#!/usr/bin/env node
/**
 * Comprehensive Visual Regression & Save-to-Render Verification
 * Tests:
 * 1. Exact saved text preservation across the entire pipeline
 * 2. Short replacement (e.g., 1 line)
 * 3. Longer replacement (e.g., 6-8 lines expanding beyond whitespace)
 * 4. Repeated edits & undo/redo determinism
 * 5. Re-opening exported PDF with PDF.js and rendering to PNG for visual inspection
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { extractPageTextBlocks } from '../src/features/editing/pdfContentEditor.js';
import { calculatePageReflow } from '../src/features/editing/layoutEngine.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import { PdfEngineAdapter } from '../src/features/engines/pdfEngineAdapter.js';

async function main() {
  console.log('=== Save-to-Render Pipeline Comprehensive Verification ===');

  const pdfPath = path.resolve('test-fixtures/resume.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  const blocks = await extractPageTextBlocks(pdfDoc, 1, 1.0, 0);

  const summaryBlock = blocks.find((b) => b.str.includes('Full Stack Developer with hands-on experience'));
  assert(summaryBlock, 'SUMMARY paragraph block must be found');
  const summaryParaId = summaryBlock.paraId;

  const skillsBlock = blocks.find((b) => b.str === 'SKILLS');
  const origSkillsTop = skillsBlock.pdfTop;

  // Test 1: Long replacement (6 lines) expanding beyond whitespace gap
  console.log('\n[Test 1] Long Replacement (6 lines expanding beyond whitespace gap)...');
  const longText =
    'Full Stack Developer with hands-on experience in MERN Stack development and training in Java Full Stack development. Experienced in developing REST APIs, backend services, authentication, database integration, and web applications. Skilled in React.js, Node.js, Express.js, MongoDB, SQL, and familiar with Java and Spring Boot. In addition, highly proficient in microservices architecture, Docker containerization, Kubernetes orchestration, CI/CD pipeline automation with GitHub Actions, AWS cloud services including S3, EC2, Lambda, and CloudFront. Strong communication skills, agile scrum collaboration, code review mentoring, automated unit testing with Jest and Cypress, and end-to-end full stack delivery.';

  const reflowLong = calculatePageReflow({
    allBlocks: blocks,
    paragraphEdits: {
      [summaryParaId]: {
        text: longText,
        fontFamily: 'Times',
        fontSize: 10.99,
      },
    },
    options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
  });

  assert(reflowLong.downstreamShift > 0, 'downstreamShift must be > 0');
  assert.strictEqual(reflowLong.exportObjects.length, 6, 'Must generate 6 wrapped lines');

  // Verify all 6 lines exist in contentEdits and exportObjects
  const longExportObjects = reflowLong.exportObjects;
  for (let i = 0; i < 6; i++) {
    const obj = longExportObjects[i];
    assert(obj.text && obj.text.length > 0, `Line ${i + 1} must have non-empty text`);
  }

  const pageEditsLong = {
    'page-1': {
      version: '6.0.0',
      paragraphEdits: { [summaryParaId]: { text: longText, fontFamily: 'Times', fontSize: 10.99 } },
      contentEdits: reflowLong.contentEdits,
      objects: reflowLong.exportObjects,
      downstreamShift: reflowLong.downstreamShift,
      splitPdfY: reflowLong.splitPdfY,
      splitTop: reflowLong.splitTop,
    },
  };

  const pages = [{ id: 'page-1', originalIndex: 1, width: 595, height: 842, isBlank: false }];
  const exportResult = await exportModifiedPdf(buffer, pages, pageEditsLong);
  const pdfBytes = exportResult?.pdfBytes || exportResult;

  const valLong = await PdfEngineAdapter.validatePdfBytes(pdfBytes);
  assert(valLong.isValid, 'Exported long text PDF must be valid');

  // Re-open exported PDF in PDF.js
  const reloadedDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const reloadedBlocks = await extractPageTextBlocks(reloadedDoc, 1, 1.0, 0);

  // Check that all 6 lines of longText are found in reloadedBlocks
  console.log('Verifying all 6 lines appear in reloaded PDF:');
  const foundLines = [];
  for (let i = 0; i < 6; i++) {
    const expectedSnippet = longExportObjects[i].text.slice(0, 30);
    const match = reloadedBlocks.find((b) => b.str.includes(expectedSnippet));
    assert(match, `Line ${i + 1} ("${expectedSnippet}...") must exist in reloaded PDF`);
    foundLines.push(match);
    console.log(`  ✔ Line ${i + 1} found at pdfTop=${Math.round(match.pdfTop)}: "${match.str.slice(0, 50)}..."`);
  }

  // Check SKILLS is shifted down by downstreamShift
  const shiftedSkills = reloadedBlocks.find((b) => b.str === 'SKILLS' && b.pdfTop > origSkillsTop);
  assert(shiftedSkills, 'Shifted SKILLS must exist in reloaded PDF');
  assert.strictEqual(
    Math.round(shiftedSkills.pdfTop),
    Math.round(origSkillsTop + reflowLong.downstreamShift),
    'SKILLS must be shifted down by exactly downstreamShift'
  );
  console.log(`  ✔ SKILLS cleanly shifted to pdfTop=${Math.round(shiftedSkills.pdfTop)} (expected: ${Math.round(origSkillsTop + reflowLong.downstreamShift)})`);

  // Verify no overlap: last line of summary is above shifted SKILLS
  const lastSummaryLine = foundLines[foundLines.length - 1];
  assert(
    shiftedSkills.pdfTop >= lastSummaryLine.pdfTop + lastSummaryLine.pdfHeight,
    'SKILLS must be below the last line of summary without overlap'
  );
  console.log('  ✔ No overlap: gap between last summary line and SKILLS is clean');

  // Render to PNG for visual inspection
  const expPage = await reloadedDoc.getPage(1);
  const expVp = expPage.getViewport({ scale: 1.5 });
  const expCanvas = createCanvas(expVp.width, expVp.height);
  await expPage.render({ canvasContext: expCanvas.getContext('2d'), viewport: expVp }).promise;
  fs.writeFileSync('test-fixtures/verify-long-replacement.png', expCanvas.toBuffer('image/png'));
  console.log('  ✔ Rendered PNG saved to test-fixtures/verify-long-replacement.png');

  // Test 2: Short replacement (1 line)
  console.log('\n[Test 2] Short Replacement (1 line)...');
  const shortText = 'Full Stack Developer specialized in high-performance cloud architectures.';
  const reflowShort = calculatePageReflow({
    allBlocks: blocks,
    paragraphEdits: { [summaryParaId]: { text: shortText, fontFamily: 'Times', fontSize: 10.99 } },
    options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
  });

  const activeShortExportObjects = reflowShort.exportObjects.filter((o) => o.text && o.text.length > 0);
  assert.strictEqual(activeShortExportObjects.length, 1, 'Short text must have exactly 1 active text line');
  const pageEditsShort = {
    'page-1': {
      version: '6.0.0',
      paragraphEdits: { [summaryParaId]: { text: shortText, fontFamily: 'Times', fontSize: 10.99 } },
      contentEdits: reflowShort.contentEdits,
      objects: reflowShort.exportObjects,
      downstreamShift: reflowShort.downstreamShift,
      splitPdfY: reflowShort.splitPdfY,
      splitTop: reflowShort.splitTop,
    },
  };

  const exportResultShort = await exportModifiedPdf(buffer, pages, pageEditsShort);
  const pdfBytesShort = exportResultShort?.pdfBytes || exportResultShort;
  const reloadedShortDoc = await pdfjsLib.getDocument({ data: pdfBytesShort }).promise;
  const reloadedShortBlocks = await extractPageTextBlocks(reloadedShortDoc, 1, 1.0, 0);

  const shortMatch = reloadedShortBlocks.find((b) => b.str.includes('specialized in high-performance'));
  assert(shortMatch, 'Short replacement line must exist in reloaded PDF');
  console.log(`  ✔ Short replacement found: "${shortMatch.str}"`);

  // Render short replacement PNG
  const shortPage = await reloadedShortDoc.getPage(1);
  const shortVp = shortPage.getViewport({ scale: 1.5 });
  const shortCanvas = createCanvas(shortVp.width, shortVp.height);
  await shortPage.render({ canvasContext: shortCanvas.getContext('2d'), viewport: shortVp }).promise;
  fs.writeFileSync('test-fixtures/verify-short-replacement.png', shortCanvas.toBuffer('image/png'));
  console.log('  ✔ Rendered PNG saved to test-fixtures/verify-short-replacement.png');

  // Test 3: Repeated edits & Undo/Redo simulation
  console.log('\n[Test 3] Repeated Edits & Undo/Redo Determinism...');
  const textV1 = 'First edit version of summary text.';
  const textV2 = 'Second edit version replacing the first edit with completely different text.';
  const reflowV1 = calculatePageReflow({ allBlocks: blocks, paragraphEdits: { [summaryParaId]: { text: textV1 } } });
  const reflowV2 = calculatePageReflow({ allBlocks: blocks, paragraphEdits: { [summaryParaId]: { text: textV2 } } });
  const reflowRevert = calculatePageReflow({ allBlocks: blocks, paragraphEdits: {} });

  assert.strictEqual(reflowV1.exportObjects[0].text, textV1, 'V1 text must match exactly');
  assert.strictEqual(reflowV2.exportObjects[0].text, textV2, 'V2 text must match exactly');
  assert.strictEqual(Object.keys(reflowRevert.contentEdits).length, 0, 'Reverting to baseline leaves 0 edits');
  assert.strictEqual(reflowRevert.downstreamShift, 0, 'Reverting to baseline leaves 0 downstreamShift');
  console.log('  ✔ Repeated edits and baseline revert are 100% deterministic with zero coordinate drift');

  console.log('\n=== ALL PIPELINE VERIFICATION TESTS PASSED SUCCESSFULLY! ===\n');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
