/**
 * Drawing Tools for Fabric.js Canvas
 * Manages freehand pen and semi-transparent highlighter brush modes.
 */

import { PencilBrush } from 'fabric';

/**
 * Enable freehand pen drawing mode.
 * @param {import('fabric').Canvas} canvas
 * @param {object} [options]
 */
export function enablePenMode(canvas, options = {}) {
  if (!canvas) return;

  canvas.isDrawingMode = true;
  const brush = new PencilBrush(canvas);
  brush.color = options.color || '#2563eb';
  brush.width = options.width || 3;
  canvas.freeDrawingBrush = brush;
}

/**
 * Enable semi-transparent highlighter drawing mode.
 * @param {import('fabric').Canvas} canvas
 * @param {object} [options]
 */
export function enableHighlighterMode(canvas, options = {}) {
  if (!canvas) return;

  canvas.isDrawingMode = true;
  const brush = new PencilBrush(canvas);
  // Default translucent yellow highlighter
  brush.color = options.color || 'rgba(250, 204, 21, 0.45)';
  brush.width = options.width || 22;
  canvas.freeDrawingBrush = brush;
}

/**
 * Disable drawing mode and return to object selection mode.
 * @param {import('fabric').Canvas} canvas
 */
export function disableDrawingMode(canvas) {
  if (!canvas) return;
  canvas.isDrawingMode = false;
}
