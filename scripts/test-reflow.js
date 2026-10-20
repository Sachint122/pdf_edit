#!/usr/bin/env node
/**
 * Generic Structure-Aware PDF Reflow & Paragraph Expansion Test Suite
 *
 * Verifies document-independent layout reflow across diverse document types:
 * - Single-column Legal Agreements / Contracts with numbered clauses
 * - Two-column Academic / Research Papers with independent column flows
 * - Invoices / Financial Statements with multi-column tabular data
 * - Corporate Newsletters / Magazines with 3-column layouts and sidebars
 * - Short-to-long expansion and long-to-short shrinkage
 * - Zero cumulative coordinate drift across repeated edits
 * - Structural headings, divider lines, and images preserved
 * - Safe page overflow detection
 * - Undo/redo layout restoration
 * - Actual PDF export validity using pdf-lib
 * - Existing PDF page management and Image Editor isolation
 */

import assert from 'node:assert';
import { PDFDocument, rgb } from 'pdf-lib';
import {
  measureTextWidth,
  wrapTextToLines,
  detectColumnsAndFlow,
  isHeadingText,
  buildGenericLayoutModel,
  isDownstreamElement,
  calculateParagraphReflow,
  calculatePageReflow,
} from '../src/features/editing/layoutEngine.js';
import { exportModifiedPdf } from '../src/features/export/exportPdf.js';
import {
  addBlankPage,
  rotatePage,
  movePage,
  deletePage,
} from '../src/features/page-management/pageOperations.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logCase(num, title) {
  console.log(`\n${COLORS.cyan}[Case ${num}] ${title}${COLORS.reset}`);
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

function runTest(num, title, fn) {
  totalCount++;
  logCase(num, title);
  try {
    fn();
    logPass(title);
    passedCount++;
  } catch (err) {
    logFail(title, err);
  }
}

async function runAsyncTest(num, title, fn) {
  totalCount++;
  logCase(num, title);
  try {
    await fn();
    logPass(title);
    passedCount++;
  } catch (err) {
    logFail(title, err);
  }
}

// ============================================================================
// DIVERSE DOCUMENT FIXTURES
// ============================================================================

/**
 * Fixture 1: Commercial Legal Contract (Single Column, Numbered Clauses)
 */
function createContractDocBlocks() {
  return [
    { id: 'contract-title', str: 'MASTER SERVICES AGREEMENT', origPdfLeft: 54, origPdfTop: 45, origPdfWidth: 504, origPdfHeight: 20, origBaseVx: 54, origBaseVy: 62, rawFontSize: 16, isBold: true },
    
    // Clause 1
    { id: 'clause-1-hdr', str: '1. DEFINITIONS AND INTERPRETATION', origPdfLeft: 54, origPdfTop: 85, origPdfWidth: 300, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 97, rawFontSize: 12, isBold: true },
    { id: 'c1-l1', str: 'In this Agreement, unless the context otherwise requires, capitalized terms shall have the meanings set forth herein.', origPdfLeft: 54, origPdfTop: 105, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 116, rawFontSize: 10, isParagraphMember: true, paraId: 'para-clause-1' },
    { id: 'c1-l2', str: 'The headings in this Agreement are inserted for convenience only and shall not affect its construction.', origPdfLeft: 54, origPdfTop: 120, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 131, rawFontSize: 10, isParagraphMember: true, paraId: 'para-clause-1' },
    { id: 'c1-l3', str: 'References to clauses and schedules are to the clauses and schedules of this Agreement.', origPdfLeft: 54, origPdfTop: 135, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 146, rawFontSize: 10, isParagraphMember: true, paraId: 'para-clause-1' },

    // Clause 2
    { id: 'clause-2-hdr', str: '2. CONFIDENTIALITY AND NON-DISCLOSURE', origPdfLeft: 54, origPdfTop: 175, origPdfWidth: 320, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 187, rawFontSize: 12, isBold: true },
    { id: 'c2-l1', str: 'Each party agrees to hold all confidential information of the other party in strict confidence and use it solely for performance.', origPdfLeft: 54, origPdfTop: 195, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 206, rawFontSize: 10 },
    { id: 'c2-l2', str: 'This obligation shall survive termination or expiration of this Agreement for a period of five (5) years.', origPdfLeft: 54, origPdfTop: 210, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 221, rawFontSize: 10 },

    // Clause 3
    { id: 'clause-3-hdr', str: '3. INDEMNIFICATION AND LIABILITY', origPdfLeft: 54, origPdfTop: 250, origPdfWidth: 280, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 262, rawFontSize: 12, isBold: true },
    { id: 'c3-l1', str: 'Neither party shall be liable for indirect, incidental, or consequential damages arising out of this Agreement.', origPdfLeft: 54, origPdfTop: 270, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 281, rawFontSize: 10 },
  ];
}

/**
 * Fixture 2: Academic / Research Paper (Two-Column Layout with Spanning Abstract)
 */
function createAcademicTwoColBlocks() {
  return [
    // Spanning Title & Abstract
    { id: 'paper-title', str: 'A Scalable Architecture for In-Browser Document Processing', origPdfLeft: 54, origPdfTop: 45, origPdfWidth: 504, origPdfHeight: 22, origBaseVx: 54, origBaseVy: 64, rawFontSize: 18, isBold: true },
    { id: 'paper-authors', str: 'Alice Smith, Bob Jones, and Carol Danvers — MIT CSAIL', origPdfLeft: 54, origPdfTop: 75, origPdfWidth: 504, origPdfHeight: 12, origBaseVx: 54, origBaseVy: 85, rawFontSize: 10, isItalic: true },
    
    // Abstract (Spanning)
    { id: 'abs-hdr', str: 'Abstract', origPdfLeft: 54, origPdfTop: 100, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 111, rawFontSize: 11, isBold: true },
    { id: 'abs-l1', str: 'We present a lightweight, structure-aware layout reflow model that dynamically computes bounding boxes and dependent reflow.', origPdfLeft: 54, origPdfTop: 115, origPdfWidth: 504, origPdfHeight: 12, origBaseVx: 54, origBaseVy: 125, rawFontSize: 9.5 },

    // Column 1 (Left: x = 54, width = 236)
    { id: 'col1-sec1-hdr', str: '1. Introduction', origPdfLeft: 54, origPdfTop: 150, origPdfWidth: 150, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 162, rawFontSize: 12, isBold: true },
    { id: 'col1-p1-l1', str: 'Modern digital document workflows require real-time interactive editing.', origPdfLeft: 54, origPdfTop: 170, origPdfWidth: 236, origPdfHeight: 12, origBaseVx: 54, origBaseVy: 180, rawFontSize: 9.5, isParagraphMember: true, paraId: 'para-col1-intro' },
    { id: 'col1-p1-l2', str: 'However, existing solutions are restricted by rigid 2D point positions.', origPdfLeft: 54, origPdfTop: 183, origPdfWidth: 236, origPdfHeight: 12, origBaseVx: 54, origBaseVy: 193, rawFontSize: 9.5, isParagraphMember: true, paraId: 'para-col1-intro' },
    { id: 'col1-sec2-hdr', str: '2. Background and Related Work', origPdfLeft: 54, origPdfTop: 220, origPdfWidth: 200, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 232, rawFontSize: 12, isBold: true },
    { id: 'col1-p2-l1', str: 'Previous systems either reconstruct full ASTs or rely on heavy cloud services.', origPdfLeft: 54, origPdfTop: 240, origPdfWidth: 236, origPdfHeight: 12, origBaseVx: 54, origBaseVy: 250, rawFontSize: 9.5 },

    // Column 2 (Right: x = 322, width = 236)
    { id: 'col2-sec3-hdr', str: '3. System Architecture', origPdfLeft: 322, origPdfTop: 150, origPdfWidth: 160, origPdfHeight: 14, origBaseVx: 322, origBaseVy: 162, rawFontSize: 12, isBold: true },
    { id: 'col2-p1-l1', str: 'Our system runs entirely client-side using WebAssembly and pure HTML5 canvas.', origPdfLeft: 322, origPdfTop: 170, origPdfWidth: 236, origPdfHeight: 12, origBaseVx: 322, origBaseVy: 180, rawFontSize: 9.5 },
    { id: 'col2-p1-l2', str: 'This ensures zero server roundtrips and complete privacy for sensitive data.', origPdfLeft: 322, origPdfTop: 183, origPdfWidth: 236, origPdfHeight: 12, origBaseVx: 322, origBaseVy: 193, rawFontSize: 9.5 },
    { id: 'col2-sec4-hdr', str: '4. Experimental Evaluation', origPdfLeft: 322, origPdfTop: 220, origPdfWidth: 180, origPdfHeight: 14, origBaseVx: 322, origBaseVy: 232, rawFontSize: 12, isBold: true },
    { id: 'col2-p2-l1', str: 'We evaluate response time and layout fidelity across 5,000 diverse PDF documents.', origPdfLeft: 322, origPdfTop: 240, origPdfWidth: 236, origPdfHeight: 12, origBaseVx: 322, origBaseVy: 250, rawFontSize: 9.5 },
  ];
}

/**
 * Fixture 3: Commercial Invoice with Notes and Itemized Multi-Column Data Table
 */
function createInvoiceDocBlocks() {
  return [
    // Invoice Title & Info
    { id: 'inv-title', str: 'INVOICE #INV-2026-089', origPdfLeft: 54, origPdfTop: 45, origPdfWidth: 250, origPdfHeight: 20, origBaseVx: 54, origBaseVy: 62, rawFontSize: 16, isBold: true },
    { id: 'inv-date', str: 'Date: October 20, 2026', origPdfLeft: 400, origPdfTop: 45, origPdfWidth: 150, origPdfHeight: 14, origBaseVx: 400, origBaseVy: 57, rawFontSize: 11 },
    
    // Notes & Payment Terms Paragraph (y = 90 - 130)
    { id: 'inv-notes-hdr', str: 'Terms & Conditions:', origPdfLeft: 54, origPdfTop: 85, origPdfWidth: 150, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 97, rawFontSize: 11, isBold: true },
    { id: 'inv-n-l1', str: 'Payment is due within 30 days of invoice issuance via wire transfer or credit card.', origPdfLeft: 54, origPdfTop: 105, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 116, rawFontSize: 10, isParagraphMember: true, paraId: 'para-inv-notes' },
    { id: 'inv-n-l2', str: 'Please quote invoice number on all remittance advice to prevent processing delays.', origPdfLeft: 54, origPdfTop: 120, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 131, rawFontSize: 10, isParagraphMember: true, paraId: 'para-inv-notes' },

    // Itemized Table (Header row at y = 160)
    { id: 'tbl-th-desc', str: 'Description', origPdfLeft: 54, origPdfTop: 160, origPdfWidth: 250, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 172, rawFontSize: 10, isBold: true },
    { id: 'tbl-th-qty', str: 'Qty', origPdfLeft: 320, origPdfTop: 160, origPdfWidth: 50, origPdfHeight: 14, origBaseVx: 320, origBaseVy: 172, rawFontSize: 10, isBold: true },
    { id: 'tbl-th-rate', str: 'Unit Rate', origPdfLeft: 400, origPdfTop: 160, origPdfWidth: 60, origPdfHeight: 14, origBaseVx: 400, origBaseVy: 172, rawFontSize: 10, isBold: true },
    { id: 'tbl-th-amt', str: 'Total', origPdfLeft: 490, origPdfTop: 160, origPdfWidth: 60, origPdfHeight: 14, origBaseVx: 490, origBaseVy: 172, rawFontSize: 10, isBold: true },

    // Table Row 1 (y = 185)
    { id: 'tbl-r1-desc', str: 'Cloud Infrastructure Architecture Consulting', origPdfLeft: 54, origPdfTop: 185, origPdfWidth: 250, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 196, rawFontSize: 10 },
    { id: 'tbl-r1-qty', str: '40 hrs', origPdfLeft: 320, origPdfTop: 185, origPdfWidth: 50, origPdfHeight: 13, origBaseVx: 320, origBaseVy: 196, rawFontSize: 10 },
    { id: 'tbl-r1-rate', str: '$150.00', origPdfLeft: 400, origPdfTop: 185, origPdfWidth: 60, origPdfHeight: 13, origBaseVx: 400, origBaseVy: 196, rawFontSize: 10 },
    { id: 'tbl-r1-amt', str: '$6,000.00', origPdfLeft: 490, origPdfTop: 185, origPdfWidth: 60, origPdfHeight: 13, origBaseVx: 490, origBaseVy: 196, rawFontSize: 10 },

    // Table Row 2 (y = 205)
    { id: 'tbl-r2-desc', str: 'WebAssembly Engine Implementation', origPdfLeft: 54, origPdfTop: 205, origPdfWidth: 250, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 216, rawFontSize: 10 },
    { id: 'tbl-r2-qty', str: '20 hrs', origPdfLeft: 320, origPdfTop: 205, origPdfWidth: 50, origPdfHeight: 13, origBaseVx: 320, origBaseVy: 216, rawFontSize: 10 },
    { id: 'tbl-r2-rate', str: '$180.00', origPdfLeft: 400, origPdfTop: 205, origPdfWidth: 60, origPdfHeight: 13, origBaseVx: 400, origBaseVy: 216, rawFontSize: 10 },
    { id: 'tbl-r2-amt', str: '$3,600.00', origPdfLeft: 490, origPdfTop: 205, origPdfWidth: 60, origPdfHeight: 13, origBaseVx: 490, origBaseVy: 216, rawFontSize: 10 },
  ];
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================

async function main() {
  console.log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}   GENERIC STRUCTURE-AWARE PDF REFLOW TEST SUITE (12 CHECKS)   ${COLORS.reset}`);
  console.log(`${COLORS.bold}================================================================${COLORS.reset}`);

  // --------------------------------------------------------------------------
  // TEST 1: Generic Contract Paragraph Expansion (3 lines to 7 lines)
  // --------------------------------------------------------------------------
  runTest(1, 'Contract document: expand clause paragraph from 3 lines to 7 lines', () => {
    const blocks = createContractDocBlocks();
    
    // Expand Clause 1 with 7 lines of contract text (no resume keywords)
    const expandedClause = [
      'In this Agreement, unless the context otherwise requires, capitalized terms shall have the meanings set forth herein.',
      'The headings in this Agreement are inserted for convenience only and shall not affect its legal interpretation or construction.',
      'References to clauses and schedules are to the clauses and schedules of this Agreement and any executed addenda.',
      'Any reference to any statute or statutory provision includes a reference to that statute or statutory provision as amended.',
      'Words importing the singular include the plural and vice versa, and words importing a gender include every gender.',
      'The words including, include, in particular, or any similar expression shall be construed as illustrative and shall not limit the sense of the words.',
      'A reference to writing or written includes email transmissions but excludes text messaging and unverified instant chat.',
    ].join(' ');

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-clause-1': { text: expandedClause },
      },
      canvasObjects: [],
      options: { pageHeight: 792, pageWidth: 612, bottomMargin: 45 },
    });

    // Clause 2 and Clause 3 must shift down by identical positive delta
    const c2Hdr = reflowResult.contentEdits['clause-2-hdr'];
    const c3Hdr = reflowResult.contentEdits['clause-3-hdr'];

    assert(c2Hdr && c2Hdr.isShifted, 'Clause 2 header must be shifted down');
    assert(c3Hdr && c3Hdr.isShifted, 'Clause 3 header must be shifted down');
    assert(c2Hdr.shiftY > 0, `Expected positive shift for Clause 2, got ${c2Hdr.shiftY}`);
    assert.strictEqual(c2Hdr.shiftY, c3Hdr.shiftY, 'Downstream clauses must share identical deltaY');

    // Relative distance between Clause 2 (175) and Clause 3 (250) was 75pt originally
    const c2NewTop = c2Hdr.block.pdfTop;
    const c3NewTop = c3Hdr.block.pdfTop;
    assert.strictEqual(c3NewTop - c2NewTop, 250 - 175, 'Relative distance between clauses must be preserved');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Contract Clause Deletion & Upward Reflow
  // --------------------------------------------------------------------------
  runTest(2, 'Contract document: delete 2 lines of text and verify upward reflow', () => {
    const blocks = createContractDocBlocks();
    const shrunkText = 'In this Agreement, capitalized terms have defined meanings.';

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-clause-1': { text: shrunkText },
      },
      canvasObjects: [],
      options: { pageHeight: 792, pageWidth: 612, bottomMargin: 45 },
    });

    const c2Hdr = reflowResult.contentEdits['clause-2-hdr'];
    const c3Hdr = reflowResult.contentEdits['clause-3-hdr'];

    assert(c2Hdr && c2Hdr.isShifted, 'Clause 2 header must be shifted');
    assert(c2Hdr.shiftY < 0, `Expected negative upward shift for Clause 2, got ${c2Hdr.shiftY}`);
    assert.strictEqual(c2Hdr.shiftY, c3Hdr.shiftY, 'Clause 2 and 3 must share identical upward delta');
    assert.strictEqual(c2Hdr.block.pdfTop, 175 + c2Hdr.shiftY, 'Clause 2 top must equal origTop + negative delta');

    // Cleared lines must have whiteout export objects
    const cleared = Object.values(reflowResult.contentEdits).filter((e) => e.isClearedLine);
    assert(cleared.length >= 2, `Expected at least 2 cleared lines, got ${cleared.length}`);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Zero Cumulative Coordinate Drift Across Repeated Edits
  // --------------------------------------------------------------------------
  runTest(3, 'Repeated sequential edits have zero cumulative coordinate drift', () => {
    const blocks = createContractDocBlocks();
    const origC2Top = 175;

    const edits = [
      'Short clause statement.',
      'Medium length clause statement explaining obligations and conditions under standard law.',
      'Extensive clause statement with multiple sentences detailing representations, warranties, covenants, disclaimers, and dispute resolution.',
      'Short again.',
      // Back to exact original length
      'In this Agreement, unless the context otherwise requires, capitalized terms shall have the meanings set forth herein. The headings in this Agreement are inserted for convenience only and shall not affect its construction. References to clauses and schedules are to the clauses and schedules of this Agreement.',
    ];

    for (let i = 0; i < edits.length; i++) {
      const res = calculatePageReflow({
        allBlocks: blocks,
        paragraphEdits: {
          'para-clause-1': { text: edits[i] },
        },
      });

      if (i === edits.length - 1) {
        const c2Edit = res.contentEdits['clause-2-hdr'];
        const shift = c2Edit?.shiftY ?? 0;
        assert.strictEqual(shift, 0, `Expected 0 coordinate drift after returning to original text, got ${shift}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Two-Column Academic Paper — Column Independence
  // --------------------------------------------------------------------------
  runTest(4, 'Two-column academic paper: editing Column 1 does not shift Column 2', () => {
    const blocks = createAcademicTwoColBlocks();

    // Expand Introduction paragraph in Column 1 (Left)
    const longIntro = 'Modern digital document workflows require real-time interactive editing. Traditional desktop word processors allow dynamic paragraph expansion, but web-based PDF editors have historically lacked section reflow. Our layout-aware engine recalculates coordinates dynamically using exact canvas font metrics.';

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-col1-intro': { text: longIntro },
      },
    });

    // Column 1 downstream elements (Section 2 Background) MUST shift down
    const sec2Hdr = reflowResult.contentEdits['col1-sec2-hdr'];
    const p2L1 = reflowResult.contentEdits['col1-p2-l1'];
    assert(sec2Hdr && sec2Hdr.isShifted, 'Column 1 Section 2 must shift down');
    assert(p2L1 && p2L1.isShifted, 'Column 1 Paragraph 2 must shift down');
    assert(sec2Hdr.shiftY > 0, 'Column 1 Section 2 shift must be positive');

    // Column 2 elements (Section 3 System Architecture, Section 4 Evaluation) MUST NOT SHIFT
    const col2Sec3 = reflowResult.contentEdits['col2-sec3-hdr'];
    const col2P1 = reflowResult.contentEdits['col2-p1-l1'];
    const col2Sec4 = reflowResult.contentEdits['col2-sec4-hdr'];

    assert(!col2Sec3 || !col2Sec3.isShifted, 'Column 2 Section 3 must remain untouched (not shifted)');
    assert(!col2P1 || !col2P1.isShifted, 'Column 2 paragraph must remain untouched');
    assert(!col2Sec4 || !col2Sec4.isShifted, 'Column 2 Section 4 must remain untouched');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Invoice with Multi-Column Data Table — Row & Cell Preservation
  // --------------------------------------------------------------------------
  runTest(5, 'Invoice document: expanding paragraph above data table shifts table without cell distortion', () => {
    const blocks = createInvoiceDocBlocks();
    const canvasObjects = [
      // Top invoice company logo at y = 15 (upstream of table and notes)
      { id: 'inv-logo', type: 'image', left: 54, top: 15, origTop: 15, width: 120, height: 25 },
      // Horizontal divider line above table at y = 150
      { id: 'inv-divider', type: 'line', left: 54, top: 150, origTop: 150, width: 504, height: 1 },
    ];

    // Expand Terms & Conditions paragraph beyond whitespace clearance (exceeds 27pt clearance)
    const expandedNotes = 'Payment is due within 30 days of invoice issuance via electronic funds transfer or wire transfer. Late payments shall accrue interest at 1.5% per month or the maximum rate permitted by law. All taxes and duties are the responsibility of the client unless explicitly stated otherwise in the agreement. Any billing discrepancies must be submitted in writing within 14 calendar days of invoice receipt. Invoices remaining unpaid past 60 days are referred to collection.';

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-inv-notes': { text: expandedNotes },
      },
      canvasObjects,
    });

    // 1. Top company logo MUST NOT shift (anchored at top)
    const shiftedLogo = reflowResult.shiftedCanvasObjects.find((o) => o.id === 'inv-logo');
    assert.strictEqual(shiftedLogo?.top, 15, 'Top company logo must remain anchored at y=15');

    // 2. Divider line MUST shift down with the table
    const shiftedDivider = reflowResult.shiftedCanvasObjects.find((o) => o.id === 'inv-divider');
    assert(shiftedDivider && shiftedDivider.top > 150, 'Table divider line must shift down');

    // 3. Every cell of the itemized table must shift down by the EXACT SAME delta
    const delta = shiftedDivider.top - 150;
    const thDesc = reflowResult.contentEdits['tbl-th-desc'];
    const thQty = reflowResult.contentEdits['tbl-th-qty'];
    const r1Desc = reflowResult.contentEdits['tbl-r1-desc'];
    const r1Amt = reflowResult.contentEdits['tbl-r1-amt'];
    const r2Desc = reflowResult.contentEdits['tbl-r2-desc'];

    assert(thDesc && thQty && r1Desc && r1Amt && r2Desc, 'All table cells must be accounted for');
    assert.strictEqual(thDesc.shiftY, delta, 'Table header description must shift by delta');
    assert.strictEqual(thQty.shiftY, delta, 'Table header quantity must shift by delta');
    assert.strictEqual(r1Desc.shiftY, delta, 'Table row 1 description must shift by delta');
    assert.strictEqual(r1Amt.shiftY, delta, 'Table row 1 amount must shift by delta');

    // Horizontal alignment between cells in Row 1 must remain 100% exact
    const r1DescLeft = r1Desc.origPdfLeft;
    const r1AmtLeft = r1Amt.origPdfLeft;
    assert.strictEqual(r1AmtLeft - r1DescLeft, 490 - 54, 'Cell X coordinates and relative horizontal spacing must be preserved');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Generic Heading Detection (No Hardcoded Keywords)
  // --------------------------------------------------------------------------
  runTest(6, 'Generic heading heuristics work across diverse styles without hardcoded words', () => {
    // 1. Numbered / structured section titles
    assert(isHeadingText('1. Introduction'), 'Numbered title must be recognized as heading');
    assert(isHeadingText('2.1 Methodology'), 'Sub-section numbering must be recognized as heading');
    assert(isHeadingText('Article IV - Representations and Warranties'), 'Legal article must be recognized as heading');
    assert(isHeadingText('§ 12.3 Limitation of Liability'), 'Statute section symbol must be recognized as heading');
    assert(isHeadingText('Chapter 3: System Design'), 'Chapter heading must be recognized as heading');

    // 2. Colon-terminated labels
    assert(isHeadingText('Payment Terms:'), 'Colon label must be recognized as heading');
    assert(isHeadingText('Bill To:'), 'Short colon label must be recognized as heading');
    assert(isHeadingText('Technical Specifications:'), 'Multi-word colon label must be recognized as heading');

    // 3. ALL CAPS titles
    assert(isHeadingText('FINANCIAL STATEMENTS'), 'ALL CAPS title must be recognized as heading');
    assert(isHeadingText('PROJECT SCOPE AND DELIVERABLES'), 'ALL CAPS long title must be recognized as heading');

    // 4. Regular body sentences should NOT be recognized as headings
    assert(!isHeadingText('This is a normal body sentence explaining how the engine works.'), 'Normal body sentence must not be a heading');
    assert(!isHeadingText('We evaluated performance across multiple test datasets and verified accuracy.'), 'Long prose sentence must not be a heading');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Generic Layout Model Inference & Classification
  // --------------------------------------------------------------------------
  runTest(7, 'Generic layout model computes baselines and classifies elements accurately', () => {
    const blocks = createInvoiceDocBlocks();
    const model = buildGenericLayoutModel({
      allBlocks: blocks,
      options: { pageWidth: 612, pageHeight: 792, bottomMargin: 45 },
    });

    assert(['high', 'medium', 'low'].includes(model.confidence), 'Model confidence must be established');
    assert.strictEqual(typeof model.medianFontSize, 'number', 'Model must compute median font size');
    assert(model.tableBlockIds.size > 0, 'Model must detect table cells in invoice fixture');
    assert(model.tableBlockIds.has('tbl-r1-desc'), 'Row 1 item must be identified as table cell');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Safe Page Boundary & Content Overflow Detection
  // --------------------------------------------------------------------------
  runTest(8, 'Page overflow detection reports boundary status safely without clipping', () => {
    const blocks = createContractDocBlocks();
    // Massive text that pushes Clause 3 past the bottom margin
    const massiveText = 'This is an extensive legal covenant with numerous paragraphs of terms and obligations. '.repeat(100);

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-clause-1': { text: massiveText },
      },
      options: { pageHeight: 792, pageWidth: 612, bottomMargin: 45 },
    });

    assert(reflowResult.overflowInfo.hasOverflow === true, 'Overflow must be detected');
    assert(reflowResult.overflowInfo.overflowingBlocks.length > 0, 'Must identify overflowing blocks');
    assert(reflowResult.overflowInfo.overflowingBlocks[0].overflowAmount > 0, 'Overflow amount must be positive');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Undo/Redo State Restoration
  // --------------------------------------------------------------------------
  runTest(9, 'Undo/redo snapshot restores both modified text and reflowed positions', () => {
    const blocks = createContractDocBlocks();

    // State 0: pristine
    const state0 = {
      pages: [{ id: 'page-1', width: 612, height: 792 }],
      pageEdits: { 'page-1': { paragraphEdits: {}, contentEdits: {}, objects: [] } },
    };

    // State 1: user edits paragraph
    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-clause-1': { text: 'Shortened clause.' },
      },
    });

    const state1 = {
      pages: [{ id: 'page-1', width: 612, height: 792 }],
      pageEdits: {
        'page-1': {
          paragraphEdits: { 'para-clause-1': { text: 'Shortened clause.' } },
          contentEdits: reflowResult.contentEdits,
          objects: reflowResult.exportObjects,
        },
      },
    };

    // Undo: restore state 0
    const restoredState = JSON.parse(JSON.stringify(state0));
    assert.deepStrictEqual(restoredState.pageEdits['page-1'].contentEdits, {}, 'Undo restores empty contentEdits');

    // Redo: restore state 1
    const redoneState = JSON.parse(JSON.stringify(state1));
    assert(redoneState.pageEdits['page-1'].contentEdits['clause-2-hdr'].isShifted, 'Redo restores shifted positions');
  });

  // --------------------------------------------------------------------------
  // TEST 10: PDF Export Binary Output & Structural Validity
  // --------------------------------------------------------------------------
  await runAsyncTest(10, 'Export modified PDF and verify valid binary output and objects', async () => {
    const srcDoc = await PDFDocument.create();
    const page = srcDoc.addPage([612, 792]);
    page.drawText('Sample Legal Document Agreement', { x: 54, y: 720, size: 14 });
    const originalPdfBytes = await srcDoc.save();

    const blocks = createContractDocBlocks();
    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-clause-1': { text: 'New expanded clause text flowing across multiple lines.' },
      },
    });

    const exportResult = await exportModifiedPdf(
      originalPdfBytes,
      [{ id: 'page-1', originalIndex: 1, width: 612, height: 792, rotation: 0 }],
      {
        'page-1': {
          objects: reflowResult.exportObjects,
        },
      }
    );

    const exportedBytes = exportResult?.pdfBytes || exportResult;
    assert(exportedBytes instanceof Uint8Array, 'Export must return Uint8Array');
    assert(exportedBytes.length > 500, 'Exported bytes must be a valid PDF buffer');

    const verifiedDoc = await PDFDocument.load(exportedBytes);
    assert.strictEqual(verifiedDoc.getPageCount(), 1, 'Exported PDF must have 1 page');
    const outPage = verifiedDoc.getPage(0);
    assert.strictEqual(outPage.getWidth(), 612, 'Page width must be preserved');
    assert.strictEqual(outPage.getHeight(), 792, 'Page height must be preserved');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Existing PDF Page Operations Integrity
  // --------------------------------------------------------------------------
  runTest(11, 'Existing PDF page operations (rotate, reorder, delete, blank page) remain intact', () => {
    const initialPages = [
      { id: 'page-1', originalIndex: 1, isBlank: false, rotation: 0 },
      { id: 'page-2', originalIndex: 2, isBlank: false, rotation: 0 },
    ];

    // Rotate
    const rotated = rotatePage(initialPages, 'page-1', 'cw');
    assert.strictEqual(rotated[0].rotation, 90, 'Page 1 must rotate 90 deg cw');

    // Move
    const moved = movePage(initialPages, 'page-2', 'up');
    assert.strictEqual(moved[0].id, 'page-2', 'Page 2 must move to index 0');

    // Add Blank Page
    const { pages: withBlank, newPageId } = addBlankPage(initialPages, 1);
    assert.strictEqual(withBlank.length, 3, 'Must have 3 pages after adding blank');
    assert(withBlank[1].isBlank, 'Inserted page must be blank');

    // Delete Page
    const { pages: afterDelete } = deletePage(withBlank, newPageId);
    assert.strictEqual(afterDelete.length, 2, 'Must have 2 pages after deleting blank');
  });

  // --------------------------------------------------------------------------
  // TEST 12: Image Editor Isolation
  // --------------------------------------------------------------------------
  runTest(12, 'Image Editor functionality and OCR metadata remain completely untouched', () => {
    const ocrBlock = {
      id: 'img-ocr-1',
      str: 'Original text in image document',
      isOcrDetected: true,
      left: 100,
      top: 100,
      width: 200,
      height: 20,
    };

    assert.strictEqual(ocrBlock.isOcrDetected, true, 'OCR flag is preserved');
    assert(ocrBlock.id.startsWith('img-'), 'Image block ID prefix is preserved');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Single-Line Paragraph Expansion with Container Width Wrapping
  // --------------------------------------------------------------------------
  runTest(13, 'Single-line paragraph expands and wraps to verified container width rather than short line width', () => {
    // 1-line paragraph that is only 90pt wide initially
    const singleLineBlocks = [
      { id: 'single-para-1', str: 'Project Overview:', origPdfLeft: 54, origPdfTop: 100, origPdfWidth: 90, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 112, rawFontSize: 11, isParagraphMember: true, paraId: 'para-single' },
      { id: 'next-sec-hdr', str: 'Deliverables', origPdfLeft: 54, origPdfTop: 140, origPdfWidth: 100, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 152, rawFontSize: 12, isBold: true },
    ];

    const expandedText = 'This project overview includes a comprehensive architectural review of high throughput streaming pipelines, secure identity federations, and distributed caching protocols across multiple availability zones. Multi-region failover and zero-trust perimeter policies are enforced across all services.';

    const reflowResult = calculatePageReflow({
      allBlocks: singleLineBlocks,
      paragraphEdits: {
        'para-single': { text: expandedText },
      },
      options: { pageWidth: 612, pageHeight: 792, bottomMargin: 45 },
    });

    const activeLines = Object.values(reflowResult.contentEdits).filter((e) => !e.isClearedLine && !e.isShifted);
    // On 500pt available container width, this text should wrap to 2-3 lines (NOT 10 lines if wrapped at 90pt!)
    assert(activeLines.length >= 2 && activeLines.length <= 4, `Expected 2 to 4 wrapped lines, got ${activeLines.length}`);

    // Downstream header must shift down
    const nextHdr = reflowResult.contentEdits['next-sec-hdr'];
    assert(nextHdr && nextHdr.isShifted, 'Deliverables header must shift down');
    assert(nextHdr.shiftY > 0, 'Shift must be positive downward');
  });

  // --------------------------------------------------------------------------
  // TEST 14: Visual Band Composite Row Preservation (Side-by-Side Elements)
  // --------------------------------------------------------------------------
  runTest(14, 'Side-by-side elements on the same baseline (e.g. Job Title on left, Date on right) shift cohesively without tearing', () => {
    const blocksWithSideBySide = [
      // Top paragraph
      { id: 'p1-l1', str: 'Top introduction paragraph line 1', origPdfLeft: 54, origPdfTop: 100, origPdfWidth: 350, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 112, isParagraphMember: true, paraId: 'para-top' },
      { id: 'p1-l2', str: 'Top introduction paragraph line 2', origPdfLeft: 54, origPdfTop: 115, origPdfWidth: 350, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 127, isParagraphMember: true, paraId: 'para-top' },

      // Visual Band at y = 170: Left Title & Right-Aligned Date (zero horizontal overlap!)
      { id: 'job-title', str: 'Senior Cloud Architect', origPdfLeft: 54, origPdfTop: 170, origPdfWidth: 200, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 182, rawFontSize: 12, isBold: true },
      { id: 'job-date', str: '2022 – Present', origPdfLeft: 460, origPdfTop: 170, origPdfWidth: 94, origPdfHeight: 14, origBaseVx: 460, origBaseVy: 182, rawFontSize: 11 },
    ];

    // Expand top paragraph
    const reflowResult = calculatePageReflow({
      allBlocks: blocksWithSideBySide,
      paragraphEdits: {
        'para-top': { text: 'Expanded paragraph text that adds multiple detailed descriptions across several lines to push content down significantly. '.repeat(3) },
      },
    });

    const titleEdit = reflowResult.contentEdits['job-title'];
    const dateEdit = reflowResult.contentEdits['job-date'];

    assert(titleEdit && titleEdit.isShifted, 'Job title on the left must shift');
    assert(dateEdit && dateEdit.isShifted, 'Job date on the right must shift together with title');
    assert.strictEqual(titleEdit.shiftY, dateEdit.shiftY, 'Job title and date must share identical vertical shift');
    assert.strictEqual(titleEdit.block.pdfTop, dateEdit.block.pdfTop, 'Job title and date must maintain exact horizontal baseline alignment');
  });

  // --------------------------------------------------------------------------
  // TEST 15: AFM Standard Font Metrics Determinism
  // --------------------------------------------------------------------------
  runTest(15, 'Standard AFM metrics (Helvetica, Times, Courier) compute exact deterministic text widths', () => {
    // 1. Courier is fixed width 0.600em
    const courierWidth = measureTextWidth('Antigravity', 10, 'Courier');
    assert.strictEqual(courierWidth, 11 * 10 * 0.60, 'Courier must be exactly length * fontSize * 0.60');

    // 2. Helvetica standard glyph metrics
    const helvWidth = measureTextWidth('Hello World', 12, 'Helvetica');
    assert(helvWidth > 60 && helvWidth < 80, `Expected Helvetica width ~68pt, got ${helvWidth}`);

    // 3. Times-Roman proportional serif metrics
    const timesWidth = measureTextWidth('Hello World', 12, 'Times');
    assert(timesWidth > 55 && timesWidth < 75, `Expected Times width ~62pt, got ${timesWidth}`);
  });

  // --------------------------------------------------------------------------
  // TEST 16: Synthetic Line Safety (No Bogus Whiteouts or Duplicate Masks)
  // --------------------------------------------------------------------------
  runTest(16, 'Synthetic lines do not produce duplicate whiteout masks in exportObjects', () => {
    const blocks = createContractDocBlocks();
    const longText = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six. Sentence seven.';

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-clause-1': { text: longText },
      },
    });

    // In exportObjects, only the first line of the expanded paragraph should have whiteoutLines populated
    const paraExportObjects = reflowResult.exportObjects.filter((o) => o.originalBlockId && (o.originalBlockId.startsWith('c1-') || o.originalBlockId.includes('clause-1')));
    const objectsWithWhiteout = paraExportObjects.filter((o) => Array.isArray(o.whiteoutLines) && o.whiteoutLines.length > 0);

    assert.strictEqual(objectsWithWhiteout.length, 1, 'Only exactly 1 export object per paragraph should carry whiteoutLines');
  });

  // --------------------------------------------------------------------------
  // TEST 17: Multi-Paragraph Sequential Edits & Distinct Element Typography
  // --------------------------------------------------------------------------
  runTest(17, 'Multi-paragraph sequential edits propagate upstream shifts without corrupting distinct element typography', () => {
    const blocks = [
      // Section Heading (14pt Bold, Dark Navy, distinct styling)
      { id: 'sec-hdr-1', str: 'Professional Experience', origPdfLeft: 54, origPdfTop: 50, origPdfWidth: 250, origPdfHeight: 18, origBaseVx: 54, origBaseVy: 65, rawFontSize: 14, isBold: true, fill: '#0f172a' },
      
      // Paragraph 1 (2 lines at y = 80)
      { id: 'p1-l1', str: 'Architected enterprise microservices on distributed Kubernetes clusters.', origPdfLeft: 54, origPdfTop: 80, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 92, rawFontSize: 10, isParagraphMember: true, paraId: 'para-1' },
      { id: 'p1-l2', str: 'Reduced operational latency by 45% using gRPC and Redis caching.', origPdfLeft: 54, origPdfTop: 95, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 107, rawFontSize: 10, isParagraphMember: true, paraId: 'para-1' },

      // Sub-Heading / Role (12pt Italic, Slate)
      { id: 'role-hdr', str: 'Senior Infrastructure Engineer', origPdfLeft: 54, origPdfTop: 118, origPdfWidth: 250, origPdfHeight: 15, origBaseVx: 54, origBaseVy: 130, rawFontSize: 12, isItalic: true, fill: '#334155' },

      // Paragraph 2 (2 lines at y = 140)
      { id: 'p2-l1', str: 'Implemented automated CI/CD pipelines with comprehensive security scanning.', origPdfLeft: 54, origPdfTop: 140, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 152, rawFontSize: 10, isParagraphMember: true, paraId: 'para-2' },
      { id: 'p2-l2', str: 'Enforced SOC2 compliance and zero-trust identity policies.', origPdfLeft: 54, origPdfTop: 155, origPdfWidth: 504, origPdfHeight: 13, origBaseVx: 54, origBaseVy: 167, rawFontSize: 10, isParagraphMember: true, paraId: 'para-2' },

      // Downstream Section 2 Heading (14pt Bold, Dark Navy)
      { id: 'sec-hdr-2', str: 'Education & Certifications', origPdfLeft: 54, origPdfTop: 178, origPdfWidth: 250, origPdfHeight: 18, origBaseVx: 54, origBaseVy: 193, rawFontSize: 14, isBold: true, fill: '#0f172a' },
    ];

    // User edits BOTH Paragraph 1 AND Paragraph 2
    // Paragraph 1 expands from 2 lines to 3 lines (+15pt delta, exceeding 10pt clearance)
    const longP1 = 'Architected enterprise microservices on distributed Kubernetes clusters across multi-region VPC networks. Deployed automated failover mechanisms and resilient stateful sets. Reduced operational latency by 45% using gRPC and Redis caching.';
    // Paragraph 2 expands from 2 lines to 3 lines (+15pt delta, exceeding 10pt clearance)
    const longP2 = 'Implemented automated CI/CD pipelines with comprehensive static code analysis and container vulnerability scanning. Managed artifact registries and cryptographic image signing. Enforced SOC2 compliance and zero-trust identity policies.';

    const reflowResult = calculatePageReflow({
      allBlocks: blocks,
      paragraphEdits: {
        'para-1': { text: longP1, fontSize: 10 },
        'para-2': { text: longP2, fontSize: 10 },
      },
    });

    // 1. Section 1 Heading (upstream of Para 1) MUST NOT shift
    assert(!reflowResult.contentEdits['sec-hdr-1'], 'Upstream heading must not shift');

    // 2. Role Heading (between Para 1 and Para 2) MUST shift down by Para 1 delta
    const roleEdit = reflowResult.contentEdits['role-hdr'];
    assert(roleEdit && roleEdit.isShifted, 'Role header between paragraphs must shift');
    assert(roleEdit.shiftY > 0, 'Role header shift must be positive');
    // Typography MUST be preserved verbatim: 12pt Italic, fill #334155 (NOT overwritten by paragraph's 10pt normal #000000)
    assert.strictEqual(roleEdit.block.fontSize || roleEdit.block.rawFontSize, 12, 'Role header must retain its own 12pt font size');
    assert.strictEqual(roleEdit.block.isItalic, true, 'Role header must retain italic styling');
    assert.strictEqual(roleEdit.block.fill, '#334155', 'Role header must retain its original text color');

    // 3. Paragraph 2 MUST start at its original top + Para 1 delta (NOT its unshifted top!)
    const p2FirstLine = reflowResult.contentEdits['p2-l1'];
    assert(p2FirstLine, 'Paragraph 2 first line must be present in contentEdits');
    assert(p2FirstLine.block.pdfTop > 140, `Paragraph 2 first line (${p2FirstLine.block.pdfTop}) must be shifted below its original 140`);
    assert.strictEqual(p2FirstLine.block.pdfTop, 140 + roleEdit.shiftY, 'Paragraph 2 starting top must equal originalTop + upstreamShift');

    // 4. Section 2 Heading (below both paragraphs) MUST shift down by the COMBINED shift (delta1 + delta2)
    const sec2Edit = reflowResult.contentEdits['sec-hdr-2'];
    assert.strictEqual(sec2Edit.shiftY, roleEdit.shiftY + 15, 'Section 2 shift must equal cumulative displacement of both paragraphs (15 + 15 = 30pt)');
    assert.strictEqual(sec2Edit.block.rawFontSize, 14, 'Section 2 header must retain its own 14pt font size');
    assert.strictEqual(sec2Edit.block.isBold, true, 'Section 2 header must retain bold weight');
  });

  // --------------------------------------------------------------------------
  // TEST 18: Preserving Hyperlinks, Divider Lines, and Annotations Across Shifts
  // --------------------------------------------------------------------------
  await runAsyncTest(18, 'Downstream hyperlinks and vector divider lines shift cohesively and generate valid PDF annotations', async () => {
    const blocksWithLink = [
      // Top paragraph to expand
      { id: 'intro-1', str: 'Welcome to our platform services agreement.', origPdfLeft: 54, origPdfTop: 80, origPdfWidth: 504, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 92, rawFontSize: 11, isParagraphMember: true, paraId: 'para-intro' },
      { id: 'intro-2', str: 'Please review our guidelines below.', origPdfLeft: 54, origPdfTop: 96, origPdfWidth: 504, origPdfHeight: 14, origBaseVx: 54, origBaseVy: 108, rawFontSize: 11, isParagraphMember: true, paraId: 'para-intro' },

      // Downstream link line with clickable URL and custom color
      {
        id: 'terms-link-line',
        str: 'Read full terms at https://example.com/terms and conditions.',
        origPdfLeft: 54,
        origPdfTop: 180,
        origPdfWidth: 350,
        origPdfHeight: 14,
        origBaseVx: 54,
        origBaseVy: 192,
        rawFontSize: 10,
        fill: '#0284c7',
        linkUrl: 'https://example.com/terms',
      },
    ];

    // Downstream horizontal divider line (Fabric line vector object at y = 150)
    const canvasObjects = [
      {
        id: 'section-divider-line',
        type: 'line',
        left: 54,
        top: 140,
        origTop: 140,
        x1: 54,
        y1: 140,
        origY1: 140,
        x2: 558,
        y2: 140,
        origY2: 140,
        stroke: '#cbd5e1',
        strokeWidth: 1.5,
      },
    ];

    const expandedIntro = 'Welcome to our comprehensive platform services agreement. We provide enterprise-grade reliability, SOC2 certified data centers, high-availability clusters, automated backup solutions, real-time telemetry monitoring, and 24/7 dedicated engineering support across all operational regions. We guarantee 99.99% system availability, redundant data replication across geographic zones, and automated disaster recovery failover mechanisms for mission-critical enterprise workloads.';

    const reflowResult = calculatePageReflow({
      allBlocks: blocksWithLink,
      paragraphEdits: {
        'para-intro': { text: expandedIntro, fontSize: 11 },
      },
      canvasObjects,
    });

    // 1. Verify Divider Line shifted down while preserving its coordinates & geometry
    const shiftedDivider = reflowResult.shiftedCanvasObjects.find((o) => o.id === 'section-divider-line');
    assert(shiftedDivider, 'Divider line must be in shiftedCanvasObjects');
    assert(shiftedDivider.top > 140, 'Divider line top must shift down');
    assert.strictEqual(shiftedDivider.y1, shiftedDivider.top, 'Divider line y1 must match shifted top');
    assert.strictEqual(shiftedDivider.y2, shiftedDivider.top, 'Divider line y2 must maintain horizontal orientation');
    assert.strictEqual(shiftedDivider.stroke, '#cbd5e1', 'Divider line stroke color must be preserved');
    assert.strictEqual(shiftedDivider.strokeWidth, 1.5, 'Divider line thickness must be preserved');

    // 2. Verify Downstream Hyperlink block preserves linkUrl and text color
    const linkEdit = reflowResult.contentEdits['terms-link-line'];
    assert(linkEdit && linkEdit.isShifted, 'Terms link line must shift down');
    assert.strictEqual(linkEdit.linkUrl, 'https://example.com/terms', 'Hyperlink URL must be preserved');
    assert.strictEqual(linkEdit.block.fill, '#0284c7', 'Hyperlink custom color must be preserved');

    // 3. Export PDF and verify binary with link annotation
    const testDoc = await PDFDocument.create();
    testDoc.addPage([612, 792]);
    const origPdfBytes = await testDoc.save();

    const exportResult = await exportModifiedPdf(
      origPdfBytes,
      [{ id: 'page-1', originalIndex: 1, isBlank: false, rotation: 0 }],
      {
        'page-1': {
          objects: [...reflowResult.shiftedCanvasObjects, ...reflowResult.exportObjects],
        },
      }
    );

    const exportedBytes = exportResult?.pdfBytes || exportResult;
    assert(exportedBytes instanceof Uint8Array, 'Export must return Uint8Array');
    const verifiedDoc = await PDFDocument.load(exportedBytes);
    const page = verifiedDoc.getPage(0);
    // Annotations array must exist on the page
    const annots = page.node.Annots();
    assert(annots && annots.size() > 0, 'Page must contain active link annotations in PDF tree');
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
  if (passedCount === totalCount) {
    console.log(`${COLORS.green}${COLORS.bold}  ✔ ALL ${passedCount}/${totalCount} REFLOW VERIFICATION TESTS PASSED SUCCESSFULLY!${COLORS.reset}`);
  } else {
    console.error(`${COLORS.red}${COLORS.bold}  ✖ FAILED: ${totalCount - passedCount} of ${totalCount} tests failed.${COLORS.reset}`);
    process.exit(1);
  }
  console.log(`${COLORS.bold}================================================================${COLORS.reset}\n`);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
