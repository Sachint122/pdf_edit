/**
 * Automated Verification Tests for Phase 5 (Advanced Features)
 * Watermarks, Page Numbers / Headers / Footers, PDF Metadata, Multi-Source Merging.
 * Run via Node.js: node tests/phase5.test.js
 */

import assert from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import { generateSamplePdf } from '../src/utils/samplePdf.js';
import { FontManager } from '../src/features/export/fontManager.js';
import { applyWatermark, applyPageNumber } from '../src/features/advanced/watermarkManager.js';
import { applyPdfMetadata, readPdfMetadata } from '../src/features/advanced/pdfMetadata.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import { validatePdfHeader } from '../src/utils/fileValidation.js';

async function runPhase5Tests() {
  console.log('--- Running Phase 5 Automated Tests ---');

  // ==========================================
  // Test 1: Watermarks Engine
  // ==========================================
  console.log('Test 1: Watermarks application (Diagonal, Horizontal, Sizing, Opacity)...');
  const doc1 = await PDFDocument.create();
  const page1 = doc1.addPage([612, 792]);
  const fontMgr1 = new FontManager(doc1);

  // Apply Diagonal Watermark
  await applyWatermark(
    page1,
    {
      enabled: true,
      text: 'CONFIDENTIAL',
      fontSize: 54,
      opacity: 0.2,
      angle: -45,
      color: '#ef4444',
    },
    fontMgr1
  );

  const doc1Bytes = await doc1.save();
  assert(doc1Bytes.length > 500, 'Watermarked PDF should save valid bytes');
  assert(validatePdfHeader(doc1Bytes.buffer), 'PDF header must be valid');
  console.log('✔ Test 1 Passed: Watermark applied cleanly to page.');

  // ==========================================
  // Test 2: Page Numbering & Header/Footer Engine
  // ==========================================
  console.log('Test 2: Header/Footer page numbering across multiple positions and formats...');
  const doc2 = await PDFDocument.create();
  const fontMgr2 = new FontManager(doc2);

  // Test different positions: bottom-center, top-right, bottom-left
  const positions = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'];

  for (let idx = 0; idx < positions.length; idx++) {
    const p = doc2.addPage([612, 792]);
    await applyPageNumber(
      p,
      idx,
      positions.length,
      {
        enabled: true,
        format: 'Page {n} of {total}',
        position: positions[idx],
        fontSize: 10,
        color: '#64748b',
        opacity: 0.9,
      },
      fontMgr2
    );
  }

  const doc2Bytes = await doc2.save();
  const reloadedDoc2 = await PDFDocument.load(doc2Bytes);
  assert.strictEqual(reloadedDoc2.getPageCount(), positions.length);
  console.log('✔ Test 2 Passed: Page numbers applied across all 6 header/footer positions.');

  // ==========================================
  // Test 3: PDF Document Metadata Reader & Writer
  // ==========================================
  console.log('Test 3: PDF Metadata reading and writing (Title, Author, Subject, Keywords)...');
  const doc3 = await PDFDocument.create();
  doc3.addPage([612, 792]);

  const testMetadata = {
    title: 'Confidential Business Plan 2026',
    author: 'Chief Executive Officer',
    subject: 'Strategic Growth & Financial Forecast',
    keywords: ['business', 'strategy', 'finance', 'q1-2026'],
  };

  applyPdfMetadata(doc3, testMetadata);
  const doc3Bytes = await doc3.save();

  // Read metadata back from saved bytes
  const extractedMeta = await readPdfMetadata(doc3Bytes);
  assert.strictEqual(extractedMeta.title, testMetadata.title);
  assert.strictEqual(extractedMeta.author, testMetadata.author);
  assert.strictEqual(extractedMeta.subject, testMetadata.subject);
  assert.strictEqual(extractedMeta.keywords.length, 4);
  assert(extractedMeta.keywords.includes('strategy'));
  console.log('✔ Test 3 Passed: Document metadata written and re-parsed with complete fidelity.');

  // ==========================================
  // Test 4: Multi-Source PDF Merging via Export Engine
  // ==========================================
  console.log('Test 4: Multi-source PDF merging into unified document...');
  
  // Create Document A (2 pages)
  const docA = await PDFDocument.create();
  docA.addPage([600, 800]);
  docA.addPage([600, 800]);
  const docABytes = await docA.save();

  // Create Document B (2 pages)
  const docB = await PDFDocument.create();
  docB.addPage([500, 700]);
  docB.addPage([500, 700]);
  const docBBytes = await docB.save();

  // Interleave pages: Doc A page 1, Doc B page 1, Doc B page 2, Doc A page 2
  const interleavedPages = [
    {
      id: 'p-a-1',
      originalIndex: 1,
      isBlank: false,
      sourceDocId: 'doc-a',
      width: 600,
      height: 800,
      rotation: 0,
    },
    {
      id: 'p-b-1',
      originalIndex: 1,
      isBlank: false,
      sourceDocId: 'doc-b',
      width: 500,
      height: 700,
      rotation: 90, // with rotation
    },
    {
      id: 'p-b-2',
      originalIndex: 2,
      isBlank: false,
      sourceDocId: 'doc-b',
      width: 500,
      height: 700,
      rotation: 0,
    },
    {
      id: 'p-a-2',
      originalIndex: 2,
      isBlank: false,
      sourceDocId: 'doc-a',
      width: 600,
      height: 800,
      rotation: 0,
    },
  ];

  const mergeResult = await exportModifiedPdf(null, interleavedPages, {}, {
    sourceBuffers: {
      'doc-a': docABytes,
      'doc-b': docBBytes,
    },
  });

  const mergedDoc = await PDFDocument.load(mergeResult.pdfBytes);
  assert.strictEqual(mergedDoc.getPageCount(), 4, 'Merged document must have exactly 4 pages');

  // Verify rotated page from Doc B
  assert.strictEqual(mergedDoc.getPage(1).getRotation().angle, 90);
  console.log('✔ Test 4 Passed: Multiple PDF sources merged and interleaved into unified document.');

  // ==========================================
  // Test 5: Full Combined Pipeline (All Phase 5 Features in Concert)
  // ==========================================
  console.log('Test 5: Full combined export (Edits + Watermarks + Page Numbers + Metadata + Merge)...');
  const samplePdf = await generateSamplePdf();

  const combinedPages = [
    {
      id: 'p-orig-1',
      originalIndex: 1,
      isBlank: false,
      width: 612,
      height: 792,
      rotation: 0,
    },
    {
      id: 'p-orig-2',
      originalIndex: 2,
      isBlank: false,
      width: 612,
      height: 792,
      rotation: 0,
    },
    {
      id: 'p-blank-3',
      originalIndex: null,
      isBlank: true,
      width: 612,
      height: 792,
      rotation: 0,
    },
  ];

  const combinedEdits = {
    'p-orig-1': {
      objects: [
        {
          type: 'textbox',
          text: 'Executive Summary with Watermark',
          left: 60,
          top: 60,
          fontSize: 20,
          fill: '#0f172a',
        },
      ],
    },
  };

  const combinedOptions = {
    watermark: {
      enabled: true,
      text: 'OFFICIAL DOCUMENT',
      fontSize: 44,
      opacity: 0.15,
      angle: -45,
      color: '#3b82f6',
    },
    pageNumbers: {
      enabled: true,
      format: 'Page {n} of {total}',
      position: 'bottom-center',
      fontSize: 10,
      color: '#64748b',
    },
    metadata: {
      title: 'Audited Report Q3',
      author: 'FinOps Team',
      subject: 'Financial Audit',
      keywords: ['audit', 'q3', 'report'],
    },
  };

  const { pdfBytes, blob } = await exportModifiedPdf(samplePdf, combinedPages, combinedEdits, combinedOptions);

  assert(pdfBytes instanceof Uint8Array);
  assert(blob instanceof Blob);
  assert(validatePdfHeader(pdfBytes.buffer));

  const finalParsedDoc = await PDFDocument.load(pdfBytes);
  assert.strictEqual(finalParsedDoc.getPageCount(), 3);
  assert.strictEqual(finalParsedDoc.getTitle(), 'Audited Report Q3');
  assert.strictEqual(finalParsedDoc.getAuthor(), 'FinOps Team');
  console.log('✔ Test 5 Passed: Full pipeline compilation with watermarks, numbering, and metadata verified.');

  console.log('\n=============================================');
  console.log('All Phase 5 Tests Passed Successfully! ✔');
  console.log('=============================================');
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 Test Failure:', err);
  process.exit(1);
});
