/**
 * Image to PDF Converter and OCR Bridge
 * Converts an image file (PNG, JPG, WebP) into a high-fidelity PDF document using pdf-lib,
 * and extracts text blocks with OCR for direct in-place editing.
 */

import { PDFDocument } from 'pdf-lib';
import { runOcrOnFile, isImageFile } from './ocr.js';

/**
 * Convert WebP or arbitrary image to PNG Uint8Array via browser Canvas
 * @param {File|Blob|string} imageFile
 * @returns {Promise<Uint8Array>}
 */
async function imageToPngBytes(imageFile) {
  if (typeof document === 'undefined') {
    throw new Error('Image conversion requires browser environment or valid PNG/JPEG bytes.');
  }

  return new Promise((resolve, reject) => {
    const url = typeof imageFile === 'string' ? imageFile : URL.createObjectURL(imageFile);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (typeof imageFile !== 'string') {
            URL.revokeObjectURL(url);
          }
          if (!blob) {
            return reject(new Error('Canvas toBlob conversion failed.'));
          }
          const reader = new FileReader();
          reader.onload = () => {
            resolve(new Uint8Array(reader.result));
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      } catch (err) {
        if (typeof imageFile !== 'string') {
          URL.revokeObjectURL(url);
        }
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (typeof imageFile !== 'string') {
        URL.revokeObjectURL(url);
      }
      reject(new Error(`Failed to load image: ${err?.message || 'invalid image'}`));
    };

    img.src = url;
  });
}

/**
 * Get image natural dimensions
 * @param {File|Blob|string|Uint8Array} imageFile
 * @returns {Promise<{ width: number, height: number }>}
 */
export async function getImageDimensions(imageFile) {
  if (typeof document === 'undefined') {
    return { width: 612, height: 792 };
  }

  return new Promise((resolve) => {
    const url = typeof imageFile === 'string'
      ? imageFile
      : URL.createObjectURL(imageFile instanceof Uint8Array ? new Blob([imageFile]) : imageFile);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const width = img.naturalWidth || img.width || 612;
      const height = img.naturalHeight || img.height || 792;
      if (typeof imageFile !== 'string') {
        URL.revokeObjectURL(url);
      }
      resolve({ width, height });
    };

    img.onerror = () => {
      if (typeof imageFile !== 'string') {
        URL.revokeObjectURL(url);
      }
      resolve({ width: 612, height: 792 });
    };

    img.src = url;
  });
}

/**
 * Convert an image file or DataURL into a PDF document and run OCR
 * @param {File|Blob|string|Uint8Array} imageSource - The image to convert
 * @param {object} [options]
 * @param {string} [options.fileName]
 * @param {boolean} [options.skipOcr=false]
 * @param {function} [options.onProgress]
 * @returns {Promise<{ pdfBytes: Uint8Array, fileName: string, width: number, height: number, textBlocks: Array<object> }>}
 */
export async function convertImageToEditablePdf(imageSource, options = {}) {
  if (!imageSource) {
    throw new Error('No image provided for PDF conversion.');
  }

  const rawName = imageSource.name || options.fileName || 'Image-Document.png';
  const baseName = rawName.replace(/\.[^/.]+$/, '');
  const outFileName = `${baseName}.pdf`;

  // 1. Get raw bytes of the image
  let imageBytes;
  let isJpg = false;
  let isWebp = false;

  if (typeof imageSource === 'string') {
    isJpg = imageSource.includes('image/jpeg') || imageSource.includes('image/jpg');
    isWebp = imageSource.includes('image/webp');
    if (isWebp && typeof document !== 'undefined') {
      imageBytes = await imageToPngBytes(imageSource);
    } else {
      const parts = imageSource.split(',');
      const b64 = parts.length > 1 ? parts[1] : parts[0];
      const binary = atob(b64);
      imageBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        imageBytes[i] = binary.charCodeAt(i);
      }
    }
  } else if (imageSource instanceof Uint8Array) {
    imageBytes = imageSource;
    isJpg = rawName.toLowerCase().endsWith('.jpg') || rawName.toLowerCase().endsWith('.jpeg');
  } else {
    // File or Blob
    const mime = (imageSource.type || '').toLowerCase();
    const name = (imageSource.name || '').toLowerCase();
    isJpg = mime === 'image/jpeg' || mime === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
    isWebp = mime === 'image/webp' || name.endsWith('.webp');

    if (isWebp && typeof document !== 'undefined') {
      imageBytes = await imageToPngBytes(imageSource);
    } else {
      const arrayBuffer = await imageSource.arrayBuffer();
      imageBytes = new Uint8Array(arrayBuffer);
    }
  }

  // 2. Embed image in a new PDFDocument
  const pdfDoc = await PDFDocument.create();
  let embeddedImage;

  try {
    if (isJpg && !isWebp) {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    }
  } catch (embedErr) {
    // Fallback: If format error, convert to PNG via canvas and retry
    if (typeof document !== 'undefined') {
      const pngBytes = await imageToPngBytes(imageSource);
      embeddedImage = await pdfDoc.embedPng(pngBytes);
    } else {
      throw embedErr;
    }
  }

  const { width: origWidth, height: origHeight } = embeddedImage;

  // Fit into comfortable standard PDF viewport (max 1200 pt)
  const maxDim = 1200;
  let scaleFactor = 1;
  if (origWidth > maxDim || origHeight > maxDim) {
    scaleFactor = Math.min(maxDim / origWidth, maxDim / origHeight);
  }

  const pageWidth = Math.round(origWidth * scaleFactor);
  const pageHeight = Math.round(origHeight * scaleFactor);

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  const pdfBytes = await pdfDoc.save();

  // 3. Run OCR to detect text blocks if requested
  let textBlocks = [];
  if (!options.skipOcr) {
    try {
      options.onProgress?.({ status: 'recognizing text', progress: 0.1 });
      const ocrResult = await runOcrOnFile(imageSource, {
        pageHeightPt: pageHeight,
        scaleFactor,
        onProgress: options.onProgress,
      });

      if (ocrResult.success && Array.isArray(ocrResult.textBlocks)) {
        textBlocks = ocrResult.textBlocks;
      }
    } catch (ocrErr) {
      console.warn('OCR text detection failed (falling back to image-only PDF):', ocrErr);
    }
  }

  return {
    pdfBytes,
    fileName: outFileName,
    width: pageWidth,
    height: pageHeight,
    textBlocks,
    scaleFactor,
    isImage: true,
    originalImageFile: imageSource,
    originalFileName: rawName,
    originalFormat: isJpg ? 'image/jpeg' : 'image/png',
    naturalWidth: origWidth,
    naturalHeight: origHeight,
    imageMeta: {
      originalImageFile: imageSource,
      originalFileName: rawName,
      originalFormat: isJpg ? 'image/jpeg' : 'image/png',
      naturalWidth: origWidth,
      naturalHeight: origHeight,
      scaleFactor,
    },
  };
}

export default {
  convertImageToEditablePdf,
  getImageDimensions,
  isImageFile,
};
