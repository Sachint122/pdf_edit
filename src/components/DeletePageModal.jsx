/**
 * DeletePageModal Component
 * Confirmation dialog before removing a page from the document.
 */

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export function DeletePageModal({ isOpen, pageNumber, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-md bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            <h3 className="font-semibold text-sm text-white">Delete Page {pageNumber}?</h3>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-xs text-slate-300 leading-relaxed">
          <p>
            Are you sure you want to delete <strong className="text-white">Page {pageNumber}</strong>?
            This will remove the page and all annotations placed on it.
            You can restore it using Undo (Ctrl+Z).
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5 bg-slate-900/50">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-sm shadow-red-600/30 active:scale-98 transition-all"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Trash2 size={13} />
            <span>Delete Page</span>
          </button>
        </div>
      </div>
    </div>
  );
}
