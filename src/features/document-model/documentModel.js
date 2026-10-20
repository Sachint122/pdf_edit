/**
 * Document Model
 * Converts low-level 2D PDF coordinates into a semantic, document-flow structure:
 * Headings, Paragraphs, Lists, Sections, Links, and Dividers.
 */

import { isHeadingText } from '../editing/layoutEngine.js';

export class DocumentModel {
  /**
   * Parse extracted page text blocks into a semantic document flow model
   * @param {Array<object>} allBlocks - Extracted text blocks with 2D coordinates
   * @param {object} [options={}]
   * @returns {object} Semantic Document Model
   */
  static parseFromPdfBlocks(allBlocks = [], options = {}) {
    const pageWidth = options.pageWidth || 612;
    const pageHeight = options.pageHeight || 792;

    // Filter valid non-empty blocks
    const validBlocks = (allBlocks || []).filter((b) => {
      const str = (b.str || b.originalStr || '').trim();
      return str.length > 0;
    });

    if (validBlocks.length === 0) {
      return {
        title: 'Empty Document',
        sections: [],
        pageWidth,
        pageHeight,
      };
    }

    // Sort into natural reading order: top-to-bottom, left-to-right
    const sorted = [...validBlocks].sort((a, b) => {
      const aTop = Number.isFinite(a.origPdfTop) ? a.origPdfTop : (a.pdfTop ?? a.top ?? 0);
      const bTop = Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? b.top ?? 0);
      if (Math.abs(aTop - bTop) > 6) {
        return aTop - bTop;
      }
      const aLeft = Number.isFinite(a.origPdfLeft) ? a.origPdfLeft : (a.pdfLeft ?? a.left ?? 0);
      const bLeft = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? b.left ?? 0);
      return aLeft - bLeft;
    });

    // Detect median font size for relative heading classification
    const fontSizes = sorted.map((b) => b.rawFontSize || b.fontSize || 11).sort((a, b) => a - b);
    const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 11;

    // Group text blocks into logical paragraphs and headings
    const elements = [];
    let currentPara = null;

    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      const str = (b.str || b.originalStr || '').trim();
      const fontSize = b.rawFontSize || b.fontSize || medianFontSize;
      const isBold = Boolean(b.isBold || b.fontWeight === 'bold');
      const isItalic = Boolean(b.isItalic || b.fontStyle === 'italic');
      const color = b.fill || b.color || '#000000';
      const linkUrl = b.linkUrl || '';
      const top = Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? b.top ?? 0);
      const left = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? b.left ?? 0);

      const isHeading = isHeadingText(str, { fontSize, isBold, medianFontSize });
      const isBullet = /^[\u2022\u2023\u25E6\u2043\u2219•\-*]\s+/.test(str);

      if (isHeading) {
        if (currentPara) {
          elements.push(currentPara);
          currentPara = null;
        }
        elements.push({
          id: `elem-heading-${b.id || i}`,
          type: 'heading',
          text: str,
          style: {
            fontSize: Math.max(13, fontSize),
            fontFamily: b.fontFamily || 'Helvetica',
            isBold: true,
            isItalic,
            color,
            textAlign: b.textAlign || 'left',
          },
          originalTop: top,
          originalLeft: left,
        });
      } else if (isBullet) {
        if (currentPara) {
          elements.push(currentPara);
          currentPara = null;
        }
        elements.push({
          id: `elem-bullet-${b.id || i}`,
          type: 'list_item',
          text: str.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*]\s+/, '').trim(),
          style: {
            fontSize,
            fontFamily: b.fontFamily || 'Helvetica',
            isBold,
            isItalic,
            color,
            textAlign: b.textAlign || 'left',
            linkUrl,
          },
          originalTop: top,
          originalLeft: left,
        });
      } else {
        // Body text: check if it continues the current paragraph
        if (currentPara) {
          const prevTop = currentPara.lastTop;
          const lineGap = top - prevTop;
          const samePara = lineGap <= (fontSize * 1.8) && lineGap >= 0;
          if (samePara) {
            currentPara.text += ` ${str}`;
            currentPara.lastTop = top;
            currentPara.sourceBlockIds.push(b.id);
            continue;
          } else {
            elements.push(currentPara);
            currentPara = null;
          }
        }

        currentPara = {
          id: `elem-para-${b.id || i}`,
          type: 'paragraph',
          text: str,
          style: {
            fontSize,
            fontFamily: b.fontFamily || 'Helvetica',
            isBold,
            isItalic,
            color,
            textAlign: b.textAlign || 'left',
            linkUrl,
          },
          originalTop: top,
          originalLeft: left,
          lastTop: top,
          sourceBlockIds: [b.id],
        };
      }
    }

    if (currentPara) {
      elements.push(currentPara);
    }

    // Group elements under logical document sections
    const sections = [];
    let currentSection = {
      id: 'sec-root',
      title: 'General',
      items: [],
    };

    for (const elem of elements) {
      if (elem.type === 'heading') {
        if (currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          id: `sec-${elem.id}`,
          title: elem.text,
          headingElement: elem,
          items: [],
        };
      } else {
        currentSection.items.push(elem);
      }
    }

    if (currentSection.items.length > 0 || currentSection.headingElement) {
      sections.push(currentSection);
    }

    return {
      title: elements[0]?.type === 'heading' ? elements[0].text : 'Document',
      elements,
      sections,
      pageWidth,
      pageHeight,
      medianFontSize,
    };
  }
}
