/**
 * DocumentFlowEditor Component (Mode 2: Document Flow Editor)
 * Provides an intuitive, Word-like / Google Docs-like editing surface
 * where paragraphs naturally expand, wrap, and flow across pages.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Plus,
  Trash2,
  Bold,
  Italic,
  List,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { DocumentModel } from '../features/document-model/documentModel.js';
import { FlowLayoutEngine } from '../features/layout/flowLayoutEngine.js';

export function DocumentFlowEditor({
  allBlocks = [],
  fileName = 'Document.pdf',
  onSwitchToOriginal,
  onExportFlowPdf,
}) {
  // Parse document model from raw PDF blocks
  const initialModel = useMemo(() => {
    return DocumentModel.parseFromPdfBlocks(allBlocks);
  }, [allBlocks]);

  const [sections, setSections] = useState(() => initialModel.sections || []);
  const [activeItemId, setActiveItemId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);

  // Auto-resize textareas based on content
  const adjustTextareaHeight = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleUpdateItemText = (secId, itemId, newText) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          items: sec.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, text: newText };
          }),
        };
      })
    );
  };

  const handleUpdateHeadingText = (secId, newTitle) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          title: newTitle,
          headingElement: sec.headingElement
            ? { ...sec.headingElement, text: newTitle }
            : null,
        };
      })
    );
  };

  const handleToggleStyle = (secId, itemId, property) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          items: sec.items.map((item) => {
            if (item.id !== itemId) return item;
            const curVal = item.style?.[property];
            return {
              ...item,
              style: {
                ...item.style,
                [property]: !curVal,
              },
            };
          }),
        };
      })
    );
  };

  const handleAddParagraph = (secId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        const newId = `para-new-${Date.now()}`;
        return {
          ...sec,
          items: [
            ...sec.items,
            {
              id: newId,
              type: 'paragraph',
              text: 'Type your new paragraph text here...',
              style: {
                fontSize: 11,
                fontFamily: 'Helvetica',
                color: '#334155',
                isBold: false,
                isItalic: false,
                textAlign: 'left',
              },
            },
          ],
        };
      })
    );
  };

  const handleAddBulletItem = (secId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        const newId = `bullet-new-${Date.now()}`;
        return {
          ...sec,
          items: [
            ...sec.items,
            {
              id: newId,
              type: 'list_item',
              text: 'New bullet list point...',
              style: {
                fontSize: 10.5,
                fontFamily: 'Helvetica',
                color: '#334155',
                isBold: false,
                isItalic: false,
                textAlign: 'left',
              },
            },
          ],
        };
      })
    );
  };

  const handleDeleteItem = (secId, itemId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          items: sec.items.filter((item) => item.id !== itemId),
        };
      })
    );
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const pdfBytes = await FlowLayoutEngine.exportFlowToPdf(sections);
      if (typeof onExportFlowPdf === 'function') {
        onExportFlowPdf(pdfBytes);
      } else {
        // Fallback browser download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace(/\.pdf$/i, '') + '-flow-edited.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setExportNotice('Document Flow PDF compiled and exported successfully!');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('Flow export error:', err);
      setExportNotice('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto">
      {/* Top Banner: Conversion & Layout Notice */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-500/30 px-6 py-3.5 shadow-md">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Document Flow Mode</span>
                <span className="px-2 py-0.5 text-[11px] font-medium bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  Word-Like Reflow
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Paragraphs automatically wrap and push downstream sections down. Notice: Complex multi-column graphic layouts may differ from the original 2D canvas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onSwitchToOriginal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Original PDF Mode
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Exporting...' : 'Export Flow PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Export status toast notice */}
      {exportNotice && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Main Flow Editor Workspace */}
      <div className="flex-1 py-8 px-4 flex justify-center">
        <div className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-2xl p-8 sm:p-14 min-h-[950px] border border-slate-200 flex flex-col">
          {sections.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No structured text detected in document flow.</p>
              <button
                type="button"
                onClick={onSwitchToOriginal}
                className="mt-4 px-4 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 font-medium"
              >
                Return to Original PDF Editor
              </button>
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.id} className="mb-8 group/sec">
                {/* Section Header */}
                {sec.headingElement && (
                  <div className="flex items-center justify-between mb-2.5 pb-1 border-b border-slate-200">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => handleUpdateHeadingText(sec.id, e.target.value)}
                      className="text-base sm:text-lg font-bold text-slate-900 tracking-tight bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full outline-none transition-colors"
                      placeholder="Section Title"
                    />
                    <div className="opacity-0 group-hover/sec:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleAddParagraph(sec.id)}
                        title="Add paragraph to section"
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBulletItem(sec.id)}
                        title="Add bullet item"
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 cursor-pointer"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Section Items */}
                <div className="space-y-3">
                  {sec.items.map((item) => {
                    const isBullet = item.type === 'list_item';
                    const isSelected = activeItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`group/item relative rounded-lg transition-all p-2 -mx-2 ${
                          isSelected
                            ? 'bg-indigo-50/70 ring-1 ring-indigo-300 shadow-sm'
                            : 'hover:bg-slate-50/80'
                        }`}
                        onClick={() => setActiveItemId(item.id)}
                      >
                        {/* Quick Format Floating Toolbar */}
                        {isSelected && (
                          <div className="absolute -top-7 right-2 flex items-center gap-0.5 bg-slate-900 text-white rounded-md px-1 py-0.5 shadow-lg text-[11px] z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStyle(sec.id, item.id, 'isBold');
                              }}
                              className={`p-1 rounded hover:bg-slate-800 ${item.style?.isBold ? 'text-indigo-400 font-bold' : 'text-slate-300'}`}
                              title="Toggle Bold"
                            >
                              <Bold className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStyle(sec.id, item.id, 'isItalic');
                              }}
                              className={`p-1 rounded hover:bg-slate-800 ${item.style?.isItalic ? 'text-indigo-400 italic' : 'text-slate-300'}`}
                              title="Toggle Italic"
                            >
                              <Italic className="w-3 h-3" />
                            </button>
                            <div className="w-px h-3 bg-slate-700 my-auto mx-0.5" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(sec.id, item.id);
                              }}
                              className="p-1 rounded hover:bg-red-900/50 text-red-400"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          {isBullet && (
                            <span className="text-slate-400 select-none font-bold mt-1 text-sm leading-none">•</span>
                          )}
                          <textarea
                            value={item.text}
                            onChange={(e) => {
                              handleUpdateItemText(sec.id, item.id, e.target.value);
                              adjustTextareaHeight(e.target);
                            }}
                            ref={(el) => adjustTextareaHeight(el)}
                            rows={1}
                            style={{
                              fontSize: `${item.style?.fontSize || 11}pt`,
                              fontWeight: item.style?.isBold ? 700 : 400,
                              fontStyle: item.style?.isItalic ? 'italic' : 'normal',
                              color: item.style?.color || '#334155',
                              textAlign: item.style?.textAlign || 'left',
                            }}
                            className="w-full bg-transparent resize-none outline-none leading-relaxed overflow-hidden font-sans"
                            placeholder="Paragraph content..."
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
