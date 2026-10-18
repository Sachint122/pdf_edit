/**
 * WatermarkModal Component
 * Configures document-level watermark and header/footer page numbers.
 */

import React, { useState } from 'react';
import { Stamp, Hash, X, Check } from 'lucide-react';
import { DEFAULT_WATERMARK_CONFIG, DEFAULT_PAGE_NUMBER_CONFIG } from '../features/advanced/watermarkManager.js';

export function WatermarkModal({
  isOpen,
  watermarkConfig = DEFAULT_WATERMARK_CONFIG,
  pageNumberConfig = DEFAULT_PAGE_NUMBER_CONFIG,
  onClose,
  onSave,
}) {
  const [activeTab, setActiveTab] = useState('watermark'); // 'watermark' | 'page-numbers'
  const [localWatermark, setLocalWatermark] = useState({ ...DEFAULT_WATERMARK_CONFIG, ...watermarkConfig });
  const [localPageNumbers, setLocalPageNumbers] = useState({ ...DEFAULT_PAGE_NUMBER_CONFIG, ...pageNumberConfig });

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      watermark: localWatermark,
      pageNumbers: localPageNumbers,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Stamp size={16} className="text-blue-400" />
            <h3 className="font-semibold text-sm text-white">Watermarks & Page Numbers</h3>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-white/[0.08] bg-slate-900/40 p-1.5 gap-1.5">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors relative ${
              activeTab === 'watermark'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
            onClick={() => setActiveTab('watermark')}
          >
            <Stamp size={13} />
            <span>Watermark</span>
            {localWatermark.enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors relative ${
              activeTab === 'page-numbers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
            onClick={() => setActiveTab('page-numbers')}
          >
            <Hash size={13} />
            <span>Page Numbers</span>
            {localPageNumbers.enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'watermark' && (
            <div className="flex flex-col gap-4">
              {/* Enable Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  checked={localWatermark.enabled}
                  onChange={(e) => setLocalWatermark((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                <span className="font-semibold text-xs text-white">Enable Watermark on Export</span>
              </label>

              {localWatermark.enabled && (
                <div className="flex flex-col gap-3.5">
                  {/* Text Input */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Watermark Text</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                      value={localWatermark.text}
                      onChange={(e) => setLocalWatermark((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="e.g. CONFIDENTIAL, DRAFT"
                    />
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {['CONFIDENTIAL', 'DRAFT', 'SAMPLE', 'COPY', 'ORIGINAL'].map((word) => (
                      <button
                        key={word}
                        type="button"
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        onClick={() => setLocalWatermark((prev) => ({ ...prev, text: word }))}
                      >
                        {word}
                      </button>
                    ))}
                  </div>

                  {/* Font Size & Opacity Slider */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Font Size ({localWatermark.fontSize}pt)</label>
                      <input
                        type="range"
                        min="24"
                        max="80"
                        step="2"
                        className="w-full accent-blue-500 cursor-pointer"
                        value={localWatermark.fontSize}
                        onChange={(e) => setLocalWatermark((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Opacity ({Math.round(localWatermark.opacity * 100)}%)</label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.8"
                        step="0.05"
                        className="w-full accent-blue-500 cursor-pointer"
                        value={localWatermark.opacity}
                        onChange={(e) => setLocalWatermark((prev) => ({ ...prev, opacity: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  {/* Angle & Color */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rotation</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        value={localWatermark.angle}
                        onChange={(e) => setLocalWatermark((prev) => ({ ...prev, angle: Number(e.target.value) }))}
                      >
                        <option value={-45}>Diagonal (-45°)</option>
                        <option value={0}>Horizontal (0°)</option>
                        <option value={45}>Diagonal (+45°)</option>
                        <option value={-90}>Vertical (-90°)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Color</label>
                      <input
                        type="color"
                        value={localWatermark.color}
                        onChange={(e) => setLocalWatermark((prev) => ({ ...prev, color: e.target.value }))}
                        className="w-full h-8 rounded-xl border border-slate-700 bg-transparent cursor-pointer p-0.5"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'page-numbers' && (
            <div className="flex flex-col gap-4">
              {/* Enable Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  checked={localPageNumbers.enabled}
                  onChange={(e) => setLocalPageNumbers((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                <span className="font-semibold text-xs text-white">Enable Page Numbers on Export</span>
              </label>

              {localPageNumbers.enabled && (
                <div className="flex flex-col gap-3.5">
                  {/* Format Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Numbering Format</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                      value={localPageNumbers.format}
                      onChange={(e) => setLocalPageNumbers((prev) => ({ ...prev, format: e.target.value }))}
                    >
                      <option value="Page {n} of {total}">Page 1 of 5</option>
                      <option value="{n} / {total}">1 / 5</option>
                      <option value="Page {n}">Page 1</option>
                      <option value="- {n} -">- 1 -</option>
                      <option value="{n}">1</option>
                    </select>
                  </div>

                  {/* Position Selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Position</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        value={localPageNumbers.position}
                        onChange={(e) => setLocalPageNumbers((prev) => ({ ...prev, position: e.target.value }))}
                      >
                        <option value="bottom-center">Bottom Center (Footer)</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-center">Top Center (Header)</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Color</label>
                      <input
                        type="color"
                        value={localPageNumbers.color}
                        onChange={(e) => setLocalPageNumbers((prev) => ({ ...prev, color: e.target.value }))}
                        className="w-full h-8 rounded-xl border border-slate-700 bg-transparent cursor-pointer p-0.5"
                      />
                    </div>
                  </div>

                  {/* Font Size & Margin */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Font Size ({localPageNumbers.fontSize}pt)</label>
                      <input
                        type="range"
                        min="8"
                        max="16"
                        step="1"
                        className="w-full accent-blue-500 cursor-pointer"
                        value={localPageNumbers.fontSize}
                        onChange={(e) => setLocalPageNumbers((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Edge Margin ({localPageNumbers.margin}pt)</label>
                      <input
                        type="range"
                        min="15"
                        max="50"
                        step="5"
                        className="w-full accent-blue-500 cursor-pointer"
                        value={localPageNumbers.margin}
                        onChange={(e) => setLocalPageNumbers((prev) => ({ ...prev, margin: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}
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
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
            onClick={handleSave}
          >
            <Check size={14} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
