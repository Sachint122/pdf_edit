/**
 * PDF Export Engine
 * Compiles original PDF bytes, page structure (rotations, deletions, reordering, blanks),
 * and vector editing layers (text, shapes, drawings, images, signatures) into a valid modified PDF using pdf-lib.
 */

import {
  PDFDocument,
  degrees,
  rgb,
  PDFName,
  PDFString,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from 'pdf-lib';
import { FontManager } from './fontManager.js';
import { toPdfLibRgb } from './colorParser.js';
import { applyWatermark, applyPageNumber } from '../advanced/watermarkManager.js';
import { applyPdfMetadata } from '../advanced/pdfMetadata.js';
import { sanitizeForWinAnsi } from '../../utils/textSanitizer.js';

/**
 * Add a clickable URI Link annotation to a PDF page
 * @param {import('pdf-lib').PDFDocument} outDoc
 * @param {import('pdf-lib').PDFPage} targetPage
 * @param {number[]} rect - [x1, y1, x2, y2] in PDF point coordinates
 * @param {string} url - Target link URL
 */
export function addLinkAnnotation(outDoc, targetPage, rect, url) {
  if (!outDoc || !targetPage || !url || !Array.isArray(rect) || rect.length !== 4) return;
  try {
    let cleanUrl = String(url).trim();
    if (!cleanUrl) return;
    if (!/^https?:\/\//i.test(cleanUrl) && !/^mailto:/i.test(cleanUrl) && !/^tel:/i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const [x1, y1, x2, y2] = rect;
    const validRect = [
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2),
    ];

    const linkAnnotation = outDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: validRect,
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(cleanUrl),
      },
    });

    const linkAnnotationRef = outDoc.context.register(linkAnnotation);
    const annots = targetPage.node.get(PDFName.of('Annots'));
    if (!annots) {
      targetPage.node.set(PDFName.of('Annots'), outDoc.context.obj([linkAnnotationRef]));
    } else {
      outDoc.context.lookup(annots).push(linkAnnotationRef);
    }
  } catch (err) {
    console.warn('Could not attach link annotation:', err);
  }
}

/**
 * Convert WebP or non-standard image DataURL to PNG DataURL in browser environment
 */
export async function convertWebpToPng(dataUrl) {
  if (typeof document === 'undefined') return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        resolve(pngUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/**
 * Convert DataURL to Uint8Array
 */
export function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl) return new Uint8Array(0);
  const parts = dataUrl.split(',');
  const base64 = parts.length > 1 ? parts[1] : parts[0];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Exports modified PDF document in browser memory.
 *
 * @param {ArrayBuffer|Uint8Array} originalBuffer - Original PDF bytes
 * @param {Array<object>} pages - Array of page objects { id, originalIndex, isBlank, width, height, rotation, sourceDocId }
 * @param {object} pageEdits - Map of { [pageId]: fabricJson }
 * @param {object} [options] - { watermark, pageNumbers, metadata, sourceBuffers }
 * @param {function} [onProgress] - ({ current, total, phase }) => void
 * @returns {Promise<{ pdfBytes: Uint8Array, blob: Blob }>}
 */
export async function exportModifiedPdf(originalBuffer, pages = [], pageEdits = {}, options = {}, onProgress) {
  if (!pages || pages.length === 0) {
    throw new Error('Cannot export document with 0 pages.');
  }

  const reportProgress = (current, total, phase) => {
    if (typeof onProgress === 'function') {
      onProgress({ current, total, phase });
    }
  };

  reportProgress(0, pages.length, 'Initializing export engine...');

  // 1. Load source PDF document (if not empty) and any merged source documents
  let srcDoc = null;
  const srcDocsMap = {};

  let effectiveOriginal = originalBuffer;
  if (effectiveOriginal && typeof effectiveOriginal.getData === 'function') {
    try {
      effectiveOriginal = await effectiveOriginal.getData();
    } catch (e) {
      console.warn('Could not retrieve data from originalBuffer proxy:', e);
    }
  }

  if (
    effectiveOriginal &&
    (effectiveOriginal.byteLength > 0 || (effectiveOriginal.buffer && effectiveOriginal.buffer.byteLength > 0))
  ) {
    try {
      const uint8Original = effectiveOriginal instanceof Uint8Array
        ? effectiveOriginal
        : new Uint8Array(effectiveOriginal);
      srcDoc = await PDFDocument.load(uint8Original, { ignoreEncryption: true });
      srcDocsMap['main'] = srcDoc;
    } catch (loadErr) {
      console.error('Failed to load source PDF document in exportModifiedPdf:', loadErr);
    }
  }

  if (options.sourceBuffers) {
    for (const [docKey, buf] of Object.entries(options.sourceBuffers)) {
      if (buf && buf.byteLength > 0 && !srcDocsMap[docKey]) {
        try {
          const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
          srcDocsMap[docKey] = await PDFDocument.load(u8, { ignoreEncryption: true });
        } catch (mergeLoadErr) {
          console.warn(`Could not load merge source document "${docKey}":`, mergeLoadErr);
        }
      }
    }
  }

  // 2. Create target document
  const outDoc = await PDFDocument.create();
  const fontManager = new FontManager(outDoc);

  // Apply Document Metadata
  if (options.metadata) {
    applyPdfMetadata(outDoc, options.metadata);
  }

  const totalPages = pages.length;

  // 3. Process pages sequentially
  for (let i = 0; i < totalPages; i++) {
    const pageConfig = pages[i];
    reportProgress(i + 1, totalPages, `Processing Page ${i + 1} of ${totalPages}...`);

    let targetPage;

    // A. Page Creation / Copying
    const sourceDoc = (pageConfig.sourceDocId && srcDocsMap[pageConfig.sourceDocId])
      ? srcDocsMap[pageConfig.sourceDocId]
      : srcDoc;

    if (pageConfig.isBlank || !sourceDoc || !pageConfig.originalIndex) {
      if (!pageConfig.isBlank && !sourceDoc) {
        console.warn(`[exportModifiedPdf] Page ${i + 1} has no source document. Falling back to blank page!`);
      }
      // Blank page
      const w = pageConfig.width || 612;
      const h = pageConfig.height || 792;
      targetPage = outDoc.addPage([w, h]);
    } else {
      // Copy page from source document
      const srcPageIndex = pageConfig.originalIndex - 1;
      const [copiedPage] = await outDoc.copyPages(sourceDoc, [srcPageIndex]);
      targetPage = outDoc.addPage(copiedPage);
    }

    // B. Apply Page Rotation
    if (pageConfig.rotation && pageConfig.rotation !== 0) {
      targetPage.setRotation(degrees(pageConfig.rotation));
    }

    // C. Watermark & Page Numbers
    if (options.watermark && options.watermark.enabled) {
      await applyWatermark(targetPage, options.watermark, fontManager);
    }
    if (options.pageNumbers && options.pageNumbers.enabled) {
      await applyPageNumber(targetPage, i, totalPages, options.pageNumbers, fontManager);
    }

    const { width: pWidth, height: pHeight } = targetPage.getSize();

    // C. Render Vector Editing Objects for this page
    const edits = pageEdits[pageConfig.id];
    const objects = edits?.objects || [];

    // Native Downstream Shift: When an expanded paragraph exceeds available whitespace,
    // shift downstream content using native PDF Form XObject slicing, preserving 100% of the
    // original TrueType fonts, vector divider lines, colors, bullets, dates, and relative layout.
    const downstreamShift = edits?.downstreamShift || 0;
    const splitPdfY = edits?.splitPdfY;

    if (downstreamShift > 0 && Number.isFinite(splitPdfY) && sourceDoc && pageConfig.originalIndex) {
      try {
        const srcPageIndex = pageConfig.originalIndex - 1;
        const srcPage = sourceDoc.getPage(srcPageIndex);

        const bottomPart = await outDoc.embedPage(srcPage, {
          left: 0,
          bottom: 0,
          right: pWidth,
          top: splitPdfY,
        });

        // Clean whiteout over original bottom section
        targetPage.drawRectangle({
          x: 0,
          y: 0,
          width: pWidth,
          height: splitPdfY + 1,
          color: rgb(1, 1, 1),
        });

        // Set explicit clipping path on targetPage so bottomPart CANNOT draw anything above (splitPdfY - downstreamShift)
        const contentStream = targetPage.getContentStream();
        contentStream.push(
          pushGraphicsState(),
          rectangle(0, 0, pWidth, splitPdfY - downstreamShift),
          clip(),
          endPath()
        );

        // Draw the native bottom slice shifted down by downstreamShift
        targetPage.drawPage(bottomPart, {
          x: 0,
          y: -downstreamShift,
        });

        contentStream.push(popGraphicsState());
      } catch (sliceErr) {
        console.warn('Could not apply native downstream slice shift:', sliceErr);
      }
    }

    for (const obj of objects) {
      try {
        const objType = (obj.type || '').toLowerCase();
        const objLeft = Number.isFinite(obj.left) ? obj.left : 0;
        const objTop = Number.isFinite(obj.top) ? obj.top : 0;
        const objAngle = Number.isFinite(obj.angle) ? obj.angle : 0;

        // 1. TEXTBOX
        if (objType === 'textbox' || objType === 'i-text' || objType === 'text') {
          const font = await fontManager.getFont(obj.fontFamily, obj.fontWeight, obj.fontStyle);
          const textColor = toPdfLibRgb(obj.fill) || rgb(0, 0, 0);
          const fontSize = obj.fontSize || 16;
          const rawText = obj.text || '';
          const text = sanitizeForWinAnsi(rawText);
          const lines = text.split('\n');
          const lineHeight = fontSize * (obj.lineHeight || 1.2);

          const isContentEdit = !!obj.isPdfContentEdit;
          const linesInfo = Array.isArray(obj.linesInfo) && obj.linesInfo.length > 0 ? obj.linesInfo : null;
          const textAlign = obj.textAlign || 'left';

          if (isContentEdit) {
            if (!obj.isLinkOnly) {
              // Compute replacement text width using pdf-lib font metrics
            let maxReplacementTextWidth = 0;
            for (const lineText of lines) {
              try {
                const w = font.widthOfTextAtSize(lineText, fontSize);
                if (w > maxReplacementTextWidth) maxReplacementTextWidth = w;
              } catch {
                maxReplacementTextWidth = Math.max(maxReplacementTextWidth, lineText.length * fontSize * 0.55);
              }
            }

            // Precise whiteout masking per line to avoid overlapping subsequent lines or headers
            const whiteoutLines = (Array.isArray(obj.whiteoutLines) && obj.whiteoutLines.length > 0)
              ? obj.whiteoutLines
              : (linesInfo || [{
                pdfLeft: objLeft,
                pdfWidth: Math.max((obj.width || 100) * (obj.scaleX || 1), maxReplacementTextWidth),
                rawFontSize: fontSize,
                baseVy: objTop + fontSize * 0.76,
              }]);

            if (obj.backgroundColor && obj.backgroundColor !== 'transparent') {
              const bgRgb = toPdfLibRgb(obj.backgroundColor) || rgb(1, 1, 1);
              for (const lInfo of whiteoutLines) {
                const lLeft = Number.isFinite(lInfo.paraLeft)
                  ? lInfo.paraLeft
                  : (Number.isFinite(lInfo.pdfLeft) ? lInfo.pdfLeft : objLeft);
                const origWidth = Number.isFinite(lInfo.paraWidth)
                  ? lInfo.paraWidth
                  : (Number.isFinite(lInfo.pdfWidth) ? lInfo.pdfWidth : ((obj.width || 100) * (obj.scaleX || 1)));
                const lFontSize = Number.isFinite(lInfo.rawFontSize) ? lInfo.rawFontSize : fontSize;
                const lBaseVy = Number.isFinite(lInfo.baseVy) ? lInfo.baseVy : (objTop + lFontSize * 0.76);

                // Baseline in PDF-lib coordinates: yBaseline = pHeight - lBaseVy
                // Ascenders reach up to yBaseline + 0.88 * fontSize
                // Descenders reach down to yBaseline - 0.26 * fontSize
                // Bottom of whiteout rectangle = yBaseline - 0.26 * fontSize
                // Height = 1.18 * fontSize
                const stripY = pHeight - lBaseVy - (lFontSize * 0.26);
                const stripHeight = lFontSize * 1.18;
                const maskWidth = Math.max(origWidth, maxReplacementTextWidth) + 4;

                targetPage.drawRectangle({
                  x: lLeft - 1,
                  y: stripY,
                  width: maskWidth,
                  height: stripHeight,
                  color: bgRgb,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              }
            }

            // Draw replacement text exactly on original baselines with alignment support
            for (let l = 0; l < lines.length; l++) {
              const lineText = lines[l];
              if (lineText.length === 0) continue;

              const lInfo = (linesInfo && l < linesInfo.length) ? linesInfo[l] : null;

              let lineY;
              if (lInfo && Number.isFinite(lInfo.baseVy)) {
                // Exact baseline match
                lineY = pHeight - lInfo.baseVy;
              } else {
                // Fallback for additional lines or single block
                const firstBaseVy = (linesInfo && linesInfo.length > 0 && Number.isFinite(linesInfo[0].baseVy))
                  ? linesInfo[0].baseVy
                  : (objTop + fontSize * 0.76);
                lineY = pHeight - (firstBaseVy + l * lineHeight);
              }

              // Determine boundaries for alignment
              const boundLeft = (lInfo && Number.isFinite(lInfo.paraLeft))
                ? lInfo.paraLeft
                : (lInfo && Number.isFinite(lInfo.pdfLeft)
                  ? lInfo.pdfLeft
                  : (lInfo && Number.isFinite(lInfo.pdfX) ? lInfo.pdfX : objLeft));

              const boundWidth = (lInfo && Number.isFinite(lInfo.paraWidth))
                ? lInfo.paraWidth
                : (lInfo && Number.isFinite(lInfo.pdfWidth)
                  ? lInfo.pdfWidth
                  : (lInfo && Number.isFinite(lInfo.rawWidth) ? lInfo.rawWidth : ((obj.width || 100) * (obj.scaleX || 1))));

              const isLastLine = (lInfo && typeof lInfo.isLastLine !== 'undefined')
                ? lInfo.isLastLine
                : (l === lines.length - 1);

              let lineWidth = 0;
              try {
                lineWidth = font.widthOfTextAtSize(lineText, fontSize);
              } catch {
                lineWidth = lineText.length * fontSize * 0.55;
              }

              if (textAlign === 'center') {
                const lineX = boundLeft + Math.max(0, (boundWidth - lineWidth) / 2);
                targetPage.drawText(lineText, {
                  x: lineX,
                  y: lineY,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              } else if (textAlign === 'right') {
                const lineX = boundLeft + Math.max(0, boundWidth - lineWidth);
                targetPage.drawText(lineText, {
                  x: lineX,
                  y: lineY,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              } else if (textAlign === 'justify') {
                // Justify distributes paragraph text across available line width,
                // leaving the final line naturally aligned to the left.
                if (isLastLine) {
                  targetPage.drawText(lineText, {
                    x: boundLeft,
                    y: lineY,
                    size: fontSize,
                    font,
                    color: textColor,
                    opacity: obj.opacity ?? 1,
                    rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                  });
                } else {
                  const words = lineText.trim().split(/\s+/).filter(Boolean);
                  if (words.length <= 1) {
                    targetPage.drawText(lineText, {
                      x: boundLeft,
                      y: lineY,
                      size: fontSize,
                      font,
                      color: textColor,
                      opacity: obj.opacity ?? 1,
                      rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                    });
                  } else {
                    let totalWordsWidth = 0;
                    const wordWidths = [];
                    for (const w of words) {
                      let ww = 0;
                      try {
                        ww = font.widthOfTextAtSize(w, fontSize);
                      } catch {
                        ww = w.length * fontSize * 0.55;
                      }
                      wordWidths.push(ww);
                      totalWordsWidth += ww;
                    }

                    let normalSpaceWidth = fontSize * 0.28;
                    try {
                      normalSpaceWidth = font.widthOfTextAtSize(' ', fontSize);
                    } catch {
                      normalSpaceWidth = fontSize * 0.28;
                    }

                    const remainingSpace = boundWidth - totalWordsWidth;
                    const gapCount = words.length - 1;

                    // If the line is short (< 80% of boundWidth) or space is negative, keep natural left-aligned spacing.
                    // Otherwise distribute across width, but clamp gapWidth to maximum 1.35x normalSpaceWidth
                    // to eliminate excessive spacing and unnatural rivers between words.
                    const isShortLine = totalWordsWidth < boundWidth * 0.80;
                    const rawGap = (gapCount > 0 && remainingSpace > 0) ? (remainingSpace / gapCount) : normalSpaceWidth;
                    const maxGap = normalSpaceWidth * 1.35;

                    const gapWidth = isShortLine
                      ? normalSpaceWidth
                      : Math.min(maxGap, Math.max(normalSpaceWidth, rawGap));

                    let curX = boundLeft;
                    for (let wIdx = 0; wIdx < words.length; wIdx++) {
                      targetPage.drawText(words[wIdx], {
                        x: curX,
                        y: lineY,
                        size: fontSize,
                        font,
                        color: textColor,
                        opacity: obj.opacity ?? 1,
                        rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                      });
                      curX += wordWidths[wIdx] + (wIdx < gapCount ? gapWidth : 0);
                    }
                  }
                }
              } else {
                // Default: 'left'
                targetPage.drawText(lineText, {
                  x: boundLeft,
                  y: lineY,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              }
            }
          }
          } else {
            // Standard non-content-edit user text box
            const pad = obj.padding || 0;
            const startY = pHeight - (objTop + fontSize * 0.85);
            const boxWidth = (obj.width || 100) * (obj.scaleX || 1);
            const contentWidth = Math.max(0, boxWidth - pad * 2);

            // Draw solid background rectangle if specified
            if (obj.backgroundColor && obj.backgroundColor !== 'transparent') {
              const bgRgb = toPdfLibRgb(obj.backgroundColor);
              if (bgRgb) {
                const bgHeight = Math.max(fontSize * lines.length * 1.2, (obj.height || fontSize) * (obj.scaleY || 1));
                targetPage.drawRectangle({
                  x: objLeft - pad,
                  y: pHeight - objTop - bgHeight - pad,
                  width: boxWidth + pad * 2,
                  height: bgHeight + pad * 2,
                  color: bgRgb,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              }
            }

            for (let l = 0; l < lines.length; l++) {
              const lineText = lines[l];
              if (lineText.length === 0) continue;

              const lineY = startY - l * lineHeight;
              let lineWidth = 0;
              try {
                lineWidth = font.widthOfTextAtSize(lineText, fontSize);
              } catch {
                lineWidth = lineText.length * fontSize * 0.55;
              }

              if (textAlign === 'center') {
                const lineX = objLeft + pad + Math.max(0, (contentWidth - lineWidth) / 2);
                targetPage.drawText(lineText, {
                  x: lineX,
                  y: lineY,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              } else if (textAlign === 'right') {
                const lineX = objLeft + pad + Math.max(0, contentWidth - lineWidth);
                targetPage.drawText(lineText, {
                  x: lineX,
                  y: lineY,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              } else if (textAlign === 'justify') {
                const isLastLine = (l === lines.length - 1);
                if (isLastLine || lines.length === 1) {
                  targetPage.drawText(lineText, {
                    x: objLeft + pad,
                    y: lineY,
                    size: fontSize,
                    font,
                    color: textColor,
                    opacity: obj.opacity ?? 1,
                    rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                  });
                } else {
                  const words = lineText.trim().split(/\s+/);
                  if (words.length <= 1) {
                    targetPage.drawText(lineText, {
                      x: objLeft + pad,
                      y: lineY,
                      size: fontSize,
                      font,
                      color: textColor,
                      opacity: obj.opacity ?? 1,
                      rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                    });
                  } else {
                    let totalWordsWidth = 0;
                    const wordWidths = [];
                    for (const w of words) {
                      let ww = 0;
                      try {
                        ww = font.widthOfTextAtSize(w, fontSize);
                      } catch {
                        ww = w.length * fontSize * 0.55;
                      }
                      wordWidths.push(ww);
                      totalWordsWidth += ww;
                    }
                    const remainingSpace = contentWidth - totalWordsWidth;
                    const gapCount = words.length - 1;
                    const gapWidth = (gapCount > 0 && remainingSpace > 0)
                      ? (remainingSpace / gapCount)
                      : (fontSize * 0.25);

                    let curX = objLeft + pad;
                    for (let wIdx = 0; wIdx < words.length; wIdx++) {
                      targetPage.drawText(words[wIdx], {
                        x: curX,
                        y: lineY,
                        size: fontSize,
                        font,
                        color: textColor,
                        opacity: obj.opacity ?? 1,
                        rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                      });
                      curX += wordWidths[wIdx] + gapWidth;
                    }
                  }
                }
              } else {
                targetPage.drawText(lineText, {
                  x: objLeft + pad,
                  y: lineY,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              }
            }
          }

          // Attach Clickable Hyperlink Annotation if specified on text object
          if (obj.linkUrl && typeof obj.linkUrl === 'string' && obj.linkUrl.trim().length > 0) {
            const rectX1 = Math.max(0, objLeft);
            const rectWidth = Math.max(10, (obj.width || 100) * (obj.scaleX || 1));
            const rectHeight = Math.max(fontSize, (obj.height || (fontSize * lines.length * 1.2)) * (obj.scaleY || 1));
            const rectY1 = Math.max(0, pHeight - objTop - rectHeight);
            const rectX2 = rectX1 + rectWidth;
            const rectY2 = rectY1 + rectHeight;
            addLinkAnnotation(outDoc, targetPage, [rectX1, rectY1, rectX2, rectY2], obj.linkUrl);
          }
        }

        // 2. RECTANGLE
        else if (objType === 'rect') {
          const w = (obj.width || 100) * (obj.scaleX || 1);
          const h = (obj.height || 60) * (obj.scaleY || 1);
          const x = objLeft;
          const y = pHeight - objTop - h;

          const fillColor = toPdfLibRgb(obj.fill);
          const strokeColor = toPdfLibRgb(obj.stroke);

          targetPage.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: fillColor || undefined,
            borderColor: strokeColor || undefined,
            borderWidth: strokeColor ? obj.strokeWidth || 1 : 0,
            opacity: obj.opacity ?? 1,
            rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
          });
        }

        // 3. CIRCLE
        else if (objType === 'circle') {
          const radius = (obj.radius || 30) * (obj.scaleX || 1);
          const x = objLeft + radius;
          const y = pHeight - objTop - radius;

          const fillColor = toPdfLibRgb(obj.fill);
          const strokeColor = toPdfLibRgb(obj.stroke);

          targetPage.drawCircle({
            x,
            y,
            size: radius,
            color: fillColor || undefined,
            borderColor: strokeColor || undefined,
            borderWidth: strokeColor ? obj.strokeWidth || 1 : 0,
            opacity: obj.opacity ?? 1,
          });
        }

        // 4. LINE
        else if (objType === 'line') {
          const strokeColor = toPdfLibRgb(obj.stroke) || rgb(0, 0, 0);
          const x1 = Number.isFinite(obj.x1) ? obj.x1 : objLeft;
          const y1 = Number.isFinite(obj.y1) ? obj.y1 : objTop;
          const x2 = Number.isFinite(obj.x2) ? obj.x2 : objLeft + (obj.width || 100) * (obj.scaleX || 1);
          const y2 = Number.isFinite(obj.y2) ? obj.y2 : objTop + (obj.height || 0) * (obj.scaleY || 1);

          targetPage.drawLine({
            start: { x: x1, y: pHeight - y1 },
            end: { x: x2, y: pHeight - y2 },
            thickness: obj.strokeWidth || 2,
            color: strokeColor,
            opacity: obj.opacity ?? 1,
          });
        }

        // 5. IMAGE / SIGNATURE
        else if (objType === 'image' || objType === 'fabricimage') {
          let imgSrc = obj.src;
          if (imgSrc) {
            if (imgSrc.startsWith('data:image/webp') && typeof document !== 'undefined') {
              try {
                imgSrc = await convertWebpToPng(imgSrc);
              } catch (convErr) {
                console.warn('Could not convert webp image to png:', convErr);
              }
            }

            const imgBytes = dataUrlToUint8Array(imgSrc);
            if (imgBytes.length > 0) {
              const isJpg = imgSrc.includes('image/jpeg') || imgSrc.includes('image/jpg');
              const embedded = isJpg
                ? await outDoc.embedJpg(imgBytes)
                : await outDoc.embedPng(imgBytes);

              const w = (obj.width || 100) * (obj.scaleX || 1);
              const h = (obj.height || 100) * (obj.scaleY || 1);
              const x = objLeft;
              const y = pHeight - objTop - h;

              targetPage.drawImage(embedded, {
                x,
                y,
                width: w,
                height: h,
                opacity: obj.opacity ?? 1,
                rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
              });
            }
          }
        }

        // 6. FREEHAND PATH (PEN / HIGHLIGHTER)
        else if (objType === 'path' && Array.isArray(obj.path)) {
          const svgPath = obj.path.map((seg) => seg.join(' ')).join(' ');
          const strokeColor = toPdfLibRgb(obj.stroke) || rgb(0, 0, 0);

          // In Fabric 7, path segments are in absolute coordinates.
          // If the user moved the path after drawing, left - pathOffset.x gives the movement delta.
          const offsetX = (obj.left ?? 0) - (obj.pathOffset?.x ?? 0);
          const offsetY = (obj.top ?? 0) - (obj.pathOffset?.y ?? 0);
          const x = offsetX;
          const y = pHeight - offsetY;

          targetPage.drawSvgPath(svgPath, {
            x,
            y,
            borderColor: strokeColor,
            borderWidth: obj.strokeWidth || 2,
            opacity: obj.opacity ?? 1,
          });
        }
      } catch (objErr) {
        console.warn(`Could not render object ${obj.type} during export:`, objErr);
      }
    }
  }

  reportProgress(totalPages, totalPages, 'Saving final PDF bytes...');

  // 4. Compile and save modified PDF bytes
  const pdfBytes = await outDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  reportProgress(totalPages, totalPages, 'Export complete!');

  return {
    pdfBytes,
    blob,
  };
}
