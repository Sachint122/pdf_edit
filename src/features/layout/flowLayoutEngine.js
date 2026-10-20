/**
 * Flow Layout Engine
 * Calculates continuous document-flow layout (like Microsoft Word / Google Docs)
 * without arbitrary fixed 2D coordinate collision or manual Y-shifting.
 * Supports multi-page pagination and flow-to-PDF compilation via pdf-lib.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { FontManager } from '../export/fontManager.js';
import { toPdfLibRgb } from '../export/colorParser.js';
import { addLinkAnnotation } from '../export/exportPdf.js';
import { sanitizeForWinAnsi } from '../../utils/textSanitizer.js';
import { wrapTextToLines } from '../editing/layoutEngine.js';

export class FlowLayoutEngine {
  /**
   * Typeset document flow elements into paginated flow pages
   * @param {Array<object>} sections - Document sections with items
   * @param {object} [options={}]
   * @returns {Array<object>} Array of pages with laid out lines
   */
  static typesetDocumentFlow(sections = [], options = {}) {
    const pageWidth = options.pageWidth || 612;
    const pageHeight = options.pageHeight || 792;
    const margin = options.margin || 54;
    const contentWidth = pageWidth - (margin * 2);

    const pages = [];
    let curPageLines = [];
    let curY = margin;

    const startNewPage = () => {
      if (curPageLines.length > 0) {
        pages.push({
          pageNumber: pages.length + 1,
          lines: curPageLines,
          pageWidth,
          pageHeight,
        });
        curPageLines = [];
        curY = margin;
      }
    };

    for (const sec of sections) {
      // 1. Heading element
      if (sec.headingElement) {
        const hStyle = sec.headingElement.style || {};
        const hFontSize = hStyle.fontSize || 14;
        const hFontFamily = hStyle.fontFamily || 'Helvetica';
        const hLineHeight = hFontSize * 1.35;
        const hSpacingAfter = 6;

        // Check if heading fits on current page (plus at least one following line)
        if (curY + hLineHeight + hSpacingAfter > pageHeight - margin - 30) {
          startNewPage();
        }

        const hLines = wrapTextToLines(
          sec.headingElement.text || '',
          contentWidth,
          hFontSize,
          hFontFamily,
          true,
          Boolean(hStyle.isItalic)
        );

        for (const hl of hLines) {
          curPageLines.push({
            type: 'heading',
            text: hl,
            x: margin,
            y: curY,
            fontSize: hFontSize,
            fontFamily: hFontFamily,
            isBold: true,
            isItalic: Boolean(hStyle.isItalic),
            color: hStyle.color || '#0f172a',
            textAlign: hStyle.textAlign || 'left',
          });
          curY += hLineHeight;
        }
        curY += hSpacingAfter;
      }

      // 2. Section body items (paragraphs, bullets)
      for (const item of (sec.items || [])) {
        const style = item.style || {};
        const fontSize = style.fontSize || 10.5;
        const fontFamily = style.fontFamily || 'Helvetica';
        const isBold = Boolean(style.isBold);
        const isItalic = Boolean(style.isItalic);
        const color = style.color || '#334155';
        const lineHeight = fontSize * 1.32;
        const isBullet = item.type === 'list_item';
        const indent = isBullet ? 16 : 0;
        const availableTextWidth = contentWidth - indent;

        const wrapped = wrapTextToLines(
          item.text || '',
          availableTextWidth,
          fontSize,
          fontFamily,
          isBold,
          isItalic
        );

        for (let lIdx = 0; lIdx < wrapped.length; lIdx++) {
          const lText = wrapped[lIdx];
          if (curY + lineHeight > pageHeight - margin) {
            startNewPage();
          }

          curPageLines.push({
            type: item.type,
            text: lText,
            prefix: (isBullet && lIdx === 0) ? '• ' : '',
            x: margin + indent,
            y: curY,
            fontSize,
            fontFamily,
            isBold,
            isItalic,
            color,
            textAlign: style.textAlign || 'left',
            linkUrl: item.style?.linkUrl || '',
          });
          curY += lineHeight;
        }
        // Spacing between paragraphs
        curY += (isBullet ? 3 : 6);
      }

      // Spacing between sections
      curY += 10;
    }

    if (curPageLines.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        lines: curPageLines,
        pageWidth,
        pageHeight,
      });
    }

    return pages;
  }

  /**
   * Export the typeset document flow into clean vector PDF binary bytes
   * @param {Array<object>} sections
   * @param {object} [options={}]
   * @returns {Promise<Uint8Array>}
   */
  static async exportFlowToPdf(sections = [], options = {}) {
    const doc = await PDFDocument.create();
    const fontManager = new FontManager(doc);
    const flowPages = FlowLayoutEngine.typesetDocumentFlow(sections, options);

    for (const fp of flowPages) {
      const page = doc.addPage([fp.pageWidth, fp.pageHeight]);
      const pHeight = fp.pageHeight;

      for (const line of fp.lines) {
        const font = await fontManager.getFont(
          line.fontFamily,
          line.isBold ? 'bold' : 'normal',
          line.isItalic ? 'italic' : 'normal'
        );
        const textColor = toPdfLibRgb(line.color) || rgb(0, 0, 0);
        const fullText = sanitizeForWinAnsi((line.prefix || '') + line.text);
        const lineY = pHeight - line.y - (line.fontSize * 0.82);

        page.drawText(fullText, {
          x: line.x,
          y: lineY,
          size: line.fontSize,
          font,
          color: textColor,
        });

        // Add clickable link annotation if linkUrl exists
        if (line.linkUrl) {
          let textW = 100;
          try {
            textW = font.widthOfTextAtSize(fullText, line.fontSize);
          } catch {
            textW = fullText.length * line.fontSize * 0.55;
          }
          const rect = [
            line.x,
            lineY - 2,
            line.x + textW,
            lineY + line.fontSize + 2,
          ];
          addLinkAnnotation(doc, page, rect, line.linkUrl);
        }
      }
    }

    return await doc.save();
  }
}
