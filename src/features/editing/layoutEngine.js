/**
 * Document Layout & Automatic PDF Section Reflow Engine
 *
 * Provides Word-like paragraph expansion and shrinkage with automatic
 * layout adjustment:
 * - Recalculates paragraph height using font metrics, available width, line spacing, and wrapping.
 * - Detects column boundaries, headings, divider lines, and section structures.
 * - Identifies dependent downstream elements while leaving unrelated columns/sidebars untouched.
 * - Computes exact, reversible vertical shifts (zero cumulative drift across repeated edits).
 * - Identifies and safely handles page overflow.
 */

// Memoized 2D canvas context for high-performance text measurement in browser
// Standard Adobe Font Metrics (AFM) glyph width tables (units per 1000 em)
// Matches PDF.js and pdf-lib standard 14 font rendering across all platforms
const AFM_HELVETICA = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 222,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, 'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778,
  'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778,
  'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556,
  '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556,
  'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556,
  'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722,
  'x': 500, 'y': 500, 'z': 500, '{': 334, '|': 260, '}': 334, '~': 584,
  '•': 350, '–': 556, '—': 1000, '“': 333, '”': 333, '‘': 222, '’': 222,
};

const AFM_TIMES = {
  ' ': 250, '!': 333, '"': 408, '#': 500, '$': 500, '%': 833, '&': 778, "'": 180,
  '(': 333, ')': 333, '*': 500, '+': 564, ',': 250, '-': 333, '.': 250, '/': 278,
  '0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
  '8': 500, '9': 500, ':': 278, ';': 278, '<': 564, '=': 564, '>': 564, '?': 444,
  '@': 921, 'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556, 'G': 722,
  'H': 722, 'I': 333, 'J': 389, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 722,
  'P': 556, 'Q': 722, 'R': 667, 'S': 556, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 333, '\\': 278, ']': 333, '^': 422, '_': 500,
  '`': 333, 'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444, 'f': 278, 'g': 500,
  'h': 500, 'i': 278, 'j': 278, 'k': 500, 'l': 278, 'm': 778, 'n': 500, 'o': 500,
  'p': 500, 'q': 500, 'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722,
  'x': 500, 'y': 500, 'z': 444, '{': 400, '|': 275, '}': 400, '~': 541,
  '•': 350, '–': 500, '—': 1000, '“': 444, '”': 444, '‘': 250, '’': 250,
};

/**
 * Measure text string width using actual font metrics.
 * @param {string} text
 * @param {number} fontSize
 * @param {string} fontFamily
 * @param {boolean} isBold
 * @param {boolean} isItalic
 * @returns {number} width in PDF points
 */
export function measureTextWidth(text, fontSize = 12, fontFamily = 'Helvetica', isBold = false, _isItalic = false) {
  if (!text) return 0;

  // Courier is fixed pitch: 0.600 em
  if (fontFamily === 'Courier') {
    return text.length * fontSize * 0.60;
  }

  // Standard AFM lookup for Helvetica and Times
  const isTimes = fontFamily === 'Times';
  const afmTable = isTimes ? AFM_TIMES : AFM_HELVETICA;
  let totalEm = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const emWidth = afmTable[ch] !== undefined ? afmTable[ch] : 520;
    totalEm += emWidth;
  }

  const boldFactor = isBold ? 1.05 : 1.0;
  return (totalEm / 1000) * fontSize * boldFactor;
}

/**
 * Word-wraps text within a given column width using exact font metrics.
 * Preserves explicit newlines (`\n`) and handles long words gracefully.
 *
 * @param {string} text
 * @param {number} availableWidth
 * @param {number} fontSize
 * @param {string} fontFamily
 * @param {boolean} isBold
 * @param {boolean} isItalic
 * @returns {Array<string>} Array of wrapped line strings
 */
export function wrapTextToLines(
  text = '',
  availableWidth = 300,
  fontSize = 12,
  fontFamily = 'Helvetica',
  isBold = false,
  isItalic = false
) {
  if (text === null || text === undefined) return [''];

  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split('\n');
  const wrappedLines = [];
  const safeWidth = Math.max(20, availableWidth);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paraText = paragraphs[pIdx].trim();

    if (paraText.length === 0) {
      // Empty paragraph line (e.g. double newline)
      wrappedLines.push('');
      continue;
    }

    const words = paraText.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrappedLines.push('');
      continue;
    }

    let currentLineWords = [];
    let currentLineText = '';

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const testLine = currentLineWords.length === 0 ? word : `${currentLineText} ${word}`;
      const testWidth = measureTextWidth(testLine, fontSize, fontFamily, isBold, isItalic);

      if (testWidth <= safeWidth || currentLineWords.length === 0) {
        currentLineWords.push(word);
        currentLineText = testLine;
      } else {
        // Line full — commit current line and start new one with this word
        wrappedLines.push(currentLineText);
        currentLineWords = [word];
        currentLineText = word;
      }
    }

    if (currentLineWords.length > 0) {
      wrappedLines.push(currentLineText);
    }
  }

  return wrappedLines.length > 0 ? wrappedLines : [''];
}

/**
 * Identifies column boundaries in a page based on horizontal text clustering.
 * Prevents edits in one column from affecting unrelated columns or sidebars.
 *
 * @param {Array<object>} blocks - All text blocks on the page
 * @param {number} [pageWidth=612]
 * @returns {{ columns: Array<{ id: number, minX: number, maxX: number, isSidebar: boolean }>, getColumnForX: Function }}
 */
export function detectColumnsAndFlow(blocks = [], pageWidth = 612) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return {
      columns: [{ id: 0, minX: 0, maxX: pageWidth, isSidebar: false }],
      getColumnForX: () => 0,
    };
  }

  // Filter valid content blocks
  const valid = blocks.filter((b) => {
    const left = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? b.baseVx ?? 0);
    const width = Number.isFinite(b.origPdfWidth) ? b.origPdfWidth : (b.pdfWidth ?? b.rawWidth ?? 50);
    return width >= 20 && left >= 0 && (left + width) <= pageWidth + 20;
  });

  if (valid.length <= 3) {
    return {
      columns: [{ id: 0, minX: 0, maxX: pageWidth, isSidebar: false }],
      getColumnForX: () => 0,
    };
  }

  // Sample left margin clusters
  const leftMargins = valid.map((b) => Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? b.baseVx ?? 0));
  leftMargins.sort((a, b) => a - b);

  // Group margins with gap > 40pt
  const clusters = [];
  let curCluster = [leftMargins[0]];

  for (let i = 1; i < leftMargins.length; i++) {
    if (leftMargins[i] - leftMargins[i - 1] > 40) {
      clusters.push(curCluster);
      curCluster = [leftMargins[i]];
    } else {
      curCluster.push(leftMargins[i]);
    }
  }
  if (curCluster.length > 0) {
    clusters.push(curCluster);
  }

  // Significant columns must have >= 15% of page text blocks
  const minBlocksForCol = Math.max(2, Math.floor(valid.length * 0.15));
  const significant = clusters.filter((c) => c.length >= minBlocksForCol);

  if (significant.length >= 2) {
    const cols = significant.map((c, idx) => {
      const avgLeft = c.reduce((sum, v) => sum + v, 0) / c.length;
      const colBlocks = valid.filter((b) => {
        const l = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? b.baseVx ?? 0);
        return Math.abs(l - avgLeft) <= 35;
      });
      // When computing column right boundary, exclude spanning full-width elements
      const nonSpanningColBlocks = colBlocks.filter((b) => {
        const w = Number.isFinite(b.origPdfWidth) ? b.origPdfWidth : (b.pdfWidth ?? b.rawWidth ?? 50);
        return w < pageWidth * 0.55;
      });
      const blocksForBounds = nonSpanningColBlocks.length > 0 ? nonSpanningColBlocks : colBlocks;
      const rights = blocksForBounds.map((b) => {
        const l = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? b.baseVx ?? 0);
        const w = Number.isFinite(b.origPdfWidth) ? b.origPdfWidth : (b.pdfWidth ?? b.rawWidth ?? 50);
        return l + w;
      });
      const maxR = rights.length > 0 ? Math.max(...rights) : avgLeft + 200;
      const colWidth = maxR - avgLeft;
      return {
        id: idx,
        minX: Math.max(0, avgLeft - 10),
        maxX: Math.min(pageWidth, maxR + 10),
        isSidebar: colWidth < pageWidth * 0.32,
      };
    });

    return {
      columns: cols,
      getColumnForX: (x) => {
        const matchingCols = cols.filter((col) => x >= col.minX - 15 && x <= col.maxX + 15);
        if (matchingCols.length === 1) return matchingCols[0].id;
        if (matchingCols.length > 1) {
          matchingCols.sort((a, b) => {
            const centerA = (a.minX + a.maxX) / 2;
            const centerB = (b.minX + b.maxX) / 2;
            return Math.abs(x - centerA) - Math.abs(x - centerB);
          });
          return matchingCols[0].id;
        }
        return -1; // Span across or neutral
      },
    };
  }

  // Single-column layout default
  return {
    columns: [{ id: 0, minX: 0, maxX: pageWidth, isSidebar: false }],
    getColumnForX: () => 0,
  };
}

/**
 * Generic heuristic to detect section headings in arbitrary PDFs.
 * Evaluates typography (font size, weight, all-caps, title-case),
 * structural section numbering (e.g. "1. Introduction", "Article IV", "Section 2"),
 * and syntactic markers (e.g. ending colon) WITHOUT document-specific hardcoding.
 *
 * @param {string} str
 * @param {object|number} [context={}]
 * @param {number} [context.fontSize]
 * @param {boolean} [context.isBold]
 * @param {number} [context.medianFontSize=11]
 * @returns {boolean}
 */
export function isHeadingText(str = '', context = {}) {
  const trimmed = String(str).trim();
  if (trimmed.length < 2 || trimmed.length > 70) return false;
  const hasLetters = /[A-Za-z]/.test(trimmed);
  if (!hasLetters) return false;

  const fontSize = typeof context === 'number' ? context : (context.fontSize || 12);
  const isBold = typeof context === 'object' && context ? Boolean(context.isBold) : false;
  const medianFontSize = typeof context === 'object' && context && context.medianFontSize ? context.medianFontSize : 11;

  // 1. Explicit section numbering patterns across technical, legal, academic, and business documents:
  // e.g. "1. Introduction", "2.1 Background", "Section 3: Results", "Article IV - Obligations", "§ 12.3", "Chapter 4"
  if (/^(?:§\s*\d+|(?:\d+(?:\.\d+)*\.?|[A-Z]\.|[IVXLCDM]+\.)\s+[A-Za-z0-9]|(?:Section|Chapter|Article|Clause|Part|Schedule|Appendix|Phase|Step)\s+(?:\d+|[A-ZIVXLCDM]+)[\s:—–.-])/i.test(trimmed)) {
    return true;
  }

  // 2. Colon-terminated title / field label: "Overview:", "Terms & Conditions:", "Scope:"
  if (/^[A-Z][A-Za-z0-9\s—–-]{1,35}:$/.test(trimmed)) {
    return true;
  }

  // Sentence-like endings usually indicate body sentences, not headings
  const endsWithSentenceStop = /[.?!]\s*$/.test(trimmed) && !/^(?:etc|inc|ltd|co|corp|al|e\.g|i\.e)\.$/i.test(trimmed);

  // 3. ALL CAPS heading: "INTRODUCTION", "TERMS OF SERVICE", "PROJECT OVERVIEW"
  const isAllCaps = hasLetters && !/[a-z]/.test(trimmed);
  const wordCount = trimmed.split(/\s+/).length;
  if (isAllCaps && trimmed.length <= 45 && wordCount <= 7 && !endsWithSentenceStop) {
    return true;
  }

  // 4. Significantly larger font size than median body text (e.g. >= 15% larger)
  if (fontSize >= medianFontSize * 1.15 && trimmed.length <= 60 && !endsWithSentenceStop) {
    return true;
  }

  // 5. Bold font weight with short character count (< 45 chars)
  if (isBold && trimmed.length <= 45 && !endsWithSentenceStop) {
    return true;
  }

  return false;
}

/**
 * Generic Document Layout Model
 *
 * Represents arbitrary document pages and canvas objects without document-specific hardcoding:
 * - Detects column containers and flow streams.
 * - Detects table grids (rows with multiple aligned cells).
 * - Identifies structural element types (heading, paragraph_line, list_item, table_cell, divider, header_footer).
 * - Calculates layout confidence ('high' | 'medium' | 'low').
 * - Preserves table internal alignments and column independence during reflow.
 *
 * @param {object} params
 * @param {Array<object>} params.allBlocks - All extracted text blocks on the page
 * @param {Array<object>} [params.canvasObjects=[]] - Any canvas shapes, images, or dividers
 * @param {object} [params.options={}] - Page options (pageWidth, pageHeight, bottomMargin)
 * @returns {object} Layout model
 */
export function buildGenericLayoutModel({
  allBlocks = [],
  canvasObjects: _canvasObjects = [],
  options = {},
}) {
  const pageWidth = options.pageWidth || 612;
  const pageHeight = options.pageHeight || 792;
  const _bottomMargin = options.bottomMargin || 45;

  // 1. Calculate document-wide typographic baselines
  const fontSizes = allBlocks
    .map((b) => b.rawFontSize || b.fontSize || 12)
    .filter((s) => Number.isFinite(s) && s > 0);
  fontSizes.sort((a, b) => a - b);
  const medianFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 11;

  // 2. Detect column flow containers
  const columnDetector = detectColumnsAndFlow(allBlocks, pageWidth);
  columnDetector.pageWidth = pageWidth;

  // 3. Detect potential table structures (rows with 2+ horizontally separated items)
  const rowsByY = new Map();
  for (const b of allBlocks) {
    const top = Math.round(Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? 0));
    const bucket = Math.round(top / 5) * 5;
    if (!rowsByY.has(bucket)) rowsByY.set(bucket, []);
    rowsByY.get(bucket).push(b);
  }

  const tableRows = [];
  for (const [bucketY, rowBlocks] of rowsByY.entries()) {
    if (rowBlocks.length >= 3) {
      const sortedX = [...rowBlocks].sort((a, b) => {
        const aL = Number.isFinite(a.origPdfLeft) ? a.origPdfLeft : (a.pdfLeft ?? 0);
        const bL = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? 0);
        return aL - bL;
      });
      let hasOverlap = false;
      for (let i = 1; i < sortedX.length; i++) {
        const prev = sortedX[i - 1];
        const cur = sortedX[i];
        const prevR = (Number.isFinite(prev.origPdfLeft) ? prev.origPdfLeft : (prev.pdfLeft ?? 0)) +
                      (Number.isFinite(prev.origPdfWidth) ? prev.origPdfWidth : (prev.pdfWidth ?? 50));
        const curL = Number.isFinite(cur.origPdfLeft) ? cur.origPdfLeft : (cur.pdfLeft ?? 0);
        if (prevR > curL + 5) {
          hasOverlap = true;
          break;
        }
      }
      if (!hasOverlap) {
        tableRows.push({ bucketY, blocks: sortedX });
      }
    }
  }

  const tableBlockIds = new Set();
  if (tableRows.length >= 2) {
    for (const tr of tableRows) {
      for (const b of tr.blocks) {
        tableBlockIds.add(b.id);
      }
    }
  }

  // 4. Group blocks into horizontal visual bands (composite rows within 4pt in the SAME column)
  const bandsByY = [];
  const allBlocksMap = new Map();
  for (const b of allBlocks) {
    allBlocksMap.set(b.id, b);
    const top = Math.round(Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? 0));
    const left = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? 0);
    const width = Number.isFinite(b.origPdfWidth) ? b.origPdfWidth : (b.pdfWidth ?? 100);
    const colId = columnDetector.getColumnForX(left + width * 0.5);

    let matchedBand = bandsByY.find((band) => Math.abs(band.top - top) <= 4 && band.colId === colId);
    if (!matchedBand) {
      matchedBand = { top, colId, blockIds: [] };
      bandsByY.push(matchedBand);
    }
    matchedBand.blockIds.push(b.id);
  }

  const visualBandMap = new Map();
  for (const band of bandsByY) {
    if (band.blockIds.length > 1) {
      for (const id of band.blockIds) {
        visualBandMap.set(id, band.blockIds);
      }
    }
  }

  // 5. Classify elements
  const classifiedBlocks = allBlocks.map((block) => {
    const str = block.str || block.originalStr || '';
    const top = Number.isFinite(block.origPdfTop) ? block.origPdfTop : (block.pdfTop ?? 0);
    const left = Number.isFinite(block.origPdfLeft) ? block.origPdfLeft : (block.pdfLeft ?? 0);
    const width = Number.isFinite(block.origPdfWidth) ? block.origPdfWidth : (block.pdfWidth ?? 100);
    const height = Number.isFinite(block.origPdfHeight) ? block.origPdfHeight : (block.pdfHeight ?? 14);
    const fontSize = block.rawFontSize || block.fontSize || 12;
    const isBold = Boolean(block.isBold || block.fontWeight === 'bold');

    let elementType = 'paragraph_line';
    if (top <= 36) {
      elementType = 'header_footer';
    } else if (top + height >= pageHeight - 30) {
      elementType = 'header_footer';
    } else if (tableBlockIds.has(block.id)) {
      elementType = 'table_cell';
    } else if (isHeadingText(str, { fontSize, isBold, medianFontSize })) {
      elementType = 'heading';
    } else if (/^[\u2022\u2023\u25E6\u2043\u2219•\-*]\s+/.test(str.trim())) {
      elementType = 'list_item';
    }

    const colId = columnDetector.getColumnForX(left + width * 0.5);

    return {
      id: block.id,
      block,
      str,
      type: elementType,
      columnId: colId,
      bounds: { left, top, width, height, right: left + width, bottom: top + height },
      style: {
        fontSize,
        isBold,
        fontFamily: block.fontFamily || 'Helvetica',
        color: block.fill || block.color || '#000000',
        backgroundColor: block.backgroundColor || '#ffffff',
      },
    };
  });

  // 6. Layout confidence
  let confidence = 'high';
  if (columnDetector.columns.length > 3) {
    confidence = 'low';
  } else if (tableRows.length >= 4) {
    confidence = 'medium';
  } else if (allBlocks.length < 3) {
    confidence = 'medium';
  }

  return {
    pageWidth,
    pageHeight,
    medianFontSize,
    columnDetector,
    columns: columnDetector.columns,
    classifiedBlocks,
    tableRows,
    tableBlockIds,
    visualBandMap,
    allBlocksMap,
    confidence,
  };
}

/**
 * Checks direct spatial relationship between candidate and target paragraph.
 */
function isDirectDownstream(candidate, targetPara, columnDetector, layoutModel) {
  const candId = candidate.id || candidate.originalBlockId;
  const targetId = targetPara.id || targetPara.paraId;
  if (candId === targetId) return false;

  const targetLines = targetPara.lines || targetPara.paraLines;
  if (Array.isArray(targetLines) && targetLines.some((l) => (l.id || l.originalBlockId) === candId)) {
    return false;
  }
  const candParaId = candidate.paraId || (candidate.isParagraphMember && candidate.paraLines?.[0]?.paraId);
  if (targetId && candParaId && targetId === candParaId) {
    return false;
  }

  const candTop = Number.isFinite(candidate.origPdfTop)
    ? candidate.origPdfTop
    : (candidate.pdfTop ?? (Number.isFinite(candidate.origTop) ? candidate.origTop : (candidate.top ?? 0)));
  const targetTop = Number.isFinite(targetPara.origPdfTop) ? targetPara.origPdfTop : (targetPara.pdfTop ?? targetPara.top ?? 0);
  const targetLastVy = targetPara.origBaseVy ?? (targetTop + (targetPara.origPdfHeight || 14));

  // Must be vertically below the target paragraph
  const candBaseVy = candidate.origBaseVy ?? (candidate.baseVy ?? (candTop + (candidate.rawFontSize || 12) * 0.76));
  if (candBaseVy <= targetLastVy - 2 && candTop <= targetTop + 2) {
    return false;
  }

  // Anchored top headers (top <= 36) never shift
  if (candTop <= 36) {
    return false;
  }

  const candLeft = Number.isFinite(candidate.origPdfLeft)
    ? candidate.origPdfLeft
    : (candidate.pdfLeft ?? (Number.isFinite(candidate.origLeft) ? candidate.origLeft : (candidate.left ?? 0)));
  const candWidth = Number.isFinite(candidate.origPdfWidth)
    ? candidate.origPdfWidth
    : (candidate.pdfWidth ?? (Number.isFinite(candidate.origWidth) ? candidate.origWidth : (candidate.width ?? 100)));
  const targetLeft = Number.isFinite(targetPara.origPdfLeft) ? targetPara.origPdfLeft : (targetPara.pdfLeft ?? targetPara.left ?? 0);
  const targetWidth = Number.isFinite(targetPara.origPdfWidth) ? targetPara.origPdfWidth : (targetPara.pdfWidth ?? targetPara.width ?? 300);

  const pageWidth = columnDetector?.pageWidth || layoutModel?.pageWidth || 612;
  const isCandFullWidth = candWidth >= (pageWidth * 0.60) || candWidth >= 350;
  const isTargetFullWidth = targetWidth >= (pageWidth * 0.60) || targetWidth >= 350;
  const isTableCell = Boolean(layoutModel?.tableBlockIds?.has(candId));

  const candCol = columnDetector?.getColumnForX ? columnDetector.getColumnForX(candLeft + candWidth * 0.5) : 0;
  const targetCol = isTargetFullWidth ? -1 : (columnDetector?.getColumnForX ? columnDetector.getColumnForX(targetLeft + targetWidth * 0.5) : 0);

  // Unrelated separate column / sidebar — do NOT shift!
  if (candCol !== -1 && targetCol !== -1 && candCol !== targetCol && !isCandFullWidth && !isTargetFullWidth) {
    return false;
  }

  // Horizontal overlap check
  const overlapLeft = Math.max(candLeft, targetLeft);
  const overlapRight = Math.min(candLeft + candWidth, targetLeft + targetWidth);
  const overlap = overlapRight - overlapLeft;

  const minW = Math.min(candWidth, targetWidth);
  const hasHorizontalAlignment = isCandFullWidth || isTargetFullWidth || isTableCell || (overlap > 10) || (minW > 0 && (overlap / minW) >= 0.20);

  // If layout confidence is low and candidate is not full width or table cell, require higher overlap (>40%)
  if (layoutModel && layoutModel.confidence === 'low' && !isCandFullWidth && !isTargetFullWidth && !isTableCell) {
    return minW > 0 && (overlap / minW) >= 0.40;
  }

  return hasHorizontalAlignment;
}

/**
 * Checks if a candidate element is downstream of the target paragraph in the same flow column.
 * Uses the generic layout model to respect columns, tables, headers/footers, and horizontal boundaries.
 * Preserves composite rows (e.g. Heading + Date on same visual band).
 *
 * @param {object} candidate
 * @param {object} targetPara
 * @param {object} columnDetector
 * @param {object} [layoutModel=null]
 * @returns {boolean}
 */
export function isDownstreamElement(candidate, targetPara, columnDetector, layoutModel = null) {
  if (!candidate || !targetPara) return false;

  const candId = candidate.id || candidate.originalBlockId;
  const targetId = targetPara.id || targetPara.paraId;
  if (candId === targetId) return false;

  // Member lines of target paragraph belong to the paragraph itself
  const targetLines = targetPara.lines || targetPara.paraLines;
  if (Array.isArray(targetLines) && targetLines.some((l) => (l.id || l.originalBlockId) === candId)) {
    return false;
  }
  const candParaId = candidate.paraId || (candidate.isParagraphMember && candidate.paraLines?.[0]?.paraId);
  if (targetId && candParaId && targetId === candParaId) {
    return false;
  }

  // Check direct downstream relationship
  const direct = isDirectDownstream(candidate, targetPara, columnDetector, layoutModel);
  if (direct) return true;

  // Composite Row / Visual Band Preservation:
  // If candidate is not directly downstream (e.g. date right-aligned), but shares a visual band with a sibling that IS directly downstream, they shift together!
  if (layoutModel && layoutModel.visualBandMap && layoutModel.allBlocksMap) {
    const siblingIds = layoutModel.visualBandMap.get(candId);
    if (Array.isArray(siblingIds) && siblingIds.length > 1) {
      for (const sibId of siblingIds) {
        if (sibId === candId) continue;
        const sibBlock = layoutModel.allBlocksMap.get(sibId);
        if (sibBlock && isDirectDownstream(sibBlock, targetPara, columnDetector, layoutModel)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Calculates new paragraph height, wrapped lines, and vertical height difference (deltaY).
 *
 * @param {Array<object>} paraLines - Original lines of the paragraph
 * @param {string} newText - New paragraph text entered by user
 * @param {object} [options={}]
 * @returns {object} Reflow calculation details
 */
export function calculateParagraphReflow(paraLines = [], newText = '', options = {}) {
  if (!Array.isArray(paraLines) || paraLines.length === 0) {
    return {
      newLines: [],
      clearedLines: [],
      deltaY: 0,
      origHeight: 0,
      newHeight: 0,
      lineSpacing: 14,
      whiteoutLines: [],
    };
  }

  const firstLine = paraLines[0];
  const lastLine = paraLines[paraLines.length - 1];

  const fontSize = options.fontSize || firstLine.rawFontSize || firstLine.fontSize || 11;
  const fontFamily = options.fontFamily || firstLine.fontFamily || 'Helvetica';
  const isBold = options.isBold !== undefined ? options.isBold : Boolean(firstLine.isBold || firstLine.fontWeight === 'bold');
  const isItalic = options.isItalic !== undefined ? options.isItalic : Boolean(firstLine.isItalic || firstLine.fontStyle === 'italic');
  const fill = options.color || options.fill || firstLine.fill || firstLine.color || '#000000';
  const backgroundColor = options.backgroundColor || firstLine.backgroundColor || '#ffffff';
  const textAlign = options.textAlign || firstLine.textAlign || 'left';

  // Determine pristine original positions
  const origLeft = Math.min(...paraLines.map((l) => Number.isFinite(l.origPdfLeft) ? l.origPdfLeft : (l.pdfLeft ?? l.baseVx ?? 0)));
  const origRight = Math.max(...paraLines.map((l) => {
    const lLeft = Number.isFinite(l.origPdfLeft) ? l.origPdfLeft : (l.pdfLeft ?? l.baseVx ?? 0);
    const lWidth = Number.isFinite(l.origPdfWidth) ? l.origPdfWidth : (l.pdfWidth ?? l.rawWidth ?? 200);
    return lLeft + lWidth;
  }));

  // Verified available width determination
  let availableWidth = origRight - origLeft;
  if (options.availableWidth && options.availableWidth > availableWidth) {
    availableWidth = options.availableWidth;
  } else if (options.columnWidth && options.columnWidth > availableWidth) {
    availableWidth = options.columnWidth;
  } else if (paraLines.length >= 2) {
    // In multi-line paragraphs, non-last lines represent the column wrapping boundary
    const nonLastLines = paraLines.slice(0, -1);
    const maxNonLastW = Math.max(...nonLastLines.map((l) => Number.isFinite(l.origPdfWidth) ? l.origPdfWidth : (l.pdfWidth ?? l.rawWidth ?? availableWidth)));
    availableWidth = Math.max(availableWidth, maxNonLastW);
  } else if (paraLines.length === 1 && options.columnDetector) {
    const colId = options.columnDetector.getColumnForX(origLeft + 15);
    const col = options.columnDetector.columns?.find((c) => c.id === colId);
    if (col && (col.maxX - origLeft) > availableWidth) {
      availableWidth = Math.max(availableWidth, col.maxX - origLeft - 15);
    }
  }
  availableWidth = Math.max(40, availableWidth);

  // Determine pristine line spacing
  let lineSpacing = fontSize * 1.25;
  if (paraLines.length >= 2) {
    const vy0 = Number.isFinite(firstLine.origBaseVy) ? firstLine.origBaseVy : firstLine.baseVy;
    const vy1 = Number.isFinite(paraLines[1].origBaseVy) ? paraLines[1].origBaseVy : paraLines[1].baseVy;
    const measuredSpacing = Math.abs(vy1 - vy0);
    if (measuredSpacing >= fontSize * 0.8 && measuredSpacing <= fontSize * 2.5) {
      lineSpacing = measuredSpacing;
    }
  }

  const origCount = paraLines.length;
  const firstTop = Number.isFinite(firstLine.origPdfTop) ? firstLine.origPdfTop : (firstLine.pdfTop ?? 0);
  const firstBaseVy = Number.isFinite(firstLine.origBaseVy) ? firstLine.origBaseVy : (firstLine.baseVy ?? (firstTop + fontSize * 0.76));

  const origHeight = (origCount - 1) * lineSpacing + (fontSize * 1.20);

  // Wrap text into lines
  const cleanText = String(newText ?? '').trim();
  const wrappedLineStrings = cleanText.length > 0
    ? wrapTextToLines(cleanText, availableWidth, fontSize, fontFamily, isBold, isItalic)
    : [];

  const newCount = wrappedLineStrings.length;
  const newHeight = newCount > 0 ? (newCount - 1) * lineSpacing + (fontSize * 1.20) : 0;
  const deltaY = newCount > 0 ? (newCount - origCount) * lineSpacing : -origHeight;

  const newLines = [];
  const clearedLines = [];
  const paraId = firstLine.paraId || `para-${firstLine.id}`;

  // Build whiteout coverage for all original lines of the paragraph
  const whiteoutLines = paraLines.map((l) => ({
    pdfLeft: Number.isFinite(l.origPdfLeft) ? l.origPdfLeft : (l.pdfLeft ?? l.baseVx ?? 0),
    pdfTop: Number.isFinite(l.origPdfTop) ? l.origPdfTop : (l.pdfTop ?? 0),
    pdfWidth: Number.isFinite(l.origPdfWidth) ? l.origPdfWidth : (l.pdfWidth ?? l.rawWidth ?? availableWidth),
    pdfHeight: Number.isFinite(l.origPdfHeight) ? l.origPdfHeight : (l.pdfHeight ?? Math.round(fontSize * 1.20)),
    baseVy: Number.isFinite(l.origBaseVy) ? l.origBaseVy : (l.baseVy ?? (firstTop + fontSize * 0.76)),
    rawFontSize: fontSize,
    paraLeft: origLeft,
    paraWidth: availableWidth,
  }));

  // Build new active line objects
  for (let i = 0; i < newCount; i++) {
    const lineText = wrappedLineStrings[i];
    const isSynthetic = i >= origCount;
    const baseBlock = isSynthetic ? lastLine : paraLines[i];
    const lineId = isSynthetic ? `line-synth-${paraId}-${i + 1}` : baseBlock.id;
    const lineTop = firstTop + i * lineSpacing;
    const lineVy = firstBaseVy + i * lineSpacing;
    const isLast = i === newCount - 1;

    newLines.push({
      id: lineId,
      str: lineText,
      text: lineText,
      originalStr: isSynthetic ? '' : (baseBlock.originalStr || baseBlock.str),
      pdfLeft: origLeft,
      pdfTop: lineTop,
      pdfWidth: availableWidth,
      pdfHeight: Math.round(fontSize * 1.20),
      baseVy: lineVy,
      baseVx: origLeft,
      fontSize,
      rawFontSize: fontSize,
      fontFamily,
      isBold,
      isItalic,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      fill,
      color: fill,
      backgroundColor,
      textAlign,
      isSyntheticLine: isSynthetic,
      isParagraphMember: true,
      paraId,
      paraBoundaries: {
        left: origLeft,
        right: origRight,
        width: availableWidth,
        isLastLine: isLast,
      },
      linesInfo: [{
        pdfLeft: origLeft,
        pdfTop: lineTop,
        pdfWidth: availableWidth,
        pdfHeight: Math.round(fontSize * 1.20),
        baseVy: lineVy,
        rawFontSize: fontSize,
        paraLeft: origLeft,
        paraRight: origRight,
        paraWidth: availableWidth,
        isLastLine: isLast,
      }],
      whiteoutLines,
    });
  }

  // Original lines that are no longer needed (when text was deleted) are marked as cleared
  for (let i = newCount; i < origCount; i++) {
    const oldLine = paraLines[i];
    clearedLines.push({
      id: oldLine.id,
      isClearedLine: true,
      text: '',
      str: '',
      pdfLeft: Number.isFinite(oldLine.origPdfLeft) ? oldLine.origPdfLeft : (oldLine.pdfLeft ?? 0),
      pdfTop: Number.isFinite(oldLine.origPdfTop) ? oldLine.origPdfTop : (oldLine.pdfTop ?? 0),
      pdfWidth: Number.isFinite(oldLine.origPdfWidth) ? oldLine.origPdfWidth : (oldLine.pdfWidth ?? availableWidth),
      pdfHeight: Number.isFinite(oldLine.origPdfHeight) ? oldLine.origPdfHeight : (oldLine.pdfHeight ?? Math.round(fontSize * 1.20)),
      baseVy: Number.isFinite(oldLine.origBaseVy) ? oldLine.origBaseVy : oldLine.baseVy,
      backgroundColor,
      whiteoutLines: [{
        pdfLeft: Number.isFinite(oldLine.origPdfLeft) ? oldLine.origPdfLeft : (oldLine.pdfLeft ?? 0),
        pdfTop: Number.isFinite(oldLine.origPdfTop) ? oldLine.origPdfTop : (oldLine.pdfTop ?? 0),
        pdfWidth: Number.isFinite(oldLine.origPdfWidth) ? oldLine.origPdfWidth : (oldLine.pdfWidth ?? availableWidth),
        pdfHeight: Number.isFinite(oldLine.origPdfHeight) ? oldLine.origPdfHeight : (oldLine.pdfHeight ?? Math.round(fontSize * 1.20)),
        baseVy: Number.isFinite(oldLine.origBaseVy) ? oldLine.origBaseVy : oldLine.baseVy,
        rawFontSize: fontSize,
      }],
    });
  }

  return {
    paraId,
    newLines,
    clearedLines,
    deltaY,
    origHeight,
    newHeight,
    lineSpacing,
    origCount,
    newCount,
    availableWidth,
    whiteoutLines,
  };
}

/**
 * Calculates complete layout reflow across an entire page when one or more paragraphs change.
 * Determines downstream shifts, handles multi-column independence, and protects page boundaries.
 *
 * @param {object} params
 * @param {Array<object>} params.allBlocks - Pristine extracted text blocks on the page
 * @param {object} params.paragraphEdits - Map of paragraph/block edits: { [id]: { text, fontSize, color, ... } }
 * @param {Array<object>} [params.canvasObjects=[]] - Fabric vector objects (shapes, images) on the page
 * @param {object} [params.options={}] - Layout configuration { pageHeight: 792, pageWidth: 612, bottomMargin: 45 }
 * @returns {object} Reflow state containing contentEdits map, exportObjects array, and overflowInfo
 */
export function calculatePageReflow({
  allBlocks = [],
  paragraphEdits = {},
  canvasObjects = [],
  options = {},
}) {
  const pageHeight = options.pageHeight || 792;
  const pageWidth = options.pageWidth || 612;
  const bottomMargin = options.bottomMargin || 45;
  const maxAllowedY = pageHeight - bottomMargin;

  const layoutModel = buildGenericLayoutModel({
    allBlocks,
    canvasObjects,
    options: { pageHeight, pageWidth, bottomMargin },
  });
  const columnDetector = layoutModel.columnDetector;

  // Group blocks by paragraph cluster
  const paraMap = new Map();
  for (const b of allBlocks) {
    const pid = b.paraId || (b.isParagraphMember && b.paraLines?.[0]?.paraId) || b.id;
    const bLeft = Number.isFinite(b.origPdfLeft) ? b.origPdfLeft : (b.pdfLeft ?? 0);
    const bWidth = Number.isFinite(b.origPdfWidth) ? b.origPdfWidth : (b.pdfWidth ?? 100);
    if (!paraMap.has(pid)) {
      paraMap.set(pid, {
        id: pid,
        lines: [],
        origPdfTop: Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? 0),
        origPdfLeft: bLeft,
        origPdfWidth: bWidth,
        origBaseVy: Number.isFinite(b.origBaseVy) ? b.origBaseVy : (b.baseVy ?? 0),
      });
    }
    const para = paraMap.get(pid);
    para.lines.push(b);
    para.origPdfTop = Math.min(para.origPdfTop, Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? 0));
    para.origPdfLeft = Math.min(para.origPdfLeft, bLeft);
    para.origPdfWidth = Math.max(para.origPdfWidth, bWidth);
    para.origBaseVy = Math.max(para.origBaseVy, Number.isFinite(b.origBaseVy) ? b.origBaseVy : (b.baseVy ?? 0));
  }

  for (const para of paraMap.values()) {
    para.lines.sort((a, b) => {
      const topA = Number.isFinite(a.origPdfTop) ? a.origPdfTop : (a.pdfTop ?? 0);
      const topB = Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? 0);
      return topA - topB;
    });
    para.paraLines = para.lines;
  }

  // Identify edited paragraphs and calculate their reflow
  const editedParaReflows = [];
  const handledParaIds = new Set();

  for (const [editKey, editData] of Object.entries(paragraphEdits)) {
    if (!editData) continue;
    // Find target paragraph
    let targetPara = paraMap.get(editKey);
    if (!targetPara) {
      for (const p of paraMap.values()) {
        if (p.lines.some((l) => l.id === editKey)) {
          targetPara = p;
          break;
        }
      }
    }

    if (!targetPara || handledParaIds.has(targetPara.id)) continue;
    handledParaIds.add(targetPara.id);

    const newText = editData.text !== undefined ? editData.text : targetPara.lines.map((l) => l.str).join(' ');
    const reflow = calculateParagraphReflow(targetPara.lines, newText, {
      ...editData,
      textAlign: editData.textAlign,
      columnDetector,
      pageWidth,
    });

    editedParaReflows.push({
      para: targetPara,
      reflow,
      editData,
      deltaY: reflow.deltaY,
      top: targetPara.origPdfTop,
    });
  }

  // Sort edited paragraphs vertically top to bottom
  editedParaReflows.sort((a, b) => a.top - b.top);

  // Prepare result structures
  const contentEdits = {};
  const exportObjects = [];
  const handledBlockIds = new Set();
  const overflowingBlocks = [];

  // 1. Apply reflowed lines for edited paragraphs
  for (let pIdx = 0; pIdx < editedParaReflows.length; pIdx++) {
    const item = editedParaReflows[pIdx];
    const { reflow } = item;

    // Calculate cumulative vertical shift from preceding edited paragraphs in the same flow column
    let upstreamShift = 0;
    for (let uIdx = 0; uIdx < pIdx; uIdx++) {
      const upstreamItem = editedParaReflows[uIdx];
      if (upstreamItem.deltaY !== 0 && isDownstreamElement(item.para.lines[0], upstreamItem.para, columnDetector, layoutModel)) {
        upstreamShift += upstreamItem.deltaY;
      }
    }

    for (let lIdx = 0; lIdx < reflow.newLines.length; lIdx++) {
      const line = reflow.newLines[lIdx];
      const shiftedLineTop = line.pdfTop + upstreamShift;
      const shiftedLineVy = line.baseVy + upstreamShift;

      if (shiftedLineTop + line.pdfHeight > maxAllowedY) {
        overflowingBlocks.push({
          block: line,
          originalTop: line.pdfTop,
          shiftedTop: shiftedLineTop,
          overflowAmount: (shiftedLineTop + line.pdfHeight) - maxAllowedY,
          isParagraphLine: true,
        });
      }
      handledBlockIds.add(line.id);

      const linkUrl = line.linkUrl || item.editData?.linkUrl || item.para.lines[0]?.linkUrl || '';
      const isLinkOnly = Boolean(line.isLinkOnly || item.editData?.isLinkOnly);

      const shiftedLinesInfo = (line.linesInfo || []).map((li) => ({
        ...li,
        pdfTop: li.pdfTop + upstreamShift,
        baseVy: li.baseVy + upstreamShift,
      }));

      contentEdits[line.id] = {
        text: line.text,
        originalText: line.originalStr,
        textAlign: line.textAlign,
        isSyntheticLine: Boolean(line.isSyntheticLine),
        paraBoundaries: line.paraBoundaries,
        linkUrl,
        isLinkOnly,
        block: {
          ...line,
          pdfTop: shiftedLineTop,
          baseVy: shiftedLineVy,
          screenTop: shiftedLineTop,
          linkUrl,
          isLinkOnly,
        },
      };

      exportObjects.push({
        type: 'textbox',
        text: line.text,
        left: line.pdfLeft,
        top: shiftedLineTop,
        width: line.pdfWidth,
        height: line.pdfHeight,
        fontSize: line.fontSize,
        fontFamily: line.fontFamily,
        fontWeight: line.fontWeight,
        fontStyle: line.fontStyle,
        fill: line.fill,
        backgroundColor: line.backgroundColor,
        padding: 0,
        isPdfContentEdit: true,
        textAlign: line.textAlign,
        linkUrl,
        isLinkOnly,
        originalBlockId: line.id,
        linesInfo: shiftedLinesInfo,
        whiteoutLines: lIdx === 0 ? line.whiteoutLines : [],
      });
    }

    for (let clIdx = 0; clIdx < reflow.clearedLines.length; clIdx++) {
      const cl = reflow.clearedLines[clIdx];
      handledBlockIds.add(cl.id);
      contentEdits[cl.id] = {
        text: '',
        originalText: cl.str,
        isClearedLine: true,
        block: { ...cl },
      };
      // Cleared lines need whiteout export object so PDF erases them
      exportObjects.push({
        type: 'textbox',
        text: '',
        left: cl.pdfLeft,
        top: cl.pdfTop,
        width: cl.pdfWidth,
        height: cl.pdfHeight,
        fontSize: 10,
        fill: '#ffffff',
        backgroundColor: cl.backgroundColor || '#ffffff',
        padding: 0,
        isPdfContentEdit: true,
        originalBlockId: cl.id,
        linesInfo: [],
        whiteoutLines: (reflow.newLines.length === 0 && clIdx === 0) ? cl.whiteoutLines : [],
      });
    }
  }

  // Measure available space before the next affected content block for each edited paragraph
  for (const item of editedParaReflows) {
    let minDownstreamTop = Infinity;
    let nextDownstreamBlock = null;
    for (const b of allBlocks) {
      if (isDownstreamElement(b, item.para, columnDetector, layoutModel)) {
        const bTop = Number.isFinite(b.origPdfTop) ? b.origPdfTop : (b.pdfTop ?? 0);
        if (bTop < minDownstreamTop) {
          minDownstreamTop = bTop;
          nextDownstreamBlock = b;
        }
      }
    }

    for (const obj of canvasObjects) {
      if (!obj || obj.isPdfContentEdit) continue;
      if (isDownstreamElement(obj, item.para, columnDetector, layoutModel)) {
        const objTop = Number.isFinite(obj.origTop) ? obj.origTop : (obj.top ?? 0);
        if (objTop < minDownstreamTop) {
          minDownstreamTop = objTop;
          nextDownstreamBlock = obj;
        }
      }
    }

    const lastOrigLine = item.para.lines[item.para.lines.length - 1];
    const lastOrigBottom = Number.isFinite(lastOrigLine?.origPdfTop)
      ? lastOrigLine.origPdfTop + (lastOrigLine.origPdfHeight || (lastOrigLine.rawFontSize || 12) * 1.2)
      : (item.para.origPdfTop + (item.para.origPdfHeight || 36));

    const availableClearance = Number.isFinite(minDownstreamTop) && minDownstreamTop < Infinity
      ? Math.max(0, minDownstreamTop - lastOrigBottom)
      : Math.max(0, maxAllowedY - lastOrigBottom);

    item.minDownstreamTop = minDownstreamTop;
    item.nextDownstreamBlock = nextDownstreamBlock;
    item.availableClearance = availableClearance;
    item.lastOrigBottom = lastOrigBottom;

    // Requirement 1 & 4:
    // If paragraph fits within available whitespace (deltaY <= availableClearance), downstreamShift = 0.
    // When paragraph exceeds that space (deltaY > availableClearance), shift downstream elements.
    // If deltaY < 0 (text deleted), shift downstream elements upward (deltaY).
    if (item.deltaY > availableClearance) {
      item.downstreamShift = item.deltaY;
    } else if (item.deltaY < 0) {
      item.downstreamShift = item.deltaY;
    } else {
      item.downstreamShift = 0;
    }
  }

  // 2. Identify affected downstream elements belonging to the same verified document flow
  // (Preserves original relative positions and group relationships without destructively re-synthesizing them)
  const affectedDownstreamElements = [];

  for (const block of allBlocks) {
    if (handledBlockIds.has(block.id)) continue;

    // Check which edited paragraphs are upstream of this block in the same flow column
    let totalShift = 0;
    for (const item of editedParaReflows) {
      if (item.downstreamShift === 0) continue;
      if (isDownstreamElement(block, item.para, columnDetector, layoutModel)) {
        totalShift += item.downstreamShift;
      }
    }

    if (totalShift !== 0) {
      const origTop = Number.isFinite(block.origPdfTop) ? block.origPdfTop : (block.pdfTop ?? 0);
      const origBaseVy = Number.isFinite(block.origBaseVy) ? block.origBaseVy : (block.baseVy ?? (origTop + (block.rawFontSize || 12) * 0.76));
      const origLeft = Number.isFinite(block.origPdfLeft) ? block.origPdfLeft : (block.pdfLeft ?? block.baseVx ?? 0);
      const origWidth = Number.isFinite(block.origPdfWidth) ? block.origPdfWidth : (block.pdfWidth ?? block.rawWidth ?? 100);
      const origHeight = Number.isFinite(block.origPdfHeight) ? block.origPdfHeight : (block.pdfHeight ?? 14);

      const shiftedTop = origTop + totalShift;
      const shiftedBaseVy = origBaseVy + totalShift;

      const shiftedLinkUrl = block.linkUrl || '';
      const shiftedIsLinkOnly = Boolean(block.isLinkOnly);

      contentEdits[block.id] = {
        text: block.str,
        originalText: block.originalStr || block.str,
        isShifted: true,
        shiftY: totalShift,
        origPdfTop: origTop,
        origBaseVy,
        origPdfLeft: origLeft,
        origPdfWidth: origWidth,
        origPdfHeight: origHeight,
        linkUrl: shiftedLinkUrl,
        isLinkOnly: shiftedIsLinkOnly,
        block: {
          ...block,
          pdfTop: shiftedTop,
          baseVy: shiftedBaseVy,
          screenTop: shiftedTop,
          linkUrl: shiftedLinkUrl,
          isLinkOnly: shiftedIsLinkOnly,
        },
      };

      affectedDownstreamElements.push({
        id: block.id,
        block: contentEdits[block.id].block,
        totalShift,
        origPdfTop: origTop,
        origBaseVy,
        origPdfLeft: origLeft,
        origPdfWidth: origWidth,
        origPdfHeight: origHeight,
        shiftedTop,
        shiftedBaseVy,
      });

      // If downstream element has a hyperlink, preserve clickable link annotation at shifted coordinates
      // using isLinkOnly: true (no whiteout mask, no font replacement, 100% native PDF rendering preserved)
      if (shiftedLinkUrl) {
        exportObjects.push({
          type: 'textbox',
          text: '',
          left: origLeft,
          top: shiftedTop,
          width: origWidth,
          height: origHeight,
          fontSize: block.rawFontSize || block.fontSize || 12,
          padding: 0,
          isPdfContentEdit: true,
          isLinkOnly: true,
          linkUrl: shiftedLinkUrl,
          originalBlockId: block.id,
        });
      }
    }
  }

  // Calculate overall page downstream shift and native split boundary
  let pageDownstreamShift = 0;
  let splitTop = 0;
  let splitPdfY = 0;

  for (const item of editedParaReflows) {
    if (item.downstreamShift > pageDownstreamShift) {
      pageDownstreamShift = item.downstreamShift;
      if (item.minDownstreamTop < Infinity) {
        splitTop = (item.lastOrigBottom + item.minDownstreamTop) / 2;
        splitPdfY = pageHeight - splitTop;
      }
    }
  }

  // 3. Page Boundary & Overflow Protection (Requirements 8 & 9)
  // Check if any shifted downstream element or expanded paragraph line pushes beyond the bottom page boundary
  let maxShiftedBottom = 0;
  for (const block of affectedDownstreamElements) {
    const bottom = block.shiftedTop + block.origPdfHeight;
    if (bottom > maxShiftedBottom) {
      maxShiftedBottom = bottom;
    }
  }

  for (const item of editedParaReflows) {
    const lastLine = item.reflow.newLines[item.reflow.newLines.length - 1];
    if (lastLine) {
      const bottom = lastLine.pdfTop + lastLine.pdfHeight;
      if (bottom > maxShiftedBottom) {
        maxShiftedBottom = bottom;
      }
    }
  }

  if (maxShiftedBottom > maxAllowedY) {
    const overflowAmount = Math.round(maxShiftedBottom - maxAllowedY);
    overflowingBlocks.push({
      overflowAmount,
      maxShiftedBottom,
      maxAllowedY,
      message: `Paragraph expansion pushes content beyond the bottom page boundary (+${overflowAmount}pt). Multi-page pagination is not supported on this layout; layout preserved safely without clipping.`,
    });
  }

  // 4. Shift user-added vector canvas objects (shapes, divider lines, images)
  const shiftedCanvasObjects = [];
  for (const obj of canvasObjects) {
    if (!obj || obj.isPdfContentEdit) continue;
    let totalShift = 0;
    for (const item of editedParaReflows) {
      if (item.deltaY === 0) continue;
      if (isDownstreamElement(obj, item.para, columnDetector, layoutModel)) {
        totalShift += item.deltaY;
      }
    }

    if (totalShift !== 0) {
      const origTop = Number.isFinite(obj.origTop) ? obj.origTop : (obj.top ?? 0);
      const origY1 = Number.isFinite(obj.origY1) ? obj.origY1 : obj.y1;
      const origY2 = Number.isFinite(obj.origY2) ? obj.origY2 : obj.y2;
      shiftedCanvasObjects.push({
        ...obj,
        origTop,
        origY1,
        origY2,
        top: origTop + totalShift,
        y1: Number.isFinite(origY1) ? origY1 + totalShift : undefined,
        y2: Number.isFinite(origY2) ? origY2 + totalShift : undefined,
      });
    } else {
      shiftedCanvasObjects.push(obj);
    }
  }

  return {
    contentEdits,
    exportObjects,
    shiftedBlocks: affectedDownstreamElements,
    affectedDownstreamElements,
    shiftedCanvasObjects,
    downstreamShift: pageDownstreamShift,
    splitPdfY,
    splitTop,
    layoutModel,
    hasReflow: editedParaReflows.some((i) => i.deltaY !== 0),
    overflowInfo: {
      hasOverflow: overflowingBlocks.length > 0,
      overflowingBlocks,
      message: overflowingBlocks[0]?.message || null,
      maxAllowedY,
    },
    continuationInfo: {
      hasOverflow: overflowingBlocks.length > 0,
      overflowAmount: overflowingBlocks.length > 0 ? Math.max(...overflowingBlocks.map((o) => o.overflowAmount)) : 0,
      overflowingBlocks,
      maxAllowedY,
      recommendedSplitTop: maxAllowedY,
    },
  };
}
