/**
 * TopToolbar Component
 * Modern, responsive toolbar built with Tailwind CSS.
 * Desktop / Laptop: Premium elevated command bar with glassmorphic islands, smooth typography, and zero collisions.
 * Mobile: Ultra-minimalist top bar with auto-full-width fit and a single animated Menu button opening a feature-packed drawer.
 */

import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  FileEdit,
  PenTool,
  Image as ImageIcon,
  PenLine,
  Undo2,
  Redo2,
  RotateCw,
  Download,
  Files,
  Keyboard,
  Menu,
  X,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

export function TopToolbar({
  fileName = 'Document.pdf',
  numPages = 1,
  activePage = 1,
  scale = 1.0,
  activeTool = 'edit-content',
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onRotateCurrentPage,
  onSelectPage,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onOpenFile,
  onSelectTool,
  onAddImage,
  onOpenSignatureModal,
  onOpenExport,
  onOpenMergeModal,
  onOpenOrganizeModal,
  onOpenShortcutsModal,
}) {
  const replaceFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePrevPage = () => {
    if (activePage > 1) {
      onSelectPage(activePage - 1);
    }
  };

  const handleNextPage = () => {
    if (activePage < numPages) {
      onSelectPage(activePage + 1);
    }
  };

  const handleZoomSelect = (e) => {
    const val = e.target.value;
    if (val === 'fit-width') {
      onFitWidth();
    } else if (val === 'fit-page') {
      onFitPage();
    } else {
      onZoomChange(parseFloat(val));
    }
  };

  const triggerOpenNew = () => {
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleNewFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onOpenFile(e.target.files[0]);
    }
  };

  const triggerImageUpload = () => {
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
      imageFileInputRef.current.click();
    }
  };

  const handleImageFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        onAddImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getShortName = (name) => {
    if (!name) return 'Document.pdf';
    const dotIdx = name.lastIndexOf('.');
    const ext = dotIdx !== -1 ? name.slice(dotIdx) : '';
    const base = dotIdx !== -1 ? name.slice(0, dotIdx) : name;
    if (base.length > 14) {
      return `${base.slice(0, 13)}…${ext}`;
    }
    return name;
  };

  const shortFileName = getShortName(fileName);

  return (
    <>
      {/* Hidden File Inputs */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleNewFile}
      />
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* Main Top Header */}
      <header className="h-14 bg-[#0d121c]/95 border-b border-white/[0.08] backdrop-blur-md px-3.5 lg:px-5 relative flex items-center justify-between select-none sticky top-0 z-40 shadow-xs">

        {/* ========================================================= */}
        {/* LAPTOP / DESKTOP VIEW (>= 768px): Upgraded Premium Studio Command Bar */}
        {/* ========================================================= */}

        {/* Left Segment: Document Identity, File Actions, Undo/Redo */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0 z-10">

          {/* Document Chip Badge */}
          <div
            className="flex items-center gap-2 bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 max-w-[200px] transition-colors"
            title={fileName}
          >
            <div className="w-5 h-5 rounded bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
              <FileText size={12} />
            </div>
            <span className="truncate">{shortFileName}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto flex-shrink-0" title="Document loaded" />
          </div>

          {/* Quick File Action Buttons (Segmented Capsule) */}
          <div className="flex items-center bg-slate-900/80 border border-slate-800/90 p-0.5 rounded-lg shadow-xs">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/90 transition-colors active:scale-98"
              onClick={triggerOpenNew}
              title="Open another PDF file from local storage"
            >
              <FolderOpen size={13} className="text-amber-400/90" />
              <span>Open</span>
            </button>

            <div className="h-3 w-px bg-slate-800" />

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/90 transition-colors active:scale-98"
              onClick={onOpenMergeModal}
              title="Merge another PDF into this document"
            >
              <Files size={13} className="text-cyan-400/90" />
              <span>Merge</span>
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/90 transition-colors active:scale-98"
              onClick={onOpenOrganizeModal}
              title="Organize Pages: Reorder, Delete, Rotate, and Add Pages"
            >
              <LayoutGrid size={13} className="text-indigo-400/90" />
              <span>Pages</span>
            </button>
          </div>

          {/* Undo / Redo Micro Capsule */}
          <div className="inline-flex items-center bg-slate-900/80 border border-slate-800/90 p-0.5 rounded-lg shadow-xs gap-0.5">
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/90 disabled:opacity-25 disabled:pointer-events-none transition-colors"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo last edit (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/90 disabled:opacity-25 disabled:pointer-events-none transition-colors"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo edit (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          </div>
        </div>

        {/* Center Segment: Hero Floating Studio Tool Dock (Always Geometrically Centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 bg-slate-900/90 border border-slate-800/90 p-1 rounded-xl shadow-lg shadow-black/30 backdrop-blur-md z-20">
          {/* Edit Content Tool */}
          <button
            type="button"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-98 ${activeTool === 'edit-content'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            onClick={() => onSelectTool('edit-content')}
            title="Direct In-Place PDF Content Editor (Click on existing text lines to edit)"
          >
            <FileEdit size={14} />
            <span>Edit Content</span>
          </button>

          {/* Freehand Pen */}
          <button
            type="button"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-98 ${activeTool === 'pen'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            onClick={() => onSelectTool(activeTool === 'pen' ? 'edit-content' : 'pen')}
            title="Freehand Drawing Pen Tool (P)"
          >
            <PenTool size={14} />
            <span>Pen</span>
          </button>

          {/* Insert Image */}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors active:scale-98"
            onClick={triggerImageUpload}
            title="Insert Image (PNG, JPG, WebP)"
          >
            <ImageIcon size={14} className="text-slate-400 group-hover:text-white" />
            <span>Image</span>
          </button>

          {/* Add Signature */}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors active:scale-98"
            onClick={onOpenSignatureModal}
            title="Draw or Upload Handwritten Signature"
          >
            <PenLine size={14} className="text-slate-400 group-hover:text-white" />
            <span>Signature</span>
          </button>
        </div>

        {/* Right Segment: Navigation, Precision Zoom & Export Action */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0 ml-auto z-10">
          {/* Page Navigation Capsule: Backward and Next Buttons */}
          <div className="inline-flex items-center gap-1 bg-slate-900/80 border border-slate-800/90 rounded-lg p-0.5 text-xs text-slate-300 shadow-xs">
            <button
              type="button"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              onClick={handlePrevPage}
              disabled={activePage <= 1}
              title="Backward Page (Previous)"
              aria-label="Backward Page"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="text-slate-300 text-xs font-semibold px-2 tabular-nums">
              {activePage} / {numPages}
            </span>

            <button
              type="button"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              onClick={handleNextPage}
              disabled={activePage >= numPages}
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight size={15} />
            </button>

            <div className="h-3 w-px bg-slate-800 mx-0.5" />

            {/* Rotate Page 90° */}
            <button
              type="button"
              className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
              onClick={onRotateCurrentPage}
              title="Rotate Current Page 90° Clockwise"
            >
              <RotateCw size={13} />
            </button>
          </div>

          {/* Zoom Controls & Fit Width Capsule */}
          <div className="inline-flex items-center bg-slate-900/80 border border-slate-800/90 rounded-lg p-0.5 text-xs text-slate-300 shadow-xs gap-0.5">
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              onClick={() => onZoomChange(Math.max(0.4, Number((scale - 0.15).toFixed(2))))}
              disabled={scale <= 0.4}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>

            

            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              onClick={() => onZoomChange(Math.min(3.0, Number((scale + 0.15).toFixed(2))))}
              disabled={scale >= 3.0}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>

            <div className="h-3 w-px bg-slate-800 mx-0.5" />

            {/* Fit Width Button */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors active:scale-98"
              onClick={onFitWidth}
              title="Fit to Workspace Width"
            >
              <Maximize2 size={12} className="text-cyan-400" />
              <span>Fit Width</span>
            </button>
          </div>

          {/* Keyboard Shortcuts Button */}
          <button
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800/90 transition-colors shadow-xs"
            onClick={onOpenShortcutsModal}
            title="Keyboard Shortcuts Cheat-Sheet (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard size={14} />
          </button>

          {/* Primary Export Action */}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
            onClick={onOpenExport}
            title="Export and Download Edited PDF (Ctrl+S)"
          >
            <Download size={13} />
            <span>Export PDF</span>
          </button>
        </div>


        {/* ========================================================= */}
        {/* MOBILE VIEW (< 768px): Fit Width, Export & Animated Menu */}
        {/* ========================================================= */}

        {/* Mobile Left: File badge + Backward & Next buttons with Page Counter */}
        <div className="flex md:hidden items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 max-w-[110px] truncate"
            title={fileName}
          >
            <FileText size={13} className="text-blue-400 flex-shrink-0" />
            <span className="truncate">{shortFileName}</span>
          </div>

          <div className="inline-flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 shadow-xs">
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              onClick={handlePrevPage}
              disabled={activePage <= 1}
              title="Backward Page"
              aria-label="Backward Page"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="text-[11px] font-bold text-slate-300 px-1.5 tabular-nums">
              {activePage}/{numPages}
            </span>

            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              onClick={handleNextPage}
              disabled={activePage >= numPages}
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Mobile Right: Fit Width + Export + Single Menu Button */}
        <div className="flex md:hidden items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 hover:bg-cyan-900/50 active:scale-95 transition-all shadow-xs"
            onClick={onFitWidth}
            title="Fit Full Device Width (Auto Width)"
            aria-label="Fit Full Device Width"
          >
            <Maximize2 size={13} />
            <span>Fit</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 active:scale-95 transition-all"
            onClick={onOpenExport}
            title="Export PDF"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
            aria-label="Open Tools Menu"
            title="Open Tools & Options"
          >
            <Menu size={17} />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* COOL ANIMATED MOBILE MENU LIST (Drawer / Modal) */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Animated Menu Card */}
          <div
            className="relative z-10 bg-slate-900 border-t border-slate-700/80 rounded-t-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Indicator & Header */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">Tools & Controls</h3>
                    <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{fileName}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 text-slate-300 flex items-center justify-center transition-colors"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Screen Fit Action on Mobile */}
            <button
              type="button"
              onClick={() => {
                onFitWidth();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 border border-blue-500/40 text-left active:scale-98 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30">
                  <Maximize2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Fit Full Screen Width</div>
                  <div className="text-[10px] text-blue-300">Automatically scale page to device edges</div>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-md">
                Fit Width
              </span>
            </button>

            {/* Section 1: Editing Mode */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Editing Tools
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Edit Text */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('edit-content');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${activeTool === 'edit-content'
                      ? 'bg-blue-600/25 border-blue-500/60 text-white shadow-md shadow-blue-500/15'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
                    }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <FileEdit size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight text-white">Edit Text</div>
                    <div className="text-[10px] text-slate-400">Direct In-Place</div>
                  </div>
                </button>

                {/* Pen Drawing */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool(activeTool === 'pen' ? 'edit-content' : 'pen');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${activeTool === 'pen'
                      ? 'bg-indigo-600/25 border-indigo-500/60 text-white shadow-md shadow-indigo-500/15'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
                    }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <PenTool size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight text-white">Pen Tool</div>
                    <div className="text-[10px] text-slate-400">Freehand Sketch</div>
                  </div>
                </button>

                {/* Insert Image */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    triggerImageUpload();
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 text-left transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight text-white">Add Image</div>
                    <div className="text-[10px] text-slate-400">Upload Photos</div>
                  </div>
                </button>

                {/* Signature */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSignatureModal();
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 text-left transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <PenLine size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight text-white">Signature</div>
                    <div className="text-[10px] text-slate-400">Draw or Sign</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Section 2: Navigation & Page Management */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Page Navigation
              </span>
              <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/60 rounded-2xl p-2.5">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={activePage <= 1}
                  className="p-2 rounded-xl bg-slate-700/60 text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Page {activePage} of {numPages}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={activePage >= numPages}
                  className="p-2 rounded-xl bg-slate-700/60 text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Page Extra Actions */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onRotateCurrentPage();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 active:scale-95 transition-all"
                >
                  <RotateCw size={14} className="text-amber-400" />
                  <span>Rotate 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenOrganizeModal?.();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 active:scale-95 transition-all"
                >
                  <LayoutGrid size={14} className="text-indigo-400" />
                  <span>Organize</span>
                </button>
              </div>
            </div>

            {/* Section 3: Document Actions (Undo, Redo, Open, Merge) */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Document History & File
              </span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={() => {
                    onUndo();
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] font-semibold text-slate-300 disabled:opacity-30 active:scale-95 transition-all"
                >
                  <Undo2 size={16} />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={() => {
                    onRedo();
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] font-semibold text-slate-300 disabled:opacity-30 active:scale-95 transition-all"
                >
                  <Redo2 size={16} />
                  <span>Redo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    triggerOpenNew();
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] font-semibold text-slate-300 active:scale-95 transition-all"
                >
                  <FolderOpen size={16} className="text-amber-400" />
                  <span>Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenMergeModal();
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] font-semibold text-slate-300 active:scale-95 transition-all"
                >
                  <Files size={16} className="text-cyan-400" />
                  <span>Merge</span>
                </button>
              </div>
            </div>

            {/* Primary Action Button: Export PDF */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setMobileMenuOpen(false);
                  const fn = onExport || onOpenExport;
                  if (typeof fn === 'function') fn();
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-blue-500/30 active:scale-98 transition-all disabled:opacity-75 disabled:pointer-events-none"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Exporting PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Export & Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
