/**
 * PDF Engine Adapter
 * Clean abstraction layer isolating PDF rendering, text extraction,
 * vector manipulation, and export compilation.
 */

import { PDFDocument } from 'pdf-lib';
import { exportModifiedPdf } from '../export/exportPdf.js';
import { extractPageTextBlocks } from '../editing/pdfContentEditor.js';

export class PdfEngineAdapter {
  /**
   * Extract pristine text blocks with typography from a PDF page
   * @param {object} pdfDoc - PDF.js document proxy
   * @param {number} pageNumber - 1-based page index
   * @param {number} [scale=1.0]
   * @param {number} [rotation=0]
   * @returns {Promise<Array<object>>}
   */
  static async extractPageText(pdfDoc, pageNumber, scale = 1.0, rotation = 0) {
    if (!pdfDoc) return [];
    try {
      const blocks = await extractPageTextBlocks(pdfDoc, pageNumber, scale, rotation);
      return blocks || [];
    } catch (err) {
      console.warn(`[PdfEngineAdapter] Error extracting text for page ${pageNumber}:`, err);
      return [];
    }
  }

  /**
   * Compile edited PDF document into binary bytes
   * @param {ArrayBuffer|Uint8Array} originalBuffer
   * @param {Array<object>} pages
   * @param {object} pageEdits
   * @param {object} [options={}]
   * @returns {Promise<Uint8Array>}
   */
  static async compileModifiedPdf(originalBuffer, pages = [], pageEdits = {}, options = {}) {
    const result = await exportModifiedPdf(originalBuffer, pages, pageEdits, options);
    const bytes = result?.pdfBytes || result;
    if (!(bytes instanceof Uint8Array)) {
      throw new Error('PDF compilation failed to produce valid Uint8Array bytes');
    }
    return bytes;
  }

  /**
   * Validate that exported PDF bytes load and parse correctly
   * @param {Uint8Array} pdfBytes
   * @returns {Promise<{ isValid: boolean, pageCount: number, error?: string }>}
   */
  static async validatePdfBytes(pdfBytes) {
    try {
      if (!pdfBytes || pdfBytes.length < 50) {
        return { isValid: false, pageCount: 0, error: 'Empty or truncated PDF buffer' };
      }
      const doc = await PDFDocument.load(pdfBytes);
      return {
        isValid: true,
        pageCount: doc.getPageCount(),
      };
    } catch (err) {
      return {
        isValid: false,
        pageCount: 0,
        error: err.message,
      };
    }
  }
}
