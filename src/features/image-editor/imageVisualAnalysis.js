/**
 * Image Visual Analysis Utility
 * Analyzes raw pixel data and OCR bounding boxes to accurately detect:
 * - Local background color via perimeter sampling
 * - Primary ink/text color with contrast thresholding
 * - Typography (font family, font size, bold vs regular) separately for each text block
 * - Section headings and job titles as bold, body text as regular
 * - Paragraph clustering that preserves each line's individual font properties
 */

/**
 * Converts RGB components to hex string
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Computes color distance (Euclidean in RGB space)
 */
export function colorDistance(c1, c2) {
  return Math.hypot(c1.r - c2.r, c1.g - c2.g, c1.b - c2.b);
}

/**
 * Detects if a text string is a resume or document section heading.
 * e.g., "SUMMARY", "Professional Summary", "WORK EXPERIENCE", "Education", "Skills"
 */
export function isSectionHeadingText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length > 50) return false;

  // Standard section heading keywords in professional documents
  const headingPattern = /^(summary|professional summary|executive summary|career summary|work experience|experience|professional experience|employment history|education|academic background|skills|technical skills|core competencies|projects|key projects|certifications|awards|honors|publications|contact|contact information|profile|personal profile|languages|interests|references)$/i;
  if (headingPattern.test(trimmed)) return true;

  // Short all-caps headings: e.g. "SUMMARY", "EXPERIENCE", "PROJECTS", "EDUCATION"
  if (trimmed.length >= 3 && trimmed.length <= 35 && !/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Detects if a text string is regular body text (e.g. summary body text, descriptions).
 */
export function isBodyText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length >= 7 || trimmed.length >= 45) return true;
  if (/[.,;]/.test(trimmed) && words.length >= 4) return true;
  if (/\b(experienced|knowledge|skills|responsible|architectures|technologies|distributed|focusing|delivering|delivery|solutions|mindset)\b/i.test(trimmed) && words.length >= 4) {
    return true;
  }
  return false;
}

/**
 * Detects if a text string is a job title / professional role.
 * e.g., "Senior Software Engineer", "Product Manager", "Lead Architect", "Frontend Developer"
 */
export function isJobTitleText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length > 50) return false;

  // If it has sentence characteristics or body vocabulary, it is body text not a job title
  if (isBodyText(trimmed)) return false;
  if (/[.,;]/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length > 6) return false;

  // Specific role title patterns
  const rolePattern = /\b(software engineer|frontend engineer|backend engineer|full stack engineer|senior software engineer|lead engineer|principal engineer|staff engineer|systems engineer|devops engineer|cloud engineer|data engineer|data scientist|machine learning engineer|ai engineer|product manager|project manager|program manager|engineering manager|technical lead|tech lead|architect|solutions architect|cloud architect|developer|senior developer|web developer|mobile developer|ui\/ux designer|product designer|graphic designer|consultant|senior consultant|analyst|business analyst|data analyst|systems administrator|qa engineer|test engineer|security engineer|director|vp of engineering|vice president|founder|co-founder|intern|software engineering intern)\b/i;
  if (rolePattern.test(trimmed)) return true;

  // Generic role title words in concise phrases
  if (/\b(engineer|developer|architect|manager|lead|director|consultant|analyst|specialist|officer|designer|coordinator|administrator)\b/i.test(trimmed)) {
    return words.length <= 4;
  }

  return false;
}

/**
 * Samples the background color around the perimeter of a bounding box.
 * Perimeter pixels are used because they are immediately adjacent to the text
 * but free from glyph strokes.
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context of the full-resolution image
 * @param {{ x0: number, y0: number, x1: number, y1: number }} bbox
 * @param {number} imgWidth
 * @param {number} imgHeight
 * @returns {{ hex: string, rgb: { r: number, g: number, b: number } }}
 */
export function sampleBackgroundColor(ctx, bbox, imgWidth, imgHeight) {
  const pad = 2;
  const x = Math.max(0, Math.floor(bbox.x0 - pad));
  const y = Math.max(0, Math.floor(bbox.y0 - pad));
  const w = Math.min(imgWidth - x, Math.ceil((bbox.x1 - bbox.x0) + pad * 2));
  const h = Math.min(imgHeight - y, Math.ceil((bbox.y1 - bbox.y0) + pad * 2));

  if (w <= 0 || h <= 0) {
    return { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } };
  }

  let imgData;
  try {
    imgData = ctx.getImageData(x, y, w, h);
  } catch {
    return { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } };
  }

  const data = imgData.data;
  const perimeterPixels = [];

  // Sample top and bottom rows
  for (let col = 0; col < w; col++) {
    const topIdx = col * 4;
    perimeterPixels.push({ r: data[topIdx], g: data[topIdx + 1], b: data[topIdx + 2] });
    const btmIdx = ((h - 1) * w + col) * 4;
    perimeterPixels.push({ r: data[btmIdx], g: data[btmIdx + 1], b: data[btmIdx + 2] });
  }

  // Sample left and right columns
  for (let row = 1; row < h - 1; row++) {
    const leftIdx = (row * w + 0) * 4;
    perimeterPixels.push({ r: data[leftIdx], g: data[leftIdx + 1], b: data[leftIdx + 2] });
    const rightIdx = (row * w + (w - 1)) * 4;
    perimeterPixels.push({ r: data[rightIdx], g: data[rightIdx + 1], b: data[rightIdx + 2] });
  }

  if (perimeterPixels.length === 0) {
    return { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } };
  }

  // Find median RGB to reject occasional stray dark strokes along the perimeter
  const rSorted = perimeterPixels.map((p) => p.r).sort((a, b) => a - b);
  const gSorted = perimeterPixels.map((p) => p.g).sort((a, b) => a - b);
  const bSorted = perimeterPixels.map((p) => p.b).sort((a, b) => a - b);
  const mid = Math.floor(perimeterPixels.length / 2);

  const medianR = rSorted[mid];
  const medianG = gSorted[mid];
  const medianB = bSorted[mid];

  return {
    hex: rgbToHex(medianR, medianG, medianB),
    rgb: { r: medianR, g: medianG, b: medianB },
  };
}

/**
 * Extracts the primary ink/text color inside the bounding box.
 * Contrasts foreground pixels with the detected background color.
 */
export function extractTextColor(ctx, bbox, bgRgb, imgWidth, imgHeight) {
  const x = Math.max(0, Math.floor(bbox.x0));
  const y = Math.max(0, Math.floor(bbox.y0));
  const w = Math.min(imgWidth - x, Math.ceil(bbox.x1 - bbox.x0));
  const h = Math.min(imgHeight - y, Math.ceil(bbox.y1 - bbox.y0));

  if (w <= 0 || h <= 0) {
    return '#000000';
  }

  let imgData;
  try {
    imgData = ctx.getImageData(x, y, w, h);
  } catch {
    return '#000000';
  }

  const data = imgData.data;
  const inkPixels = [];
  const contrastThreshold = 38;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    const dist = colorDistance({ r, g, b }, bgRgb);
    if (dist >= contrastThreshold) {
      inkPixels.push({ r, g, b, dist });
    }
  }

  if (inkPixels.length === 0) {
    const bgLum = 0.299 * bgRgb.r + 0.587 * bgRgb.g + 0.114 * bgRgb.b;
    return bgLum > 128 ? '#0f172a' : '#f8fafc';
  }

  inkPixels.sort((a, b) => b.dist - a.dist);
  const topQuarter = inkPixels.slice(0, Math.max(1, Math.floor(inkPixels.length * 0.4)));

  const avgR = Math.round(topQuarter.reduce((sum, p) => sum + p.r, 0) / topQuarter.length);
  const avgG = Math.round(topQuarter.reduce((sum, p) => sum + p.g, 0) / topQuarter.length);
  const avgB = Math.round(topQuarter.reduce((sum, p) => sum + p.b, 0) / topQuarter.length);

  return rgbToHex(avgR, avgG, avgB);
}

/**
 * Estimates font weight (bold vs normal) and typeface category (serif vs sans-serif)
 * separately for each text block by combining:
 * 1. Pixel stem thickness (measured via horizontal ink runs)
 * 2. Ink density ratio
 * 3. Text role heuristics (section headings and job titles vs summary body text)
 *
 * @param {CanvasRenderingContext2D|null} ctx
 * @param {{ x0: number, y0: number, x1: number, y1: number }} bbox
 * @param {{ r: number, g: number, b: number }} bgRgb
 * @param {number} imgWidth
 * @param {number} imgHeight
 * @param {string} [text='']
 * @returns {{ isBold: boolean, fontWeight: 'bold'|'normal', fontFamily: string, isHeading: boolean, isJobTitle: boolean, isBody: boolean }}
 */
export function analyzeFontAttributes(ctx, bbox, bgRgb, imgWidth, imgHeight, text = '') {
  const cleanText = (text || '').trim();
  const isHeading = isSectionHeadingText(cleanText);
  const isJobTitle = isJobTitleText(cleanText);
  const isBody = isBodyText(cleanText);

  const x = Math.max(0, Math.floor(bbox.x0));
  const y = Math.max(0, Math.floor(bbox.y0));
  const w = Math.min(imgWidth - x, Math.ceil(bbox.x1 - bbox.x0));
  const h = Math.min(imgHeight - y, Math.ceil(bbox.y1 - bbox.y0));

  let inkDensity = 0.18;
  let medianStemWidth = 1.4;
  let fontFamily = 'Helvetica';

  if (ctx && w > 0 && h > 0) {
    try {
      const imgData = ctx.getImageData(x, y, w, h);
      const data = imgData.data;
      let inkCount = 0;
      const totalPixels = w * h;

      for (let i = 0; i < data.length; i += 4) {
        const dist = colorDistance(
          { r: data[i], g: data[i + 1], b: data[i + 2] },
          bgRgb
        );
        if (dist >= 35) {
          inkCount++;
        }
      }

      inkDensity = totalPixels > 0 ? (inkCount / totalPixels) : 0.18;

      // Measure continuous horizontal ink runs across middle 50% of the box
      const strokeRuns = [];
      const rowStart = Math.floor(h * 0.25);
      const rowEnd = Math.floor(h * 0.75);

      for (let row = rowStart; row < rowEnd; row += 2) {
        let currentRun = 0;
        for (let col = 0; col < w; col++) {
          const idx = (row * w + col) * 4;
          const isInk = colorDistance({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }, bgRgb) >= 35;
          if (isInk) {
            currentRun++;
          } else {
            if (currentRun > 0 && currentRun < w * 0.6) {
              strokeRuns.push(currentRun);
            }
            currentRun = 0;
          }
        }
        if (currentRun > 0 && currentRun < w * 0.6) {
          strokeRuns.push(currentRun);
        }
      }

      if (strokeRuns.length > 0) {
        strokeRuns.sort((a, b) => a - b);
        medianStemWidth = strokeRuns[Math.floor(strokeRuns.length / 2)];
      }

      // Serif detection: Count horizontal transitions across vertical stems
      let horizontalChanges = 0;
      for (let row = Math.floor(h * 0.2); row < Math.floor(h * 0.8); row += 2) {
        let lastIsInk = false;
        for (let col = 0; col < w; col++) {
          const idx = (row * w + col) * 4;
          const isInk = colorDistance({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }, bgRgb) >= 35;
          if (isInk !== lastIsInk) {
            horizontalChanges++;
            lastIsInk = isInk;
          }
        }
      }

      const changeRatio = w > 0 ? (horizontalChanges / (w * 0.3)) : 1;
      fontFamily = changeRatio > 2.2 ? 'Times' : 'Helvetica';
    } catch {
      // Non-blocking fallback
    }
  }

  // Determine Font Weight:
  // 1. Section headings and job titles are prominent bold elements in resumes/documents.
  // 2. Summary body text and paragraph descriptions are strictly regular weight (400)
  //    unless pixel stem analysis overwhelmingly indicates heavy bold.
  // 3. General text uses stem width and density thresholds.
  let isBold = false;
  const stemRatio = h > 0 ? (medianStemWidth / h) : 0.1;

  if (isHeading || isJobTitle) {
    isBold = true;
  } else if (isBody) {
    // Body text must be regular unless unmistakably heavy bold
    isBold = Boolean(stemRatio >= 0.22 && medianStemWidth >= 2.8 && inkDensity >= 0.35);
  } else {
    // Short phrases, dates, labels
    isBold = Boolean((stemRatio >= 0.16 && medianStemWidth >= 2.2) || inkDensity >= 0.30);
  }

  return {
    isBold,
    fontWeight: isBold ? 'bold' : 'normal',
    fontFamily,
    isHeading,
    isJobTitle,
    isBody,
  };
}

/**
 * Evaluates paragraph line alignment (left, center, or right) based on line bounding boxes.
 */
export function detectParagraphAlignment(paraLines) {
  if (!Array.isArray(paraLines) || paraLines.length <= 1) {
    return 'left';
  }

  const lefts = paraLines.map((l) => l.left ?? l.bbox?.x0 ?? 0);
  const rights = paraLines.map((l) => {
    const w = l.width ?? (l.bbox ? (l.bbox.x1 - l.bbox.x0) : 0);
    return (l.left ?? l.bbox?.x0 ?? 0) + w;
  });
  const centers = paraLines.map((l, i) => (lefts[i] + rights[i]) / 2);

  const leftVariance = Math.max(...lefts) - Math.min(...lefts);
  const rightVariance = Math.max(...rights) - Math.min(...rights);
  const centerVariance = Math.max(...centers) - Math.min(...centers);

  if (centerVariance < 12 && centerVariance < leftVariance * 0.6) {
    return 'center';
  }
  if (rightVariance < 12 && rightVariance < leftVariance * 0.6) {
    return 'right';
  }
  return 'left';
}

/**
 * Enhances raw OCR text lines with deep visual pixel analysis.
 * Detects font family, font size, and font weight separately for each text block.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} imageSource
 * @param {Array<object>} rawLines - Lines from recognizeOcr
 * @param {object} options
 * @returns {Array<object>} - Enriched lines with individually detected typography
 */
export function analyzeImageTextLines(imageSource, rawLines, options = {}) {
  if (!imageSource || !Array.isArray(rawLines) || rawLines.length === 0) {
    return [];
  }

  const imgWidth = imageSource.naturalWidth || imageSource.width || 800;
  const imgHeight = imageSource.naturalHeight || imageSource.height || 1000;
  const scaleFactor = options.scaleFactor || 1;

  let ctx = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(imageSource, 0, 0, imgWidth, imgHeight);
    }
  }

  const analyzed = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const bbox = line.bbox;
    if (!bbox) continue;

    const x0 = Math.round(bbox.x0 * scaleFactor);
    const y0 = Math.round(bbox.y0 * scaleFactor);
    const x1 = Math.round(bbox.x1 * scaleFactor);
    const y1 = Math.round(bbox.y1 * scaleFactor);

    const lineWidth = Math.max(10, x1 - x0);
    const lineHeight = Math.max(10, y1 - y0);

    let bgColor = { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } };
    let textColor = '#000000';
    let fontAttrs = {
      isBold: false,
      fontWeight: 'normal',
      fontFamily: 'Helvetica',
      isHeading: isSectionHeadingText(line.text),
      isJobTitle: isJobTitleText(line.text),
      isBody: isBodyText(line.text),
    };

    if (ctx) {
      bgColor = sampleBackgroundColor(ctx, bbox, imgWidth, imgHeight);
      textColor = extractTextColor(ctx, bbox, bgColor.rgb, imgWidth, imgHeight);
      fontAttrs = analyzeFontAttributes(ctx, bbox, bgColor.rgb, imgWidth, imgHeight, line.text);
    } else {
      fontAttrs = analyzeFontAttributes(null, bbox, bgColor.rgb, imgWidth, imgHeight, line.text);
    }

    // Estimate font size separately for each block based on its own line height and line role
    let estimatedFontSize;
    if (fontAttrs.isHeading) {
      estimatedFontSize = Math.max(14, Math.round(lineHeight * 0.85));
    } else if (fontAttrs.isJobTitle) {
      estimatedFontSize = Math.max(12, Math.round(lineHeight * 0.82));
    } else {
      estimatedFontSize = Math.max(9, Math.round(lineHeight * 0.68));
    }

    const baseVy = y0 + estimatedFontSize * 0.76;

    analyzed.push({
      str: line.text,
      text: line.text,
      originalText: line.text,
      originalStr: line.text,
      baseVx: x0,
      baseVy,
      rawWidth: lineWidth,
      rawFontSize: estimatedFontSize,
      ascent: estimatedFontSize * 0.8,
      descent: estimatedFontSize * 0.2,
      pdfLeft: x0,
      pdfTop: y0,
      pdfWidth: lineWidth,
      pdfHeight: lineHeight,
      pdfFontSize: estimatedFontSize,
      screenLeft: x0,
      screenTop: y0,
      screenWidth: lineWidth,
      screenHeight: lineHeight,
      left: x0,
      top: y0,
      width: lineWidth,
      height: lineHeight,
      fontSize: estimatedFontSize,
      fontFamily: fontAttrs.fontFamily,
      isBold: fontAttrs.isBold,
      isItalic: false,
      fontWeight: fontAttrs.fontWeight,
      fontStyle: 'normal',
      fill: textColor,
      color: textColor,
      backgroundColor: bgColor.hex,
      pdfX: x0,
      pdfY: imgHeight - y1,
      pdfHeightVal: lineHeight,
      confidence: line.confidence || 0,
      isOcrDetected: true,
      isHeading: fontAttrs.isHeading,
      isJobTitle: fontAttrs.isJobTitle,
      isBody: fontAttrs.isBody,
      textAlign: 'left',
      tesseractParaId: line.tesseractParaId || null,
    });
  }

  return analyzed;
}

/**
 * Clusters image OCR text lines into logical paragraphs while strictly preserving
 * each line's individually detected font family, font size, and font weight.
 *
 * @param {Array<object>} lineBlocks - Lines with individual styling
 * @param {number} [pageNumber=1]
 * @returns {Array<object>} - Enriched blocks with paragraph grouping
 */
export function clusterImageParagraphBlocks(lineBlocks, pageNumber = 1) {
  if (!Array.isArray(lineBlocks) || lineBlocks.length === 0) {
    return [];
  }

  const paragraphGroups = [];
  let currentPara = null;

  for (let i = 0; i < lineBlocks.length; i++) {
    const line = lineBlocks[i];
    const isHeading = Boolean(line.isHeading || isSectionHeadingText(line.str));
    const isJobTitle = Boolean(line.isJobTitle || isJobTitleText(line.str));

    // Section headings always form their own isolated single-line block
    if (isHeading) {
      if (currentPara) {
        paragraphGroups.push(currentPara);
        currentPara = null;
      }
      paragraphGroups.push({
        id: `img-para-${pageNumber}-${paragraphGroups.length + 1}`,
        lines: [line],
        isHeading: true,
      });
      continue;
    }

    // Job titles form their own block (or start a new group)
    if (isJobTitle) {
      if (currentPara) {
        paragraphGroups.push(currentPara);
        currentPara = null;
      }
      paragraphGroups.push({
        id: `img-para-${pageNumber}-${paragraphGroups.length + 1}`,
        lines: [line],
        isJobTitle: true,
      });
      continue;
    }

    if (!currentPara) {
      currentPara = {
        id: `img-para-${pageNumber}-${paragraphGroups.length + 1}`,
        lines: [line],
        baseVx: line.baseVx,
        baseVy: line.baseVy,
        rawFontSize: line.rawFontSize,
      };
      continue;
    }

    const prevLine = currentPara.lines[currentPara.lines.length - 1];
    const verticalGap = line.baseVy - prevLine.baseVy;
    const validGap = verticalGap >= prevLine.rawFontSize * 0.7 && verticalGap <= prevLine.rawFontSize * 2.2;
    const sameLeft = Math.abs(line.baseVx - currentPara.baseVx) <= Math.max(12, prevLine.rawFontSize * 1.0);
    const isIndent = line.baseVx >= currentPara.baseVx && (line.baseVx - currentPara.baseVx) <= 30;

    if (validGap && (sameLeft || isIndent)) {
      currentPara.lines.push(line);
    } else {
      paragraphGroups.push(currentPara);
      currentPara = {
        id: `img-para-${pageNumber}-${paragraphGroups.length + 1}`,
        lines: [line],
        baseVx: line.baseVx,
        baseVy: line.baseVy,
        rawFontSize: line.rawFontSize,
      };
    }
  }

  if (currentPara) {
    paragraphGroups.push(currentPara);
  }

  const blocks = [];
  let blockCounter = 1;

  for (const group of paragraphGroups) {
    const isMultiLine = group.lines.length > 1;

    // If all lines in this multi-line group are regular body text, harmonize subtle 1px OCR height jitter
    // so the paragraph has consistent text rendering across all its constituent lines.
    // (If the group has mixed roles/styles, e.g. heading + body, each line retains its distinct styles).
    const isPureBodyPara = isMultiLine && group.lines.every((l) => !l.isHeading && !l.isJobTitle && !l.isBold);
    if (isPureBodyPara) {
      const sortedSizes = group.lines.map((l) => l.rawFontSize || l.fontSize || 11).sort((a, b) => a - b);
      const medianBodySize = sortedSizes[Math.floor(sortedSizes.length / 2)];
      for (const line of group.lines) {
        line.rawFontSize = medianBodySize;
        line.fontSize = medianBodySize;
        line.pdfFontSize = medianBodySize;
      }
    }

    // IMPORTANT: Do NOT homogenize font sizes or weights across lines!
    // Each line retains its own individual font size, font family, and font weight.
    for (let idx = 0; idx < group.lines.length; idx++) {
      group.lines[idx].id = `img-block-${pageNumber}-${blockCounter++}`;
    }

    // Create paraLines snapshot where each line keeps its own individual typography and geometry
    const paraLinesSnapshot = group.lines.map((l) => ({
      id: l.id,
      str: l.str,
      originalStr: l.str,
      rawWidth: l.rawWidth,
      rawFontSize: l.rawFontSize,
      fontSize: l.fontSize,
      pdfFontSize: l.pdfFontSize,
      pdfLeft: l.pdfLeft,
      pdfTop: l.pdfTop,
      pdfWidth: l.pdfWidth,
      pdfHeight: l.pdfHeight,
      baseVx: l.baseVx,
      baseVy: l.baseVy,
      left: l.left ?? l.pdfLeft ?? l.baseVx,
      top: l.top ?? l.pdfTop,
      width: l.width ?? l.rawWidth ?? l.pdfWidth,
      height: l.height ?? l.pdfHeight,
      screenLeft: l.screenLeft ?? l.left ?? l.pdfLeft,
      screenTop: l.screenTop ?? l.top ?? l.pdfTop,
      screenWidth: l.screenWidth ?? l.width ?? l.rawWidth,
      screenHeight: l.screenHeight ?? l.height ?? l.pdfHeight,
      fontFamily: l.fontFamily,
      isBold: l.isBold,
      isItalic: l.isItalic,
      fontWeight: l.fontWeight,
      fontStyle: l.fontStyle,
      fill: l.fill,
      color: l.color,
      backgroundColor: l.backgroundColor,
      paraId: group.id,
      isOcrDetected: true,
    }));

    for (let idx = 0; idx < group.lines.length; idx++) {
      const line = group.lines[idx];
      blocks.push({
        ...line,
        isParagraph: false,
        isParagraphMember: isMultiLine,
        paraId: group.id,
        lineIndex: idx,
        paraLines: paraLinesSnapshot,
      });
    }
  }

  return blocks;
}

let measureCanvasCtx = null;

function ensureMeasureCanvas() {
  if (typeof document === 'undefined') return null;
  if (!measureCanvasCtx) {
    try {
      const offscreen = document.createElement('canvas');
      measureCanvasCtx = offscreen.getContext('2d');
    } catch {
      measureCanvasCtx = null;
    }
  }
  return measureCanvasCtx;
}

export function resolveImageFontStack(fontFamily) {
  if (fontFamily === 'Times') return '"Times New Roman", Times, Georgia, serif';
  if (fontFamily === 'Courier') return '"Courier New", Courier, monospace';
  return '"Helvetica Neue", Helvetica, Arial, sans-serif';
}

export function measureImageTextPx(text, fontSize, fontStack, isBold, isItalic) {
  const ctx = ensureMeasureCanvas();
  if (ctx && text) {
    const weight = isBold ? 'bold ' : '';
    const style = isItalic ? 'italic ' : '';
    ctx.font = `${style}${weight}${fontSize}px ${fontStack}`;
    return ctx.measureText(text).width;
  }
  const ratio = isBold ? 0.60 : 0.52;
  return (text || '').length * fontSize * ratio;
}

/**
 * Maps wrapped line strings onto original OCR line slots with anchor-preserving geometry.
 * - Content lines reuse original geometry (x/y/width/height/baseline) exactly.
 * - Attempts a bounded font-size adjustment if replacement text is slightly longer than original width.
 * - Extra wrapped lines become synthetic slots with extrapolated baselines.
 * - Unused original slots are returned as cleared lines (empty text) so export can
 *   clean out stale OCR glyphs without preserving empty selection rows.
 */
function mapWrappedLinesToImageSlots(wrappedTexts, paraLines) {
  const results = [];
  const template = paraLines[paraLines.length - 1] || paraLines[0];
  const fontSize = template.rawFontSize || template.fontSize || 11;

  let lineGap = fontSize * 1.35;
  if (paraLines.length >= 2) {
    const gaps = [];
    for (let i = 1; i < paraLines.length; i++) {
      const prev = paraLines[i - 1];
      const curr = paraLines[i];
      const prevBase = Number.isFinite(prev.baseVy) ? prev.baseVy : ((prev.pdfTop ?? prev.top ?? 0) + fontSize * 0.76);
      const currBase = Number.isFinite(curr.baseVy) ? curr.baseVy : ((curr.pdfTop ?? curr.top ?? 0) + fontSize * 0.76);
      const gap = currBase - prevBase;
      if (gap > fontSize * 0.5 && gap < fontSize * 3) gaps.push(gap);
    }
    if (gaps.length > 0) {
      gaps.sort((a, b) => a - b);
      lineGap = gaps[Math.floor(gaps.length / 2)];
    }
  }

  const lineHeight = Number.isFinite(template.pdfHeight)
    ? template.pdfHeight
    : (template.height || Math.max(10, Math.round(fontSize * 1.15)));

  for (let i = 0; i < wrappedTexts.length; i++) {
    if (i < paraLines.length) {
      const line = paraLines[i];
      const lineFontSize = line.rawFontSize || line.fontSize || fontSize;
      const lineText = wrappedTexts[i];

      results.push({
        lineId: line.id,
        text: lineText,
        originalText: line.originalStr || line.str,
        block: {
          ...line,
          rawFontSize: lineFontSize,
          fontSize: lineFontSize,
          pdfFontSize: lineFontSize,
        },
        isClearedLine: false,
        isSyntheticLine: false,
      });
      continue;
    }

    const prevBlock = results[results.length - 1]?.block || template;
    const prevTop = Number.isFinite(prevBlock.pdfTop) ? prevBlock.pdfTop : (prevBlock.top ?? 0);
    const prevBase = Number.isFinite(prevBlock.baseVy)
      ? prevBlock.baseVy
      : (prevTop + fontSize * 0.76);
    const newTop = prevTop + lineGap;
    const newBaseVy = prevBase + lineGap;
    const synthId = `${template.id}__extra_${i - paraLines.length + 1}`;
    const pLeft = Number.isFinite(template.pdfLeft) ? template.pdfLeft : (template.baseVx ?? template.left ?? 0);
    const pWidth = Number.isFinite(template.pdfWidth) ? template.pdfWidth : (template.rawWidth ?? template.width ?? 100);

    const synthBlock = {
      ...template,
      id: synthId,
      str: wrappedTexts[i],
      originalStr: '',
      pdfLeft: pLeft,
      pdfTop: newTop,
      pdfWidth: pWidth,
      pdfHeight: lineHeight,
      baseVx: pLeft,
      baseVy: newBaseVy,
      left: pLeft,
      top: newTop,
      width: pWidth,
      height: lineHeight,
      screenLeft: pLeft,
      screenTop: newTop,
      screenWidth: pWidth,
      screenHeight: lineHeight,
      rawWidth: pWidth,
      isSyntheticLine: true,
      isOcrDetected: true,
    };

    results.push({
      lineId: synthId,
      text: wrappedTexts[i],
      originalText: '',
      block: synthBlock,
      isClearedLine: false,
      isSyntheticLine: true,
    });
  }

  // White-out original OCR lines that are no longer needed after shortening.
  for (let i = wrappedTexts.length; i < paraLines.length; i++) {
    const line = paraLines[i];
    results.push({
      lineId: line.id,
      text: '',
      originalText: line.originalStr || line.str,
      block: line,
      isClearedLine: true,
      isSyntheticLine: false,
    });
  }

  return results;
}

/**
 * Reflows image paragraph text with pixel-accurate width-based wrapping.
 * Uses Canvas measureText() so preview and export share the same metrics.
 *
 * Line count follows the wrapped content:
 * - Shortened text drops unused trailing OCR rows (returned as cleared white-outs).
 * - Lengthened text creates additional synthetic rows instead of clipping.
 * - Intentional blank lines from explicit \\n breaks are preserved (trailing empties trimmed).
 */
export function reflowImageParagraphText(paraLines, editedLineId, newText, existingEdits = {}, isFullParagraph = false) {
  if (!Array.isArray(paraLines) || paraLines.length === 0) {
    return [{ lineId: editedLineId, text: newText, originalText: newText }];
  }

  // 1. Explicit newlines encode intentional paragraph breaks. Preserve mid-paragraph
  //    blank lines; drop only trailing empties produced by stale layout.
  if (typeof newText === 'string' && newText.includes('\n') && isFullParagraph) {
    const rawLines = newText.split(/\r?\n/).map((l) => l.replace(/^\s+|\s+$/g, ''));
    while (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }
    if (rawLines.length > 0) {
      return mapWrappedLinesToImageSlots(rawLines, paraLines);
    }
  }

  // 2. Prepare composite paragraph text
  let combinedText = '';
  if (isFullParagraph) {
    combinedText = (newText || '').trim().replace(/\s+/g, ' ');
  } else {
    const fullTextParts = [];
    for (const line of paraLines) {
      if (existingEdits[line.id]?.isClearedLine) continue;
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
    combinedText = fullTextParts.join(' ').replace(/\s+/g, ' ').trim();
  }

  const words = combinedText.length > 0 ? combinedText.split(' ').filter(Boolean) : [];
  if (words.length === 0) {
    return paraLines.map((line) => ({
      lineId: line.id,
      text: '',
      originalText: line.originalStr || line.str,
      block: line,
      isClearedLine: true,
      isSyntheticLine: false,
    }));
  }

  // 3. Paragraph container width from the union of constituent line boxes (native image px).
  const pLeft = Math.min(...paraLines.map((l) => (Number.isFinite(l.pdfLeft) ? l.pdfLeft : (l.baseVx ?? 0))));
  const pRight = Math.max(...paraLines.map((l) => {
    const lLeft = Number.isFinite(l.pdfLeft) ? l.pdfLeft : (l.baseVx ?? 0);
    const lWidth = Number.isFinite(l.pdfWidth) ? l.pdfWidth : (l.rawWidth ?? 100);
    return lLeft + lWidth;
  }));
  const pWidth = Math.max(20, pRight - pLeft);

  // 4. Use the first line's typography for wrap decisions (body paras are size-harmonized).
  const styleLine = paraLines[0];
  const lineFontSize = styleLine.rawFontSize || styleLine.fontSize || 11;
  const lineFontStack = resolveImageFontStack(styleLine.fontFamily || 'Helvetica');
  const lineBold = Boolean(styleLine.isBold || styleLine.fontWeight === 'bold');
  const lineItalic = Boolean(styleLine.isItalic || styleLine.fontStyle === 'italic');
  const spaceWidth = measureImageTextPx(' ', lineFontSize, lineFontStack, lineBold, lineItalic);

  // 5. Wrap by measured width — line count is content-driven, not OCR-slot-driven.
  const wrappedTexts = [];
  let wordIdx = 0;

  while (wordIdx < words.length) {
    const currentLineWords = [];
    let currentLinePixelWidth = 0;

    while (wordIdx < words.length) {
      const nextWord = words[wordIdx];
      const wordPx = measureImageTextPx(nextWord, lineFontSize, lineFontStack, lineBold, lineItalic);
      const addedPx = currentLineWords.length === 0 ? wordPx : (spaceWidth + wordPx);

      // Keep short tech suffixes with the preceding token.
      let suffixPx = 0;
      if (wordIdx + 1 < words.length) {
        const peekWord = words[wordIdx + 1];
        if (/^(js,?|ts,?|\.js,?|api,?|apis,?)$/i.test(peekWord)) {
          suffixPx = spaceWidth + measureImageTextPx(peekWord, lineFontSize, lineFontStack, lineBold, lineItalic);
        }
      }

      if (
        currentLineWords.length > 0 &&
        (currentLinePixelWidth + addedPx + suffixPx) > pWidth
      ) {
        break;
      }

      currentLineWords.push(nextWord);
      currentLinePixelWidth += addedPx;
      wordIdx++;
    }

    if (currentLineWords.length === 0 && wordIdx < words.length) {
      // Extremely long single token: force at least one word to avoid infinite loop.
      currentLineWords.push(words[wordIdx]);
      wordIdx++;
    }

    wrappedTexts.push(currentLineWords.join(' '));
  }

  return mapWrappedLinesToImageSlots(wrappedTexts, paraLines);
}


export default {
  sampleBackgroundColor,
  extractTextColor,
  analyzeFontAttributes,
  detectParagraphAlignment,
  analyzeImageTextLines,
  clusterImageParagraphBlocks,
  reflowImageParagraphText,
  isSectionHeadingText,
  isJobTitleText,
  isBodyText,
  rgbToHex,
  colorDistance,
};
