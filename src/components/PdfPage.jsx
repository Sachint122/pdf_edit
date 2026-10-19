/**
 * PdfPage Component
 * Renders an individual PDF page (or blank page) with high DPR, rotation,
 * and hosts an interactive Fabric.js overlay.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from 'fabric';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link,
} from 'lucide-react';
import { renderPdfPage, cancelPdfPageRender } from '../features/pdf-viewer/pageRenderer.js';
import {
  enablePenMode,
  enableHighlighterMode,
  disableDrawingMode,
} from '../features/editing/drawingTools.js';
import { extractObjectProperties } from '../utils/objectProperties.js';
import { extractPageTextBlocks } from '../features/editing/pdfContentEditor.js';

let textMeasureCtx = null;

function ensureTextMeasureCtx() {
  if (typeof document === 'undefined') return null;
  if (!textMeasureCtx) {
    const c = document.createElement('canvas');
    textMeasureCtx = c.getContext('2d');
  }
  return textMeasureCtx;
}

function measureRenderedTextWidth(text, fontSize, fontStack, isBold, isItalic) {
  const ctx = ensureTextMeasureCtx();
  if (ctx && text) {
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontStack}`;
    return ctx.measureText(text).width;
  }
  return (text || '').length * fontSize * 0.52;
}

/**
 * Computes natural typographic word distribution for justified alignment.
 * Avoids excessive word spacing and clamps gap to natural limits matching PDF export.
 */
function computeJustifiedGap(text, containerWidth, fontSize, fontStack, isBold, isItalic) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const normalSpace = fontSize * 0.28;
  if (words.length <= 1) {
    return { gap: normalSpace, words };
  }

  let totalWordsWidth = 0;
  const ctx = ensureTextMeasureCtx();
  if (ctx) {
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontStack}`;
    for (const w of words) {
      totalWordsWidth += ctx.measureText(w).width;
    }
  }

  if (totalWordsWidth === 0) {
    totalWordsWidth = words.join('').length * fontSize * 0.52;
  }

  const availableWidth = Math.max(20, containerWidth);
  const remaining = availableWidth - totalWordsWidth;
  const gapCount = words.length - 1;

  // Natural maximum gap threshold (1.20x normal space width) to avoid excessive spacing between words
  const maxGap = normalSpace * 1.20;

  // If the line is short (< 85% of available width) or words overflow, keep natural spacing
  if (totalWordsWidth < availableWidth * 0.85 || remaining <= 0) {
    return { gap: normalSpace, words };
  }

  const rawGap = remaining / gapCount;
  const clampedGap = Math.min(maxGap, Math.max(normalSpace, rawGap));

  return { gap: clampedGap, words };
}

export function PdfPage({
  pdfDoc,
  page,
  pageNumber,
  scale = 1.0,
  activeTool = 'edit-content',
  savedEdits = null,
  selectedBlockId = null,
  selectedObject = null,
  initialOcrBlocks = null,
  onSelectContentBlock,
  onApplyAlignment,
  onPageVisible,
  onPageEditsChange,
  onObjectSelected,
  onObjectDeselected,
  onRegisterCanvas,
  onUnregisterCanvas,
}) {
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const fabricInstanceRef = useRef(null);

  const [isRendered, setIsRendered] = useState(page?.isBlank || false);
  const [renderError, setRenderError] = useState(null);
  const [textBlocks, setTextBlocks] = useState([]);

  const rotation = page?.rotation || 0;
  const isRotatedQuarter = rotation % 180 !== 0;
  const rawWidth = page?.width || 612;
  const rawHeight = page?.height || 792;

  const baseWidth = isRotatedQuarter ? rawHeight : rawWidth;
  const baseHeight = isRotatedQuarter ? rawWidth : rawHeight;

  const displayWidth = Math.floor(baseWidth * scale);
  const displayHeight = Math.floor(baseHeight * scale);

  // Keep latest callbacks in ref to prevent unnecessary canvas re-instantiation
  const callbacksRef = useRef({
    onPageEditsChange,
    onObjectSelected,
    onObjectDeselected,
    onRegisterCanvas,
    onUnregisterCanvas,
  });

  useEffect(() => {
    callbacksRef.current = {
      onPageEditsChange,
      onObjectSelected,
      onObjectDeselected,
      onRegisterCanvas,
      onUnregisterCanvas,
    };
  });

  // 1. Observe visibility to track current active page in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            if (typeof onPageVisible === 'function') {
              onPageVisible(pageNumber);
            }
          }
        });
      },
      {
        threshold: [0.1, 0.4, 0.8],
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [pageNumber, onPageVisible]);

  // 2. Render PDF.js Page Canvas (if not a blank page)
  useEffect(() => {
    if (page?.isBlank || !pdfDoc || !pdfCanvasRef.current) {
      return;
    }

    const canvas = pdfCanvasRef.current;
    let isCancelled = false;

    const executeRender = async () => {
      try {
        setRenderError(null);
        const result = await renderPdfPage(pdfDoc, page.originalIndex, canvas, {
          scale,
          rotation,
        });

        if (isCancelled) return;

        if (!result?.cancelled) {
          setIsRendered(true);
        }
      } catch (err) {
        if (isCancelled) return;
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}:`, err);
          setRenderError('Failed to render page.');
        }
      }
    };

    executeRender();

    return () => {
      isCancelled = true;
      cancelPdfPageRender(canvas);
    };
  }, [pdfDoc, page?.originalIndex, page?.isBlank, pageNumber, scale, rotation, baseWidth, baseHeight]);

  // Extract existing text items from the PDF page for direct in-place content editing
  useEffect(() => {
    if (!pdfDoc || page?.isBlank) {
      return;
    }

    let isSubscribed = true;

    extractPageTextBlocks(pdfDoc, page.originalIndex, scale, rotation)
      .then((blocks) => {
        if (isSubscribed) {
          if ((!blocks || blocks.length === 0) && Array.isArray(initialOcrBlocks) && initialOcrBlocks.length > 0) {
            const scaled = initialOcrBlocks.map((b) => ({
              ...b,
              screenLeft: b.left * scale,
              screenTop: b.top * scale,
              screenWidth: b.width * scale,
              screenHeight: b.height * scale,
            }));
            setTextBlocks(scaled);
          } else {
            setTextBlocks(blocks);
          }
        }
      })
      .catch((err) => {
        console.warn(`Error extracting text blocks for page ${pageNumber}:`, err);
        if (isSubscribed && Array.isArray(initialOcrBlocks) && initialOcrBlocks.length > 0) {
          const scaled = initialOcrBlocks.map((b) => ({
            ...b,
            screenLeft: b.left * scale,
            screenTop: b.top * scale,
            screenWidth: b.width * scale,
            screenHeight: b.height * scale,
          }));
          setTextBlocks(scaled);
        }
      });

    return () => {
      isSubscribed = false;
      setTextBlocks([]);
    };
  }, [pdfDoc, page?.originalIndex, page?.isBlank, pageNumber, scale, rotation, initialOcrBlocks]);

  // Enrich text blocks with real background color and text color from the rendered canvas
  useEffect(() => {
    if (!isRendered || !pdfCanvasRef.current) return;

    try {
      const canvas = pdfCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || canvas.width <= 0 || canvas.height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      const cWidth = canvas.width;
      const cHeight = canvas.height;
      const imgData = ctx.getImageData(0, 0, cWidth, cHeight).data;

      setTextBlocks((prevBlocks) => {
        if (!prevBlocks || prevBlocks.length === 0) return prevBlocks;
        let hasUpdate = false;
        const updated = prevBlocks.map((b) => {
          if (b.sampledBg && (!b.isOcrDetected || b.sampledText)) return b;

          let newBg = b.backgroundColor;
          let newColor = b.fill || b.color;
          let bgUpdated = false;

          const sx = Math.max(0, Math.min(cWidth - 1, Math.round(((b.screenLeft ?? b.left) - 3) * dpr)));
          const sy = Math.max(0, Math.min(cHeight - 1, Math.round(((b.screenTop ?? b.top) + (b.screenHeight ?? b.height) / 2) * dpr)));
          const pixelIdx = (sy * cWidth + sx) * 4;

          let bgLum = 255;
          if (imgData[pixelIdx + 3] >= 20) {
            const r = imgData[pixelIdx];
            const g = imgData[pixelIdx + 1];
            const bVal = imgData[pixelIdx + 2];
            bgLum = 0.299 * r + 0.587 * g + 0.114 * bVal;
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bVal.toString(16).padStart(2, '0')}`;
            if (hex !== b.backgroundColor) {
              newBg = hex;
              bgUpdated = true;
            }
          }

          // Sample actual text color, background, bold styling, and font family from image for OCR text blocks
          let textUpdated = false;
          let detectedBold = b.isBold;
          let detectedFont = b.fontFamily || 'Helvetica';
          let updatedParaLines = b.paraLines;

          if (b.isOcrDetected && !b.sampledText && (!b.fill || b.fill === '#000000')) {
            const boxLeft = b.screenLeft ?? b.left;
            const boxWidth = b.screenWidth ?? b.width;
            const boxTop = b.screenTop ?? b.top;
            const boxHeight = b.screenHeight ?? b.height;
            const sampleSteps = 7;
            let maxContrast = 0;
            let bestHex = null;

            for (let step = 1; step <= sampleSteps; step++) {
              const tx = Math.max(0, Math.min(cWidth - 1, Math.round((boxLeft + (boxWidth * step) / (sampleSteps + 1)) * dpr)));
              const ty = Math.max(0, Math.min(cHeight - 1, Math.round((boxTop + boxHeight * 0.5) * dpr)));
              const tIdx = (ty * cWidth + tx) * 4;
              if (imgData[tIdx + 3] >= 50) {
                const tr = imgData[tIdx];
                const tg = imgData[tIdx + 1];
                const tb = imgData[tIdx + 2];
                const tLum = 0.299 * tr + 0.587 * tg + 0.114 * tb;
                const contrast = Math.abs(tLum - bgLum);
                if (contrast > maxContrast && contrast > 30) {
                  maxContrast = contrast;
                  bestHex = `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
                }
              }
            }

            if (bestHex && bestHex !== b.fill) {
              newColor = bestHex;
              textUpdated = true;
            }

            // Sample ink density to detect bold styling
            let inkCount = 0;
            let totalChecked = 0;
            const yStart = Math.max(0, Math.min(cHeight - 1, Math.round((boxTop + boxHeight * 0.2) * dpr)));
            const yEnd = Math.max(0, Math.min(cHeight - 1, Math.round((boxTop + boxHeight * 0.8) * dpr)));
            const xStart = Math.max(0, Math.min(cWidth - 1, Math.round((boxLeft + 2) * dpr)));
            const xEnd = Math.max(0, Math.min(cWidth - 1, Math.round((boxLeft + boxWidth - 2) * dpr)));
            const stepX = Math.max(1, Math.round((xEnd - xStart) / 25));
            const stepY = Math.max(1, Math.round((yEnd - yStart) / 8));

            for (let y = yStart; y <= yEnd; y += stepY) {
              for (let x = xStart; x <= xEnd; x += stepX) {
                const idx = (y * cWidth + x) * 4;
                if (imgData[idx + 3] >= 50) {
                  const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
                  if (Math.abs(lum - bgLum) > 35) {
                    inkCount++;
                  }
                  totalChecked++;
                }
              }
            }

            const inkRatio = totalChecked > 0 ? (inkCount / totalChecked) : 0;
            // Respect OCR detected bold if explicitly set; otherwise require substantial ink ratio
            if (b.isBold !== undefined) {
              detectedBold = b.isBold;
            } else {
              detectedBold = Boolean(inkRatio >= 0.32);
            }

            // Detect serif footings vs clean sans-serif stems
            let baselineInk = 0;
            let midInk = 0;
            const baseLineY = Math.max(0, Math.min(cHeight - 1, Math.round((boxTop + boxHeight * 0.82) * dpr)));
            const midLineY = Math.max(0, Math.min(cHeight - 1, Math.round((boxTop + boxHeight * 0.5) * dpr)));
            for (let x = xStart; x <= xEnd; x += stepX) {
              const bIdx = (baseLineY * cWidth + x) * 4;
              const mIdx = (midLineY * cWidth + x) * 4;
              if (imgData[bIdx + 3] >= 50) {
                const bL = 0.299 * imgData[bIdx] + 0.587 * imgData[bIdx + 1] + 0.114 * imgData[bIdx + 2];
                if (Math.abs(bL - bgLum) > 35) baselineInk++;
              }
              if (imgData[mIdx + 3] >= 50) {
                const mL = 0.299 * imgData[mIdx] + 0.587 * imgData[mIdx + 1] + 0.114 * imgData[mIdx + 2];
                if (Math.abs(mL - bgLum) > 35) midInk++;
              }
            }
            detectedFont = (b.fontFamily && b.fontFamily !== 'Helvetica')
              ? b.fontFamily
              : (midInk > 0 && (baselineInk / midInk) >= 1.45 ? 'Times' : 'Helvetica');

            if (detectedBold !== b.isBold || detectedFont !== b.fontFamily) {
              textUpdated = true;
            }

            if (Array.isArray(b.paraLines)) {
              updatedParaLines = b.paraLines.map((l) => {
                if (l.id === b.id) {
                  return {
                    ...l,
                    fill: newColor,
                    color: newColor,
                    backgroundColor: newBg,
                    fontFamily: detectedFont,
                    isBold: detectedBold,
                    fontWeight: detectedBold ? 'bold' : 'normal',
                  };
                }
                return l;
              });
            }
          }

          if (bgUpdated || textUpdated) {
            hasUpdate = true;
            return {
              ...b,
              backgroundColor: newBg,
              fill: newColor,
              color: newColor,
              fontFamily: detectedFont,
              isBold: detectedBold,
              fontWeight: detectedBold ? 'bold' : 'normal',
              paraLines: updatedParaLines,
              sampledBg: true,
              sampledText: true,
            };
          }

          return { ...b, sampledBg: true, sampledText: true };
        });
        return hasUpdate ? updated : prevBlocks;
      });
    } catch {
      // Non-blocking
    }
  }, [isRendered]);

  // Cache initial props for canvas creation
  const initialMountPropsRef = useRef({
    scale,
    activeTool,
    savedEdits,
  });

  // 3. Initialize & Mount Fabric.js Overlay Canvas
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const initialScale = initialMountPropsRef.current.scale;
    const initialTool = initialMountPropsRef.current.activeTool;
    const initialEdits = initialMountPropsRef.current.savedEdits;

    const fabricCanvas = new Canvas(fabricCanvasRef.current, {
      width: Math.floor(baseWidth * initialScale),
      height: Math.floor(baseHeight * initialScale),
      selection: initialTool === 'select',
      preserveObjectStacking: true,
    });

    fabricCanvas.setZoom(initialScale);
    fabricInstanceRef.current = fabricCanvas;

    // Load saved edits for this page if available
    if (initialEdits) {
      try {
        fabricCanvas.loadFromJSON(initialEdits).then(() => {
          fabricCanvas.setZoom(initialScale);
          fabricCanvas.renderAll();
        }).catch((e) => {
          console.warn(`Could not restore edits for page ${page.id}:`, e);
        });
      } catch (e) {
        console.warn(`Error invoking loadFromJSON on page ${page.id}:`, e);
      }
    }

    // Register active canvas with parent manager
    if (typeof callbacksRef.current.onRegisterCanvas === 'function') {
      callbacksRef.current.onRegisterCanvas(page.id, fabricCanvas);
    }

    // Change listeners to synchronize edits state
    const handleChange = () => {
      if (typeof callbacksRef.current.onPageEditsChange === 'function') {
        const json = fabricCanvas.toJSON(['linkUrl', 'isPdfContentEdit', 'originalBlockId', 'textAlign', 'isLinkOnly']);
        callbacksRef.current.onPageEditsChange(page.id, json);
      }
    };

    fabricCanvas.on('object:added', handleChange);
    fabricCanvas.on('object:modified', handleChange);
    fabricCanvas.on('object:removed', handleChange);
    fabricCanvas.on('path:created', handleChange);

    // Selection listeners for properties panel
    fabricCanvas.on('selection:created', (e) => {
      const target = e.selected?.[0] || fabricCanvas.getActiveObject();
      if (typeof callbacksRef.current.onObjectSelected === 'function') {
        callbacksRef.current.onObjectSelected(page.id, extractObjectProperties(target), fabricCanvas);
      }
    });

    fabricCanvas.on('selection:updated', (e) => {
      const target = e.selected?.[0] || fabricCanvas.getActiveObject();
      if (typeof callbacksRef.current.onObjectSelected === 'function') {
        callbacksRef.current.onObjectSelected(page.id, extractObjectProperties(target), fabricCanvas);
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      if (typeof callbacksRef.current.onObjectDeselected === 'function') {
        callbacksRef.current.onObjectDeselected();
      }
    });

    return () => {
      if (typeof callbacksRef.current.onUnregisterCanvas === 'function') {
        callbacksRef.current.onUnregisterCanvas(page.id);
      }
      fabricCanvas.dispose();
      fabricInstanceRef.current = null;
    };
  }, [page.id, baseWidth, baseHeight]); // Mounts once per unique page.id

  // 4. Update Fabric Canvas dimensions & zoom when scale or rotation changes
  useEffect(() => {
    const canvas = fabricInstanceRef.current;
    if (!canvas) return;

    canvas.setDimensions({
      width: Math.floor(baseWidth * scale),
      height: Math.floor(baseHeight * scale),
    });
    canvas.setZoom(scale);
    canvas.renderAll();
  }, [scale, baseWidth, baseHeight]);

  // 5. Update Fabric Canvas interaction mode when activeTool changes
  useEffect(() => {
    const canvas = fabricInstanceRef.current;
    if (!canvas) return;

    if (activeTool === 'pen') {
      enablePenMode(canvas, { color: '#2563eb', width: 3 });
      canvas.selection = false;
      canvas.forEachObject((o) => {
        o.selectable = false;
        o.evented = false;
      });
    } else if (activeTool === 'highlighter') {
      enableHighlighterMode(canvas, { color: 'rgba(250, 204, 21, 0.45)', width: 22 });
      canvas.selection = false;
      canvas.forEachObject((o) => {
        o.selectable = false;
        o.evented = false;
      });
    } else {
      disableDrawingMode(canvas);
      canvas.selection = true;
      canvas.forEachObject((o) => {
        o.selectable = true;
        o.evented = true;
      });
    }
    canvas.renderAll();
  }, [activeTool]);

  return (
    <div
      ref={containerRef}
      id={`page-container-${pageNumber}`}
      className="relative bg-white rounded-xs shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_12px_24px_-4px_rgba(0,0,0,0.35),0_24px_48px_-12px_rgba(0,0,0,0.4)] ring-1 ring-black/10 flex flex-col items-center select-none mb-10 transition-shadow duration-200"
      style={{
        width: displayWidth,
        minHeight: displayHeight,
      }}
    >
      {/* Background Canvas: PDF.js or Blank Paper */}
      {page?.isBlank ? (
        <div
          style={{
            width: displayWidth,
            height: displayHeight,
            background: '#ffffff',
            borderRadius: 2,
          }}
        />
      ) : (
        <canvas ref={pdfCanvasRef} className="block rounded-xs" />
      )}

      {/* Interactive Direct In-Place PDF Text Content Editing Layer */}
      <div className={`absolute inset-0 z-12 ${activeTool === 'edit-content' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {(() => {
          const contentEdits = savedEdits?.contentEdits || {};
          const knownIds = new Set(textBlocks.map((b) => b.id));
          // Image-editor synthetic lines exist only in contentEdits after reflow growth.
          const syntheticBlocks = Object.entries(contentEdits)
            .filter(([, edit]) => edit?.isSyntheticLine && edit.block && !knownIds.has(edit.block.id))
            .map(([, edit]) => {
              const b = edit.block;
              return {
                ...b,
                screenLeft: (Number.isFinite(b.pdfLeft) ? b.pdfLeft : (b.left ?? 0)) * scale,
                screenTop: (Number.isFinite(b.pdfTop) ? b.pdfTop : (b.top ?? 0)) * scale,
                screenWidth: (Number.isFinite(b.pdfWidth) ? b.pdfWidth : (b.width ?? 100)) * scale,
                screenHeight: (Number.isFinite(b.pdfHeight) ? b.pdfHeight : (b.height ?? 14)) * scale,
                isOcrDetected: true,
                isParagraphMember: true,
              };
            });
          return [...textBlocks, ...syntheticBlocks];
        })().map((block) => {
          const contentEdits = savedEdits?.contentEdits || {};
          const currentEdit = contentEdits[block.id];
          const isEdited = !!currentEdit;
          const currentText = isEdited ? currentEdit.text : block.str;
          const textAlign = currentEdit?.textAlign || block.textAlign || 'left';
          const paraBoundaries = currentEdit?.paraBoundaries;
          const isClearedLine = Boolean(currentEdit?.isClearedLine);
          let computedIsLastLine = false;
          if (paraBoundaries && typeof paraBoundaries.isLastLine === 'boolean') {
            computedIsLastLine = paraBoundaries.isLastLine;
          } else if (block.paraLines && block.paraLines.length > 0) {
            const activeParaLineIds = block.paraLines
              .map((l) => l.id)
              .filter((id) => !contentEdits[id]?.isClearedLine);
            computedIsLastLine = activeParaLineIds.length > 0
              ? activeParaLineIds[activeParaLineIds.length - 1] === block.id
              : (block.lineIndex === block.paraLines.length - 1);
          } else {
            computedIsLastLine = true;
          }
          const isLastLine = !isClearedLine && computedIsLastLine;

          const isSelected = !isClearedLine && selectedBlockId === block.id;
          const isSelectedParaMember = Boolean(
            !isSelected &&
            !isClearedLine &&
            selectedObject?.isParagraphMember &&
            selectedObject?.paraLines?.some((l) => l.id === block.id)
          );

          const effectiveBlock = currentEdit?.block || block;
          const exactSize = (effectiveBlock.rawFontSize || effectiveBlock.fontSize || effectiveBlock.pdfFontSize || 12) * scale;
          const isBold = effectiveBlock.isBold || effectiveBlock.fontWeight === 'bold';
          const isItalic = effectiveBlock.isItalic || effectiveBlock.fontStyle === 'italic';

          const currentFontFamily = effectiveBlock.fontFamily || 'Helvetica';
          const fontStack = currentFontFamily === 'Times'
            ? '"Times New Roman", Times, Georgia, serif'
            : currentFontFamily === 'Courier'
            ? '"Courier New", Courier, monospace'
            : '"Helvetica Neue", Helvetica, Arial, sans-serif';

          const paraLeft = paraBoundaries
            ? Math.round(paraBoundaries.left * scale)
            : Math.round(block.screenLeft ?? block.left ?? 0);
          const paraWidth = paraBoundaries
            ? Math.round(paraBoundaries.width * scale)
            : Math.round(block.screenWidth ?? block.width ?? 100);
          const origLeft = Math.round(block.screenLeft ?? block.left ?? paraLeft);
          const origWidth = Math.round(block.screenWidth ?? block.width ?? paraWidth);
          const origTop = Math.round(block.screenTop ?? block.top ?? 0);

          const activeAlignment = selectedObject && (selectedBlockId === block.id || (selectedObject.isParagraphMember && selectedObject.paraLines?.some((l) => l.id === block.id)))
            ? (selectedObject.textAlign || textAlign)
            : textAlign;

          const hasLink = Boolean(currentEdit?.linkUrl || block.linkUrl);
          const linkUrl = currentEdit?.linkUrl || block.linkUrl || '';
          const isImageOcr = Boolean(block.isOcrDetected || effectiveBlock.isOcrDetected || currentEdit?.isSyntheticLine);

          if (isEdited) {
            // Image OCR: natural line-height matching original document typography and unedited OCR line boxes.
            const naturalHeight = Math.round(block.screenHeight ?? block.height ?? (exactSize * 1.30));
            const boxHeight = isImageOcr
              ? Math.max(Math.round(exactSize * 1.22), naturalHeight)
              : Math.max(
                Math.round(exactSize * 1.092),
                Math.round(block.screenHeight ?? block.height ?? (exactSize * 1.10))
              );

            const measuredTextW = measureRenderedTextWidth(
              currentText || '',
              exactSize,
              fontStack,
              isBold,
              isItalic
            );

            // Image left-align and justified last-lines hug text like unedited Experience boxes.
            // Center, right, and non-last justified lines need the full paragraph column width.
            const needsFullParaWidth = activeAlignment === 'center'
              || activeAlignment === 'right'
              || (activeAlignment === 'justify' && !isLastLine);

            const renderLeft = needsFullParaWidth ? paraLeft : origLeft;
            const renderWidth = needsFullParaWidth
              ? paraWidth
              : Math.max(12, Math.ceil(measuredTextW) + 2);

            // White-out must always cleanly cover original ink across the line without gaps or artifact exposure.
            const maskLeft = needsFullParaWidth
              ? paraLeft
              : Math.min(origLeft, renderLeft);
            const maskWidth = needsFullParaWidth
              ? paraWidth
              : Math.max(origWidth, Math.ceil(measuredTextW) + 4, (renderLeft + Math.ceil(measuredTextW) + 2) - maskLeft);
            const maskTop = origTop - 1;
            const maskHeight = boxHeight + 2;
            const bgColor = effectiveBlock.backgroundColor || block.backgroundColor || '#ffffff';

            // Image-editor cleared OCR rows: tight white-out only — never a selection row.
            if (isClearedLine) {
              return (
                <div
                  key={`cleared-${block.id}`}
                  className="absolute pointer-events-none border-0"
                  style={{
                    left: origLeft - 1,
                    top: maskTop,
                    width: origWidth + 2,
                    height: maskHeight,
                    backgroundColor: bgColor,
                    zIndex: 16,
                  }}
                  aria-hidden="true"
                />
              );
            }

            const cssTextAlign = activeAlignment === 'justify' && !isLastLine
              ? 'left'
              : (activeAlignment === 'center' || activeAlignment === 'right' ? activeAlignment : 'left');

            return (
              <div
                key={`edited-${block.id}`}
                className={`absolute box-border cursor-pointer pointer-events-auto select-none transition-all ${
                  isSelected
                    ? 'border-2 border-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.35)] z-28'
                    : isSelectedParaMember
                    ? 'border border-blue-500/70 bg-blue-500/10 shadow-[0_0_0_1px_rgba(37,99,235,0.25)] z-20'
                    : hasLink
                    ? 'border border-blue-500/50 hover:border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.2)] z-18 hover:z-26'
                    : 'border border-transparent hover:border-blue-500/70 hover:shadow-[0_0_0_2px_rgba(37,99,235,0.2)] z-18 hover:z-26'
                }`}
                style={{
                  left: renderLeft,
                  top: origTop,
                  width: needsFullParaWidth ? paraWidth : renderWidth,
                  height: boxHeight,
                  minHeight: boxHeight,
                  paddingLeft: '0px',
                  paddingRight: '0px',
                  fontSize: `${exactSize}px`,
                  fontFamily: fontStack,
                  fontWeight: isBold ? 700 : 400,
                  fontStyle: isItalic ? 'italic' : 'normal',
                  color: effectiveBlock.fill || effectiveBlock.color || block.fill || block.color || '#000000',
                  backgroundColor: 'transparent',
                  lineHeight: `${boxHeight}px`,
                  letterSpacing: 'normal',
                  overflow: 'visible',
                  whiteSpace: 'nowrap',
                  textAlign: cssTextAlign,
                }}
                title={hasLink ? `Hyperlink: "${linkUrl}" | Click to edit` : (isSelectedParaMember ? `Paragraph member: "${currentText.slice(0, 40)}"` : `Click to edit: "${currentText.slice(0, 40)}"`)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof onSelectContentBlock === 'function') {
                    onSelectContentBlock(page.id, pageNumber, block, currentText);
                  }
                }}
              >
                {/* Background white-out (covers original image glyphs without inflating selection) */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: maskLeft - renderLeft,
                    top: maskTop - origTop - 1,
                    width: maskWidth,
                    height: maskHeight + 2,
                    backgroundColor: bgColor,
                    zIndex: 0,
                  }}
                  aria-hidden="true"
                />

                {/* Floating Contextual Toolbar for Selected Block */}
                {isSelected && (
                  <div
                    className="absolute -top-9 left-0 flex items-center bg-slate-900/95 border border-slate-700/80 rounded-lg p-0.5 shadow-xl backdrop-blur-md z-30 pointer-events-auto gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className={`p-1 rounded-md transition-colors ${
                          activeAlignment === 'left' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyAlignment?.('left');
                        }}
                        title="Align Left"
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        type="button"
                        className={`p-1 rounded-md transition-colors ${
                          activeAlignment === 'center' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyAlignment?.('center');
                        }}
                        title="Align Center"
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        type="button"
                        className={`p-1 rounded-md transition-colors ${
                          activeAlignment === 'right' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyAlignment?.('right');
                        }}
                        title="Align Right"
                      >
                        <AlignRight size={13} />
                      </button>
                      <button
                        type="button"
                        className={`p-1 rounded-md transition-colors ${
                          activeAlignment === 'justify' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyAlignment?.('justify');
                        }}
                        title="Justify"
                      >
                        <AlignJustify size={13} />
                      </button>
                    </div>

                    {(selectedObject?.linkUrl || hasLink) && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-300 bg-blue-950/80 rounded border border-blue-500/40">
                        <Link size={10} className="text-blue-400" />
                        <span className="max-w-[120px] truncate">{selectedObject?.linkUrl || linkUrl}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="relative z-10 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                  {activeAlignment === 'justify' && !isLastLine ? (() => {
                    const justResult = computeJustifiedGap(
                      currentText,
                      needsFullParaWidth ? paraWidth : renderWidth,
                      exactSize,
                      fontStack,
                      isBold,
                      isItalic
                    );
                    return (
                      <div
                        className="flex items-center justify-start"
                        style={{ gap: `${justResult.gap}px`, height: '100%' }}
                      >
                        {justResult.words.map((w, wIdx) => (
                          <span key={wIdx}>{w}</span>
                        ))}
                      </div>
                    );
                  })() : (
                    <span
                      className="block w-full"
                      style={{
                        textAlign: cssTextAlign,
                        lineHeight: `${boxHeight}px`,
                      }}
                    >
                      {currentText || '\u00A0'}
                    </span>
                  )}
                </div>

                {hasLink && (
                  <span
                    className="absolute -bottom-3 right-0 inline-flex items-center gap-0.5 text-[8px] font-semibold text-blue-300 bg-blue-950/95 border border-blue-500/50 rounded px-1 py-px shadow-xs pointer-events-none z-10"
                    title={`Link: ${linkUrl}`}
                  >
                    <Link size={8} className="text-blue-400" />
                    <span>Link</span>
                  </span>
                )}

                {!isSelected && !isSelectedParaMember && (
                  <span className="absolute -top-3.5 -right-0.5 text-[9px] font-semibold text-white bg-blue-600 rounded px-1 py-px shadow-xs opacity-0 hover:opacity-100 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                    ✎ Edit
                  </span>
                )}
              </div>
            );
          }

          return (
            <div
              key={block.id}
              className={`absolute rounded-xs cursor-pointer box-border transition-all select-none group ${
                isSelected
                  ? 'border-2 border-blue-600 bg-blue-600/15 shadow-[0_0_0_2px_rgba(37,99,235,0.35)] z-28'
                  : isSelectedParaMember
                  ? 'border border-solid border-blue-500/70 bg-blue-500/15 shadow-[0_0_0_1px_rgba(37,99,235,0.25)] z-20'
                  : hasLink
                  ? 'border border-solid border-blue-500/60 bg-blue-500/10 shadow-[0_0_0_1px_rgba(37,99,235,0.25)] z-16 hover:z-25'
                  : 'border border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500 hover:border-solid hover:shadow-[0_0_0_2px_rgba(37,99,235,0.25)] z-14 hover:z-25'
              }`}
              style={{
                left: block.screenLeft ?? block.left,
                top: (block.screenTop ?? block.top) - 2,
                width: block.screenWidth ?? block.width,
                height: (block.screenHeight ?? block.height) + 4,
              }}
              title={hasLink ? `Hyperlink: "${linkUrl}" | Click to edit` : (isSelectedParaMember ? `Paragraph member: "${block.str.slice(0, 35)}"` : `Click to edit content in right panel: "${block.str.slice(0, 35)}"`)}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onSelectContentBlock === 'function') {
                  onSelectContentBlock(page.id, pageNumber, block, block.str);
                }
              }}
            >
              {/* Floating Contextual Toolbar for Selected Unedited Block */}
              {isSelected && (
                <div
                  className="absolute -top-9 left-0 flex items-center bg-slate-900/95 border border-slate-700/80 rounded-lg p-0.5 shadow-xl backdrop-blur-md z-30 pointer-events-auto gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className={`p-1 rounded-md transition-colors ${
                        activeAlignment === 'left' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyAlignment?.('left');
                      }}
                      title="Align Left"
                    >
                      <AlignLeft size={13} />
                    </button>
                    <button
                      type="button"
                      className={`p-1 rounded-md transition-colors ${
                        activeAlignment === 'center' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyAlignment?.('center');
                      }}
                      title="Align Center"
                    >
                      <AlignCenter size={13} />
                    </button>
                    <button
                      type="button"
                      className={`p-1 rounded-md transition-colors ${
                        activeAlignment === 'right' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyAlignment?.('right');
                      }}
                      title="Align Right"
                    >
                      <AlignRight size={13} />
                    </button>
                    <button
                      type="button"
                      className={`p-1 rounded-md transition-colors ${
                        activeAlignment === 'justify' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyAlignment?.('justify');
                      }}
                      title="Justify"
                    >
                      <AlignJustify size={13} />
                    </button>
                  </div>

                  {(selectedObject?.linkUrl || hasLink) && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-300 bg-blue-950/80 rounded border border-blue-500/40">
                      <Link size={10} className="text-blue-400" />
                      <span className="max-w-[120px] truncate">{selectedObject?.linkUrl || linkUrl}</span>
                    </div>
                  )}
                </div>
              )}

              {hasLink && (
                <span
                  className="absolute -bottom-3 right-0 inline-flex items-center gap-0.5 text-[8px] font-semibold text-blue-300 bg-blue-950/95 border border-blue-500/50 rounded px-1 py-px shadow-xs pointer-events-none z-10"
                  title={`Link: ${linkUrl}`}
                >
                  <Link size={8} className="text-blue-400" />
                  <span>Link</span>
                </span>
              )}

              {!isSelected && !isSelectedParaMember && (
                <span className="absolute -top-3.5 -right-0.5 text-[10px] font-semibold text-white bg-blue-600 rounded px-1 py-px shadow-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap">
                  ✎ Edit
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Fabric.js Overlay Canvas */}
      <div id={`page-overlay-${page.id}`} className="absolute inset-0 pointer-events-auto z-10">
        <canvas ref={fabricCanvasRef} />
      </div>

      {/* Placeholder spinner overlay while first rendering */}
      {!isRendered && !renderError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-xs shadow-2xl text-slate-400 gap-3">
          <div className="w-8 h-8 border-3 border-black/10 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading page {pageNumber}...</span>
        </div>
      )}

      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xs font-semibold">
          {renderError}
        </div>
      )}

      {/* Page Number Badge */}
      <div className="absolute -bottom-7 text-[11px] font-medium text-slate-400/80 tracking-wide select-none">
        Page {pageNumber} {page?.isBlank ? '(Blank)' : ''}
      </div>
    </div>
  );
}
