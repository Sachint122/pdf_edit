/**
 * File Validation Utility
 * Validates local PDF files before parsing.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const FILE_VALIDATION_ERRORS = {
  NO_FILE: 'No file was provided.',
  EMPTY_FILE: 'The selected file is empty (0 bytes).',
  EXCEEDS_SIZE_LIMIT: 'File exceeds the maximum size limit of 50 MB.',
  INVALID_MIME: 'Selected file is not a recognized PDF document.',
  INVALID_HEADER: 'The file header does not match a valid PDF signature.',
};

/**
 * Validate a File object.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePdfFile(file) {
  if (!file) {
    return { valid: false, error: FILE_VALIDATION_ERRORS.NO_FILE };
  }

  if (file.size === 0) {
    return { valid: false, error: FILE_VALIDATION_ERRORS.EMPTY_FILE };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: FILE_VALIDATION_ERRORS.EXCEEDS_SIZE_LIMIT };
  }

  const isPdfMime = file.type === 'application/pdf';
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');

  if (!isPdfMime && !hasPdfExtension) {
    return { valid: false, error: FILE_VALIDATION_ERRORS.INVALID_MIME };
  }

  return { valid: true };
}

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

/**
 * Check if a file is a supported image
 * @param {File} file
 * @returns {boolean}
 */
export function isImageFile(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    type.startsWith('image/') ||
    SUPPORTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
  );
}

/**
 * Validate either a PDF file or an Image file.
 * @param {File} file
 * @returns {{ valid: boolean, isImage: boolean, error?: string }}
 */
export function validateDocumentOrImageFile(file) {
  if (!file) {
    return { valid: false, isImage: false, error: FILE_VALIDATION_ERRORS.NO_FILE };
  }

  if (file.size === 0) {
    return { valid: false, isImage: false, error: FILE_VALIDATION_ERRORS.EMPTY_FILE };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, isImage: false, error: FILE_VALIDATION_ERRORS.EXCEEDS_SIZE_LIMIT };
  }

  if (isImageFile(file)) {
    return { valid: true, isImage: true };
  }

  const pdfValidation = validatePdfFile(file);
  return { ...pdfValidation, isImage: false };
}

/**
 * Validates the raw binary header of a PDF ArrayBuffer.
 * Per ISO 32000-1, conforming readers accept %PDF- anywhere within the first 1024 bytes.
 * @param {ArrayBuffer} buffer
 * @returns {boolean}
 */
export function validatePdfHeader(buffer) {
  if (!buffer || buffer.byteLength < 5) {
    return false;
  }
  const checkLength = Math.min(1024, buffer.byteLength - 4);
  const bytes = new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength));
  // ASCII %PDF- is [0x25, 0x50, 0x44, 0x46, 0x2D]
  for (let i = 0; i <= checkLength; i++) {
    if (
      bytes[i] === 0x25 &&     // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d    // -
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Read File object as ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.onabort = () => reject(new Error('File reading was aborted.'));
    reader.readAsArrayBuffer(file);
  });
}
