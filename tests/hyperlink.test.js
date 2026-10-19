/**
 * Automated Test Suite: Hyperlink Feature
 * Tests adding, editing, and removing clickable hyperlinks in exported PDFs.
 */

import assert from 'node:assert';
import { exportModifiedPdf, addLinkAnnotation } from '../src/features/export/exportPdf.js';
import { generateSamplePdf } from '../src/utils/samplePdf.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';

async function runTests() {
  console.log('--- Running Hyperlink Feature Automated Tests ---');

  // Test 1: Helper addLinkAnnotation adds valid URI annotations
  console.log('Test 1: addLinkAnnotation creates conforming URI annotations...');
  {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);

    // Add HTTP URL without prefix (should auto-prefix https://)
    addLinkAnnotation(doc, page, [50, 50, 200, 70], 'example.com/docs');
    // Add mailto URL (should preserve protocol)
    addLinkAnnotation(doc, page, [50, 100, 200, 120], 'mailto:support@example.com');

    const pdfBytes = await doc.save();
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const p1 = await pdfDoc.getPage(1);
    const annots = await p1.getAnnotations();

    assert.strictEqual(annots.length, 2, 'Should create exactly 2 annotations');
    assert.strictEqual(annots[0].subtype, 'Link', 'First annot should be Link');
    assert.strictEqual(annots[0].url, 'https://example.com/docs', 'Should auto-normalize to https://');
    assert.strictEqual(annots[1].subtype, 'Link', 'Second annot should be Link');
    assert.strictEqual(annots[1].url, 'mailto:support@example.com', 'Should preserve mailto:');
    console.log('✔ Test 1 Passed: addLinkAnnotation works reliably.');
  }

  // Test 2: Export PDF with clickable standard Textbox hyperlink
  console.log('Test 2: Export standard Textbox with clickable hyperlink...');
  {
    const sampleBuffer = await generateSamplePdf();
    const pages = [{ id: 'p1', width: 612, height: 792, originalIndex: 1, isBlank: false }];
    const pageEdits = {
      p1: {
        objects: [
          {
            type: 'textbox',
            text: 'Visit Google',
            left: 100,
            top: 200,
            width: 150,
            height: 25,
            fontSize: 16,
            fontFamily: 'Helvetica',
            fill: '#2563eb',
            linkUrl: 'https://google.com',
          },
        ],
      },
    };

    const { pdfBytes: exportedBytes } = await exportModifiedPdf(sampleBuffer, pages, pageEdits);
    const pdfDoc = await pdfjsLib.getDocument({ data: exportedBytes }).promise;
    const p1 = await pdfDoc.getPage(1);
    const annots = await p1.getAnnotations();

    const linkAnnot = annots.find((a) => a.subtype === 'Link');
    assert.ok(linkAnnot, 'Exported PDF should have a Link annotation');
    assert.strictEqual(linkAnnot.url, 'https://google.com/', 'Annotation should point to https://google.com/');
    assert.strictEqual(linkAnnot.rect[0], 100, 'Rect X1 should match object left');
    console.log('✔ Test 2 Passed: Textbox hyperlink exported with correct URI and bounding box.');
  }

  // Test 3: Export PDF with in-place PDF content block hyperlink (link-only, preserving original text)
  console.log('Test 3: Export in-place PDF text with hyperlink preserving original text...');
  {
    const sampleBuffer = await generateSamplePdf();
    const pages = [{ id: 'p1', width: 612, height: 792, originalIndex: 1, isBlank: false }];
    const pageEdits = {
      p1: {
        contentEdits: {
          'block-1': {
            text: 'Original Heading Text',
            originalText: 'Original Heading Text',
            linkUrl: 'https://github.com/myrepo',
            isLinkOnly: true,
          },
        },
        objects: [
          {
            type: 'textbox',
            text: 'Original Heading Text',
            left: 50,
            top: 150,
            width: 250,
            height: 20,
            fontSize: 14,
            isPdfContentEdit: true,
            isLinkOnly: true,
            linkUrl: 'https://github.com/myrepo',
            originalBlockId: 'block-1',
          },
        ],
      },
    };

    const { pdfBytes: exportedBytes } = await exportModifiedPdf(sampleBuffer, pages, pageEdits);
    const pdfDoc = await pdfjsLib.getDocument({ data: exportedBytes }).promise;
    const p1 = await pdfDoc.getPage(1);
    const annots = await p1.getAnnotations();

    const linkAnnot = annots.find((a) => a.subtype === 'Link');
    assert.ok(linkAnnot, 'Exported PDF should have Link annotation for content block');
    assert.strictEqual(linkAnnot.url, 'https://github.com/myrepo', 'Annotation should point to GitHub repo');
    console.log('✔ Test 3 Passed: In-place text hyperlink attached cleanly preserving original style.');
  }

  // Test 4: Editing and Removing a hyperlink
  console.log('Test 4: Editing and Removing a hyperlink...');
  {
    const sampleBuffer = await generateSamplePdf();
    const pages = [{ id: 'p1', width: 612, height: 792, originalIndex: 1, isBlank: false }];

    // 4A: Edited URL
    const editedEdits = {
      p1: {
        objects: [
          {
            type: 'textbox',
            text: 'Click here',
            left: 50,
            top: 150,
            width: 100,
            height: 20,
            fontSize: 14,
            linkUrl: 'https://updated-link.org',
          },
        ],
      },
    };
    const { pdfBytes: editedBytes } = await exportModifiedPdf(sampleBuffer, pages, editedEdits);
    const docEdited = await pdfjsLib.getDocument({ data: editedBytes }).promise;
    const pEdited = await docEdited.getPage(1);
    const annotsEdited = await pEdited.getAnnotations();
    assert.strictEqual(annotsEdited[0].url, 'https://updated-link.org/', 'Should reflect updated URL');

    // 4B: Removed URL (linkUrl set to empty string or null)
    const removedEdits = {
      p1: {
        objects: [
          {
            type: 'textbox',
            text: 'Click here',
            left: 50,
            top: 150,
            width: 100,
            height: 20,
            fontSize: 14,
            linkUrl: '',
          },
        ],
      },
    };
    const { pdfBytes: removedBytes } = await exportModifiedPdf(sampleBuffer, pages, removedEdits);
    const docRemoved = await pdfjsLib.getDocument({ data: removedBytes }).promise;
    const pRemoved = await docRemoved.getPage(1);
    const annotsRemoved = await pRemoved.getAnnotations();
    assert.strictEqual(annotsRemoved.length, 0, 'Should have 0 Link annotations after removal');
    console.log('✔ Test 4 Passed: Hyperlink editing and removal verified.');
  }

  console.log('\n--- All Hyperlink Feature Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('Hyperlink test failed:', err);
  process.exit(1);
});
