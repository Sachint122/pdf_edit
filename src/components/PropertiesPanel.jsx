/**
 * PropertiesPanel Component
 * Contextual inspector for configuring active canvas objects (Text, Shapes, Images).
 */

import React, { useState } from 'react';
import {
  Type,
  Square,
  Image as ImageIcon,
  Trash2,
  Copy,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Info,
  FileEdit,
  Check,
  RotateCcw,
  X,
} from 'lucide-react';

function ContentEditSection({ selectedObject, onSaveContentEdit, onResetContentEdit, onClose }) {
  const [contentEditText, setContentEditText] = useState(selectedObject.text ?? '');
  const [contentColor, setContentColor] = useState(
    selectedObject.fill || selectedObject.block?.fill || selectedObject.block?.color || '#000000'
  );
  const originalText = selectedObject.originalText ?? '';
  const originalColor = selectedObject.block?.fill || selectedObject.block?.color || '#000000';
  const isModifiedFromOriginal = contentEditText !== originalText || contentColor !== originalColor;
  const isUnsaved = contentEditText !== (selectedObject.text ?? '') || contentColor !== (selectedObject.fill ?? originalColor);

  return (
    <aside className="fixed inset-x-0 bottom-0 max-h-[80vh] lg:static lg:max-h-none lg:w-72 h-full bg-[#131924] border-t lg:border-t-0 lg:border-l border-white/[0.08] flex flex-col flex-shrink-0 select-none z-40 shadow-2xl lg:shadow-none animate-in fade-in duration-200">
      {/* Mobile drawer handle */}
      <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-2.5 lg:hidden" />

      <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.08] text-xs font-semibold text-slate-200 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <FileEdit size={14} className="text-blue-400" />
          <span>Edit Content</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedObject.pageNumber && (
            <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-md">
              Page {selectedObject.pageNumber}
            </span>
          )}
          {onClose && (
            <button
              type="button"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={onClose}
              title="Close panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Scanned Typography & Color Preview */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2.5 text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">{selectedObject.block?.fontFamily || selectedObject.fontFamily || 'Helvetica'}</span>
              <span className="text-slate-500">•</span>
              <span className="font-medium text-slate-400">
                {Number(selectedObject.block?.rawFontSize || selectedObject.block?.fontSize || selectedObject.fontSize || 12).toFixed(1)} pt
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(selectedObject.block?.isBold || selectedObject.fontWeight === 'bold') && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Bold
                </span>
              )}
              {(selectedObject.block?.isItalic || selectedObject.fontStyle === 'italic') && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium italic bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  Italic
                </span>
              )}
              {!selectedObject.block?.isBold && !selectedObject.block?.isItalic && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  Regular
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
            <span className="text-slate-400 text-xs font-medium">Text Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                value={contentColor}
                onChange={(e) => setContentColor(e.target.value)}
                title="Exact scanned PDF text color (click to customize)"
              />
              <span className="text-xs font-mono text-slate-300 uppercase">{contentColor}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400" htmlFor="pdf-content-textarea">
              Text Content
            </label>
            {isUnsaved && (
              <span className="text-[11px] text-amber-400 font-medium">
                ● Unsaved
              </span>
            )}
          </div>
          <textarea
            id="pdf-content-textarea"
            className="w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-xl p-3 text-xs text-slate-100 font-sans outline-none focus:ring-1 focus:ring-blue-500/50 resize-y leading-relaxed transition-colors"
            value={contentEditText}
            onChange={(e) => setContentEditText(e.target.value)}
            placeholder="Edit content text..."
            rows={5}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/25 active:scale-98 transition-all"
            onClick={() => onSaveContentEdit?.(selectedObject, contentEditText, contentColor)}
            title="Save changes to document"
          >
            <Check size={14} />
            <span>Save</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 disabled:opacity-30 active:scale-98 transition-all"
            onClick={() => {
              setContentEditText(originalText);
              setContentColor(originalColor);
              onResetContentEdit?.(selectedObject);
            }}
            title="Reset back to original PDF text"
            disabled={!isModifiedFromOriginal && !isUnsaved}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function PropertiesPanel({
  selectedObject,
  activeTool,
  onUpdateProperty,
  onDeleteSelected,
  onDuplicateSelected,
  onSaveContentEdit,
  onResetContentEdit,
  onClose,
}) {
  if (!selectedObject) {
    return (
      <aside className="hidden lg:flex w-72 h-full bg-[#131924] border-l border-white/[0.08] flex-col flex-shrink-0 select-none">
        <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.08] text-xs font-semibold text-slate-300 bg-slate-900/50">
          <span>Properties</span>
        </div>
        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 flex-1 my-auto">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
            <Info size={22} className="text-slate-400" />
          </div>
          <div className="font-semibold text-xs text-slate-200 mb-1">No element selected</div>
          <p className="text-[11px] text-slate-400 text-center leading-relaxed max-w-[210px]">
            Click any text, shape, image, or signature on the page to inspect and customize its properties.
          </p>
          <div className="mt-5 text-[11px] font-medium text-slate-400 bg-slate-900/80 border border-white/[0.06] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>Active Tool:</span> <strong className="text-blue-400 font-semibold capitalize">{activeTool}</strong>
          </div>
        </div>
      </aside>
    );
  }

  // DIRECT PDF CONTENT EDIT MODE:
  // Clean, focused interface with one box for editing, one button for saving, and one button for resetting.
  if (selectedObject.isPdfContentEdit) {
    return (
      <ContentEditSection
        key={selectedObject.blockId}
        selectedObject={selectedObject}
        onSaveContentEdit={onSaveContentEdit}
        onResetContentEdit={onResetContentEdit}
        onClose={onClose}
      />
    );
  }

  const isText = selectedObject.type === 'textbox' || selectedObject.type === 'i-text';
  const isImage = selectedObject.type === 'image' || selectedObject.type === 'fabricImage';
  const isShape = !isText && !isImage;

  return (
    <aside className="fixed inset-x-0 bottom-0 max-h-[80vh] lg:static lg:max-h-none lg:w-72 h-full bg-[#131924] border-t lg:border-t-0 lg:border-l border-white/[0.08] flex flex-col flex-shrink-0 select-none z-40 shadow-2xl lg:shadow-none animate-in fade-in duration-200">
      {/* Header with Type & Delete */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.08] text-xs font-semibold text-slate-200 bg-slate-900/50">
        <div className="flex items-center gap-2">
          {isText && <Type size={14} className="text-blue-400" />}
          {isShape && <Square size={14} className="text-cyan-400" />}
          {isImage && <ImageIcon size={14} className="text-emerald-400" />}
          <span>{isText ? 'Text Box' : isImage ? 'Image' : 'Shape'}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={onDuplicateSelected}
            title="Duplicate Object"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            onClick={onDeleteSelected}
            title="Delete Object"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* TEXT SPECIFIC CONTROLS */}
        {isText && (
          <div className="flex flex-col gap-2.5 pb-4 border-b border-white/[0.06]">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Typography</label>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Font</span>
              <select
                className="flex-1 bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none transition-colors"
                value={selectedObject.fontFamily || 'Helvetica'}
                onChange={(e) => onUpdateProperty('fontFamily', e.target.value)}
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier">Courier</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Impact">Impact</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Size</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  className="w-16 bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-200 text-center outline-none transition-colors"
                  value={Math.round(selectedObject.fontSize || 18)}
                  min={8}
                  max={120}
                  onChange={(e) => onUpdateProperty('fontSize', parseInt(e.target.value, 10))}
                />
                <span className="text-[11px] text-slate-400">px</span>
              </div>
            </div>

            {/* Formatting Buttons */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Style</span>
              <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.fontWeight === 'bold' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() =>
                    onUpdateProperty('fontWeight', selectedObject.fontWeight === 'bold' ? 'normal' : 'bold')
                  }
                  title="Bold"
                >
                  <Bold size={13} />
                </button>
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.fontStyle === 'italic' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() =>
                    onUpdateProperty('fontStyle', selectedObject.fontStyle === 'italic' ? 'normal' : 'italic')
                  }
                  title="Italic"
                >
                  <Italic size={13} />
                </button>
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.underline ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => onUpdateProperty('underline', !selectedObject.underline)}
                  title="Underline"
                >
                  <Underline size={13} />
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Align</span>
              <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.textAlign === 'left' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => onUpdateProperty('textAlign', 'left')}
                  title="Align Left"
                >
                  <AlignLeft size={13} />
                </button>
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.textAlign === 'center' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => onUpdateProperty('textAlign', 'center')}
                  title="Align Center"
                >
                  <AlignCenter size={13} />
                </button>
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.textAlign === 'right' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => onUpdateProperty('textAlign', 'right')}
                  title="Align Right"
                >
                  <AlignRight size={13} />
                </button>
              </div>
            </div>

            {/* Text Color */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-7 h-7 rounded-md border border-slate-700 bg-transparent cursor-pointer p-0.5"
                  value={selectedObject.fill || '#0f172a'}
                  onChange={(e) => onUpdateProperty('fill', e.target.value)}
                />
                <span className="text-xs font-mono text-slate-400 uppercase">{selectedObject.fill || '#0f172a'}</span>
              </div>
            </div>
          </div>
        )}

        {/* SHAPE SPECIFIC CONTROLS */}
        {isShape && (
          <div className="flex flex-col gap-2.5 pb-4 border-b border-white/[0.06]">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fill & Stroke</label>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Fill</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-7 h-7 rounded-md border border-slate-700 bg-transparent cursor-pointer p-0.5"
                  value={
                    typeof selectedObject.fill === 'string' && selectedObject.fill.startsWith('#')
                      ? selectedObject.fill
                      : '#3b82f6'
                  }
                  onChange={(e) => onUpdateProperty('fill', e.target.value)}
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  onClick={() =>
                    onUpdateProperty('fill', selectedObject.fill === 'transparent' ? '#3b82f6' : 'transparent')
                  }
                >
                  {selectedObject.fill === 'transparent' ? 'Add Fill' : 'No Fill'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Stroke</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-7 h-7 rounded-md border border-slate-700 bg-transparent cursor-pointer p-0.5"
                  value={selectedObject.stroke || '#3b82f6'}
                  onChange={(e) => onUpdateProperty('stroke', e.target.value)}
                />
                <span className="text-xs font-mono text-slate-400 uppercase">{selectedObject.stroke || '#3b82f6'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Thickness</span>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="range"
                  min={1}
                  max={20}
                  className="flex-1 accent-blue-500 cursor-pointer"
                  value={selectedObject.strokeWidth || 2}
                  onChange={(e) => onUpdateProperty('strokeWidth', parseInt(e.target.value, 10))}
                />
                <span className="text-[11px] font-mono text-slate-400 w-8 text-right">
                  {selectedObject.strokeWidth || 2}px
                </span>
              </div>
            </div>
          </div>
        )}

        {/* COMMON OPACITY */}
        <div className="flex flex-col gap-2.5 pb-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Layer & Opacity</label>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300 w-16 flex-shrink-0">Opacity</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="range"
                min={10}
                max={100}
                className="flex-1 accent-blue-500 cursor-pointer"
                value={Math.round((selectedObject.opacity ?? 1) * 100)}
                onChange={(e) => onUpdateProperty('opacity', parseInt(e.target.value, 10) / 100)}
              />
              <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
                {Math.round((selectedObject.opacity ?? 1) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
