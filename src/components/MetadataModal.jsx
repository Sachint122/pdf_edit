/**
 * MetadataModal Component
 * Allows editing document metadata (Title, Author, Subject, Keywords) stored in the PDF header.
 */

import React, { useState, useEffect } from 'react';
import { Tag, X, Check } from 'lucide-react';
import { readPdfMetadata } from '../features/advanced/pdfMetadata.js';

export function MetadataModal({
  isOpen,
  rawBuffer,
  currentMetadata = null,
  onClose,
  onSave,
}) {
  const [metadata, setMetadata] = useState(() => ({
    title: currentMetadata?.title || '',
    author: currentMetadata?.author || '',
    subject: currentMetadata?.subject || '',
    keywords: Array.isArray(currentMetadata?.keywords)
      ? currentMetadata.keywords.join(', ')
      : (currentMetadata?.keywords || ''),
  }));

  useEffect(() => {
    if (!isOpen || currentMetadata || !rawBuffer) return;

    let isMounted = true;
    readPdfMetadata(rawBuffer).then((data) => {
      if (isMounted) {
        setMetadata({
          title: data.title || '',
          author: data.author || '',
          subject: data.subject || '',
          keywords: Array.isArray(data.keywords) ? data.keywords.join(', ') : '',
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, rawBuffer, currentMetadata]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title: metadata.title.trim(),
      author: metadata.author.trim(),
      subject: metadata.subject.trim(),
      keywords: metadata.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-md bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-blue-400" />
            <h3 className="font-semibold text-sm text-white">PDF Document Metadata</h3>
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
        <div className="p-5 flex flex-col gap-3.5">
          <p className="text-xs text-slate-400 leading-relaxed mb-1">
            Set standard metadata embedded into the exported PDF file header.
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Document Title</label>
              <input
                type="text"
                className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors"
                value={metadata.title}
                onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Annual Report 2026"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Author / Creator</label>
              <input
                type="text"
                className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors"
                value={metadata.author}
                onChange={(e) => setMetadata((prev) => ({ ...prev, author: e.target.value }))}
                placeholder="e.g. John Doe, ACME Corp"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subject / Description</label>
              <input
                type="text"
                className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors"
                value={metadata.subject}
                onChange={(e) => setMetadata((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g. Legal agreement regarding..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Keywords (comma separated)</label>
              <input
                type="text"
                className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors"
                value={metadata.keywords}
                onChange={(e) => setMetadata((prev) => ({ ...prev, keywords: e.target.value }))}
                placeholder="e.g. finance, contract, report"
              />
            </div>
          </div>
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
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
            onClick={handleSave}
          >
            <Check size={14} />
            <span>Save Metadata</span>
          </button>
        </div>
      </div>
    </div>
  );
}
