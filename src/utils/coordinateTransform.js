/**
 * Coordinate Transformation Utility
 * Manages conversion between screen canvas pixels (top-left origin, DPR/zoom-scaled)
 * and PDF point space (72 DPI, bottom-left origin).
 */

export const PDF_POINTS_PER_INCH = 72;

/**
 * Converts screen canvas coordinates to PDF point coordinates.
 * @param {object} coords - { x, y, width, height }
 * @param {number} scale - Current viewport zoom factor
 * @param {number} pageHeightPt - Page height in PDF points (72 DPI)
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function canvasToPdfPoint(coords, scale, pageHeightPt) {
  const x = coords.x / scale;
  const width = (coords.width || 0) / scale;
  const height = (coords.height || 0) / scale;

  // PDF.js / Fabric canvas Y=0 is at top; pdf-lib Y=0 is at bottom
  const topY = coords.y / scale;
  const y = pageHeightPt - topY - height;

  return { x, y, width, height };
}

/**
 * Converts PDF point coordinates to screen canvas coordinates.
 * @param {object} coords - { x, y, width, height }
 * @param {number} scale - Current viewport zoom factor
 * @param {number} pageHeightPt - Page height in PDF points (72 DPI)
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function pdfPointToCanvas(coords, scale, pageHeightPt) {
  const x = coords.x * scale;
  const width = (coords.width || 0) * scale;
  const height = (coords.height || 0) * scale;

  const topY = (pageHeightPt - coords.y - (coords.height || 0)) * scale;

  return { x, y: topY, width, height };
}
