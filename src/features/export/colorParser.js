/**
 * Color Parser for PDF Export
 * Converts hex, rgb, rgba, and named CSS color strings to pdf-lib rgb() components (0..1).
 */

import { rgb } from 'pdf-lib';

export const NAMED_COLORS = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 1, g: 1, b: 1, a: 1 },
  red: { r: 0.9, g: 0.1, b: 0.1, a: 1 },
  blue: { r: 0.14, g: 0.38, b: 0.92, a: 1 },
  green: { r: 0.1, g: 0.7, b: 0.3, a: 1 },
  yellow: { r: 0.95, g: 0.8, b: 0.1, a: 1 },
  gray: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
};

/**
 * Parse a CSS color string to { r, g, b, a } where r, g, b are in [0, 1].
 * Returns null if the color is 'transparent' or invalid.
 * @param {string} colorStr
 * @returns {{ r: number, g: number, b: number, a: number }|null}
 */
export function parseColorToRgb(colorStr) {
  if (!colorStr || colorStr === 'transparent') {
    return null;
  }

  const str = colorStr.trim().toLowerCase();

  if (NAMED_COLORS[str]) {
    return NAMED_COLORS[str];
  }

  // Hex: #ffffff, #fff, #rrggbbaa, #rgba
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    let alpha = 1;

    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    } else if (hex.length === 4) {
      const parts = hex.split('').map((c) => c + c);
      hex = parts.slice(0, 3).join('');
      alpha = parseInt(parts[3], 16) / 255;
    } else if (hex.length === 8) {
      const alphaHex = hex.slice(6, 8);
      hex = hex.slice(0, 6);
      alpha = parseInt(alphaHex, 16) / 255;
    }

    const num = parseInt(hex, 16);
    if (isNaN(num)) return null;

    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
      a: Number(alpha.toFixed(3)),
    };
  }

  // rgb(...) or rgba(...)
  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10) / 255,
      g: parseInt(rgbMatch[2], 10) / 255,
      b: parseInt(rgbMatch[3], 10) / 255,
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Convenience helper returning pdf-lib rgb() instance or null.
 * @param {string} colorStr
 * @returns {import('pdf-lib').RGB|null}
 */
export function toPdfLibRgb(colorStr) {
  const parsed = parseColorToRgb(colorStr);
  if (!parsed) return null;
  return rgb(parsed.r, parsed.g, parsed.b);
}
