/**
 * Automated Verification Tests for Phase 1 (PDF Foundation)
 * Run via Node.js: node tests/phase1.test.js
 */

import assert from 'node:assert';
import { validatePdfFile, validatePdfHeader } from '../src/utils/fileValidation.js';
import { generateSamplePdf } from '../src/utils/samplePdf.js';
import { canvasToPdfPoint, pdfPointToCanvas } from '../src/utils/coordinateTransform.js';
import { PDFDocument } from 'pdf-lib';

async function runTests() {
  console.log('--- Running Phase 1 Automated Tests ---');

  // Test 1: File Validation
  console.log('Test 1: File validation tests...');
  const nullResult = validatePdfFile(null);
  assert.strictEqual(nullResult.valid, false, 'Null file should be invalid');

  const emptyFile = { name: 'empty.pdf', size: 0, type: 'application/pdf' };
  const emptyResult = validatePdfFile(emptyFile);
  assert.strictEqual(emptyResult.valid, false, '0-byte file should be invalid');
  assert.match(emptyResult.error, /empty/i);

  const oversizedFile = { name: 'huge.pdf', size: 55 * 1024 * 1024, type: 'application/pdf' };
  const oversizedResult = validatePdfFile(oversizedFile);
  assert.strictEqual(oversizedResult.valid, false, 'File >50MB should be invalid');
  assert.match(oversizedResult.error, /exceeds/i);

  const invalidTypeFile = { name: 'photo.jpg', size: 1024, type: 'image/jpeg' };
  const invalidTypeResult = validatePdfFile(invalidTypeFile);
  assert.strictEqual(invalidTypeResult.valid, false, 'Non-PDF file should be invalid');

  const validFile = { name: 'contract.pdf', size: 1024 * 100, type: 'application/pdf' };
  const validResult = validatePdfFile(validFile);
  assert.strictEqual(validResult.valid, true, 'Valid PDF file should pass');
  console.log('✔ Test 1 Passed: File validation works reliably.');

  // Test 2: Binary Header Validation
  console.log('Test 2: PDF Binary Header (%PDF-) validation...');
  const invalidBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
  assert.strictEqual(validatePdfHeader(invalidBuffer), false, 'Non-PDF header rejected');

  const validHeaderBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer; // %PDF-1.7
  assert.strictEqual(validatePdfHeader(validHeaderBuffer), true, 'Valid %PDF- header accepted');
  console.log('✔ Test 2 Passed: Binary header validation works reliably.');

  // Test 3: Sample PDF Generation & Multi-Page Verification
  console.log('Test 3: Sample PDF generation in memory...');
  const sampleBuffer = await generateSamplePdf();
  assert(sampleBuffer instanceof ArrayBuffer, 'Generated sample must be an ArrayBuffer');
  assert(sampleBuffer.byteLength > 0, 'Generated sample must not be empty');
  assert.strictEqual(validatePdfHeader(sampleBuffer), true, 'Sample PDF must have valid %PDF- header');

  const loadedDoc = await PDFDocument.load(sampleBuffer);
  const pageCount = loadedDoc.getPageCount();
  assert.strictEqual(pageCount, 3, `Expected 3 pages in sample PDF, got ${pageCount}`);
  console.log(`✔ Test 3 Passed: Sample PDF generated cleanly with ${pageCount} pages (${sampleBuffer.byteLength} bytes).`);

  // Test 4: Coordinate Transformation
  console.log('Test 4: Coordinate transformation (Screen Pixels <-> PDF Points)...');
  const pageHeightPt = 792; // 11 inches * 72 pt
  const scale = 1.5;

  // At top-left in screen pixels (x=0, y=0)
  const pdfPointTop = canvasToPdfPoint({ x: 0, y: 0, width: 150, height: 75 }, scale, pageHeightPt);
  assert.strictEqual(pdfPointTop.x, 0);
  assert.strictEqual(pdfPointTop.width, 100);
  assert.strictEqual(pdfPointTop.height, 50);
  assert.strictEqual(pdfPointTop.y, 742); // 792 - (0/1.5) - 50 = 742

  // Roundtrip back to canvas
  const canvasRoundtrip = pdfPointToCanvas(pdfPointTop, scale, pageHeightPt);
  assert.strictEqual(Math.round(canvasRoundtrip.x), 0);
  assert.strictEqual(Math.round(canvasRoundtrip.y), 0);
  assert.strictEqual(Math.round(canvasRoundtrip.width), 150);
  assert.strictEqual(Math.round(canvasRoundtrip.height), 75);
  console.log('✔ Test 4 Passed: Bidirectional coordinate transform matches accurately.');

  console.log('\n--- All Phase 1 Automated Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
