/**
 * Page Renderer Module
 * High-DPR, cancelable page rendering using HTML5 canvas with per-canvas concurrency protection.
 */

/**
 * Canvas Render Lock / Concurrency Manager
 * PDF.js strictly prohibits calling page.render() on a canvas while another render()
 * operation is currently active on that same canvas.
 * We track active and queued render operations per HTMLCanvasElement.
 */
const canvasRenderMap = new WeakMap();

/**
 * Cancel any ongoing render operation for a canvas.
 * @param {HTMLCanvasElement} canvas
 */
export function cancelPdfPageRender(canvas) {
  if (!canvas) return;
  const op = canvasRenderMap.get(canvas);
  if (op) {
    op.cancelled = true;
    if (op.renderTask) {
      try {
        op.renderTask.cancel();
      } catch {
        // Ignored
      }
    }
  }
}

/**
 * Render a single PDF page onto a target canvas element.
 * Handles device-pixel-ratio scaling for retina screens, prevents blurry text,
 * and enables graceful task cancellation and concurrency management.
 *
 * @param {object} pdfDoc - The PDF.js document proxy
 * @param {number} pageNumber - 1-indexed page number
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @param {object} [options]
 * @param {number} [options.scale=1] - Zoom level
 * @param {number} [options.rotation] - Custom rotation override
 * @param {number} [options.devicePixelRatio] - DPR override
 * @param {function} [options.onRenderTaskCreated] - Callback when renderTask is instantiated
 * @returns {Promise<{ viewport?: object, displayWidth?: number, displayHeight?: number, renderTask?: object, cancelled?: boolean }>}
 */
export async function renderPdfPage(pdfDoc, pageNumber, canvas, options = {}) {
  if (!pdfDoc || !canvas) {
    throw new Error('Invalid arguments: pdfDoc and canvas are required.');
  }

  // 1. If an operation is already in-flight for this exact canvas, cancel it and await its termination
  const prevOp = canvasRenderMap.get(canvas);
  if (prevOp) {
    prevOp.cancelled = true;
    if (prevOp.renderTask) {
      try {
        prevOp.renderTask.cancel();
      } catch {
        // Ignored
      }
    }
    // Await previous render promise so PDF.js releases canvas from its internal #canvasInUse set
    if (prevOp.promise) {
      try {
        await prevOp.promise;
      } catch {
        // Ignored (e.g. RenderingCancelledException)
      }
    }
  }

  // 2. Register current operation token on this canvas SYNCHRONOUSLY before any async calls
  const currentOp = {
    cancelled: false,
    renderTask: null,
    promise: null,
  };
  canvasRenderMap.set(canvas, currentOp);

  try {
    const page = await pdfDoc.getPage(pageNumber);

    // If a newer render request arrived on this canvas while getPage was in flight, abort cleanly
    if (currentOp.cancelled || canvasRenderMap.get(canvas) !== currentOp) {
      return { cancelled: true };
    }

    const scale = options.scale || 1.0;
    const rotation = options.rotation !== undefined ? options.rotation : page.rotate || 0;

    const viewport = page.getViewport({ scale, rotation });
    const dpr = options.devicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;

    const displayWidth = Math.floor(viewport.width);
    const displayHeight = Math.floor(viewport.height);

    // Set physical backing store size (high-DPR)
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);

    // Set CSS display size
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to acquire 2D context from canvas.');
    }

    // Ensure transformation matrix is cleanly reset to identity before drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // High-DPI scaling matrix for PDF.js - handles coordinate transformation without inverted Y
    const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      viewport,
      transform,
    };

    // Double check cancellation before calling page.render
    if (currentOp.cancelled || canvasRenderMap.get(canvas) !== currentOp) {
      return { cancelled: true, viewport, displayWidth, displayHeight };
    }

    const renderTask = page.render(renderContext);
    currentOp.renderTask = renderTask;
    currentOp.promise = renderTask.promise;

    if (typeof options.onRenderTaskCreated === 'function') {
      options.onRenderTaskCreated(renderTask);
    }

    await renderTask.promise;

    return {
      viewport,
      displayWidth,
      displayHeight,
      renderTask,
    };
  } catch (error) {
    if (error?.name === 'RenderingCancelledException') {
      // Intentional cancellation (e.g. zoom changed or page unmounted); not an application crash
      return { cancelled: true };
    }
    throw error;
  } finally {
    // Only clear the map if this is still the active operation
    if (canvasRenderMap.get(canvas) === currentOp) {
      canvasRenderMap.delete(canvas);
    }
  }
}
