/**
 * Sample PDF Generator
 * Creates a clean, multi-page PDF locally using pdf-lib in browser memory.
 * No external requests or downloads required.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateSamplePdf() {
  const pdfDoc = await PDFDocument.create();

  // Embed standard Helvetica fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // --- Page 1: Overview & Welcome ---
  const page1 = pdfDoc.addPage([612, 792]); // Standard US Letter in points
  const { width: p1Width, height: p1Height } = page1.getSize();

  // Top header banner
  page1.drawRectangle({
    x: 40,
    y: p1Height - 120,
    width: p1Width - 80,
    height: 70,
    color: rgb(0.12, 0.22, 0.38),
  });

  page1.drawText('Sample Document for PDF Editor', {
    x: 60,
    y: p1Height - 85,
    size: 22,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Client-Side Local Processing • Generated in Browser', {
    x: 60,
    y: p1Height - 105,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.75, 0.85, 0.95),
  });

  // Section 1
  page1.drawText('1. Document Information', {
    x: 40,
    y: p1Height - 160,
    size: 15,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });

  const bodyTextP1 = [
    'Welcome to the Frontend-Only PDF Editor workspace.',
    'This sample document was generated entirely locally using pdf-lib in your browser memory.',
    'No document bytes were transmitted over the network or stored in external servers.',
    '',
    'Features to explore in Phase 1:',
    '• Crisp multi-page rendering powered by PDF.js',
    '• Thumbnail sidebar navigation with real-time active page tracking',
    '• High-DPR zoom controls (Zoom In, Zoom Out, Fit Width, Fit Page)',
    '• Seamless document replacement and resource teardown',
  ];

  let yOffsetP1 = p1Height - 190;
  for (const line of bodyTextP1) {
    page1.drawText(line, {
      x: 40,
      y: yOffsetP1,
      size: 11,
      font: line.startsWith('•') ? fontHelveticaBold : fontHelvetica,
      color: rgb(0.2, 0.25, 0.3),
      lineHeight: 16,
    });
    yOffsetP1 -= 20;
  }

  // Feature Card Box
  page1.drawRectangle({
    x: 40,
    y: yOffsetP1 - 100,
    width: p1Width - 80,
    height: 90,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.7, 0.8, 0.95),
    borderWidth: 1,
  });

  page1.drawText('Security & Privacy Guarantee', {
    x: 60,
    y: yOffsetP1 - 35,
    size: 13,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.3, 0.6),
  });

  page1.drawText('All parsing, rendering, canvas editing, and PDF exports are conducted completely', {
    x: 60,
    y: yOffsetP1 - 55,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.25, 0.3, 0.35),
  });

  page1.drawText('within client-side JavaScript memory. Your files never leave this machine.', {
    x: 60,
    y: yOffsetP1 - 70,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.25, 0.3, 0.35),
  });

  // Footer
  page1.drawText('Page 1 of 3 — Frontend PDF Editor Sample', {
    x: 40,
    y: 35,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.55, 0.6),
  });

  // --- Page 2: Multi-Page Content Demonstration ---
  const page2 = pdfDoc.addPage([612, 792]);
  const { width: p2Width, height: p2Height } = page2.getSize();

  page2.drawText('2. Multi-Page Navigation Test', {
    x: 40,
    y: p2Height - 60,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });

  page2.drawText('This second page allows testing page-switching, scrolling, and thumbnail rendering.', {
    x: 40,
    y: p2Height - 85,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Diagram Box 1
  page2.drawRectangle({
    x: 40,
    y: p2Height - 240,
    width: (p2Width - 100) / 2,
    height: 130,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page2.drawText('Layer 1: Original PDF', {
    x: 55,
    y: p2Height - 140,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  page2.drawText('Rendered via PDF.js with', {
    x: 55,
    y: p2Height - 165,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('device-pixel-ratio scaling for', {
    x: 55,
    y: p2Height - 180,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('retina clarity and sharp fonts.', {
    x: 55,
    y: p2Height - 195,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Diagram Box 2
  page2.drawRectangle({
    x: 40 + (p2Width - 100) / 2 + 20,
    y: p2Height - 240,
    width: (p2Width - 100) / 2,
    height: 130,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page2.drawText('Layer 2: Interactive Overlay', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 140,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  page2.drawText('Fabric.js vector canvas layer', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 165,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('enabling text boxes, freehand pen,', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 180,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('signatures, and shapes.', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 195,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Footer Page 2
  page2.drawText('Page 2 of 3 — Frontend PDF Editor Sample', {
    x: 40,
    y: 35,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.55, 0.6),
  });

  // --- Page 3: Sample Agreement & Signature Placeholder ---
  const page3 = pdfDoc.addPage([612, 792]);
  const { width: p3Width, height: p3Height } = page3.getSize();

  page3.drawText('3. Sample Sign-Off & Verification', {
    x: 40,
    y: p3Height - 60,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });

  page3.drawText('Use this test section to evaluate document annotations and signatures.', {
    x: 40,
    y: p3Height - 85,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Sign area
  page3.drawRectangle({
    x: 40,
    y: p3Height - 250,
    width: p3Width - 80,
    height: 120,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 1,
  });

  page3.drawText('Authorized Signature Line:', {
    x: 60,
    y: p3Height - 165,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.35, 0.4),
  });

  // Dotted/dashed signature line
  page3.drawLine({
    start: { x: 60, y: p3Height - 210 },
    end: { x: 300, y: p3Height - 210 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('Sign Here', {
    x: 60,
    y: p3Height - 225,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('Date:', {
    x: 340,
    y: p3Height - 165,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.35, 0.4),
  });

  page3.drawLine({
    start: { x: 340, y: p3Height - 210 },
    end: { x: 480, y: p3Height - 210 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('DD / MM / YYYY', {
    x: 340,
    y: p3Height - 225,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer Page 3
  page3.drawText('Page 3 of 3 — Frontend PDF Editor Sample', {
    x: 40,
    y: 35,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Save to Uint8Array
  const pdfBytes = await pdfDoc.save();
  return pdfBytes.buffer;
}
