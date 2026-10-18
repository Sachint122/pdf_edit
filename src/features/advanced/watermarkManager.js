/**
 * Watermark and Page Numbering Engine for PDF Export
 * Applies customizable diagonal/horizontal watermarks and header/footer page numbers using pdf-lib.
 */

import { degrees, rgb } from 'pdf-lib';
import { toPdfLibRgb } from '../export/colorParser.js';
import { sanitizeForWinAnsi } from '../../utils/textSanitizer.js';

export const DEFAULT_WATERMARK_CONFIG = {
  enabled: false,
  text: 'CONFIDENTIAL',
  fontSize: 48,
  opacity: 0.18,
  angle: -45, // -45 deg diagonal, 0 deg horizontal
  color: '#64748b',
};

export const DEFAULT_PAGE_NUMBER_CONFIG = {
  enabled: false,
  format: 'Page {n} of {total}', // 'Page {n} of {total}' | '{n} / {total}' | 'Page {n}' | '{n}'
  position: 'bottom-center', // 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right'
  fontSize: 10,
  color: '#64748b',
  opacity: 0.85,
  margin: 25,
};

/**
 * Apply watermark to a pdf-lib page
 * @param {import('pdf-lib').PDFPage} page
 * @param {object} watermarkConfig
 * @param {import('../export/fontManager.js').FontManager} fontManager
 */
export async function applyWatermark(page, watermarkConfig = {}, fontManager) {
  if (!watermarkConfig.enabled || !watermarkConfig.text) return;

  const rawText = watermarkConfig.text.trim();
  const text = sanitizeForWinAnsi(rawText);
  if (!text) return;

  const font = await fontManager.getFont('Helvetica', 'bold', 'normal');
  const fontSize = watermarkConfig.fontSize || 48;
  const opacity = Number.isFinite(watermarkConfig.opacity) ? watermarkConfig.opacity : 0.18;
  const angle = Number.isFinite(watermarkConfig.angle) ? watermarkConfig.angle : -45;
  const color = toPdfLibRgb(watermarkConfig.color) || rgb(0.39, 0.45, 0.54);

  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  // Position at geometric center of page taking rotation into account
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Half dimensions of the rotated text bounding box
  const offsetX = (textWidth / 2) * cos - (textHeight / 2) * sin;
  const offsetY = (textWidth / 2) * sin + (textHeight / 2) * cos;

  const x = width / 2 - offsetX;
  const y = height / 2 - offsetY;

  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color,
    opacity,
    rotate: degrees(angle),
  });
}

/**
 * Apply header/footer page numbers to a pdf-lib page
 * @param {import('pdf-lib').PDFPage} page
 * @param {number} pageIndex - 0-indexed
 * @param {number} totalPages
 * @param {object} pageNumberConfig
 * @param {import('../export/fontManager.js').FontManager} fontManager
 */
export async function applyPageNumber(page, pageIndex, totalPages, pageNumberConfig = {}, fontManager) {
  if (!pageNumberConfig.enabled) return;

  const format = pageNumberConfig.format || 'Page {n} of {total}';
  const rawLabel = format
    .replace('{n}', String(pageIndex + 1))
    .replace('{total}', String(totalPages));
  const label = sanitizeForWinAnsi(rawLabel);

  const font = await fontManager.getFont('Helvetica', 'normal', 'normal');
  const fontSize = pageNumberConfig.fontSize || 10;
  const opacity = Number.isFinite(pageNumberConfig.opacity) ? pageNumberConfig.opacity : 0.85;
  const margin = Number.isFinite(pageNumberConfig.margin) ? pageNumberConfig.margin : 25;
  const color = toPdfLibRgb(pageNumberConfig.color) || rgb(0.39, 0.45, 0.54);

  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(label, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  let x = width / 2 - textWidth / 2;
  let y = margin;

  const pos = (pageNumberConfig.position || 'bottom-center').toLowerCase();

  switch (pos) {
    case 'bottom-left':
      x = margin;
      y = margin;
      break;
    case 'bottom-right':
      x = width - margin - textWidth;
      y = margin;
      break;
    case 'top-left':
      x = margin;
      y = height - margin - textHeight;
      break;
    case 'top-center':
      x = width / 2 - textWidth / 2;
      y = height - margin - textHeight;
      break;
    case 'top-right':
      x = width - margin - textWidth;
      y = height - margin - textHeight;
      break;
    case 'bottom-center':
    default:
      x = width / 2 - textWidth / 2;
      y = margin;
      break;
  }

  page.drawText(label, {
    x,
    y,
    size: fontSize,
    font,
    color,
    opacity,
  });
}
