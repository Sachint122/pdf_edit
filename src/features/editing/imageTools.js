/**
 * Image Insertion Tools for Fabric.js Canvas
 */

import { FabricImage } from 'fabric';

/**
 * Add an image to the canvas from a DataURL or Object URL.
 * @param {import('fabric').Canvas} canvas
 * @param {string} dataUrl
 * @param {object} [options]
 * @returns {Promise<import('fabric').FabricImage>}
 */
export async function addImageFromDataUrl(canvas, dataUrl, options = {}) {
  if (!canvas || !dataUrl) return null;

  try {
    const img = await FabricImage.fromURL(dataUrl);

    // Constrain max initial dimensions so it doesn't overflow page
    const maxDim = options.maxDimension || 260;
    const currentWidth = img.width || 300;
    const currentHeight = img.height || 300;

    let scaleFactor = 1;
    if (currentWidth > maxDim || currentHeight > maxDim) {
      scaleFactor = Math.min(maxDim / currentWidth, maxDim / currentHeight);
    }

    const center = canvas.getCenterPoint ? canvas.getCenterPoint() : { x: 150, y: 150 };

    img.set({
      left: options.left ?? Math.max(20, center.x - (currentWidth * scaleFactor) / 2),
      top: options.top ?? Math.max(20, center.y - (currentHeight * scaleFactor) / 2),
      scaleX: scaleFactor,
      scaleY: scaleFactor,
      cornerColor: '#3b82f6',
      cornerSize: 8,
      transparentCorners: false,
    });

    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();

    return img;
  } catch (err) {
    console.error('Failed to load image onto canvas:', err);
    throw err;
  }
}
