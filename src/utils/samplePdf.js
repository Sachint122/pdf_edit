/**
 * Professional Sample Document Generator
 * Generates an executive services agreement locally using pdf-lib in browser memory.
 * Provides realistic, clean, and professional document content for testing and demonstration.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateSamplePdf() {
  const pdfDoc = await PDFDocument.create();

  // Embed standard Helvetica fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // =========================================================================
  // Page 1: Overview, Executive Summary & Deliverables
  // =========================================================================
  const page1 = pdfDoc.addPage([612, 792]); // Standard US Letter (points)
  const { width: p1Width, height: p1Height } = page1.getSize();

  // Top Header Banner
  page1.drawRectangle({
    x: 40,
    y: p1Height - 120,
    width: p1Width - 80,
    height: 70,
    color: rgb(0.12, 0.22, 0.38),
  });

  page1.drawText('Executive Services Agreement', {
    x: 60,
    y: p1Height - 85,
    size: 22,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Strategic Consulting & Project Deliverables • Master Framework', {
    x: 60,
    y: p1Height - 105,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.75, 0.85, 0.95),
  });

  // Section 1: Executive Summary
  page1.drawText('1. Scope of Work & Deliverables', {
    x: 40,
    y: p1Height - 160,
    size: 15,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });

  const bodyTextP1 = [
    'This agreement defines the strategic deliverables, milestone schedule, and operational standards',
    'established between the participating organizations for the current initiative.',
    'All milestones are structured to ensure transparency, security, and measurable outcomes.',
    '',
    'Key Project Deliverables:',
    '• Architecture Assessment: Comprehensive review of system design and workflow requirements.',
    '• Solution Delivery: End-to-end implementation aligned with agreed functional specifications.',
    '• Quality Assurance: Multi-stage testing, validation benchmarks, and performance verification.',
    '• Handover & Enablement: Operational documentation, training sessions, and deployment support.',
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

  // Feature / Security Card Box
  page1.drawRectangle({
    x: 40,
    y: yOffsetP1 - 100,
    width: p1Width - 80,
    height: 90,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.7, 0.8, 0.95),
    borderWidth: 1,
  });

  page1.drawText('Confidentiality & Data Protection Standards', {
    x: 60,
    y: yOffsetP1 - 35,
    size: 13,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.3, 0.6),
  });

  page1.drawText('Both parties commit to upholding strict standards of confidentiality, data integrity, and compliance.', {
    x: 60,
    y: yOffsetP1 - 55,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.25, 0.3, 0.35),
  });

  page1.drawText('All proprietary materials, records, and deliverables remain strictly protected under standard NDA protocols.', {
    x: 60,
    y: yOffsetP1 - 70,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.25, 0.3, 0.35),
  });

  // Footer Page 1
  page1.drawText('Page 1 of 3 — Executive Services Agreement', {
    x: 40,
    y: 35,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.55, 0.6),
  });

  // =========================================================================
  // Page 2: Project Milestones & Governance
  // =========================================================================
  const page2 = pdfDoc.addPage([612, 792]);
  const { width: p2Width, height: p2Height } = page2.getSize();

  page2.drawText('2. Project Milestones & Execution Schedule', {
    x: 40,
    y: p2Height - 60,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });

  page2.drawText('Structured milestone roadmap designed for predictable, on-schedule project delivery.', {
    x: 40,
    y: p2Height - 85,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Card 1: Phase A
  page2.drawRectangle({
    x: 40,
    y: p2Height - 240,
    width: (p2Width - 100) / 2,
    height: 130,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page2.drawText('Phase 1: Discovery & Planning', {
    x: 55,
    y: p2Height - 140,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  page2.drawText('Timeline: Weeks 1 – 3', {
    x: 55,
    y: p2Height - 165,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.45, 0.65),
  });
  page2.drawText('Scope: Stakeholder interviews, workflow', {
    x: 55,
    y: p2Height - 180,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('discovery, requirements specification, and', {
    x: 55,
    y: p2Height - 195,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('initial architecture sign-off.', {
    x: 55,
    y: p2Height - 210,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Card 2: Phase B
  page2.drawRectangle({
    x: 40 + (p2Width - 100) / 2 + 20,
    y: p2Height - 240,
    width: (p2Width - 100) / 2,
    height: 130,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page2.drawText('Phase 2: Execution & Handover', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 140,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  page2.drawText('Timeline: Weeks 4 – 8', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 165,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.45, 0.65),
  });
  page2.drawText('Scope: Core engineering, quality assurance,', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 180,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('integration testing, user acceptance review,', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 195,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawText('and executive milestone sign-off.', {
    x: 40 + (p2Width - 100) / 2 + 35,
    y: p2Height - 210,
    size: 10,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Footer Page 2
  page2.drawText('Page 2 of 3 — Executive Services Agreement', {
    x: 40,
    y: 35,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.55, 0.6),
  });

  // =========================================================================
  // Page 3: Authorization & Signatures
  // =========================================================================
  const page3 = pdfDoc.addPage([612, 792]);
  const { width: p3Width, height: p3Height } = page3.getSize();

  page3.drawText('3. Acceptance & Authorization', {
    x: 40,
    y: p3Height - 60,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.2, 0.25),
  });

  page3.drawText('Authorized representatives confirm acceptance of the project scope and schedule above.', {
    x: 40,
    y: p3Height - 85,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Sign area 1: Client
  page3.drawRectangle({
    x: 40,
    y: p3Height - 230,
    width: p3Width - 80,
    height: 110,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page3.drawText('Client Representative: Sarah Jenkins, VP Operations', {
    x: 60,
    y: p3Height - 150,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  page3.drawLine({
    start: { x: 60, y: p3Height - 195 },
    end: { x: 280, y: p3Height - 195 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('Authorized Signature', {
    x: 60,
    y: p3Height - 210,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawLine({
    start: { x: 320, y: p3Height - 195 },
    end: { x: 480, y: p3Height - 195 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('Date (DD / MM / YYYY)', {
    x: 320,
    y: p3Height - 210,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Sign area 2: Service Provider
  page3.drawRectangle({
    x: 40,
    y: p3Height - 370,
    width: p3Width - 80,
    height: 110,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page3.drawText('Service Provider: David Vance, Managing Director', {
    x: 60,
    y: p3Height - 290,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  page3.drawLine({
    start: { x: 60, y: p3Height - 335 },
    end: { x: 280, y: p3Height - 335 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('Authorized Signature', {
    x: 60,
    y: p3Height - 350,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawLine({
    start: { x: 320, y: p3Height - 335 },
    end: { x: 480, y: p3Height - 335 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  page3.drawText('Date (DD / MM / YYYY)', {
    x: 320,
    y: p3Height - 350,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer Page 3
  page3.drawText('Page 3 of 3 — Executive Services Agreement', {
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
