/**
 * ExportModal Component
 * Progress indicator, export status, customizable filename, and download trigger.
 */

import React, { useState } from 'react';
import { Download, CheckCircle2, AlertCircle, Loader2, X, FileText } from 'lucide-react';

export function ExportModal({
  isOpen,
  isExporting = false,
  progress = { current: 0, total: 1, phase: '' },
  error = null,
  exportedBlob = null,
  defaultFilename = 'edited-document.pdf',
  onClose,
  onDownload,
  onRetry,
}) {
  const [filename, setFilename] = useState(defaultFilename);

  if (!isOpen) return null;

  const percent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={isExporting ? undefined : onClose}>
      <div className="w-full max-w-md bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <h3 className="font-semibold text-sm text-white">Export PDF</h3>
          </div>
          {!isExporting && (
            <button
              type="button"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {isExporting && (
            <div className="flex flex-col items-center text-center">
              <Loader2 size={40} className="animate-spin text-blue-500 mb-3" />
              <div className="font-bold text-sm text-white mb-1">
                Compiling Document...
              </div>
              <div className="text-xs text-slate-400 mb-4">
                {progress.phase || 'Applying edits and vector annotations'}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-2 font-mono">
                {percent}% Completed
              </div>
            </div>
          )}

          {!isExporting && error && (
            <div className="flex flex-col items-center text-center">
              <AlertCircle size={40} className="text-red-400 mb-3" />
              <div className="font-bold text-sm text-red-400 mb-1">
                Export Failed
              </div>
              <p className="text-xs text-slate-400 text-center mb-4 leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors"
                onClick={onRetry}
              >
                Try Again
              </button>
            </div>
          )}

          {!isExporting && !error && exportedBlob && (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
              <div className="font-semibold text-base text-white mb-1">
                Document Ready for Download
              </div>
              <div className="text-xs text-slate-400 mb-5">
                Size: <strong className="text-slate-200">{formatBytes(exportedBlob.size)}</strong> • 100% Client-Side Assembly
              </div>

              {/* Filename Input */}
              <div className="flex items-center gap-2.5 w-full">
                <label className="text-xs font-medium text-slate-300 flex-shrink-0">
                  File Name:
                </label>
                <input
                  type="text"
                  className="flex-1 bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-medium outline-none transition-colors"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="document.pdf"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5 bg-slate-900/50">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors"
            onClick={onClose}
            disabled={isExporting}
          >
            {exportedBlob ? 'Done' : 'Cancel'}
          </button>
          {!isExporting && exportedBlob && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
              onClick={() => onDownload(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)}
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
