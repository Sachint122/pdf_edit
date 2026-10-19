/**
 * UploadScreen Component
 * Single unified drag-and-drop file upload and picker for PDF and Images,
 * with automatic OCR text detection and clean, simple user feedback.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  FileUp,
  FileText,
  Sparkles,
  ShieldCheck,
  Layers,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';

export function UploadScreen({
  onFileSelect,
  onLoadSample,
  loading = false,
  loadingMessage = '',
  error = null,
  onClearError,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const triggerFileBrowser = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-[#0f141c]">
      <div className="w-full max-w-2xl bg-[#131924]/90 border border-white/[0.08] rounded-2xl p-6 md:p-10 shadow-2xl backdrop-blur-md flex flex-col items-center gap-6 text-center">
        {/* Header Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-xs">
            <FileText size={26} />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Frontend-Only PDF & Image Editor
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Open, inspect, and edit PDF documents and images locally in your browser with zero server uploads.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-left">
            <AlertCircle size={18} className="flex-shrink-0 text-red-400" />
            <div className="flex-1 font-medium">{error}</div>
            {onClearError && (
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-white/10 text-red-300 hover:text-white transition-colors"
                onClick={onClearError}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Single Dropzone Box */}
        <div
          className={`w-full border-2 border-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/70'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileBrowser}
        >
          {/* Only ONE upload input for both PDF and Image files */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-2">
              <Loader2 size={40} className="animate-spin text-blue-500 mb-3" />
              <div className="text-base font-bold text-white mb-1">
                {loadingMessage || 'Loading document...'}
              </div>
              <div className="text-xs text-slate-400">
                Please wait a moment...
              </div>
            </div>
          ) : (
            <>
              <FileUp className="w-11 h-11 text-slate-400 mb-1" />
              <div className="text-base font-bold text-white">
                Drag and drop your PDF or Image here, or click to browse
              </div>
              <div className="text-xs text-slate-400">
                Supports standard PDF documents and images (PNG, JPG, WebP)
              </div>

              <div className="flex items-center gap-3 mt-4 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/25 active:scale-98 transition-all"
                  onClick={triggerFileBrowser}
                  disabled={loading}
                >
                  <FileUp size={14} />
                  <span>Upload PDF or Image</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 active:scale-98 transition-all"
                  onClick={onLoadSample}
                  disabled={loading}
                  title="Generate a local multi-page sample PDF"
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Load Sample PDF</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Privacy & Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left mt-2">
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/[0.06] flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>100% Client-Side</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-normal">
              Zero backend or cloud storage. Files and OCR stay in your browser.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/[0.06] flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sparkles size={15} className="text-amber-400" />
              <span>Text Detection (OCR)</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-normal">
              Automatically detects text in images so you can click, edit, and export.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/[0.06] flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Layers size={15} className="text-cyan-400" />
              <span>Multi-Page View</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-normal">
              Accurate page previews, thumbnails, and high-DPR canvas scaling.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UploadScreen;
