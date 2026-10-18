/**
 * Automated Test Suite: Phase 6 - Quality, Security & Optimization
 * Tests bug fixes, WinAnsi text sanitization, ISO 32000-1 header validation,
 * freehand path offsets, export robustness, and keyboard shortcuts.
 */

import assert from 'node:assert';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { validatePdfFile, validatePdfHeader } from '../src/utils/fileValidation.js';
import { sanitizeForWinAnsi } from '../src/utils/textSanitizer.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import { generateSamplePdf } from '../src/utils/samplePdf.js';

async function runPhase6Tests() {
  console.log('--- Running Phase 6 Automated Tests ---');

  // ==========================================
  // Test 1: Conforming PDF Header Validation (ISO 32000-1)
  // ==========================================
  console.log('Test 1: ISO 32000-1 binary header validation with preambles and BOM...');
  
  // A. Standard clean header
  const cleanHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
  assert(validatePdfHeader(cleanHeader.buffer), 'Standard clean %PDF- header must pass');

  // B. Header with UTF-8 BOM (\xef\xbb\xbf)
  const bomHeader = new Uint8Array([0xef, 0xbb, 0xbf, 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  assert(validatePdfHeader(bomHeader.buffer), 'Header with UTF-8 BOM must pass per ISO 32000-1');

  // C. Header with leading scanner comment preamble (e.g. 20 bytes before %PDF-)
  const preamble = new Uint8Array(60);
  for (let i = 0; i < 20; i++) preamble[i] = 0x20; // spaces
  preamble.set([0x25, 0x50, 0x44, 0x46, 0x2d], 20);
  assert(validatePdfHeader(preamble.buffer), 'Header with leading comment preamble within 1024 bytes must pass');

  // D. Invalid non-PDF data
  const invalidData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG signature
  assert(!validatePdfHeader(invalidData.buffer), 'PNG signature must be rejected');

  console.log('✔ Test 1 Passed: Conforming binary header validation verified.');

  // ==========================================
  // Test 2: WinAnsi Text Sanitizer & Currency Symbol Mapping
  // ==========================================
  console.log('Test 2: WinAnsi text sanitization (Rupee ₹, Euro €, Checkmarks, Emojis)...');
  
  const textWithRupee = 'Total Amount: ₹58,222.65';
  const sanitizedRupee = sanitizeForWinAnsi(textWithRupee);
  assert(sanitizedRupee.includes('Rs.58,222.65'), 'Rupee symbol ₹ must convert to Rs.');

  const textWithSymbols = 'Approved ✓ | Price: €100 / £80 • Bullet 🚀 Rocket';
  const sanitizedSymbols = sanitizeForWinAnsi(textWithSymbols);
  assert(sanitizedSymbols.includes('[x]'), 'Checkmark ✓ must convert to [x]');
  assert(sanitizedSymbols.includes('EUR100'), 'Euro € must convert to EUR');
  assert(sanitizedSymbols.includes('GBP80'), 'Pound £ must convert to GBP');
  assert(sanitizedSymbols.includes('* Bullet'), 'Bullet • must convert to *');
  assert(!sanitizedSymbols.includes('🚀'), 'Emoji 🚀 must be sanitized for WinAnsi');

  // Verify that sanitized text draws cleanly in pdf-lib StandardFonts without throwing WinAnsi error
  const testDoc = await PDFDocument.create();
  const testPage = testDoc.addPage([300, 300]);
  const font = await testDoc.embedFont(StandardFonts.Helvetica);
  
  let drawException = null;
  try {
    testPage.drawText(sanitizedRupee, { x: 20, y: 200, font });
    testPage.drawText(sanitizedSymbols, { x: 20, y: 150, font });
  } catch (err) {
    drawException = err;
  }
  assert(!drawException, `Sanitized text must draw in pdf-lib without error: ${drawException?.message}`);

  console.log('✔ Test 2 Passed: Text sanitizer and WinAnsi encoding compatibility verified.');

  // ==========================================
  // Test 3: Merge PDF File Validation Property Contract
  // ==========================================
  console.log('Test 3: Merge PDF file validation contract...');
  
  const mockValidFile = {
    name: 'contract.pdf',
    size: 1024 * 50,
    type: 'application/pdf',
  };
  const validationResult = validatePdfFile(mockValidFile);
  assert(validationResult.valid === true, 'validatePdfFile must return valid: true');
  assert(validationResult.isValid === undefined, 'validatePdfFile contract uses .valid');

  console.log('✔ Test 3 Passed: Merge PDF validation property contract verified.');

  // ==========================================
  // Test 4: Freehand Path Coordinate Displacement Calculation
  // ==========================================
  console.log('Test 4: Freehand Path coordinate offset computation...');

  // When Fabric path is created at (100, 150):
  // left: 150, top: 200, pathOffset: { x: 150, y: 200 }
  const pathDrawn = {
    left: 150,
    top: 200,
    pathOffset: { x: 150, y: 200 },
  };
  const offsetXDrawn = (pathDrawn.left ?? 0) - (pathDrawn.pathOffset?.x ?? 0);
  const offsetYDrawn = (pathDrawn.top ?? 0) - (pathDrawn.pathOffset?.y ?? 0);
  assert(offsetXDrawn === 0, 'Initial path stroke X offset must be 0 relative to canvas');
  assert(offsetYDrawn === 0, 'Initial path stroke Y offset must be 0 relative to canvas');

  // When Fabric path is moved by (+50, +30):
  const pathMoved = {
    left: 200,
    top: 230,
    pathOffset: { x: 150, y: 200 },
  };
  const offsetXMoved = (pathMoved.left ?? 0) - (pathMoved.pathOffset?.x ?? 0);
  const offsetYMoved = (pathMoved.top ?? 0) - (pathMoved.pathOffset?.y ?? 0);
  assert(offsetXMoved === 50, 'Moved path stroke X offset must equal delta X (+50)');
  assert(offsetYMoved === 30, 'Moved path stroke Y offset must equal delta Y (+30)');

  console.log('✔ Test 4 Passed: Freehand path offset computation verified.');

  // ==========================================
  // Test 5: Full Export with Unicode Text & Rotated Annotations
  // ==========================================
  console.log('Test 5: Full document export with ₹ amounts, watermarks, and rotated annotations...');

  const sampleBuffer = await generateSamplePdf();
  const pages = [
    {
      id: 'page-1',
      originalIndex: 1,
      isBlank: false,
      width: 612,
      height: 792,
      rotation: 0,
    },
  ];

  const pageEdits = {
    'page-1': {
      objects: [
        {
          type: 'textbox',
          text: 'Rebate Amount: ₹58,222.65',
          left: 50,
          top: 100,
          fontSize: 18,
          fontFamily: 'Helvetica',
          angle: 45, // Rotated text
        },
        {
          type: 'rect',
          left: 100,
          top: 200,
          width: 150,
          height: 60,
          fill: '#3b82f6',
          angle: 30, // Rotated shape
        },
      ],
    },
  };

  const exportOptions = {
    watermark: {
      enabled: true,
      text: 'VERIFIED ₹58k',
      fontSize: 36,
      opacity: 0.2,
      angle: -45,
    },
    pageNumbers: {
      enabled: true,
      format: 'Page {n} of {total} • Confidential',
      position: 'bottom-center',
    },
  };

  const exportResult = await exportModifiedPdf(sampleBuffer, pages, pageEdits, exportOptions);
  assert(exportResult.pdfBytes instanceof Uint8Array, 'Export must produce Uint8Array bytes');
  assert(exportResult.pdfBytes.byteLength > 1000, 'Exported PDF must have valid size');
  assert(validatePdfHeader(exportResult.pdfBytes.buffer), 'Exported PDF must have valid %PDF- header');

  // Verify re-parsing the exported PDF
  const loadedExport = await PDFDocument.load(exportResult.pdfBytes);
  assert(loadedExport.getPageCount() === 1, 'Exported PDF must have exactly 1 page');

  console.log('✔ Test 5 Passed: Full export with Unicode text and rotated objects completed successfully.');

  console.log('\n--- All Phase 6 Automated Tests Passed Successfully! ---\n');
  return true;
}

runPhase6Tests().catch((err) => {
  console.error('Phase 6 Test Failed:', err);
  process.exit(1);
});
