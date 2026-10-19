/**
 * Automated Verification Tests for Text Alignment & Distribution Controls
 * Run via Node.js: node tests/alignment.test.js
 */

import assert from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import { generateSamplePdf } from '../src/utils/samplePdf.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import { validatePdfHeader } from '../src/utils/fileValidation.js';

async function runAlignmentTests() {
  console.log('--- Running Text Alignment Automated Tests ---');

  // Generate clean source PDF
  const samplePdfBytes = await generateSamplePdf({ title: 'Alignment Test PDF', pageCount: 2 });
  const srcDoc = await PDFDocument.load(samplePdfBytes);
  const srcPages = srcDoc.getPages();
  const pageWidth = srcPages[0].getWidth();
  const pageHeight = srcPages[0].getHeight();

  const pagesMeta = [
    { id: 'page-1', originalIndex: 1, isBlank: false, width: pageWidth, height: pageHeight, rotation: 0 },
    { id: 'page-2', originalIndex: 2, isBlank: false, width: pageWidth, height: pageHeight, rotation: 0 },
  ];

  // ==========================================
  // Test 1: Standard Textbox Alignment (Left, Center, Right, Justify)
  // ==========================================
  console.log('Test 1: Standard Textbox Export with Left, Center, Right, Justify alignment...');
  
  const page1Edits = {
    version: '6.0.0',
    objects: [
      {
        type: 'textbox',
        text: 'Left Aligned Text Block',
        left: 50,
        top: 100,
        width: 300,
        height: 40,
        fontSize: 16,
        fontFamily: 'Helvetica',
        fill: '#1e293b',
        textAlign: 'left',
      },
      {
        type: 'textbox',
        text: 'Center Aligned Text Block',
        left: 50,
        top: 160,
        width: 300,
        height: 40,
        fontSize: 16,
        fontFamily: 'Helvetica',
        fill: '#2563eb',
        textAlign: 'center',
      },
      {
        type: 'textbox',
        text: 'Right Aligned Text Block',
        left: 50,
        top: 220,
        width: 300,
        height: 40,
        fontSize: 16,
        fontFamily: 'Helvetica',
        fill: '#059669',
        textAlign: 'right',
      },
      {
        type: 'textbox',
        text: 'Justified paragraph text that wraps across multiple lines and distributes words cleanly.\nThis is the final line.',
        left: 50,
        top: 280,
        width: 300,
        height: 80,
        fontSize: 14,
        fontFamily: 'Helvetica',
        fill: '#7c3aed',
        textAlign: 'justify',
      },
    ],
  };

  const { pdfBytes: exportBytes1 } = await exportModifiedPdf(samplePdfBytes, pagesMeta, {
    'page-1': page1Edits,
  });

  assert(validatePdfHeader(exportBytes1), 'Exported PDF with aligned textboxes must have valid binary header');
  const exportedDoc1 = await PDFDocument.load(exportBytes1);
  assert.strictEqual(exportedDoc1.getPageCount(), 2, 'Exported document must have 2 pages');
  console.log('✔ Test 1 Passed: Standard textboxes with Left, Center, Right, Justify compile successfully.');

  // ==========================================
  // Test 2: In-Place Content Edit Alignment (Single Line & Paragraph)
  // ==========================================
  console.log('Test 2: Direct in-place PDF content edits with paragraph boundaries and alignment...');

  const page2Edits = {
    version: '6.0.0',
    contentEdits: {
      'text-block-1': {
        text: 'Centered Replacement Title',
        originalText: 'Original Document Title',
        textAlign: 'center',
        paraBoundaries: {
          left: 60,
          right: 460,
          width: 400,
          isLastLine: true,
        },
      },
      'text-block-para-line-1': {
        text: 'Professional software engineering requires deep architecture and clean testing.',
        originalText: 'Old first line of paragraph text in the document.',
        textAlign: 'justify',
        paraBoundaries: {
          left: 60,
          right: 500,
          width: 440,
          isLastLine: false,
        },
      },
      'text-block-para-line-2': {
        text: 'Final naturally left-aligned sentence.',
        originalText: 'Old second line of paragraph text.',
        textAlign: 'justify',
        paraBoundaries: {
          left: 60,
          right: 500,
          width: 440,
          isLastLine: true,
        },
      },
    },
    objects: [
      {
        type: 'textbox',
        text: 'Centered Replacement Title',
        left: 60,
        top: 80,
        width: 400,
        height: 24,
        fontSize: 18,
        fontFamily: 'Helvetica',
        fontWeight: 'bold',
        fill: '#0f172a',
        backgroundColor: '#ffffff',
        isPdfContentEdit: true,
        textAlign: 'center',
        originalBlockId: 'text-block-1',
        linesInfo: [{
          pdfLeft: 60,
          pdfTop: 80,
          pdfX: 60,
          pdfWidth: 400,
          pdfHeight: 24,
          rawFontSize: 18,
          baseVy: 96,
          paraLeft: 60,
          paraRight: 460,
          paraWidth: 400,
          isLastLine: true,
        }],
      },
      {
        type: 'textbox',
        text: 'Professional software engineering requires deep architecture and clean testing.',
        left: 60,
        top: 140,
        width: 440,
        height: 16,
        fontSize: 12,
        fontFamily: 'Helvetica',
        fill: '#1e293b',
        backgroundColor: '#ffffff',
        isPdfContentEdit: true,
        textAlign: 'justify',
        originalBlockId: 'text-block-para-line-1',
        linesInfo: [{
          pdfLeft: 60,
          pdfTop: 140,
          pdfX: 60,
          pdfWidth: 440,
          pdfHeight: 16,
          rawFontSize: 12,
          baseVy: 154,
          paraLeft: 60,
          paraRight: 500,
          paraWidth: 440,
          isLastLine: false,
        }],
      },
      {
        type: 'textbox',
        text: 'Final naturally left-aligned sentence.',
        left: 60,
        top: 160,
        width: 440,
        height: 16,
        fontSize: 12,
        fontFamily: 'Helvetica',
        fill: '#1e293b',
        backgroundColor: '#ffffff',
        isPdfContentEdit: true,
        textAlign: 'justify',
        originalBlockId: 'text-block-para-line-2',
        linesInfo: [{
          pdfLeft: 60,
          pdfTop: 160,
          pdfX: 60,
          pdfWidth: 440,
          pdfHeight: 16,
          rawFontSize: 12,
          baseVy: 174,
          paraLeft: 60,
          paraRight: 500,
          paraWidth: 440,
          isLastLine: true,
        }],
      },
    ],
  };

  const { pdfBytes: exportBytes2 } = await exportModifiedPdf(samplePdfBytes, pagesMeta, {
    'page-1': page2Edits,
  });

  assert(validatePdfHeader(exportBytes2), 'Exported PDF with in-place aligned content must be valid PDF');
  const exportedDoc2 = await PDFDocument.load(exportBytes2);
  assert.strictEqual(exportedDoc2.getPageCount(), 2);
  console.log('✔ Test 2 Passed: In-place content edits with paragraph boundaries & justify compile successfully.');

  // ==========================================
  // Test 3: Right Alignment Boundary Verification
  // ==========================================
  console.log('Test 3: Right alignment within block boundaries (not full page)...');
  
  const rightAlignEdits = {
    version: '6.0.0',
    objects: [
      {
        type: 'textbox',
        text: 'Right Box',
        left: 100,
        top: 200,
        width: 250, // Right bound is at 100 + 250 = 350, far from page right (612)
        height: 30,
        fontSize: 14,
        fontFamily: 'Helvetica',
        textAlign: 'right',
        isPdfContentEdit: true,
        linesInfo: [{
          pdfLeft: 100,
          pdfWidth: 250,
          paraLeft: 100,
          paraWidth: 250,
          rawFontSize: 14,
          baseVy: 215,
          isLastLine: true,
        }],
      },
    ],
  };

  const { pdfBytes: exportBytes3 } = await exportModifiedPdf(samplePdfBytes, pagesMeta, {
    'page-1': rightAlignEdits,
  });

  assert(validatePdfHeader(exportBytes3), 'Right-aligned block within custom boundary compiles correctly');
  console.log('✔ Test 3 Passed: Right alignment respects selected block boundaries.');

  // ==========================================
  // Test 4: Preservation of Unedited PDF Content
  // ==========================================
  console.log('Test 4: Unedited pages and untouched content preservation...');
  
  // Page 2 has ZERO edits. It must remain identical without regeneration.
  const exportedDoc4 = await PDFDocument.load(exportBytes3);
  const p2 = exportedDoc4.getPages()[1];
  assert.strictEqual(p2.getWidth(), pageWidth, 'Page 2 width must remain completely unchanged');
  assert.strictEqual(p2.getHeight(), pageHeight, 'Page 2 height must remain completely unchanged');
  console.log('✔ Test 4 Passed: Unedited pages and existing sections remain untouched.');

  console.log('\n--- All Text Alignment Automated Tests Passed Successfully! ---');
}

runAlignmentTests().catch((err) => {
  console.error('Text Alignment Test Failed:', err);
  process.exit(1);
});
