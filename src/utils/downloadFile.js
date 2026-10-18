/**
 * File Download Utility
 * Safe, client-side browser file download triggering with memory cleanup.
 */

/**
 * Triggers a browser download for a Blob.
 * @param {Blob} blob
 * @param {string} [filename='edited-document.pdf']
 */
export function downloadBlob(blob, filename = 'edited-document.pdf') {
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke Object URL after short delay to release memory
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Converts a Uint8Array of PDF bytes into a Blob and triggers download.
 * @param {Uint8Array} pdfBytes
 * @param {string} [filename='edited-document.pdf']
 */
export function downloadPdfBytes(pdfBytes, filename = 'edited-document.pdf') {
  if (!pdfBytes) return;
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadBlob(blob, filename);
}
