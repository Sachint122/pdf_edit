/**
 * PDF Loader Module
 * Handles loading, password checks, and destruction of PDF documents using pdfjs-dist.
 */

import { pdfjsLib } from './pdfWorker.js';

/**
 * Load a PDF document from an ArrayBuffer or Uint8Array.
 * @param {ArrayBuffer|Uint8Array} data
 * @param {object} [options]
 * @param {string} [options.password]
 * @param {function} [options.onProgress]
 * @returns {Promise<{ pdfDoc: object, numPages: number, pagesMeta: Array<{ pageNumber: number, width: number, height: number, aspectRatio: number, rotation: number }> }>}
 */
export async function loadPdfDocument(data, options = {}) {
  if (!data || data.byteLength === 0) {
    throw new Error('PDF data is empty or invalid.');
  }

  // Ensure data is cloned to an isolated Uint8Array buffer so PDF.js worker cannot detach caller's ArrayBuffer
  const rawBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const workerBytes = new Uint8Array(rawBytes.byteLength);
  workerBytes.set(rawBytes);

  const loadingTask = pdfjsLib.getDocument({
    data: workerBytes,
    password: options.password || '',
    cMapUrl: undefined,
    cMapPacked: true,
  });

  if (typeof options.onProgress === 'function') {
    loadingTask.onProgress = options.onProgress;
  }

  try {
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    // Preload basic dimensions for all pages so the UI can layout immediately
    const pagesMeta = [];
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        pagesMeta.push({
          pageNumber: i,
          width: viewport.width,
          height: viewport.height,
          aspectRatio: viewport.width / viewport.height,
          rotation: viewport.rotation || 0,
        });
      } catch (pageErr) {
        console.warn(`Could not preload viewport for page ${i}:`, pageErr);
        pagesMeta.push({
          pageNumber: i,
          width: 612,
          height: 792,
          aspectRatio: 612 / 792,
          rotation: 0,
        });
      }
    }

    return {
      pdfDoc,
      numPages,
      pagesMeta,
      loadingTask,
    };
  } catch (error) {
    if (error.name === 'PasswordException') {
      const err = new Error(
        error.code === 1
          ? 'This PDF requires a password to open.'
          : 'Incorrect password for protected PDF.'
      );
      err.isPasswordProtected = true;
      throw err;
    } else if (error.name === 'InvalidPDFException') {
      throw new Error('The selected file is corrupted or not a valid PDF.');
    } else {
      throw new Error(error.message || 'Failed to parse PDF document.');
    }
  }
}

/**
 * Safely destroy a PDF document and release its resources.
 * @param {object} pdfDoc
 */
export async function destroyPdfDocument(pdfDoc) {
  if (!pdfDoc) return;
  try {
    if (typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy();
    } else if (typeof pdfDoc.cleanup === 'function') {
      await pdfDoc.cleanup();
    }
  } catch (err) {
    console.warn('Error during PDF document destruction:', err);
  }
}
