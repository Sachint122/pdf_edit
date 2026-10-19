/**
 * OCR Utility for detecting text in scanned PDFs and images
 * Uses Tesseract.js for client-side OCR
 * Maps detected text to PDF point coordinates for editing
 */

import Tesseract from 'tesseract.js';
import { Textbox } from 'fabric';
import { clusterLinesIntoParagraphs } from '../features/editing/pdfContentEditor.js';

export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
];

export const DEFAULT_PSM = 3; // SINGLE_COLUMN / AUTO - good for document text
export const DEFAULT_LANG = 'eng';

/**
 * Check if a file or MIME type is an image
 * @param {File|Blob|string} fileOrType
 * @returns {boolean}
 */
export function isImageFile(fileOrType) {
  if (!fileOrType) return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrType)) return true;
  if (fileOrType instanceof Uint8Array) return true;
  if (typeof fileOrType === 'string') {
    const lower = fileOrType.toLowerCase();
    return (
      SUPPORTED_IMAGE_TYPES.includes(lower) ||
      lower.startsWith('image/') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp') ||
      lower.startsWith('data:image/')
    );
  }
  const type = fileOrType.type ? fileOrType.type.toLowerCase() : '';
  const name = fileOrType.name ? fileOrType.name.toLowerCase() : '';
  return (
    SUPPORTED_IMAGE_TYPES.includes(type) ||
    type.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  );
}

/**
 * Convert screen/Fabric canvas coordinates to PDF point coordinates
 * PDF Y=0 is at bottom; canvas Y=0 is at top
 */
export function screenToPdfPoint(y, pageHeightPt, scale = 1) {
  const topY = y / scale;
  return pageHeightPt - topY;
}

/**
 * Convert PDF point coordinates to screen coordinates
 */
export function pdfToScreenPoint(y, pageHeightPt, scale = 1) {
  return (pageHeightPt - y) * scale;
}

/**
 * Run OCR on an image file, blob, or data URL using Tesseract.js
 * @param {File|Blob|HTMLImageElement|string|ArrayBuffer} imageFile - The image to OCR
 * @param {object} [options] - OCR options
 * @param {string} [options.lang='eng'] - Language code
 * @param {number} [options.psm=3] - Page segmentation mode
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<object>} - OCR results with text, lines, words, and positions
 */
export async function recognizeOcr(imageFile, options = {}) {
  const lang = options.lang || DEFAULT_LANG;
  const psm = options.psm || DEFAULT_PSM;

  const worker = await Tesseract.createWorker(lang, undefined, {
    logger: (m) => {
      if (typeof options.onProgress === 'function') {
        options.onProgress(m);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
    });

    const result = await worker.recognize(imageFile, {}, { text: true, blocks: true });

    const lines = [];
    const words = [];

    if (result.data?.blocks && Array.isArray(result.data.blocks)) {
      let bIdx = 0;
      for (const block of result.data.blocks) {
        bIdx++;
        if (!block.paragraphs) continue;
        let pIdx = 0;
        for (const para of block.paragraphs) {
          pIdx++;
          if (!para.lines) continue;
          for (const line of para.lines) {
            const trimmed = (line.text || '').trim();
            if (trimmed && line.bbox) {
              lines.push({
                text: trimmed,
                bbox: line.bbox,
                confidence: line.confidence || 0,
                tesseractParaId: `tess-para-${bIdx}-${pIdx}`,
                words: Array.isArray(line.words)
                  ? line.words.map((w) => ({
                      text: (w.text || '').trim(),
                      bbox: w.bbox,
                      confidence: w.confidence || 0,
                    }))
                  : [],
              });
            }

            if (Array.isArray(line.words)) {
              for (const word of line.words) {
                const wTrimmed = (word.text || '').trim();
                if (wTrimmed && word.bbox) {
                  words.push({
                    text: wTrimmed,
                    x0: word.bbox.x0,
                    y0: word.bbox.y0,
                    x1: word.bbox.x1,
                    y1: word.bbox.y1,
                    confidence: word.confidence || 0,
                  });
                }
              }
            }
          }
        }
      }
    }

    return {
      success: true,
      fullText: result.data.text || '',
      lines,
      words,
      orientation: result.data.rotateRadians ? (result.data.rotateRadians * 180) / Math.PI : 0,
      lang,
      psm,
    };
  } catch (err) {
    console.error('OCR recognition failed:', err);
    return {
      success: false,
      error: err.message || 'OCR recognition failed',
    };
  } finally {
    try {
      await worker.terminate();
    } catch {
      // Worker termination cleanup
    }
  }
}

/**
 * Extract selectable/editable text blocks from OCR results, mapped to PDF coordinates
 * Matches the format expected by PdfPage and EditorLayout
 * @param {object} ocrResult - Result from recognizeOcr()
 * @param {number} pageHeightPt - Page height in PDF points
 * @param {number} [scaleFactor=1] - Coordinate multiplier if image was resized
 * @returns {Array<object>} - Array of text blocks for in-place editing
 */
export function extractOcrTextBlocks(ocrResult, pageHeightPt = 792, scaleFactor = 1) {
  if (!ocrResult || !ocrResult.success) return [];

  const rawLines = ocrResult.lines || [];
  const lineBlocks = [];

  for (let i = 0; i < rawLines.length; i++) {
    const item = rawLines[i];
    const bbox = item.bbox;
    if (!bbox) continue;

    const x0 = Math.round(bbox.x0 * scaleFactor);
    const y0 = Math.round(bbox.y0 * scaleFactor);
    const x1 = Math.round(bbox.x1 * scaleFactor);
    const y1 = Math.round(bbox.y1 * scaleFactor);

    const lineWidth = Math.max(10, x1 - x0);
    const lineHeight = Math.max(10, y1 - y0);

    // PDF Y=0 is bottom-left; top of the line in PDF points = pageHeight - y1
    const pdfY = pageHeightPt - y1;
    const estimatedFontSize = Math.max(9, Math.round(lineHeight * 0.82));
    const baseVy = y0 + estimatedFontSize * 0.76;
    const trimmed = (item.text || '').trim();
    const isLineHeading = (trimmed.length > 1 && trimmed.length < 50 && /^[A-Z0-9\s.,&/\-–|:()]+$/.test(trimmed) && /[A-Z]/.test(trimmed)) ||
      /^(experience|education|skills|projects|summary|objective|certifications|awards|contact|work experience|employment history|profile)/i.test(trimmed);

    lineBlocks.push({
      str: item.text,
      text: item.text,
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
      fontFamily: 'Helvetica',
      isBold: isLineHeading,
      isItalic: false,
      fontWeight: isLineHeading ? 'bold' : 'normal',
      fontStyle: 'normal',
      fill: '#000000',
      color: '#000000',
      backgroundColor: '#ffffff',
      pdfX: x0,
      pdfY,
      pdfHeightVal: lineHeight,
      confidence: item.confidence || 0,
      isOcrDetected: true,
      originalText: item.text,
      originalStr: item.text,
      textAlign: 'left',
      tesseractParaId: item.tesseractParaId || null,
    });
  }

  // Preserve natural reading order (top-to-bottom)
  lineBlocks.sort((a, b) => {
    const verticalDiff = a.top - b.top;
    if (Math.abs(verticalDiff) > Math.min(a.height, b.height) * 0.6) {
      return verticalDiff;
    }
    return a.left - b.left;
  });

  return clusterLinesIntoParagraphs(lineBlocks, 1);
}

/**
 * Main entry point: Run OCR on a file (image or data URL)
 * @param {File|Blob|string} file - The file or dataUrl to OCR
 * @param {object} [options] - Options
 * @param {string} [options.lang='eng'] - Language code
 * @param {number} [options.psm=3] - Page segmentation mode
 * @param {number} [options.pageHeightPt=792] - PDF page height in points
 * @param {number} [options.scaleFactor=1] - Image coordinate scale factor
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<object>} - { success, textBlocks, fullText, error }
 */
export async function runOcrOnFile(file, options = {}) {
  const pageHeightPt = options.pageHeightPt || 792;
  const scaleFactor = options.scaleFactor || 1;

  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  if (isImageFile(file)) {
    const ocrResult = await recognizeOcr(file, options);
    if (ocrResult.success) {
      const textBlocks = extractOcrTextBlocks(ocrResult, pageHeightPt, scaleFactor);
      return {
        success: true,
        textBlocks,
        fullText: ocrResult.fullText,
        lines: ocrResult.lines,
        orientation: ocrResult.orientation,
      };
    }
    return { success: false, error: ocrResult.error };
  }

  return { success: false, error: 'Unsupported file format for OCR. Please provide a PNG, JPG, or WebP image.' };
}

/**
 * Create Fabric.js Textbox objects from OCR text blocks
 * @param {import('fabric').Canvas} canvas - The Fabric.js canvas
 * @param {Array<object>} blocks - OCR text blocks from extractOcrTextBlocks
 * @param {number} [pageHeightPt=792] - Page height in PDF points
 * @returns {Array<import('fabric').Textbox>} - Created text boxes
 */
export function createOcrTextBoxes(canvas, blocks, _pageHeightPt = 792) {
  if (!canvas || !blocks || blocks.length === 0) return [];

  const textBoxes = [];

  for (const block of blocks) {
    const { left, top, width, fontSize, fontFamily, text, fill } = block;

    const textbox = new Textbox(text, {
      left: left || 20,
      top: top || 20,
      width: width || 200,
      fontSize: fontSize || 16,
      fontFamily: fontFamily || 'Helvetica',
      fill: fill || '#1e293b',
      textAlign: 'left',
      lineHeight: 1.2,
      fontWeight: 'normal',
      fontStyle: 'normal',
      padding: 4,
      borderColor: '#3b82f6',
      cornerColor: '#3b82f6',
      cornerSize: 8,
      transparentCorners: false,
      isPdfContentEdit: true,
      originalBlockId: block.id,
    });

    canvas.add(textbox);
    textBoxes.push(textbox);
  }

  if (textBoxes.length > 0) {
    canvas.setActiveObject(textBoxes[0]);
    canvas.renderAll();
  }

  return textBoxes;
}

export default {
  recognizeOcr,
  extractOcrTextBlocks,
  createOcrTextBoxes,
  runOcrOnFile,
  isImageFile,
  screenToPdfPoint,
  pdfToScreenPoint,
};