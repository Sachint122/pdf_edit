/**
 * PdfPage Component
 * Renders an individual PDF page (or blank page) with high DPR, rotation,
 * and hosts an interactive Fabric.js overlay.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from 'fabric';
import { renderPdfPage, cancelPdfPageRender } from '../features/pdf-viewer/pageRenderer.js';
import {
  enablePenMode,
  enableHighlighterMode,
  disableDrawingMode,
} from '../features/editing/drawingTools.js';
import { extractObjectProperties } from '../utils/objectProperties.js';
import { extractPageTextBlocks } from '../features/editing/pdfContentEditor.js';

export function PdfPage({
  pdfDoc,
  page,
  pageNumber,
  scale = 1.0,
  activeTool = 'edit-content',
  savedEdits = null,
  selectedBlockId = null,
  onSelectContentBlock,
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
          setTextBlocks(blocks);
        }
      })
      .catch((err) => {
        console.warn(`Error extracting text blocks for page ${pageNumber}:`, err);
      });

    return () => {
      isSubscribed = false;
      setTextBlocks([]);
    };
  }, [pdfDoc, page?.originalIndex, page?.isBlank, pageNumber, scale, rotation]);

  // Enrich text blocks with real background color from the rendered canvas
  useEffect(() => {
    if (!isRendered || !pdfCanvasRef.current) return;

    try {
      const canvas = pdfCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;

      setTextBlocks((prevBlocks) => {
        if (!prevBlocks || prevBlocks.length === 0) return prevBlocks;
        let hasUpdate = false;
        const updated = prevBlocks.map((b) => {
          if (b.sampledBg) return b;
          const sx = Math.max(0, Math.min(canvas.width - 1, Math.round(((b.screenLeft ?? b.left) - 3) * dpr)));
          const sy = Math.max(0, Math.min(canvas.height - 1, Math.round(((b.screenTop ?? b.top) + (b.screenHeight ?? b.height) / 2) * dpr)));
          const pixel = ctx.getImageData(sx, sy, 1, 1).data;
          if (pixel[3] < 20) return { ...b, sampledBg: true };

          const r = pixel[0].toString(16).padStart(2, '0');
          const g = pixel[1].toString(16).padStart(2, '0');
          const bHex = pixel[2].toString(16).padStart(2, '0');
          const hex = `#${r}${g}${bHex}`;

          if (hex !== b.backgroundColor) {
            hasUpdate = true;
            return { ...b, backgroundColor: hex, sampledBg: true };
          }
          return { ...b, sampledBg: true };
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
        const json = fabricCanvas.toJSON();
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
        {textBlocks.map((block) => {
          const contentEdits = savedEdits?.contentEdits || {};
          const isEdited = !!contentEdits[block.id];
          const currentText = isEdited ? contentEdits[block.id].text : block.str;
          const isSelected = selectedBlockId === block.id;
          const exactSize = (block.rawFontSize || block.pdfFontSize || block.fontSize || 12) * scale;
          const isBold = block.isBold || block.fontWeight === 'bold';
          const isItalic = block.isItalic || block.fontStyle === 'italic';

          const fontStack = block.fontFamily === 'Times'
            ? '"Times New Roman", Times, Georgia, serif'
            : block.fontFamily === 'Courier'
            ? '"Courier New", Courier, monospace'
            : '"Helvetica Neue", Helvetica, Arial, sans-serif';

          if (isEdited) {
            return (
              <div
                key={`edited-${block.id}`}
                className={`absolute box-border cursor-pointer pointer-events-auto select-none transition-all flex items-center ${
                  isSelected
                    ? 'border-2 border-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.35)] z-28'
                    : 'border border-transparent hover:border-blue-500/70 hover:shadow-[0_0_0_2px_rgba(37,99,235,0.2)] z-18 hover:z-26'
                }`}
                style={{
                  left: (block.screenLeft ?? block.left) - 1,
                  top: (block.screenTop ?? block.top) - 2,
                  minWidth: Math.max(block.screenWidth ?? block.width, (currentText.length * exactSize * 0.55) + 8),
                  minHeight: (block.screenHeight ?? block.height) + 4,
                  paddingLeft: '3px',
                  paddingRight: '3px',
                  fontSize: `${exactSize}px`,
                  fontFamily: fontStack,
                  fontWeight: isBold ? 700 : 400,
                  fontStyle: isItalic ? 'italic' : 'normal',
                  color: block.fill || block.color || '#000000',
                  backgroundColor: block.backgroundColor || '#ffffff',
                  lineHeight: 1.15,
                }}
                title={`Click to edit: "${currentText.slice(0, 40)}"`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof onSelectContentBlock === 'function') {
                    onSelectContentBlock(page.id, pageNumber, block, currentText);
                  }
                }}
              >
                <span>{currentText}</span>
                {!isSelected && (
                  <span className="absolute -top-3.5 -right-0.5 text-[9px] font-semibold text-white bg-blue-600 rounded px-1 py-px shadow-xs opacity-0 hover:opacity-100 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
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
                  : 'border border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500 hover:border-solid hover:shadow-[0_0_0_2px_rgba(37,99,235,0.25)] z-14 hover:z-25'
              }`}
              style={{
                left: block.screenLeft ?? block.left,
                top: (block.screenTop ?? block.top) - 2,
                width: block.screenWidth ?? block.width,
                height: (block.screenHeight ?? block.height) + 4,
              }}
              title={`Click to edit content in right panel: "${block.str.slice(0, 35)}"`}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onSelectContentBlock === 'function') {
                  onSelectContentBlock(page.id, pageNumber, block, block.str);
                }
              }}
            >
              {!isSelected && (
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
