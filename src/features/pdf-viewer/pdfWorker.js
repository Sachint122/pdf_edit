/**
 * PDF.js Worker Configuration
 * Configures the worker source for pdfjs-dist in a Vite ESM environment.
 * Uses Vite's ?url asset query to reliably bundle and serve the worker script.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export { pdfjsLib };
