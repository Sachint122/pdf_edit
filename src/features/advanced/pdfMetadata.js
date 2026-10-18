/**
 * PDF Metadata Management
 * Reads and sets standard document metadata (Title, Author, Subject, Keywords) using pdf-lib.
 */

import { PDFDocument } from 'pdf-lib';

/**
 * Extract metadata from an ArrayBuffer or Uint8Array PDF
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{ title: string, author: string, subject: string, keywords: string[] }>}
 */
export async function readPdfMetadata(buffer) {
  if (!buffer || buffer.byteLength === 0) {
    return { title: '', author: '', subject: '', keywords: [] };
  }

  try {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const pdfDoc = await PDFDocument.load(uint8, { ignoreEncryption: true });

    const rawKeywords = pdfDoc.getKeywords() || '';
    const keywords = rawKeywords
      ? (rawKeywords.includes(',') ? rawKeywords.split(',') : rawKeywords.split(/\s+/))
          .map((k) => k.trim())
          .filter(Boolean)
      : [];

    return {
      title: pdfDoc.getTitle() || '',
      author: pdfDoc.getAuthor() || '',
      subject: pdfDoc.getSubject() || '',
      keywords,
    };
  } catch (err) {
    console.warn('Could not read PDF metadata:', err);
    return { title: '', author: '', subject: '', keywords: [] };
  }
}

/**
 * Apply metadata to an output PDFDocument
 * @param {import('pdf-lib').PDFDocument} outDoc
 * @param {object} metadata
 */
export function applyPdfMetadata(outDoc, metadata = {}) {
  if (!outDoc || !metadata) return;

  if (typeof metadata.title === 'string' && metadata.title.trim()) {
    outDoc.setTitle(metadata.title.trim());
  }
  if (typeof metadata.author === 'string' && metadata.author.trim()) {
    outDoc.setAuthor(metadata.author.trim());
  }
  if (typeof metadata.subject === 'string' && metadata.subject.trim()) {
    outDoc.setSubject(metadata.subject.trim());
  }
  if (Array.isArray(metadata.keywords) && metadata.keywords.length > 0) {
    outDoc.setKeywords(metadata.keywords.filter(Boolean));
  } else if (typeof metadata.keywords === 'string' && metadata.keywords.trim()) {
    outDoc.setKeywords(metadata.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  }

  outDoc.setProducer('Frontend-Only PDF Editor (Browser Local)');
  outDoc.setCreator('Frontend-Only PDF Editor');
}
