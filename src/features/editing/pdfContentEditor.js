/**
 * PDF Content Editor Module
 * Extracts existing text blocks from PDF pages with exact font, size, and coordinates,
 * enabling direct in-place text replacement and content editing.
 */

import { Textbox } from 'fabric';
import { OPS } from 'pdfjs-dist';

/**
 * Extracts accurate text fill colors and background colors from PDF.js operator list.
 * @param {object} opList - PDF.js operator list
 * @param {object} [opsEnum] - Optional OPS dictionary
 * @returns {Array<{ x: number, y: number, color: string }>}
 */
export function extractTextColorsFromOpList(opList, opsEnum = OPS) {
  if (!opList || !Array.isArray(opList.fnArray)) return [];

  const opsReverse = {};
  if (opsEnum && typeof opsEnum === 'object') {
    for (const [k, v] of Object.entries(opsEnum)) {
      opsReverse[v] = k;
    }
  }

  const toHex = (r, g, b) => {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v <= 1 ? v * 255 : v)));
    return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
  };

  const cmykToRgb = (c, m, y, k) => {
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    return toHex(r, g, b);
  };

  const stateStack = [];
  let currentFillColor = '#000000';
  let currentMatrix = [1, 0, 0, 1, 0, 0];
  const colorMap = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const fnName = opsReverse[fn] || '';
    const args = opList.argsArray[i];

    if (fnName === 'save' || fn === 10) {
      stateStack.push({ fillColor: currentFillColor, matrix: [...currentMatrix] });
    } else if (fnName === 'restore' || fn === 11) {
      if (stateStack.length > 0) {
        const state = stateStack.pop();
        currentFillColor = state.fillColor;
        currentMatrix = state.matrix;
      }
    } else if (fnName === 'setFillRGBColor' || fn === 59) {
      if (typeof args[0] === 'string') {
        currentFillColor = args[0].startsWith('#') ? args[0] : `#${args[0]}`;
      } else if (Array.isArray(args) && args.length >= 3) {
        currentFillColor = toHex(args[0], args[1], args[2]);
      }
    } else if (fnName === 'setFillColorN' || fnName === 'setFillColor' || fn === 54 || fn === 55) {
      if (Array.isArray(args)) {
        if (args.length === 1 && typeof args[0] === 'number') {
          currentFillColor = toHex(args[0], args[0], args[0]);
        } else if (args.length === 3) {
          currentFillColor = toHex(args[0], args[1], args[2]);
        } else if (args.length === 4) {
          currentFillColor = cmykToRgb(args[0], args[1], args[2], args[3]);
        }
      }
    } else if (fnName === 'setFillColorGray' || fn === 60) {
      if (typeof args[0] === 'number') {
        currentFillColor = toHex(args[0], args[0], args[0]);
      }
    } else if (fnName === 'setTextMatrix' || fn === 42) {
      if (args && args[0]) {
        currentMatrix = [args[0][0], args[0][1], args[0][2], args[0][3], args[0][4], args[0][5]];
      }
    } else if (fnName === 'moveText' || fn === 40) {
      if (args && typeof args[0] === 'number' && typeof args[1] === 'number') {
        currentMatrix[4] += args[0];
        currentMatrix[5] += args[1];
      }
    } else if (fnName === 'showText' || fnName === 'showSpacedText' || fn === 44 || fn === 45) {
      colorMap.push({
        x: currentMatrix[4],
        y: currentMatrix[5],
        color: currentFillColor,
      });
    }
  }

  return colorMap;
}

/**
 * Maps PDF.js internal font families to standard cross-platform font families.
 * @param {string} fontName
 * @param {string} [rawFontFamily]
 * @returns {'Helvetica'|'Times'|'Courier'}
 */
export function normalizeFontFamily(fontName = '', rawFontFamily = '', extraStr = '') {
  const lower = `${fontName} ${rawFontFamily} ${extraStr}`.toLowerCase();
  if (lower.includes('sans') || lower.includes('arial') || lower.includes('helvetica')) {
    return 'Helvetica';
  }
  if (lower.includes('times') || lower.includes('serif') || lower.includes('roman') || lower.includes('georgia')) {
    return 'Times';
  }
  if (lower.includes('courier') || lower.includes('mono') || lower.includes('consolas')) {
    return 'Courier';
  }
  return 'Helvetica';
}

/**
 * Extracts and groups text items from a PDF page into editable line or paragraph blocks.
 *
 * @param {object} pdfDoc - PDF.js document proxy
 * @param {number} pageNumber - 1-indexed page number
 * @param {number} [scale=1.0] - Current canvas scale factor
 * @param {number} [rotation=0] - Current page rotation
 * @param {'paragraph'|'line'} [groupMode='paragraph'] - Whether to group lines into paragraphs
 * @returns {Promise<Array<object>>}
 */
export async function extractPageTextBlocks(pdfDoc, pageNumber, scale = 1.0, rotation = 0, _groupMode = 'line') {
  if (!pdfDoc || !pageNumber) return [];

  try {
    const page = await pdfDoc.getPage(pageNumber);
    // Base viewport in unscaled PDF points (scale = 1.0) for Fabric objects and PDF export
    const baseViewport = page.getViewport({ scale: 1.0, rotation });
    // Screen viewport in display pixels for the interactive HTML hitbox overlay
    const screenViewport = page.getViewport({ scale, rotation });
    const textContent = await page.getTextContent();

    if (!textContent || !Array.isArray(textContent.items)) {
      return [];
    }

    const items = textContent.items.filter(
      (it) => it.str && typeof it.str === 'string' && it.str.trim().length > 0
    );

    // Safely evaluate operators so common font objects are loaded and text colors are extracted
    let colorMap = [];
    try {
      if (typeof page.getOperatorList === 'function') {
        const opList = await page.getOperatorList();
        if (opList && opList.fnArray) {
          colorMap = extractTextColorsFromOpList(opList, OPS);
        }
      }
    } catch {
      // Non-blocking in mock environments
    }

    const getResolvedFontObj = (name) => {
      try {
        if (page.commonObjs && typeof page.commonObjs.has === 'function' && page.commonObjs.has(name)) {
          return page.commonObjs.get(name);
        }
      } catch {
        // ignore
      }
      return null;
    };

    // Step 1: Group items on the same baseline into line blocks
    const lineBlocks = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const transform = item.transform; // [scaleX, skewY, skewX, scaleY, x, y]

      // Match text color from colorMap by spatial proximity
      let itemColor = '#1e293b';
      if (colorMap.length > 0) {
        let bestDist = Infinity;
        let matchedColor = null;
        for (let cIdx = 0; cIdx < colorMap.length; cIdx++) {
          const entry = colorMap[cIdx];
          const dist = Math.hypot(entry.x - transform[4], entry.y - transform[5]);
          if (dist < bestDist) {
            bestDist = dist;
            matchedColor = entry.color;
          }
        }
        if (matchedColor && bestDist < 12.0) {
          itemColor = matchedColor;
        }
      }

      // Unscaled baseline coordinates in PDF points (scale = 1.0)
      const [baseVx, baseVy] = baseViewport.convertToViewportPoint(transform[4], transform[5]);
      const rawFontSize = Math.hypot(transform[0], transform[1]);
      const exactFontSize = Number(rawFontSize.toFixed(2));
      const rawWidth = Math.max(4, item.width);

      const styleObj = textContent.styles?.[item.fontName] || {};
      const ascent = (typeof styleObj.ascent === 'number' && styleObj.ascent > 0) ? styleObj.ascent : 0.76;
      const descent = (typeof styleObj.descent === 'number') ? Math.abs(styleObj.descent) : 0.20;

      const fontObj = getResolvedFontObj(item.fontName);
      const fontCandidates = [
        item.fontName,
        styleObj.fontFamily,
        fontObj?.name,
        fontObj?.baseFontName,
        fontObj?.fallbackName,
        fontObj?.loadedName,
        fontObj?.cssFontInfo?.fontFamily,
      ].filter(Boolean).join(' ');

      const fontCandidatesLower = fontCandidates.toLowerCase();

      const isBold = Boolean(
        fontObj?.bold ||
        fontObj?.black ||
        (fontObj?.cssFontInfo?.fontWeight && fontObj.cssFontInfo.fontWeight >= 600) ||
        /bold|black|heavy|w[7-9]|semibold/i.test(fontCandidatesLower)
      );

      const isItalic = Boolean(
        fontObj?.italic ||
        fontObj?.cssFontInfo?.italic ||
        /italic|oblique/i.test(fontCandidatesLower)
      );

      const fontFamily = normalizeFontFamily(item.fontName, styleObj.fontFamily, fontCandidatesLower);

      // Unscaled coordinates in PDF points:
      const pdfLeft = Math.round(baseVx - 1);
      const pdfTop = Math.round(baseVy - (exactFontSize * 0.98));
      const pdfWidth = Math.round(rawWidth + 3);
      const pdfHeight = Math.round(exactFontSize * 1.20);

      // Screen pixel coordinates for the interactive HTML hitbox overlay
      const [screenVx, screenVy] = screenViewport.convertToViewportPoint(transform[4], transform[5]);
      const screenLeft = Math.round(screenVx - 2);
      const screenTop = Math.round(screenVy - (exactFontSize * 0.98 * scale));
      const screenWidth = Math.max(16, Math.round((rawWidth + 4) * scale));
      const screenHeight = Math.max(14, Math.round(exactFontSize * 1.20 * scale));

      // Group with previous item on the same line if baseline matches
      const last = lineBlocks[lineBlocks.length - 1];
      const sameLine = last && Math.abs(last.baseVy - baseVy) <= Math.max(2.5, exactFontSize * 0.22);
      const closeGap = last && baseVx >= last.baseVx && baseVx - (last.baseVx + last.rawWidth) <= exactFontSize * 2.2;

      if (sameLine && closeGap) {
        const gap = baseVx - (last.baseVx + last.rawWidth);
        const needsSpace = gap > 2 && !last.str.endsWith(' ') && !item.str.startsWith(' ');
        last.str += (needsSpace ? ' ' : '') + item.str;
        last.rawWidth = Math.max(last.rawWidth, baseVx + rawWidth - last.baseVx);
        last.pdfWidth = Math.round(last.rawWidth + 3);
        last.screenWidth = Math.max(16, Math.round((last.rawWidth + 4) * scale));
        last.pdfTop = Math.min(last.pdfTop, pdfTop);
        last.pdfHeight = Math.max(last.pdfHeight, pdfHeight);
        last.screenTop = Math.min(last.screenTop, screenTop);
        last.screenHeight = Math.max(last.screenHeight, screenHeight);
        last.width = last.screenWidth;
        last.height = last.screenHeight;
        if (last.fill === '#1e293b' && itemColor !== '#1e293b') {
          last.fill = itemColor;
          last.color = itemColor;
        }
      } else {
        lineBlocks.push({
          id: `line-${pageNumber}-${lineBlocks.length + 1}`,
          str: item.str,
          baseVx,
          baseVy,
          rawWidth,
          rawFontSize: exactFontSize,
          ascent,
          descent,
          pdfLeft,
          pdfTop,
          pdfWidth,
          pdfHeight,
          pdfFontSize: exactFontSize,
          screenLeft,
          screenTop,
          screenWidth,
          screenHeight,
          left: screenLeft,
          top: screenTop,
          width: screenWidth,
          height: screenHeight,
          fontSize: exactFontSize,
          fontFamily,
          isBold,
          isItalic,
          fontWeight: isBold ? 'bold' : 'normal',
          fontStyle: isItalic ? 'italic' : 'normal',
          fill: itemColor,
          color: itemColor,
          backgroundColor: '#ffffff',
          pdfX: transform[4],
          pdfY: transform[5],
          pdfHeightVal: item.height || exactFontSize,
        });
      }
    }

    // Step 2: Identify paragraph clusters among lines and link them
    const paragraphGroups = [];
    let currentPara = null;
    const bulletRegex = /^([•\u2022\u25cf\u25cb\-*]|\d+[.)])\s+/;

    for (let i = 0; i < lineBlocks.length; i++) {
      const line = lineBlocks[i];

      if (!currentPara) {
        currentPara = {
          id: `para-${pageNumber}-${paragraphGroups.length + 1}`,
          lines: [line],
          fontFamily: line.fontFamily,
          rawFontSize: line.rawFontSize,
          isBold: line.isBold,
          isItalic: line.isItalic,
          baseVx: line.baseVx,
          baseVy: line.baseVy,
        };
        continue;
      }

      const prevLine = currentPara.lines[currentPara.lines.length - 1];

      // Criteria for belonging to the same paragraph:
      const sameFont = line.fontFamily === prevLine.fontFamily && line.isBold === prevLine.isBold && line.isItalic === prevLine.isItalic;
      const sameSize = Math.abs(line.rawFontSize - prevLine.rawFontSize) <= 1.2;
      const verticalGap = line.baseVy - prevLine.baseVy;
      const validLineGap = verticalGap >= prevLine.rawFontSize * 0.85 && verticalGap <= prevLine.rawFontSize * 1.85;
      const sameLeftMargin = Math.abs(line.baseVx - currentPara.baseVx) <= Math.max(6, prevLine.rawFontSize * 0.8);
      const isHangingIndent = line.baseVx >= currentPara.baseVx && (line.baseVx - currentPara.baseVx) <= 28;
      const validIndent = sameLeftMargin || isHangingIndent;
      const isNewBullet = bulletRegex.test(line.str.trim());

      if (sameFont && sameSize && validLineGap && validIndent && !isNewBullet) {
        currentPara.lines.push(line);
      } else {
        paragraphGroups.push(currentPara);
        currentPara = {
          id: `para-${pageNumber}-${paragraphGroups.length + 1}`,
          lines: [line],
          fontFamily: line.fontFamily,
          rawFontSize: line.rawFontSize,
          isBold: line.isBold,
          isItalic: line.isItalic,
          baseVx: line.baseVx,
          baseVy: line.baseVy,
        };
      }
    }

    if (currentPara) {
      paragraphGroups.push(currentPara);
    }

    // Step 3: Return lines as independent selectable blocks, enriched with paragraph metadata
    const blocks = [];
    let blockCounter = 1;

    for (const group of paragraphGroups) {
      const isMultiLinePara = group.lines.length > 1;

      // Assign stable block IDs across all lines in this paragraph group
      for (let idx = 0; idx < group.lines.length; idx++) {
        group.lines[idx].id = `text-block-${pageNumber}-${blockCounter++}`;
      }

      const groupLinesRef = group.lines.map((l) => ({
        id: l.id,
        str: l.str,
        rawWidth: l.rawWidth,
        rawFontSize: l.rawFontSize,
        ascent: l.ascent,
        descent: l.descent,
        pdfLeft: l.pdfLeft,
        pdfTop: l.pdfTop,
        pdfWidth: l.pdfWidth,
        pdfHeight: l.pdfHeight,
        baseVx: l.baseVx,
        baseVy: l.baseVy,
      }));

      for (let idx = 0; idx < group.lines.length; idx++) {
        const line = group.lines[idx];

        blocks.push({
          ...line,
          isParagraph: false,
          isParagraphMember: isMultiLinePara,
          paraId: group.id,
          lineIndex: idx,
          paraLines: groupLinesRef,
          originalStr: line.str,
          lines: [{ ...line }],
        });
      }
    }

    return blocks;
  } catch (err) {
    console.warn(`Could not extract text content for page ${pageNumber}:`, err);
    return [];
  }
}

/**
 * Automatically rearranges (reflows) text across lines of a paragraph when a line is modified or deleted.
 * Preserves exact font sizes, baselines, left margins, and document structure.
 *
 * @param {Array<object>} paraLines - All line objects in the paragraph
 * @param {string} editedLineId - The ID of the line that was edited
 * @param {string} newText - The new text for the edited line
 * @param {object} [existingEdits={}] - Current content edits map for this page
 * @returns {Array<{ lineId: string, text: string, originalText: string, block: object }>}
 */
export function reflowParagraphText(paraLines, editedLineId, newText, existingEdits = {}) {
  if (!Array.isArray(paraLines) || paraLines.length === 0) {
    return [{ lineId: editedLineId, text: newText, originalText: newText }];
  }

  // 1. Reconstruct composite paragraph text replacing the edited line's content
  const fullTextParts = [];
  for (const line of paraLines) {
    if (line.id === editedLineId) {
      if (newText && newText.trim().length > 0) {
        fullTextParts.push(newText.trim());
      }
    } else {
      const currentVal = existingEdits[line.id]?.text ?? line.str;
      if (currentVal && currentVal.trim().length > 0) {
        fullTextParts.push(currentVal.trim());
      }
    }
  }

  const combinedText = fullTextParts.join(' ').replace(/\s+/g, ' ').trim();
  const words = combinedText.length > 0 ? combinedText.split(' ') : [];

  const results = [];
  let wordIdx = 0;

  for (let i = 0; i < paraLines.length; i++) {
    const line = paraLines[i];
    const isLastLine = i === paraLines.length - 1;

    // Approximate character capacity based on line's original width and character count
    const origLength = Math.max(10, (line.str || '').trim().length);
    const avgCharWidth = (line.rawWidth || 300) / origLength;
    const maxChars = Math.max(15, Math.floor((line.rawWidth || 300) / avgCharWidth));

    const currentLineWords = [];
    let currentLineLength = 0;

    while (wordIdx < words.length) {
      const nextWord = words[wordIdx];
      const addedLength = currentLineWords.length === 0 ? nextWord.length : nextWord.length + 1;

      // Fill line up to capacity (last line takes remaining words)
      if (currentLineWords.length > 0 && !isLastLine && (currentLineLength + addedLength) > maxChars) {
        break;
      }

      currentLineWords.push(nextWord);
      currentLineLength += addedLength;
      wordIdx++;
    }

    const arrangedLineText = currentLineWords.join(' ');

    results.push({
      lineId: line.id,
      text: arrangedLineText,
      originalText: line.str,
      block: line,
    });
  }

  return results;
}

/**
 * Creates an in-place editable Textbox on the target Fabric canvas,
 * seamlessly covering the original PDF text with a solid whiteout mask
 * and matching the exact text, font, size, and layout.
 *
 * @param {import('fabric').Canvas} canvas
 * @param {object} block - Extracted text block
 * @returns {import('fabric').Textbox|null}
 */
export function createInPlaceTextBox(canvas, block) {
  if (!canvas || !block) return null;

  // Use unscaled PDF point coordinates (scale = 1.0) because Fabric canvas has setZoom(scale) applied.
  // This guarantees the Textbox renders at the exact same location as the PDF text across all zoom levels.
  const pad = 2;
  const left = block.pdfLeft ?? block.left ?? 0;
  const top = block.pdfTop ?? block.top ?? 0;
  const width = Math.max(40, block.pdfWidth ?? block.width ?? 60);
  const fontSize = block.rawFontSize ?? block.pdfFontSize ?? block.fontSize ?? 16;
  const fontFamily = block.fontFamily || 'Helvetica';
  const fontWeight = block.fontWeight || (block.isBold ? 'bold' : 'normal');
  const fontStyle = block.fontStyle || (block.isItalic ? 'italic' : 'normal');
  const fill = block.fill || block.color || '#0f172a';
  const backgroundColor = block.backgroundColor || '#ffffff';

  const textbox = new Textbox(block.str, {
    left,
    top,
    width,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    fill,
    backgroundColor, // Solid whiteout mask to hide original PDF text
    textAlign: 'left',
    lineHeight: 1.0,
    padding: pad,
    borderColor: '#2563eb',
    cornerColor: '#2563eb',
    cornerSize: 8,
    transparentCorners: false,
    // Custom metadata to indicate this is direct in-place content editing
    isPdfContentEdit: true,
    originalBlockId: block.id,
    originalPdfCoords: {
      x: block.pdfX ?? left,
      y: block.pdfY ?? top,
      width: block.rawWidth ?? width,
      height: block.pdfHeightVal ?? fontSize,
      fontSize,
    },
  });

  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();

  // Enter edit mode immediately so user can type/change content right away
  if (typeof textbox.enterEditing === 'function') {
    try {
      textbox.enterEditing();
      if (typeof textbox.selectAll === 'function') {
        textbox.selectAll();
      }
    } catch {
      // Ignored if Fabric canvas not yet focused
    }
  }

  return textbox;
}
