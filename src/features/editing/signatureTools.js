/**
 * Signature Tools for Fabric.js Canvas
 */

import { addImageFromDataUrl } from './imageTools.js';

/**
 * Add a signature image to the canvas.
 * @param {import('fabric').Canvas} canvas
 * @param {string} signatureDataUrl
 * @param {object} [options]
 */
export async function addSignature(canvas, signatureDataUrl, options = {}) {
  return addImageFromDataUrl(canvas, signatureDataUrl, {
    maxDimension: 180,
    ...options,
  });
}
