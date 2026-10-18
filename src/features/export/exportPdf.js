/**
 * PDF Export Engine
 * Compiles original PDF bytes, page structure (rotations, deletions, reordering, blanks),
 * and vector editing layers (text, shapes, drawings, images, signatures) into a valid modified PDF using pdf-lib.
 */

import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { FontManager } from './fontManager.js';
import { toPdfLibRgb } from './colorParser.js';
import { applyWatermark, applyPageNumber } from '../advanced/watermarkManager.js';
import { applyPdfMetadata } from '../advanced/pdfMetadata.js';
import { sanitizeForWinAnsi } from '../../utils/textSanitizer.js';

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

    const { height: pHeight } = targetPage.getSize();

    // C. Render Vector Editing Objects for this page
    const edits = pageEdits[pageConfig.id];
    const objects = edits?.objects || [];

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

          if (isContentEdit) {
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
            const whiteoutLines = linesInfo || [{
              pdfLeft: objLeft,
              pdfWidth: Math.max((obj.width || 100) * (obj.scaleX || 1), maxReplacementTextWidth),
              rawFontSize: fontSize,
              baseVy: objTop + fontSize * 0.76,
            }];

            if (obj.backgroundColor && obj.backgroundColor !== 'transparent') {
              const bgRgb = toPdfLibRgb(obj.backgroundColor) || rgb(1, 1, 1);
              for (const lInfo of whiteoutLines) {
                const lLeft = Number.isFinite(lInfo.pdfLeft) ? lInfo.pdfLeft : objLeft;
                const origWidth = Number.isFinite(lInfo.pdfWidth) ? lInfo.pdfWidth : ((obj.width || 100) * (obj.scaleX || 1));
                const lFontSize = Number.isFinite(lInfo.rawFontSize) ? lInfo.rawFontSize : fontSize;
                const lBaseVy = Number.isFinite(lInfo.baseVy) ? lInfo.baseVy : (objTop + lFontSize * 0.76);

                // Baseline in PDF-lib coordinates: yBaseline = pHeight - lBaseVy
                // Ascenders reach up to yBaseline + 0.76 * fontSize
                // Descenders reach down to yBaseline - 0.20 * fontSize
                // Bottom of whiteout rectangle = yBaseline - 0.20 * fontSize
                // Height = 0.96 * fontSize
                // Top of whiteout rectangle = yBaseline + 0.76 * fontSize
                // This leaves a clean safety gap above the next line, completely eliminating line overlap
                const stripY = pHeight - lBaseVy - (lFontSize * 0.20);
                const stripHeight = lFontSize * 0.96;
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

            // Draw replacement text exactly on original baselines
            for (let l = 0; l < lines.length; l++) {
              const lineText = lines[l];
              if (lineText.length === 0) continue;

              let lineX = objLeft;
              let lineY;

              if (linesInfo && l < linesInfo.length && Number.isFinite(linesInfo[l].baseVy)) {
                // Exact baseline match
                lineY = pHeight - linesInfo[l].baseVy;
                lineX = Number.isFinite(linesInfo[l].pdfX)
                  ? linesInfo[l].pdfX
                  : (Number.isFinite(linesInfo[l].pdfLeft) ? linesInfo[l].pdfLeft + 1 : objLeft);
              } else {
                // Fallback for additional lines or single block
                const firstBaseVy = (linesInfo && linesInfo.length > 0 && Number.isFinite(linesInfo[0].baseVy))
                  ? linesInfo[0].baseVy
                  : (objTop + fontSize * 0.76);
                lineY = pHeight - (firstBaseVy + l * lineHeight);
              }

              targetPage.drawText(lineText, {
                x: lineX,
                y: lineY,
                size: fontSize,
                font,
                color: textColor,
                opacity: obj.opacity ?? 1,
                rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
              });
            }
          } else {
            // Standard non-content-edit user text box
            const pad = obj.padding || 0;
            const startY = pHeight - (objTop + fontSize * 0.85);

            // Draw solid background rectangle if specified
            if (obj.backgroundColor && obj.backgroundColor !== 'transparent') {
              const bgRgb = toPdfLibRgb(obj.backgroundColor);
              if (bgRgb) {
                const bgWidth = (obj.width || 100) * (obj.scaleX || 1);
                const bgHeight = Math.max(fontSize * lines.length * 1.2, (obj.height || fontSize) * (obj.scaleY || 1));
                targetPage.drawRectangle({
                  x: objLeft - pad,
                  y: pHeight - objTop - bgHeight - pad,
                  width: bgWidth + pad * 2,
                  height: bgHeight + pad * 2,
                  color: bgRgb,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              }
            }

            for (let l = 0; l < lines.length; l++) {
              const lineText = lines[l];
              if (lineText.length > 0) {
                targetPage.drawText(lineText, {
                  x: objLeft + pad,
                  y: startY - l * lineHeight,
                  size: fontSize,
                  font,
                  color: textColor,
                  opacity: obj.opacity ?? 1,
                  rotate: objAngle !== 0 ? degrees(-objAngle) : undefined,
                });
              }
            }
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
