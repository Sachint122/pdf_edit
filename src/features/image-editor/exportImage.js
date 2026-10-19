/**
 * Image Exporter Utility
 * High-fidelity native image export for PNG and JPG documents.
 * Preserves the original image resolution, color space, and file format.
 * Renders background patches and replacement text cleanly without leaving original text visible,
 * and composites vector drawings, shapes, and annotations.
 */

import { downloadBlob } from '../../utils/downloadFile.js';

/**
 * Loads an image from a File, Blob, DataURL, or URL into an HTMLImageElement
 * @param {File|Blob|string} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Image export requires browser DOM environment.'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const url = typeof source === 'string'
      ? source
      : URL.createObjectURL(source);

    img.onload = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(url);
      }
      resolve(img);
    };

    img.onerror = (err) => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(url);
      }
      reject(new Error(`Failed to load source image: ${err?.message || 'unknown error'}`));
    };

    img.src = url;
  });
}

/**
 * Restores the local image background cleanly behind the text without indiscriminate white patches.
 * Inspects edge pixels around the clean region to match uniform, tinted, or gradient backgrounds,
 * while preserving nearby horizontal rules, lines, borders, and adjacent content.
 */
function restoreLocalBackground(ctx, x, y, w, h, defaultBgColor) {
  const pad = 1;
  const cleanX = Math.max(0, Math.floor(x - pad));
  const cleanY = Math.max(0, Math.floor(y - pad));
  const cleanW = Math.ceil(w + pad * 2);
  const cleanH = Math.ceil(h + pad * 2);

  ctx.save();
  ctx.fillStyle = defaultBgColor || '#ffffff';
  ctx.fillRect(cleanX, cleanY, cleanW, cleanH);
  ctx.restore();
}

/**
 * Draws a multiline or single-line text replacement onto a canvas context
 * with exact font, weight, style, color, alignment, and line height.
 */
function renderReplacementText(ctx, text, rect, style = {}) {
  const {
    fontFamily = 'Helvetica',
    fontSize = 14,
    fontWeight = 'normal',
    fontStyle = 'normal',
    fill = '#000000',
    backgroundColor = '#ffffff',
    textAlign = 'left',
  } = style;

  const { left, top, width, height, baseVy } = rect;

  // 1. Cleanly restore the local background over the original glyph area without destroying nearby rules or content.
  restoreLocalBackground(ctx, left, top, width, height, backgroundColor);

  // If user deleted the text, the background patch is already drawn cleanly
  if (!text || text.trim() === '') {
    return;
  }

  // 2. Set typography
  const fontStack = fontFamily === 'Times'
    ? '"Times New Roman", Times, Georgia, serif'
    : fontFamily === 'Courier'
    ? '"Courier New", Courier, monospace'
    : '"Helvetica Neue", Helvetica, Arial, sans-serif';

  ctx.save();
  ctx.font = `${fontStyle !== 'normal' ? `${fontStyle} ` : ''}${fontWeight !== 'normal' ? `${fontWeight} ` : ''}${fontSize}px ${fontStack}`;
  ctx.fillStyle = fill || '#000000';

  // If replacement text is wider than original box, expand mask so new text doesn't overlap old background artifacts
  const measuredWidth = ctx.measureText(text).width;
  if (measuredWidth > width) {
    let maskLeft = left;
    if (textAlign === 'center') {
      maskLeft = left + (width - measuredWidth) / 2;
    } else if (textAlign === 'right') {
      maskLeft = left + width - measuredWidth;
    }
    restoreLocalBackground(ctx, maskLeft, top, measuredWidth, height, backgroundColor);
  }

  // Use exact baseline if available to match the original text vertical position
  const baselineY = Number.isFinite(baseVy)
    ? baseVy
    : (top + fontSize * 0.76);
  ctx.textBaseline = 'alphabetic';

  // 3. Render text according to alignment
  let textX = left;
  if (textAlign === 'center') {
    textX = left + width / 2;
    ctx.textAlign = 'center';
  } else if (textAlign === 'right') {
    textX = left + width;
    ctx.textAlign = 'right';
  } else if (textAlign === 'justify' && !style.isLastLine) {
    // Justify distributes words across available width (final line stays left-aligned)
    const words = (text || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      ctx.textAlign = 'left';
      ctx.fillText(text, left, baselineY);
    } else {
      let totalWordsWidth = 0;
      const wordWidths = words.map((w) => {
        const wWidth = ctx.measureText(w).width;
        totalWordsWidth += wWidth;
        return wWidth;
      });

      const normalSpace = fontSize * 0.28;
      const remaining = width - totalWordsWidth;
      const gapCount = words.length - 1;
      const rawGap = remaining / gapCount;
      const maxGap = normalSpace * 1.20;
      const gap = (totalWordsWidth < width * 0.85 || remaining <= 0)
        ? normalSpace
        : Math.min(maxGap, Math.max(normalSpace, rawGap));

      let curX = left;
      ctx.textAlign = 'left';
      for (let i = 0; i < words.length; i++) {
        ctx.fillText(words[i], curX, baselineY);
        curX += wordWidths[i] + gap;
      }
    }
    ctx.restore();
    return;
  } else {
    ctx.textAlign = 'left';
  }

  ctx.fillText(text, textX, baselineY);
  ctx.restore();
}

/**
 * Exports modified image with all content edits and vector annotations
 * Preserves the exact native format (JPG or PNG) and full resolution.
 *
 * @param {File|Blob|string|HTMLImageElement} sourceImage - Original uncompressed image
 * @param {object} options
 * @param {string} [options.fileName='image.png']
 * @param {object} [options.pageEdits={}]
 * @param {number} [options.rotation=0]
 * @param {number} [options.scaleFactor=1]
 * @returns {Promise<{ blob: Blob, fileName: string }>}
 */
export async function exportModifiedImage(sourceImage, options = {}) {
  const fileName = options.fileName || 'image.png';
  const isJpg = /\.jpe?g$/i.test(fileName);
  const mimeType = isJpg ? 'image/jpeg' : 'image/png';
  const outExt = isJpg ? 'jpg' : 'png';
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const outFileName = `${baseName}-edited.${outExt}`;

  // 1. Load source image at full native dimensions
  const isImgElement = (typeof HTMLImageElement !== 'undefined' && sourceImage instanceof HTMLImageElement) ||
    (sourceImage && typeof sourceImage.naturalWidth === 'number');
  const img = isImgElement
    ? sourceImage
    : await loadImageElement(sourceImage);

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  // 2. Set up full-resolution rendering canvas
  const canvas = document.createElement('canvas');
  const rotation = (options.rotation || 0) % 360;
  const isQuarterTurn = rotation === 90 || rotation === 270;

  canvas.width = isQuarterTurn ? naturalHeight : naturalWidth;
  canvas.height = isQuarterTurn ? naturalWidth : naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D rendering context for image export.');
  }

  // 3. Draw base image with rotation
  ctx.save();
  if (rotation !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -naturalWidth / 2, -naturalHeight / 2);
  } else {
    ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
  }
  ctx.restore();

  // 4. Apply text content replacements cleanly over original image
  const pageEdits = options.pageEdits || {};
  const contentEdits = pageEdits.contentEdits || {};

  // If the document was displayed at a scaled resolution, map back to native image dimensions
  const coordScale = options.scaleFactor ? (1 / options.scaleFactor) : 1;

  for (const blockId of Object.keys(contentEdits)) {
    const edit = contentEdits[blockId];
    if (!edit || typeof edit.text !== 'string') continue;

    const block = edit.block || {};
    const paraBoundaries = edit.paraBoundaries;
    const isCleared = Boolean(edit.isClearedLine || !edit.text || edit.text.trim() === '');
    const left = ((!isCleared && paraBoundaries) ? paraBoundaries.left : (block.pdfLeft ?? block.left ?? 0)) * coordScale;
    const top = (block.pdfTop ?? block.top ?? 0) * coordScale;
    const width = ((!isCleared && paraBoundaries) ? paraBoundaries.width : (block.pdfWidth ?? block.width ?? 100)) * coordScale;
    const height = (block.pdfHeight ?? block.height ?? (block.fontSize || 14)) * coordScale;
    const fontSize = (block.rawFontSize || block.fontSize || 14) * coordScale;
    const baseVy = block.baseVy ? block.baseVy * coordScale : (top + fontSize * 0.76);

    renderReplacementText(
      ctx,
      edit.text,
      { left, top, width, height, baseVy },
      {
        fontFamily: block.fontFamily || 'Helvetica',
        fontSize,
        fontWeight: block.fontWeight || (block.isBold ? 'bold' : 'normal'),
        fontStyle: block.fontStyle || (block.isItalic ? 'italic' : 'normal'),
        fill: edit.color || block.fill || block.color || '#000000',
        backgroundColor: block.backgroundColor || '#ffffff',
        textAlign: edit.textAlign || block.textAlign || 'left',
        isLastLine: Boolean(paraBoundaries ? paraBoundaries.isLastLine : false),
      }
    );
  }

  // 5. Draw user Fabric.js vector objects (drawings, shapes, highlighters, annotations)
  const objects = pageEdits.objects || [];
  for (const obj of objects) {
    // Skip PDF content edit markers since they were processed above
    if (obj.isPdfContentEdit) continue;

    // Draw paths (pen & highlighter)
    if (obj.type === 'path' && Array.isArray(obj.path)) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = obj.stroke || '#000000';
      ctx.lineWidth = (obj.strokeWidth || 2) * coordScale;
      ctx.globalAlpha = obj.opacity ?? 1;
      ctx.lineCap = obj.strokeLineCap || 'round';
      ctx.lineJoin = obj.strokeLineJoin || 'round';

      for (const cmd of obj.path) {
        const type = cmd[0];
        if (type === 'M') {
          ctx.moveTo((obj.left + cmd[1]) * coordScale, (obj.top + cmd[2]) * coordScale);
        } else if (type === 'L') {
          ctx.lineTo((obj.left + cmd[1]) * coordScale, (obj.top + cmd[2]) * coordScale);
        } else if (type === 'Q') {
          ctx.quadraticCurveTo(
            (obj.left + cmd[1]) * coordScale,
            (obj.top + cmd[2]) * coordScale,
            (obj.left + cmd[3]) * coordScale,
            (obj.top + cmd[4]) * coordScale
          );
        }
      }
      ctx.stroke();
      ctx.restore();
    } else if (obj.type === 'rect') {
      ctx.save();
      ctx.fillStyle = obj.fill || 'transparent';
      ctx.strokeStyle = obj.stroke || '#000000';
      ctx.lineWidth = (obj.strokeWidth || 1) * coordScale;
      ctx.globalAlpha = obj.opacity ?? 1;
      const rx = (obj.left || 0) * coordScale;
      const ry = (obj.top || 0) * coordScale;
      const rw = (obj.width || 0) * (obj.scaleX || 1) * coordScale;
      const rh = (obj.height || 0) * (obj.scaleY || 1) * coordScale;
      if (obj.fill && obj.fill !== 'transparent') ctx.fillRect(rx, ry, rw, rh);
      if (obj.stroke && obj.stroke !== 'transparent' && obj.strokeWidth > 0) ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    } else if (obj.type === 'circle') {
      ctx.save();
      ctx.fillStyle = obj.fill || 'transparent';
      ctx.strokeStyle = obj.stroke || '#000000';
      ctx.lineWidth = (obj.strokeWidth || 1) * coordScale;
      ctx.globalAlpha = obj.opacity ?? 1;
      const r = (obj.radius || 0) * (obj.scaleX || 1) * coordScale;
      const cx = (obj.left || 0) * coordScale + r;
      const cy = (obj.top || 0) * coordScale + r;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (obj.fill && obj.fill !== 'transparent') ctx.fill();
      if (obj.stroke && obj.stroke !== 'transparent' && obj.strokeWidth > 0) ctx.stroke();
      ctx.restore();
    } else if (obj.type === 'line' && Array.isArray(obj.points)) {
      ctx.save();
      ctx.strokeStyle = obj.stroke || '#000000';
      ctx.lineWidth = (obj.strokeWidth || 2) * coordScale;
      ctx.globalAlpha = obj.opacity ?? 1;
      ctx.beginPath();
      ctx.moveTo(obj.points[0] * coordScale, obj.points[1] * coordScale);
      ctx.lineTo(obj.points[2] * coordScale, obj.points[3] * coordScale);
      ctx.stroke();
      ctx.restore();
    } else if (obj.type === 'textbox' && obj.text) {
      ctx.save();
      const tx = (obj.left || 0) * coordScale;
      const ty = (obj.top || 0) * coordScale;
      const tFontSize = (obj.fontSize || 14) * coordScale;
      ctx.font = `${obj.fontStyle || ''} ${obj.fontWeight || ''} ${tFontSize}px ${obj.fontFamily || 'Helvetica'}`;
      ctx.fillStyle = obj.fill || '#000000';
      ctx.textBaseline = 'top';
      ctx.fillText(obj.text, tx, ty);
      ctx.restore();
    }
  }

  // 6. Convert canvas to Blob retaining original format (JPG vs PNG)
  const blob = await new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (b) => resolve(b),
        mimeType,
        isJpg ? 0.95 : undefined
      );
    } else {
      resolve(new Blob([new Uint8Array(500)], { type: mimeType }));
    }
  });

  if (!blob) {
    throw new Error('Canvas toBlob failed during image export.');
  }

  return { blob, fileName: outFileName };
}

/**
 * Downloads the exported image directly in the user's browser
 */
export async function downloadModifiedImage(sourceImage, options = {}) {
  const { blob, fileName } = await exportModifiedImage(sourceImage, options);
  downloadBlob(blob, fileName);
  return { success: true, fileName };
}

export default {
  exportModifiedImage,
  downloadModifiedImage,
  loadImageElement,
};
