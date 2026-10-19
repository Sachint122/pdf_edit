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
  AlignJustify,
  Link,
  Unlink,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react';

function ContentEditSection({ selectedObject, onSaveContentEdit, onResetContentEdit, onApplyAlignment, onClose }) {
  const isPara = Boolean(selectedObject.isParagraphMember && selectedObject.paraLines && selectedObject.paraLines.length > 1);
  const [editScope, setEditScope] = useState('paragraph'); // 'paragraph' | 'line'
  const [contentEditText, setContentEditText] = useState(selectedObject.text ?? '');
  const [contentColor, setContentColor] = useState(
    selectedObject.fill || selectedObject.block?.fill || selectedObject.block?.color || '#000000'
  );
  const [contentAlign, setContentAlign] = useState(selectedObject.textAlign || 'left');

  const detectedFontSize = Math.round(selectedObject.block?.rawFontSize || selectedObject.block?.fontSize || selectedObject.fontSize || 12);
  const detectedFontFamily = selectedObject.block?.fontFamily || selectedObject.fontFamily || 'Helvetica';
  const isDetectedBold = Boolean(selectedObject.block?.isBold || selectedObject.fontWeight === 'bold');
  const isDetectedItalic = Boolean(selectedObject.block?.isItalic || selectedObject.fontStyle === 'italic');

  const [contentLinkUrl, setContentLinkUrl] = useState(
    selectedObject.linkUrl || selectedObject.block?.linkUrl || ''
  );

  const handleAlignSelect = (align) => {
    setContentAlign(align);
    onApplyAlignment?.(align, editScope);
  };

  const originalText = editScope === 'line'
    ? (selectedObject.block?.originalStr || selectedObject.block?.str || '')
    : (selectedObject.originalText ?? '');
  const originalColor = selectedObject.block?.fill || selectedObject.block?.color || '#000000';
  const originalAlign = selectedObject.block?.textAlign || 'left';
  const originalLinkUrl = selectedObject.block?.linkUrl || selectedObject.originalLinkUrl || '';
  const currentBaselineText = editScope === 'line'
    ? (selectedObject.lineText ?? selectedObject.block?.str ?? '')
    : (selectedObject.text ?? '');

  const isUnsaved =
    contentEditText !== currentBaselineText ||
    contentColor !== (selectedObject.fill ?? originalColor) ||
    contentAlign !== (selectedObject.textAlign ?? 'left') ||
    contentLinkUrl !== (selectedObject.linkUrl || '');

  return (
    <aside className="fixed inset-x-0 bottom-0 max-h-[80vh] lg:static lg:max-h-none lg:w-72 h-full bg-[#131924] border-t lg:border-t-0 lg:border-l border-white/[0.08] flex flex-col flex-shrink-0 select-none z-40 shadow-2xl lg:shadow-none animate-in fade-in duration-200">
      {/* Mobile drawer handle */}
      <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-2.5 lg:hidden" />

      <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.08] text-xs font-semibold text-slate-200 bg-slate-900/50">
        <div className="flex items-center gap-2">
          {isPara ? <AlignJustify size={14} className="text-emerald-400" /> : <FileEdit size={14} className="text-blue-400" />}
          <span>{isPara && editScope === 'paragraph' ? 'Edit Paragraph' : 'Edit Content'}</span>
        </div>
        <div className="flex items-center gap-2">
          {isPara && editScope === 'paragraph' && (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
              Paragraph ({selectedObject.paraLines.length} lines)
            </span>
          )}
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
        {/* Paragraph vs Single Line Scope Toggle */}
        {isPara && (
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-white/[0.08] text-xs gap-1 shadow-inner">
            <button
              type="button"
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${
                editScope === 'paragraph'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => {
                setEditScope('paragraph');
                setContentEditText(selectedObject.text ?? '');
              }}
            >
              <AlignJustify size={12} />
              <span>Full Paragraph</span>
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${
                editScope === 'line'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => {
                setEditScope('line');
                setContentEditText(selectedObject.lineText ?? selectedObject.block?.str ?? '');
              }}
            >
              <FileEdit size={12} />
              <span>Selected Line</span>
            </button>
          </div>
        )}

        {/* Text Alignment Controls */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2 text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Text Alignment</span>
            <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                className={`p-1.5 rounded-md transition-colors ${
                  contentAlign === 'left' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => handleAlignSelect('left')}
                title="Align Left"
                aria-label="Align Left"
              >
                <AlignLeft size={13} />
              </button>
              <button
                type="button"
                className={`p-1.5 rounded-md transition-colors ${
                  contentAlign === 'center' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => handleAlignSelect('center')}
                title="Align Center"
                aria-label="Align Center"
              >
                <AlignCenter size={13} />
              </button>
              <button
                type="button"
                className={`p-1.5 rounded-md transition-colors ${
                  contentAlign === 'right' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => handleAlignSelect('right')}
                title="Align Right"
                aria-label="Align Right"
              >
                <AlignRight size={13} />
              </button>
              <button
                type="button"
                className={`p-1.5 rounded-md transition-colors ${
                  contentAlign === 'justify' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => handleAlignSelect('justify')}
                title="Justify"
                aria-label="Justify"
              >
                <AlignJustify size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Preserved Document Typography & Text Color */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2.5 text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">Original Typography</span>
            <span className="text-xs font-medium text-slate-200 bg-slate-950/80 border border-slate-700/80 px-2 py-1 rounded-md">
              {detectedFontFamily === 'Times' ? 'Times New Roman' : detectedFontFamily === 'Courier' ? 'Courier New' : 'Helvetica'} • {detectedFontSize}pt
              {isDetectedBold ? ' • Bold' : ''}
              {isDetectedItalic ? ' • Italic' : ''}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
            <span className="text-slate-400 text-xs font-medium">Text Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                value={contentColor}
                onChange={(e) => setContentColor(e.target.value)}
                title="Exact document text color (click to customize)"
              />
              <span className="text-xs font-mono text-slate-300 uppercase">{contentColor}</span>
            </div>
          </div>
        </div>

        {/* Hyperlink Section */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2 text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 text-xs">
              <Link size={13} className="text-blue-400" />
              <span>Hyperlink</span>
            </div>
            {contentLinkUrl && (
              <div className="flex items-center gap-1">
                <a
                  href={contentLinkUrl.startsWith('http') || contentLinkUrl.startsWith('mailto:') ? contentLinkUrl : `https://${contentLinkUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-md text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                  title="Test link in new tab"
                >
                  <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  className="p-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  onClick={() => setContentLinkUrl('')}
                  title="Remove hyperlink"
                >
                  <Unlink size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="url"
              className="flex-1 bg-slate-950/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
              placeholder="https://example.com"
              value={contentLinkUrl}
              onChange={(e) => setContentLinkUrl(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            {contentLinkUrl ? 'Text will be clickable in the exported PDF.' : 'Assign a URL to make this text clickable in the PDF.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400" htmlFor="pdf-content-textarea">
              {isPara && editScope === 'paragraph' ? 'Paragraph Text' : 'Line Text'}
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
            rows={isPara && editScope === 'paragraph' ? 6 : 3}
            autoFocus
          />
          {isPara && editScope === 'paragraph' && (
            <p className="text-[10px] text-emerald-400/90 flex items-center gap-1 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
              <span>✦</span>
              <span>Auto-reflow active: Text wraps across all {selectedObject.paraLines.length} lines with no empty gaps.</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/25 active:scale-98 transition-all"
            onClick={() => onSaveContentEdit?.(
              selectedObject,
              contentEditText,
              contentColor,
              editScope,
              contentAlign,
              contentLinkUrl
            )}
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
              setContentAlign(originalAlign);
              setContentLinkUrl(originalLinkUrl);
              onResetContentEdit?.(selectedObject);
            }}
            title="Reset back to original document text"
            disabled={!isUnsaved}
          >
            <RotateCcw size={14} />
            <span>Discard</span>
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
  onApplyAlignment,
  onOcrImage,
  onClose,
}) {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState(null);

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
  // Clean, focused interface with alignment, typography, text edit, and save/reset.
  if (selectedObject.isPdfContentEdit) {
    return (
      <ContentEditSection
        key={selectedObject.paraId || selectedObject.blockId}
        selectedObject={selectedObject}
        onSaveContentEdit={onSaveContentEdit}
        onResetContentEdit={onResetContentEdit}
        onApplyAlignment={onApplyAlignment}
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
                <button
                  type="button"
                  className={`p-1 rounded-md transition-colors ${
                    selectedObject.textAlign === 'justify' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => onUpdateProperty('textAlign', 'justify')}
                  title="Justify"
                >
                  <AlignJustify size={13} />
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

            {/* Hyperlink Section for Textbox */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-slate-300 text-xs">
                  <Link size={12} className="text-blue-400" />
                  <span>Hyperlink</span>
                </div>
                {selectedObject.linkUrl && (
                  <div className="flex items-center gap-1">
                    <a
                      href={selectedObject.linkUrl.startsWith('http') || selectedObject.linkUrl.startsWith('mailto:') ? selectedObject.linkUrl : `https://${selectedObject.linkUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                      title="Test link in new tab"
                    >
                      <ExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      className="p-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      onClick={() => onUpdateProperty('linkUrl', '')}
                      title="Remove hyperlink"
                    >
                      <Unlink size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  className="flex-1 bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
                  placeholder="https://example.com"
                  value={selectedObject.linkUrl || ''}
                  onChange={(e) => onUpdateProperty('linkUrl', e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {selectedObject.linkUrl ? 'Clickable link enabled in exported PDF.' : 'Assign a URL to make this text clickable in the PDF.'}
              </p>
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

        {/* IMAGE SPECIFIC CONTROLS & OCR */}
        {isImage && (
          <div className="flex flex-col gap-2.5 pb-4 border-b border-white/[0.06]">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Image & OCR Text</label>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Sparkles size={14} className="text-amber-400" />
                <span>Text Detection (OCR)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Scan this image to detect text and convert it into editable text layers directly on top of the image.
              </p>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs shadow-blue-600/30 active:scale-98 transition-all disabled:opacity-50"
                onClick={async () => {
                  if (typeof onOcrImage === 'function') {
                    try {
                      setOcrLoading(true);
                      setOcrError(null);
                      await onOcrImage(selectedObject);
                    } catch (err) {
                      setOcrError(err?.message || 'Failed to detect text in image.');
                    } finally {
                      setOcrLoading(false);
                    }
                  }
                }}
                disabled={ocrLoading}
              >
                {ocrLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-white" />
                    <span>Detecting Text...</span>
                  </>
                ) : (
                  <>
                    <FileEdit size={13} />
                    <span>Detect & Edit Image Text</span>
                  </>
                )}
              </button>
              {ocrError && (
                <div className="text-[11px] text-red-400 mt-1 font-medium bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                  {ocrError}
                </div>
              )}
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
