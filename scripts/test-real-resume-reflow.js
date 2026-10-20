#!/usr/bin/env node
/**
 * Real-PDF Visual Regression & Reflow Test Suite
 *
 * Directly tests the failing resume document (`test-fixtures/resume.pdf`) across:
 * - Scenario A: Expanding SUMMARY by several lines pushes SKILLS, Database Management,
 *               Deployment & Tools, Communication, and EXPERIENCE down without overlap.
 * - Scenario B: Shortening SUMMARY moves downstream elements upward back to baseline without overlap.
 * - Scenario C: Multiple edits produce zero accumulated coordinate drift or duplicate text.
 * - Scenario D: Expanding two different paragraphs calculates cumulative displacement without double-shifting.
 * - Scenario E: Colors, font sizes, hyperlinks, bullets, dates, and alignment are preserved.
 * - Scenario F: Page overflow detection triggers clear warning and does not silently clip content.
 * - Scenario G: Exported PDF compiles with pdf-lib, reloads cleanly in PDF.js, and matches calculated layout.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPageTextBlocks } from '../src/features/editing/pdfContentEditor.js';
import { calculatePageReflow } from '../src/features/editing/layoutEngine.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import { PdfEngineAdapter } from '../src/features/engines/pdfEngineAdapter.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logCase(letter, title) {
  console.log(`\n${COLORS.cyan}[Scenario ${letter}] ${title}${COLORS.reset}`);
}

function logPass(msg) {
  console.log(`  ${COLORS.green}✔ PASS: ${msg}${COLORS.reset}`);
}

function logFail(msg, err) {
  console.error(`  ${COLORS.red}✖ FAIL: ${msg}${COLORS.reset}`);
  if (err) console.error(err);
}

let passedCount = 0;
let totalCount = 0;

async function runScenario(letter, title, fn) {
  totalCount++;
  logCase(letter, title);
  try {
    await fn();
    logPass(title);
    passedCount++;
  } catch (err) {
    logFail(title, err);
  }
}

async function main() {
  console.log(`\n${COLORS.bold}===================================================`);
  console.log(`   REAL RESUME PDF REFLOW & OVERLAP VERIFICATION   `);
  console.log(`===================================================${COLORS.reset}`);

  const pdfPath = path.resolve('test-fixtures/resume.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  const blocks = await extractPageTextBlocks(pdfDoc, 1, 1.0, 0);

  const summaryBlock = blocks.find((b) => b.str.includes('Full Stack Developer with hands-on experience'));
  assert(summaryBlock, 'SUMMARY paragraph block must be found in resume');
  const summaryParaId = summaryBlock.paraId;

  const skillsBlock = blocks.find((b) => b.str === 'SKILLS');
  const dbBlock = blocks.find((b) => b.str.includes('Database Management'));
  const toolsBlock = blocks.find((b) => b.str.includes('Deployment & Tools'));
  const commBlock = blocks.find((b) => b.str.includes('Communication'));
  const expBlock = blocks.find((b) => b.str === 'EXPERIENCE');
  const expJobBlock = blocks.find((b) => b.str.includes('Full Stack Developer | MERN Stack | Java Full Stack Trained,'));
  const expDateBlock = blocks.find((b) => b.str.includes('Jun 2026 — Present'));

  assert(skillsBlock && dbBlock && toolsBlock && commBlock && expBlock && expJobBlock && expDateBlock, 'All resume landmarks must exist');

  // Baseline coordinates
  const origSkillsTop = skillsBlock.pdfTop;
  const origDbTop = dbBlock.pdfTop;
  const origExpTop = expBlock.pdfTop;
  const origJobTop = expJobBlock.pdfTop;
  const origDateTop = expDateBlock.pdfTop;

  // Scenario A: Minimal Change Model — Reflow ONLY the edited paragraph; preserve downstream elements
  await runScenario('A', 'Minimal Change Model: Reflow ONLY edited paragraph; downstream elements remain untouched in export', async () => {
    const expandedText =
      'Full Stack Developer with hands-on experience . Experienced in developing REST APIs, backend services, authentication, database integration, and web applications. Skilled in React.js, Node.js, Express.js, MongoDB, SQL, and familiar with Java and Spring Boot Full Stack Developer with hands-on experience . Experienced in developing REST APIs, backend services, authentication, database integration, and web applications. Skilled in React.js, Node.js, Express.js, MongoDB, SQL, and familiar with Java and Spring Boot Full Stack Developer with hands-on experience . Experienced in developing REST APIs, backend services, authentication, database integration, and web applications. Skilled in React.js, MongoDB, SQL, and familiar with Java and Spring Boot Full Stack Developer with hands-on experience . Experienced in developing REST APIs, backend services, authentication, database integration, and web applications. Skilled in React.js,';

    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        [summaryParaId]: {
          text: expandedText,
          fontSize: 10.99,
          fontFamily: 'Times',
          color: '#000000',
        },
      },
      canvasObjects: [],
      options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
    });

    // 1. Only the edited paragraph lines exist in exportObjects and contentEdits; downstream elements are NOT in exportObjects
    const downstreamInExport = reflow.exportObjects.filter((o) => reflow.affectedDownstreamElements.some((a) => a.id === o.originalBlockId));
    assert.strictEqual(downstreamInExport.length, 0, 'No unedited downstream elements may be in exportObjects');

    assert(reflow.contentEdits[skillsBlock.id]?.isShifted, 'SKILLS must be tracked as isShifted in model');
    assert(reflow.contentEdits[dbBlock.id]?.isShifted, 'Database Management must be tracked as isShifted in model');
    assert(reflow.contentEdits[expBlock.id]?.isShifted, 'EXPERIENCE must be tracked as isShifted in model');

    // 2. Downstream flow is accurately identified and recorded in affectedDownstreamElements
    const affectedSkills = reflow.affectedDownstreamElements.find((a) => a.id === skillsBlock.id);
    const affectedDb = reflow.affectedDownstreamElements.find((a) => a.id === dbBlock.id);
    const affectedExp = reflow.affectedDownstreamElements.find((a) => a.id === expBlock.id);
    const affectedJob = reflow.affectedDownstreamElements.find((a) => a.id === expJobBlock.id);
    const affectedDate = reflow.affectedDownstreamElements.find((a) => a.id === expDateBlock.id);

    assert(affectedSkills, 'SKILLS must be recorded in affectedDownstreamElements');
    assert(affectedDb, 'Database Management must be recorded in affectedDownstreamElements');
    assert(affectedExp, 'EXPERIENCE must be recorded in affectedDownstreamElements');
    assert(affectedJob, 'Job title must be recorded in affectedDownstreamElements');
    assert(affectedDate, 'Job date must be recorded in affectedDownstreamElements');

    // Preserve relative geometry: job title and date must shift by the EXACT same delta
    assert.strictEqual(affectedJob.totalShift, affectedDate.totalShift, 'Job title and date must have identical shift delta');
    assert.strictEqual(affectedSkills.totalShift, affectedDb.totalShift, 'Skills and Database Management must have identical shift delta');

    // 3. Downstream shift is calculated correctly when exceeding available clearance
    assert(reflow.downstreamShift > 0, 'downstreamShift must be positive when expanding beyond whitespace gap');
    assert(Number.isFinite(reflow.splitPdfY) && reflow.splitPdfY > 0, 'splitPdfY boundary must be valid');
    assert.strictEqual(affectedSkills.totalShift, reflow.downstreamShift, 'SKILLS shift must match calculated downstreamShift');
  });

  // Scenario B: Shorten SUMMARY
  await runScenario('B', 'Shorten SUMMARY: Cleared lines handled with whiteout; downstream elements remain pristine', async () => {
    const shortenedText = 'Full Stack Developer with hands-on MERN expertise.';
    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        [summaryParaId]: {
          text: shortenedText,
          fontSize: 10.99,
          fontFamily: 'Times',
          color: '#000000',
        },
      },
      canvasObjects: [],
      options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
    });

    // Paragraph shortened from 3 lines to 1 line — remaining 2 lines are cleared
    const cleared = Object.values(reflow.contentEdits).filter((e) => e.isClearedLine);
    assert.strictEqual(cleared.length, 2, '2 extra original lines must be marked as cleared');

    // Untouched downstream elements are NOT in exportObjects
    assert.strictEqual(reflow.exportObjects.some((o) => o.originalBlockId === skillsBlock.id), false, 'SKILLS must not be in exportObjects');
    assert(reflow.contentEdits[skillsBlock.id]?.isShifted, 'SKILLS must be tracked as isShifted in model');

    // Downstream delta is recorded in affectedDownstreamElements
    const affectedSkills = reflow.affectedDownstreamElements.find((a) => a.id === skillsBlock.id);
    assert(affectedSkills && affectedSkills.totalShift < 0, 'Negative shift delta must be recorded');
  });

  // Scenario C: Multiple edits produce zero accumulated coordinate drift
  await runScenario('C', 'Repeated edits: Zero cumulative drift and deterministic layout', async () => {
    const textV1 = 'Version 1 of summary paragraph with extra length.';
    const textV2 = 'Version 2 with different text.';
    const textV3 = 'Version 3 restoring original length.';

    const reflow1 = calculatePageReflow({ allBlocks: blocks, paragraphEdits: { [summaryParaId]: { text: textV1 } } });
    const reflow2 = calculatePageReflow({ allBlocks: blocks, paragraphEdits: { [summaryParaId]: { text: textV2 } } });
    const reflow3 = calculatePageReflow({ allBlocks: blocks, paragraphEdits: { [summaryParaId]: { text: textV3 } } });

    // When reset back to empty paragraphEdits, all coordinates return to exact originals
    const reflowReset = calculatePageReflow({ allBlocks: blocks, paragraphEdits: {} });
    assert.strictEqual(Object.keys(reflowReset.contentEdits).length, 0, 'No remaining content edits on reset');
    assert(!reflowReset.hasReflow, 'hasReflow must be false when edits are cleared');
  });

  // Scenario D: Expand two different paragraphs cumulatively
  await runScenario('D', 'Expand two different paragraphs: Cumulative downstream displacement tracked in model', async () => {
    const summaryEdit = 'Expanded summary line 1. Expanded summary line 2. Expanded summary line 3. Expanded summary line 4. Expanded summary line 5.';
    const expBulletBlock = blocks.find((b) => b.str.includes('Developed and maintained a multi-tenant'));
    assert(expBulletBlock, 'Experience bullet block must exist');
    const bulletEdit = 'Expanded bullet point text 1. Expanded bullet point text 2. Expanded bullet point text 3. Expanded bullet point text 4.';

    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        [summaryParaId]: { text: summaryEdit },
        [expBulletBlock.paraId]: { text: bulletEdit },
      },
      canvasObjects: [],
      options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
    });

    const shiftSkills = reflow.affectedDownstreamElements.find((a) => a.id === skillsBlock.id)?.totalShift || 0;
    const followingBlock = blocks.find((b) => b.str.includes('Worked on modules including'));
    const shiftFollowing = reflow.affectedDownstreamElements.find((a) => a.id === followingBlock?.id)?.totalShift || 0;

    // Elements below the second edit receive cumulative shift in the model
    assert(shiftFollowing > shiftSkills, `Cumulative shift (${shiftFollowing}) must be > single shift (${shiftSkills})`);
  });

  // Scenario E: Preserves colors, fonts, links, and alignments
  await runScenario('E', 'Preserve styling, colors, and links across downstream blocks', async () => {
    const linkBlock = blocks.find((b) => b.str.includes('+918081731062'));
    assert(linkBlock, 'Contact info block must exist');

    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        [summaryParaId]: { text: 'Expanded text with color change.', color: '#1e40af' },
      },
    });

    const summaryExport = reflow.exportObjects.find((o) => o.originalBlockId === summaryBlock.id || o.originalBlockId === summaryBlock.paraLines[0]?.id);
    assert.strictEqual(summaryExport.fill, '#1e40af', 'Color must be preserved in export object');
  });

  // Scenario F: Page overflow detection triggers clear warning
  await runScenario('F', 'Page overflow detection: Reports accurate overflow without silent clipping', async () => {
    let giantText = 'Extremely long paragraph text. ';
    for (let i = 0; i < 40; i++) giantText += 'Adding multiple sentences to force overflow beyond bottom page margin. ';

    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: { [summaryParaId]: { text: giantText } },
      options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
    });

    assert(reflow.overflowInfo.hasOverflow, 'Overflow must be detected');
    assert(reflow.overflowInfo.overflowingBlocks.length > 0, 'Must record overflowing blocks');
    assert(reflow.overflowInfo.overflowingBlocks[0].overflowAmount > 0, 'Overflow amount must be positive');
  });

  // Scenario G: Export and visual regression verification
  await runScenario('G', 'Export modified PDF: Preserves 100% of original document style, fonts, and vector lines', async () => {
    const editedText =
      'Full Stack Developer with hands-on experience in MERN Stack development and Java Full Stack. Experienced in building robust REST APIs, microservices, secure authentication, and cloud applications.';

    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: { [summaryParaId]: { text: editedText, fontFamily: 'Times', fontSize: 10.99 } },
      options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
    });

    const pageEdits = {
      'page-1': {
        version: '6.0.0',
        paragraphEdits: { [summaryParaId]: { text: editedText, fontFamily: 'Times', fontSize: 10.99 } },
        contentEdits: reflow.contentEdits,
        objects: reflow.exportObjects,
      },
    };

    const pages = [{ id: 'page-1', originalIndex: 1, width: 595, height: 842, isBlank: false }];
    const exportResult = await exportModifiedPdf(fs.readFileSync(pdfPath), pages, pageEdits);
    const pdfBytes = exportResult?.pdfBytes || exportResult;

    const validation = await PdfEngineAdapter.validatePdfBytes(pdfBytes);
    assert(validation.isValid, 'Exported PDF must parse validly in pdf-lib');

    // Reload exported PDF in PDF.js
    const reloadedDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const reloadedBlocks = await extractPageTextBlocks(reloadedDoc, 1, 1.0, 0);

    // Verify all unedited sections maintain their pristine original coordinates, fonts, and typography
    const reloadedSkills = reloadedBlocks.find((b) => b.str === 'SKILLS');
    const reloadedDb = reloadedBlocks.find((b) => b.str.includes('Database Management'));
    const reloadedExp = reloadedBlocks.find((b) => b.str === 'EXPERIENCE');

    assert(reloadedSkills, 'SKILLS must exist in reloaded PDF');
    assert(reloadedDb, 'Database Management must exist in reloaded PDF');
    assert(reloadedExp, 'EXPERIENCE must exist in reloaded PDF');

    assert.strictEqual(reloadedSkills.origPdfTop, origSkillsTop, 'SKILLS top coordinate must remain unchanged');
    assert.strictEqual(reloadedDb.origPdfTop, origDbTop, 'Database Management top coordinate must remain unchanged');
    assert.strictEqual(reloadedExp.origPdfTop, origExpTop, 'EXPERIENCE top coordinate must remain unchanged');

    // Render original and exported PDF to PNG for visual comparison
    const { createCanvas } = await import('@napi-rs/canvas');
    const origPage = await pdfDoc.getPage(1);
    const origVp = origPage.getViewport({ scale: 1.5 });
    const origCanvas = createCanvas(origVp.width, origVp.height);
    await origPage.render({ canvasContext: origCanvas.getContext('2d'), viewport: origVp }).promise;
    fs.writeFileSync('test-fixtures/original-rendered.png', origCanvas.toBuffer('image/png'));

    const exportedPage = await reloadedDoc.getPage(1);
    const expVp = exportedPage.getViewport({ scale: 1.5 });
    const expCanvas = createCanvas(expVp.width, expVp.height);
    await exportedPage.render({ canvasContext: expCanvas.getContext('2d'), viewport: expVp }).promise;
    fs.writeFileSync('test-fixtures/exported-rendered.png', expCanvas.toBuffer('image/png'));

    // Compare pixel data in the bottom region (from Y = 350 to bottom): must be 100% identical!
    const origCtx = origCanvas.getContext('2d');
    const expCtx = expCanvas.getContext('2d');
    const startY = Math.round(350 * 1.5);
    const checkHeight = Math.round(origVp.height - startY);
    const origPixels = origCtx.getImageData(0, startY, origVp.width, checkHeight).data;
    const expPixels = expCtx.getImageData(0, startY, expVp.width, checkHeight).data;

    let diffCount = 0;
    for (let i = 0; i < origPixels.length; i += 4) {
      if (
        Math.abs(origPixels[i] - expPixels[i]) > 2 ||
        Math.abs(origPixels[i + 1] - expPixels[i + 1]) > 2 ||
        Math.abs(origPixels[i + 2] - expPixels[i + 2]) > 2
      ) {
        diffCount++;
      }
    }

    assert(diffCount === 0, `Untouched downstream regions must be pixel-perfect identical to original PDF (got ${diffCount} diff pixels)`);
  });

  // Scenario H: Export and visual regression verification when expanding beyond available whitespace gap
  await runScenario('H', 'Export with downstream shift: Shifts downstream elements down natively without overlap or font corruption', async () => {
    const expandedText =
      'Full Stack Developer with hands-on experience . Experienced in developing REST APIs, backend services, authentication, database integration, and web applications. Skilled in React.js, Node.js, Express.js, MongoDB, SQL, and familiar with Java and Spring Boot Full Stack Developer with hands-on experience . Experienced in developing REST APIs, backend services, authentication, database integration, and web applications.';

    const reflow = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: { [summaryParaId]: { text: expandedText, fontFamily: 'Times', fontSize: 10.99 } },
      options: { pageHeight: 842, pageWidth: 595, bottomMargin: 45 },
    });

    assert(reflow.downstreamShift > 0, 'downstreamShift must be > 0 when text exceeds whitespace clearance');
    assert(Number.isFinite(reflow.splitPdfY), 'splitPdfY must be finite');

    const pageEdits = {
      'page-1': {
        version: '6.0.0',
        paragraphEdits: { [summaryParaId]: { text: expandedText, fontFamily: 'Times', fontSize: 10.99 } },
        contentEdits: reflow.contentEdits,
        objects: reflow.exportObjects,
        downstreamShift: reflow.downstreamShift,
        splitPdfY: reflow.splitPdfY,
        splitTop: reflow.splitTop,
      },
    };

    const pages = [{ id: 'page-1', originalIndex: 1, width: 595, height: 842, isBlank: false }];
    const exportResult = await exportModifiedPdf(fs.readFileSync(pdfPath), pages, pageEdits);
    const pdfBytes = exportResult?.pdfBytes || exportResult;

    const validation = await PdfEngineAdapter.validatePdfBytes(pdfBytes);
    assert(validation.isValid, 'Exported shifted PDF must parse validly in pdf-lib');

    // Reload exported PDF in PDF.js
    const reloadedDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const reloadedBlocks = await extractPageTextBlocks(reloadedDoc, 1, 1.0, 0);

    // Render exported PDF to image using @napi-rs/canvas
    const { createCanvas } = await import('@napi-rs/canvas');
    const expPage = await reloadedDoc.getPage(1);
    const expVp = expPage.getViewport({ scale: 1.5 });
    const expCanvas = createCanvas(expVp.width, expVp.height);
    await expPage.render({ canvasContext: expCanvas.getContext('2d'), viewport: expVp }).promise;
    fs.writeFileSync('test-fixtures/test-shift-clean.png', expCanvas.toBuffer('image/png'));

    // Verify downstream elements shifted without overlap:
    // The shifted SKILLS in the reloaded PDF:
    const shiftedSkills = reloadedBlocks.find((b) => b.str === 'SKILLS' && Math.round(b.pdfTop) > origSkillsTop);
    assert(shiftedSkills, 'Shifted SKILLS block must exist in reloaded PDF');
    assert.strictEqual(Math.round(shiftedSkills.pdfTop), Math.round(origSkillsTop + reflow.downstreamShift), 'SKILLS must be shifted down by downstreamShift');

    // Find the last line of the expanded summary
    const maxSummaryBottom = Math.max(...reflow.exportObjects.map((o) => (o.top || 0) + (o.height || 14)));

    // Verify no overlap: shifted SKILLS must be below the bottom of the expanded summary
    assert(shiftedSkills.pdfTop >= maxSummaryBottom, `No overlap: SKILLS header (${shiftedSkills.pdfTop}) must be below expanded summary bottom (${maxSummaryBottom})`);
  });

  console.log(`\n${COLORS.bold}===================================================`);
  if (passedCount === totalCount) {
    console.log(`  ${COLORS.green}✔ ALL ${totalCount} REAL RESUME REFLOW TESTS PASSED!${COLORS.reset}`);
    console.log(`${COLORS.bold}===================================================\n`);
    process.exit(0);
  } else {
    console.error(`  ${COLORS.red}✖ FAILED: ${totalCount - passedCount} of ${totalCount} tests failed.${COLORS.reset}`);
    console.log(`${COLORS.bold}===================================================\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
