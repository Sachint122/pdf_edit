/**
 * OrganizePagesModal Component
 * Full-screen studio modal for visually managing PDF pages in a responsive grid.
 * Allows reordering (Move Up/Down), deletion, rotation, adding blank pages,
 * and direct jumping to pages without taking away workspace width.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  FileText,
  Check,
  LayoutGrid,
} from 'lucide-react';
import { renderPdfPage, cancelPdfPageRender } from '../features/pdf-viewer/pageRenderer.js';

function PageThumbnailCard({
  page,
  index,
  totalCount,
  pdfDoc,
  isActive,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRotate,
  onDelete,
}) {
  const canvasRef = useRef(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (page.isBlank || !pdfDoc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let cancelled = false;

    renderPdfPage(pdfDoc, page.originalIndex, canvas, {
      scale: 0.22,
      rotation: page.rotation || 0,
    })
      .then((res) => {
        if (!cancelled && res?.cancelled) {
          // cancelled
        }
      })
      .catch((err) => {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          console.warn(`Could not render thumbnail for page ${index + 1}:`, err);
          setRenderError(true);
        }
      });

    return () => {
      cancelled = true;
      cancelPdfPageRender(canvas);
    };
  }, [pdfDoc, page.originalIndex, page.isBlank, page.rotation, index]);

  return (
    <div
      className={`group relative flex flex-col bg-slate-900/90 border rounded-2xl overflow-hidden transition-all duration-200 shadow-lg ${
        isActive
          ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-blue-500/10'
          : 'border-white/[0.08] hover:border-slate-700/80 hover:shadow-xl'
      }`}
    >
      {/* Page Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/70 border-b border-white/[0.06] text-xs">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center text-[10px] font-bold">
            {index + 1}
          </span>
          <span>Page {index + 1}</span>
        </span>

        {isActive && (
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            Current
          </span>
        )}
      </div>

      {/* Thumbnail Area - Click to jump */}
      <div
        className="flex-1 min-h-[170px] max-h-[220px] bg-[#0c1017] flex items-center justify-center p-3 cursor-pointer overflow-hidden relative"
        onClick={() => onSelect(index + 1)}
        title={`Click to open Page ${index + 1}`}
      >
        {page.isBlank ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-500 border border-dashed border-slate-700/60 rounded-xl w-full h-[160px] bg-slate-900/40">
            <FileText size={24} className="opacity-40" />
            <span className="text-[11px] font-medium">Blank Page</span>
          </div>
        ) : renderError ? (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 w-full h-[160px]">
            <FileText size={24} className="text-slate-600" />
            <span className="text-[10px]">Page {index + 1}</span>
          </div>
        ) : (
          <div className="relative shadow-md rounded bg-white overflow-hidden max-h-[170px]">
            <canvas ref={canvasRef} className="block object-contain" />
          </div>
        )}

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="text-xs font-semibold text-white bg-slate-950/90 border border-white/20 px-2.5 py-1 rounded-lg shadow-lg">
            Jump to Page
          </span>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="flex items-center justify-between p-1.5 bg-slate-950/90 border-t border-white/[0.06] gap-1">
        <div className="flex items-center gap-1">
          {/* Move Earlier / Left */}
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => onMoveUp(page.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/90 disabled:opacity-20 disabled:pointer-events-none transition-colors"
            title="Move Page Earlier (Left/Up)"
            aria-label="Move page earlier"
          >
            <ArrowLeft size={13} />
          </button>

          {/* Move Later / Right */}
          <button
            type="button"
            disabled={index >= totalCount - 1}
            onClick={() => onMoveDown(page.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/90 disabled:opacity-20 disabled:pointer-events-none transition-colors"
            title="Move Page Later (Right/Down)"
            aria-label="Move page later"
          >
            <ArrowRight size={13} />
          </button>

          {/* Rotate 90° Clockwise */}
          <button
            type="button"
            onClick={() => onRotate(page.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/90 transition-colors"
            title="Rotate Page 90° Clockwise"
            aria-label="Rotate page 90 degrees"
          >
            <RotateCw size={13} />
          </button>
        </div>

        {/* Delete Page */}
        <button
          type="button"
          disabled={totalCount <= 1}
          onClick={() => onDelete(page.id, index + 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-20 disabled:pointer-events-none transition-colors"
          title={totalCount <= 1 ? 'Cannot delete the only page' : 'Delete this page'}
          aria-label="Delete this page"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function OrganizePagesModal({
  isOpen,
  pages = [],
  activePage = 1,
  pdfDoc,
  sourcePdfDocs = {},
  onClose,
  onSelectPage,
  onMovePage,
  onRotatePage,
  onDeletePage,
  onAddBlankPage,
}) {
  if (!isOpen) return null;

  const handleSelectAndClose = (pageNum) => {
    onSelectPage(pageNum);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[88vh] bg-[#101520] border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/[0.08] bg-slate-900/60 select-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <LayoutGrid size={18} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Organize Pages</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                  {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Reorder, rotate, delete, or add pages. Click any thumbnail to jump to it.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Add Blank Page Button */}
            <button
              type="button"
              onClick={onAddBlankPage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 active:scale-95 transition-all"
              title="Add a new blank page to the document"
            >
              <Plus size={14} />
              <span>Add Blank Page</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Close Organize Pages"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Page Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((page, index) => {
              const doc = page.sourceDocId && sourcePdfDocs[page.sourceDocId]
                ? sourcePdfDocs[page.sourceDocId]
                : pdfDoc;

              return (
                <PageThumbnailCard
                  key={page.id}
                  page={page}
                  index={index}
                  totalCount={pages.length}
                  pdfDoc={doc}
                  isActive={activePage === index + 1}
                  onSelect={handleSelectAndClose}
                  onMoveUp={(id) => onMovePage(id, 'up')}
                  onMoveDown={(id) => onMovePage(id, 'down')}
                  onRotate={onRotatePage}
                  onDelete={onDeletePage}
                />
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t border-white/[0.08] bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span className="hidden sm:inline">
            Tip: Use the arrow buttons on each card to change page order.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80 active:scale-95 transition-all"
            >
              <Check size={14} />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
