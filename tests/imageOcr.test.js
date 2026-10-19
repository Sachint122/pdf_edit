/**
 * Automated Verification Tests for Image Text Editing and OCR
 * Run via Node.js: node tests/imageOcr.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal polyfill for Fabric.js in headless Node test environment
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      measureText: () => ({ width: 60 }),
      fillRect: () => {},
      clearRect: () => {},
      save: () => {},
      restore: () => {},
    }),
  }),
};

import { validateDocumentOrImageFile, isImageFile } from '../src/utils/fileValidation.js';
import { extractOcrTextBlocks, createOcrTextBoxes } from '../src/utils/ocr.js';
import { convertImageToEditablePdf } from '../src/utils/imageToPdf.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import { PDFDocument } from 'pdf-lib';

// Minimal canvas mock for headless testing
function createMockCanvas() {
  const objects = [];
  let active = null;
  return {
    add: (obj) => {
      objects.push(obj);
      return obj;
    },
    remove: (obj) => {
      const idx = objects.indexOf(obj);
      if (idx !== -1) objects.splice(idx, 1);
    },
    getObjects: () => [...objects],
    setActiveObject: (obj) => {
      active = obj;
    },
    getActiveObject: () => active,
    renderAll: () => {},
  };
}

async function runImageOcrTests() {
  console.log('--- Running Image Text Editing & OCR Automated Tests ---');

  // Test 1: File Validation for Documents and Images
  console.log('Test 1: File validation detects both PDFs and Images...');
  const fakePdf = { name: 'sample.pdf', size: 1024, type: 'application/pdf' };
  const fakePng = { name: 'scan.png', size: 2048, type: 'image/png' };
  const fakeJpg = { name: 'photo.jpg', size: 4096, type: 'image/jpeg' };
  const fakeWebp = { name: 'document.webp', size: 1024, type: 'image/webp' };
  const fakeTxt = { name: 'notes.txt', size: 512, type: 'text/plain' };

  assert.strictEqual(isImageFile(fakePng), true, 'PNG must be recognized as image');
  assert.strictEqual(isImageFile(fakeJpg), true, 'JPG must be recognized as image');
  assert.strictEqual(isImageFile(fakeWebp), true, 'WebP must be recognized as image');
  assert.strictEqual(isImageFile(fakePdf), false, 'PDF is not an image');

  const valPdf = validateDocumentOrImageFile(fakePdf);
  assert.strictEqual(valPdf.valid, true);
  assert.strictEqual(valPdf.isImage, false);

  const valPng = validateDocumentOrImageFile(fakePng);
  assert.strictEqual(valPng.valid, true);
  assert.strictEqual(valPng.isImage, true);

  const valTxt = validateDocumentOrImageFile(fakeTxt);
  assert.strictEqual(valTxt.valid, false);
  console.log('✔ Test 1 Passed: Images and PDFs accurately validated.');

  // Test 2: convertImageToEditablePdf with local sample image
  console.log('Test 2: Convert image to editable PDF document...');
  const testImagePath = path.join(__dirname, '..', 'docx_images', 'image1.jpeg');
  assert.ok(fs.existsSync(testImagePath), 'Test image image1.jpeg must exist');

  const imgBuffer = fs.readFileSync(testImagePath);
  const convResult = await convertImageToEditablePdf(imgBuffer, {
    fileName: 'invoice-scan.jpeg',
    skipOcr: true, // test PDF wrapping first
  });

  assert.ok(convResult.pdfBytes instanceof Uint8Array, 'Must produce Uint8Array PDF bytes');
  assert.ok(convResult.pdfBytes.byteLength > 1000, 'PDF bytes must be non-empty');
  assert.strictEqual(convResult.fileName, 'invoice-scan.pdf');
  assert.ok(convResult.width > 0 && convResult.height > 0);

  // Validate that pdf-lib can parse the created PDF
  const parsedPdf = await PDFDocument.load(convResult.pdfBytes);
  assert.strictEqual(parsedPdf.getPageCount(), 1, 'Must have exactly 1 page');
  console.log('✔ Test 2 Passed: Image wrapped into conforming PDF document.');

  // Test 3: OCR Text Block Extraction & Coordinate Mapping
  console.log('Test 3: Extract OCR Text Blocks and map coordinates...');
  const mockOcrResult = {
    success: true,
    fullText: 'Invoice #1024\nTotal: $450.00',
    lines: [
      {
        text: 'Invoice #1024',
        bbox: { x0: 40, y0: 60, x1: 180, y1: 85 },
        confidence: 96,
      },
      {
        text: 'Total: $450.00',
        bbox: { x0: 40, y0: 120, x1: 210, y1: 148 },
        confidence: 98,
      },
    ],
  };

  const pageHeight = 792;
  const blocks = extractOcrTextBlocks(mockOcrResult, pageHeight, 1.0);
  assert.strictEqual(blocks.length, 2, 'Must extract 2 text blocks');
  assert.strictEqual(blocks[0].str, 'Invoice #1024');
  assert.strictEqual(blocks[0].left, 40);
  assert.strictEqual(blocks[0].top, 60);
  assert.strictEqual(blocks[0].width, 140);
  assert.strictEqual(blocks[0].height, 25);
  assert.strictEqual(blocks[0].pdfX, 40);
  assert.strictEqual(blocks[0].pdfY, pageHeight - 85);
  assert.strictEqual(blocks[0].baseVx, 40);
  assert.ok(blocks[0].baseVy > 60);
  assert.strictEqual(blocks[0].isOcrDetected, true);
  console.log('✔ Test 3 Passed: OCR text blocks correctly mapped to screen and PDF coordinates.');

  // Test 4: createOcrTextBoxes on Fabric Canvas
  console.log('Test 4: Fabric Canvas Textbox instantiation from OCR blocks...');
  const canvas = createMockCanvas();
  const createdBoxes = createOcrTextBoxes(canvas, blocks, pageHeight);
  assert.strictEqual(createdBoxes.length, 2);
  assert.strictEqual(canvas.getObjects().length, 2);
  assert.strictEqual(createdBoxes[0].text, 'Invoice #1024');
  assert.strictEqual(createdBoxes[1].text, 'Total: $450.00');
  console.log('✔ Test 4 Passed: Fabric canvas text boxes instantiated from OCR blocks.');

  // Test 5: Full Export with Edited OCR Text and Hyperlink over Image
  console.log('Test 5: Export edited OCR text with background mask and hyperlink...');
  const basePdfBytes = convResult.pdfBytes;
  const pagesMeta = [{ id: 'page-1', originalIndex: 0, width: convResult.width, height: convResult.height, rotation: 0 }];

  // Simulate user modifying the first OCR line: "Invoice #1024" -> "Invoice #9999" with hyperlink
  const pageEdits = {
    'page-1': {
      objects: [
        {
          type: 'textbox',
          text: 'Invoice #9999',
          left: 40,
          top: 60,
          width: 140,
          height: 25,
          fontSize: 18,
          fontFamily: 'Helvetica',
          fill: '#000000',
          backgroundColor: '#ffffff',
          isPdfContentEdit: true,
          textAlign: 'left',
          linkUrl: 'https://acme.org/invoice/9999',
          linesInfo: [{
            pdfLeft: 40,
            pdfTop: 60,
            pdfX: 40,
            pdfWidth: 140,
            pdfHeight: 25,
            rawFontSize: 18,
            baseVy: 60 + 18 * 0.76,
            paraLeft: 40,
            paraRight: 180,
            paraWidth: 140,
            isLastLine: true,
          }],
        },
      ],
    },
  };

  const exportResult = await exportModifiedPdf(basePdfBytes, pagesMeta, pageEdits);
  assert.ok(exportResult.pdfBytes instanceof Uint8Array);
  assert.ok(exportResult.pdfBytes.byteLength > 1000, 'Exported PDF bytes must be non-empty');

  // Parse exported PDF to verify link annotation and structure
  const reloadedDoc = await PDFDocument.load(exportResult.pdfBytes);
  assert.strictEqual(reloadedDoc.getPageCount(), 1);
  const exportedPage = reloadedDoc.getPage(0);
  const annots = exportedPage.node.Annots();
  assert.ok(annots, 'Annots array must exist on exported page');
  assert.strictEqual(annots.size(), 1, 'Link annotation must be attached to the page');

  console.log('✔ Test 5 Passed: Edited OCR text and hyperlink exported with full fidelity.');

  // Test 6: OCR Paragraph Clustering, Reflow, and Multi-line Text Replacement
  console.log('Test 6: Multi-line OCR Paragraph Clustering & Reflow...');
  const mockParagraphOcr = {
    success: true,
    fullText: 'Experienced software engineer with deep knowledge in React,\nNode.js, and cloud native architectures across teams.\nStrong problem solving skills and agile delivery mindset.',
    lines: [
      {
        text: 'Experienced software engineer with deep knowledge in React,',
        bbox: { x0: 50, y0: 100, x1: 380, y1: 116 },
        confidence: 95,
        tesseractParaId: 'tess-para-1-1',
      },
      {
        text: 'Node.js, and cloud native architectures across teams.',
        bbox: { x0: 50, y0: 119, x1: 360, y1: 135 },
        confidence: 96,
        tesseractParaId: 'tess-para-1-1',
      },
      {
        text: 'Strong problem solving skills and agile delivery mindset.',
        bbox: { x0: 50, y0: 138, x1: 375, y1: 154 },
        confidence: 94,
        tesseractParaId: 'tess-para-1-1',
      },
    ],
  };

  const paraBlocks = extractOcrTextBlocks(mockParagraphOcr, pageHeight, 1.0);
  assert.strictEqual(paraBlocks.length, 3, 'Must extract 3 text lines');
  assert.strictEqual(paraBlocks[0].isParagraphMember, true, 'First line must be recognized as paragraph member');
  assert.strictEqual(paraBlocks[1].isParagraphMember, true, 'Second line must be recognized as paragraph member');
  assert.strictEqual(paraBlocks[2].isParagraphMember, true, 'Third line must be recognized as paragraph member');
  assert.strictEqual(paraBlocks[0].paraId, paraBlocks[1].paraId, 'Paragraph IDs must match across lines');
  assert.strictEqual(paraBlocks[0].paraLines.length, 3, 'paraLines must contain all 3 lines');

  // Import reflowParagraphText to verify reflow behavior
  const { reflowParagraphText } = await import('../src/features/editing/pdfContentEditor.js');
  const reflowed = reflowParagraphText(
    paraBlocks[0].paraLines,
    paraBlocks[0].id,
    'Lead architect focusing on high scale distributed systems, microservices, and reliable cloud operations.',
    {},
    true
  );
  assert.strictEqual(reflowed.length, 3, 'Must reflow across the 3 original paragraph lines');
  assert.ok(reflowed[0].text.length > 0);
  assert.ok(reflowed[1].text.length > 0);

  // Test full PDF export of reflowed paragraph with whiteout masks
  const paraPageEdits = {
    'page-1': {
      objects: reflowed.map((item, idx) => ({
        type: 'textbox',
        text: item.text,
        left: 50,
        top: 100 + idx * 19,
        width: 330,
        height: 16,
        fontSize: 13,
        fontFamily: 'Helvetica',
        fill: '#0f172a',
        backgroundColor: '#f8fafc',
        isPdfContentEdit: true,
        textAlign: 'left',
        linesInfo: [{
          pdfLeft: 50,
          pdfTop: 100 + idx * 19,
          pdfX: 50,
          pdfWidth: 330,
          pdfHeight: 16,
          rawFontSize: 13,
          baseVy: 100 + idx * 19 + 13 * 0.76,
          paraLeft: 50,
          paraRight: 380,
          paraWidth: 330,
          isLastLine: idx === reflowed.length - 1,
        }],
      })),
    },
  };

  const paraExportResult = await exportModifiedPdf(basePdfBytes, pagesMeta, paraPageEdits);
  assert.ok(paraExportResult.pdfBytes instanceof Uint8Array);
  const reloadedParaDoc = await PDFDocument.load(paraExportResult.pdfBytes);
  assert.strictEqual(reloadedParaDoc.getPageCount(), 1);
  console.log('✔ Test 6 Passed: Multi-line OCR Paragraph clustering, reflow & replacement verified.');

  console.log('\n--- All Image Text Editing & OCR Tests Passed Successfully! ---');
}

runImageOcrTests().catch((err) => {
  console.error('Image OCR Tests Failed:', err);
  process.exit(1);
});
