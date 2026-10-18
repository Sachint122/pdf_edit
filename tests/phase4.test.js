/**
 * Automated Verification Tests for Phase 4 (Export Engine)
 * Run via Node.js: node tests/phase4.test.js
 */

import assert from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import { generateSamplePdf } from '../src/utils/samplePdf.js';
import { toPdfLibRgb, parseColorToRgb } from '../src/features/export/colorParser.js';
import { FontManager } from '../src/features/export/fontManager.js';
import { exportModifiedPdf, dataUrlToUint8Array } from '../src/features/export/exportPdf.js';
import { validatePdfHeader } from '../src/utils/fileValidation.js';

async function runPhase4Tests() {
  console.log('--- Running Phase 4 Automated Tests ---');

  // ==========================================
  // Test 1: Color Parser (Hex, RGB, RGBA)
  // ==========================================
  console.log('Test 1: Color Parser (Hex, RGB, RGBA, Opacity)...');
  
  // Black & White
  const black = parseColorToRgb('#000000');
  assert.strictEqual(black.r, 0);
  assert.strictEqual(black.g, 0);
  assert.strictEqual(black.b, 0);
  assert.strictEqual(black.a, 1);

  const white = parseColorToRgb('#ffffff');
  assert.strictEqual(white.r, 1);
  assert.strictEqual(white.g, 1);
  assert.strictEqual(white.b, 1);
  assert.strictEqual(white.a, 1);

  // Hex with alpha
  const hexWithAlpha = parseColorToRgb('#ff000080');
  assert.strictEqual(hexWithAlpha.r, 1);
  assert.strictEqual(hexWithAlpha.g, 0);
  assert.strictEqual(hexWithAlpha.b, 0);
  assert(Math.abs(hexWithAlpha.a - 0.5) < 0.02, 'Alpha should be ~0.5');

  // RGBA string
  const rgba = parseColorToRgb('rgba(59, 130, 246, 0.75)');
  assert(Math.abs(rgba.r - 59 / 255) < 0.01);
  assert(Math.abs(rgba.g - 130 / 255) < 0.01);
  assert(Math.abs(rgba.b - 246 / 255) < 0.01);
  assert.strictEqual(rgba.a, 0.75);

  // toPdfLibRgb returns a valid pdf-lib RGB color object
  const pdfColor = toPdfLibRgb('#3b82f6');
  assert(pdfColor, 'Should return pdf-lib RGB');
  assert.strictEqual(pdfColor.type, 'RGB');
  assert(Math.abs(pdfColor.red - 59 / 255) < 0.01);
  assert(Math.abs(pdfColor.green - 130 / 255) < 0.01);
  assert(Math.abs(pdfColor.blue - 246 / 255) < 0.01);

  // Null on transparent
  assert.strictEqual(toPdfLibRgb('transparent'), null);
  console.log('✔ Test 1 Passed: Color parser correctly converts CSS colors to pdf-lib components.');

  // ==========================================
  // Test 2: Font Manager & Standard Fonts
  // ==========================================
  console.log('Test 2: FontManager embedding standard PDF fonts...');
  const testDoc = await PDFDocument.create();
  const fontMgr = new FontManager(testDoc);

  const helvetica = await fontMgr.getFont('Helvetica', 'normal', 'normal');
  assert(helvetica, 'Helvetica font should be embedded');

  const helveticaBold = await fontMgr.getFont('Helvetica', 'bold', 'normal');
  assert(helveticaBold, 'Helvetica-Bold font should be embedded');
  assert.notStrictEqual(helvetica, helveticaBold, 'Different styles should produce distinct font instances');

  const timesItalic = await fontMgr.getFont('Times New Roman', 'normal', 'italic');
  assert(timesItalic, 'Times-Italic font should be embedded');

  const courier = await fontMgr.getFont('Courier New', 'normal', 'normal');
  assert(courier, 'Courier font should be embedded');

  // Cache test: requesting same font should return cached instance
  const helveticaCached = await fontMgr.getFont('Helvetica', 'normal', 'normal');
  assert.strictEqual(helvetica, helveticaCached, 'FontManager should return cached font');
  console.log('✔ Test 2 Passed: FontManager embeds standard fonts and caches instances correctly.');

  // ==========================================
  // Test 3: Data URL to Uint8Array Conversion
  // ==========================================
  console.log('Test 3: DataURL to Uint8Array utility...');
  // 1x1 transparent PNG data URL
  const samplePngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBytes = dataUrlToUint8Array(samplePngDataUrl);
  assert(pngBytes instanceof Uint8Array, 'Output must be a Uint8Array');
  assert(pngBytes.length > 0, 'Bytes must be non-empty');
  // PNG signature header check: 0x89, 'P', 'N', 'G' (137, 80, 78, 71)
  assert.strictEqual(pngBytes[0], 137);
  assert.strictEqual(pngBytes[1], 80);
  assert.strictEqual(pngBytes[2], 78);
  assert.strictEqual(pngBytes[3], 71);
  console.log('✔ Test 3 Passed: DataURL converted accurately into PNG byte buffer.');

  // ==========================================
  // Test 4: Full Export Engine Assembly
  // ==========================================
  console.log('Test 4: Full Export Engine compilation (Pages + Rotations + Vector Annotations)...');
  
  // 1. Generate a valid 3-page baseline sample PDF
  const sampleBuffer = await generateSamplePdf();
  assert(validatePdfHeader(sampleBuffer), 'Sample PDF must have valid header');

  // 2. Define pages configuration:
  // - Page 1: Kept, rotated 90° CW, with Text and Rect annotations
  // - Page 2: Deleted (omitted from pages list)
  // - Page 3: Kept, unrotated, with Circle and Line annotations
  // - Page 4: Added blank page (612x792), with Image and Path annotations
  const pages = [
    {
      id: 'page-orig-1',
      originalIndex: 1,
      isBlank: false,
      width: 612,
      height: 792,
      rotation: 90,
    },
    {
      id: 'page-orig-3',
      originalIndex: 3,
      isBlank: false,
      width: 612,
      height: 792,
      rotation: 0,
    },
    {
      id: 'page-blank-new',
      originalIndex: null,
      isBlank: true,
      width: 612,
      height: 792,
      rotation: 0,
    },
  ];

  // 3. Define Fabric vector annotations per page
  const pageEdits = {
    'page-orig-1': {
      objects: [
        {
          type: 'textbox',
          text: 'Approved Contract v2.0',
          left: 50,
          top: 50,
          fontSize: 22,
          fontFamily: 'Helvetica',
          fontWeight: 'bold',
          fontStyle: 'normal',
          fill: '#1e293b',
          opacity: 1,
        },
        {
          type: 'rect',
          left: 50,
          top: 100,
          width: 250,
          height: 80,
          fill: '#dbeafe',
          stroke: '#2563eb',
          strokeWidth: 2,
          opacity: 0.9,
        },
      ],
    },
    'page-orig-3': {
      objects: [
        {
          type: 'circle',
          left: 100,
          top: 150,
          radius: 35,
          fill: '#fef08a',
          stroke: '#ca8a04',
          strokeWidth: 2,
          opacity: 1,
        },
        {
          type: 'line',
          left: 50,
          top: 300,
          width: 300,
          height: 0,
          x1: 50,
          y1: 300,
          x2: 350,
          y2: 300,
          stroke: '#dc2626',
          strokeWidth: 3,
          opacity: 1,
        },
      ],
    },
    'page-blank-new': {
      objects: [
        {
          type: 'image',
          left: 100,
          top: 100,
          width: 80,
          height: 80,
          scaleX: 1,
          scaleY: 1,
          src: samplePngDataUrl,
          opacity: 1,
        },
        {
          type: 'path',
          path: [
            ['M', 50, 50],
            ['Q', 100, 100, 150, 50],
            ['L', 200, 150],
          ],
          stroke: '#10b981',
          strokeWidth: 3,
          fill: null,
          opacity: 1,
        },
      ],
    },
  };

  // 4. Track progress callback
  const progressLogs = [];
  const onProgress = (prog) => {
    progressLogs.push(prog);
  };

  // 5. Run export engine
  const { pdfBytes, blob } = await exportModifiedPdf(sampleBuffer, pages, pageEdits, {}, onProgress);

  assert(pdfBytes instanceof Uint8Array, 'Export must return a Uint8Array');
  assert(pdfBytes.byteLength > 1000, 'Exported PDF should be non-trivial size');
  assert(validatePdfHeader(pdfBytes.buffer), 'Exported PDF must have valid %PDF- header');
  assert(blob instanceof Blob, 'Export must return a valid Blob');
  assert.strictEqual(blob.type, 'application/pdf');
  assert(progressLogs.length > 0, 'Progress callback should be invoked during export');

  // 6. Verify exported PDF structure with PDFDocument.load
  const exportedDoc = await PDFDocument.load(pdfBytes);
  const exportedPageCount = exportedDoc.getPageCount();
  assert.strictEqual(exportedPageCount, 3, 'Exported document must have exactly 3 pages');

  // Verify Page 1 rotation was set to 90 degrees
  const page1 = exportedDoc.getPage(0);
  assert.strictEqual(page1.getRotation().angle, 90, 'Page 1 rotation should be 90°');

  // Verify Page 2 (original Page 3) rotation is 0 degrees
  const page2 = exportedDoc.getPage(1);
  assert.strictEqual(page2.getRotation().angle, 0, 'Page 2 rotation should be 0°');

  // Verify Page 3 (Blank page) dimensions
  const page3 = exportedDoc.getPage(2);
  const page3Size = page3.getSize();
  assert.strictEqual(page3Size.width, 612);
  assert.strictEqual(page3Size.height, 792);

  console.log('✔ Test 4 Passed: PDF compiled successfully with reordering, rotation, blank page, and vector annotations.');

  // ==========================================
  // Test 5: Export Guard Rails & Edge Cases
  // ==========================================
  console.log('Test 5: Edge cases and validation guards...');
  
  // Guard: Zero pages should reject
  await assert.rejects(
    async () => {
      await exportModifiedPdf(sampleBuffer, [], {});
    },
    {
      message: /Cannot export document with 0 pages/,
    },
    'Should throw when exporting 0 pages'
  );

  // Blank-only document (originalBuffer is null or empty)
  const blankOnlyPages = [
    {
      id: 'blank-1',
      originalIndex: null,
      isBlank: true,
      width: 595, // A4 width
      height: 842, // A4 height
      rotation: 0,
    },
  ];
  const blankDocResult = await exportModifiedPdf(null, blankOnlyPages, {});
  assert(blankDocResult.pdfBytes.length > 0);
  const reloadedBlankDoc = await PDFDocument.load(blankDocResult.pdfBytes);
  assert.strictEqual(reloadedBlankDoc.getPageCount(), 1);
  const a4Size = reloadedBlankDoc.getPage(0).getSize();
  assert.strictEqual(a4Size.width, 595);
  assert.strictEqual(a4Size.height, 842);
  console.log('✔ Test 5 Passed: Zero-page guard and blank-only document exports verified.');

  console.log('\n=============================================');
  console.log('All Phase 4 Tests Passed Successfully! ✔');
  console.log('=============================================');
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 Test Failure:', err);
  process.exit(1);
});
