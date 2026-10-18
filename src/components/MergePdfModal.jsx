/**
 * MergePdfModal Component
 * Allows users to select another PDF from their computer to merge/append into the current document.
 */

import React, { useState, useRef } from 'react';
import { Files, UploadCloud, AlertCircle, X, Check, FileText } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { validatePdfFile, validatePdfHeader, readFileAsArrayBuffer } from '../utils/fileValidation.js';

export function MergePdfModal({
  isOpen,
  currentPageCount = 1,
  onClose,
  onMerge,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [position, setPosition] = useState('end'); // 'end' | 'start'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setLoading(false);
      return;
    }

    try {
      const buffer = await readFileAsArrayBuffer(file);
      if (!validatePdfHeader(buffer)) {
        setError('The selected file does not appear to be a valid PDF document.');
        setLoading(false);
        return;
      }

      const pdf = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
      const numPages = pdf.getPageCount();

      // Extract basic page sizes
      const pagesMeta = [];
      for (let i = 0; i < numPages; i++) {
        const page = pdf.getPage(i);
        const { width, height } = page.getSize();
        pagesMeta.push({
          pageNumber: i + 1,
          width,
          height,
          rotation: page.getRotation().angle || 0,
        });
      }

      setSelectedFile(file);
      setFileBuffer(buffer);
      setFileMeta({
        name: file.name,
        size: file.size,
        numPages,
        pagesMeta,
      });
      setLoading(false);
    } catch (err) {
      console.error('Failed to parse PDF for merge:', err);
      setError(err.message || 'Failed to inspect the selected PDF file.');
      setLoading(false);
    }
  };

  const handleConfirmMerge = () => {
    if (!fileBuffer || !fileMeta) return;

    onMerge({
      buffer: fileBuffer,
      fileName: fileMeta.name,
      numPages: fileMeta.numPages,
      pagesMeta: fileMeta.pagesMeta,
      position,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-md bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Files size={16} className="text-cyan-400" />
            <h3 className="font-semibold text-sm text-white">Merge PDF Document</h3>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Hidden Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {!selectedFile ? (
            <div
              className="border-2 border-dashed border-slate-700/80 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-900/40 hover:bg-slate-900/70 transition-all text-center min-h-[140px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={34} className="text-blue-400" />
              <div className="font-semibold text-sm text-white">
                {loading ? 'Analyzing PDF File...' : 'Select PDF to Merge'}
              </div>
              <div className="text-xs text-slate-400">
                Click to browse files (processed locally in browser memory)
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Selected File Card */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <FileText size={22} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {fileMeta.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {fileMeta.numPages} page{fileMeta.numPages > 1 ? 's' : ''} • {(fileMeta.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
                  onClick={() => {
                    setSelectedFile(null);
                    setFileBuffer(null);
                    setFileMeta(null);
                  }}
                >
                  Change
                </button>
              </div>

              {/* Placement Options */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Merge Placement</label>
                <select
                  className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors cursor-pointer"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="end">Append to End (After page {currentPageCount})</option>
                  <option value="start">Insert at Beginning (Before page 1)</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs mt-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
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
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:pointer-events-none shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
            onClick={handleConfirmMerge}
            disabled={!fileBuffer || loading}
          >
            <Check size={14} />
            <span>Merge Pages</span>
          </button>
        </div>
      </div>
    </div>
  );
}
