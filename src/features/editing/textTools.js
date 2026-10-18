/**
 * Text Tools for Fabric.js Canvas
 */

import { Textbox } from 'fabric';

export const DEFAULT_TEXT_OPTIONS = {
  text: 'Click to edit text',
  fontSize: 18,
  fontFamily: 'Helvetica',
  fill: '#0f172a',
  width: 200,
  textAlign: 'left',
  lineHeight: 1.2,
  fontWeight: 'normal',
  fontStyle: 'normal',
  underline: false,
};

/**
 * Add a new editable Textbox to the canvas.
 * @param {import('fabric').Canvas} canvas
 * @param {object} [options]
 * @returns {import('fabric').Textbox}
 */
export function addTextBox(canvas, options = {}) {
  if (!canvas) return null;

  const width = options.width || DEFAULT_TEXT_OPTIONS.width;
  const height = 40;

  // Position near viewport center or offset slightly
  const center = canvas.getCenterPoint ? canvas.getCenterPoint() : { x: 150, y: 150 };
  const left = options.left ?? Math.max(20, center.x - width / 2);
  const top = options.top ?? Math.max(20, center.y - height / 2);

  const textbox = new Textbox(options.text || DEFAULT_TEXT_OPTIONS.text, {
    left,
    top,
    width,
    fontSize: options.fontSize || DEFAULT_TEXT_OPTIONS.fontSize,
    fontFamily: options.fontFamily || DEFAULT_TEXT_OPTIONS.fontFamily,
    fill: options.fill || DEFAULT_TEXT_OPTIONS.fill,
    textAlign: options.textAlign || DEFAULT_TEXT_OPTIONS.textAlign,
    lineHeight: options.lineHeight || DEFAULT_TEXT_OPTIONS.lineHeight,
    fontWeight: options.fontWeight || DEFAULT_TEXT_OPTIONS.fontWeight,
    fontStyle: options.fontStyle || DEFAULT_TEXT_OPTIONS.fontStyle,
    underline: options.underline ?? DEFAULT_TEXT_OPTIONS.underline,
    borderColor: '#3b82f6',
    cornerColor: '#3b82f6',
    cornerSize: 8,
    transparentCorners: false,
    padding: 4,
  });

  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();

  return textbox;
}
