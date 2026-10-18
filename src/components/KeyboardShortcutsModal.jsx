/**
 * KeyboardShortcutsModal Component
 * Interactive modal displaying all available keyboard shortcuts for Phase 6 polish.
 */

import React from 'react';
import { Keyboard, X } from 'lucide-react';

export function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    {
      category: 'History & Editing',
      items: [
        { keys: [`${modKey}`, 'Z'], description: 'Undo last editing or page action' },
        { keys: [`${modKey}`, 'Y'], description: 'Redo last undone action' },
        { keys: [`${modKey}`, 'Shift', 'Z'], description: 'Redo (alternative)' },
        { keys: ['Delete'], description: 'Delete currently selected object' },
        { keys: ['Backspace'], description: 'Delete currently selected object' },
      ],
    },
    {
      category: 'Tools & Content Editing',
      items: [
        { keys: ['E'], description: 'Toggle Direct PDF Content Edit mode (Click on existing PDF text)' },
        { keys: ['V'], description: 'Select / Move tool' },
        { keys: ['T'], description: 'Add new text box' },
        { keys: ['P'], description: 'Freehand pen drawing' },
        { keys: ['H'], description: 'Highlighter' },
      ],
    },
    {
      category: 'File & Document',
      items: [
        { keys: [`${modKey}`, 'S'], description: 'Open Export / Download PDF dialog' },
        { keys: ['Escape'], description: 'Deselect active object or close open modal' },
        { keys: ['?'], description: 'Open this Keyboard Shortcuts cheat-sheet' },
      ],
    },
    {
      category: 'Navigation & View',
      items: [
        { keys: ['Page Up'], description: 'Scroll to previous page' },
        { keys: ['Page Down'], description: 'Scroll to next page' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-blue-400" />
            <h3 className="font-semibold text-sm text-white">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={onClose}
            aria-label="Close shortcuts modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {group.category}
              </div>

              <div className="flex flex-col gap-2 bg-slate-900/50 border border-white/[0.06] rounded-xl p-3">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-slate-300">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="bg-slate-800 border border-slate-700/80 shadow-xs rounded px-2 py-0.5 text-[11px] font-mono font-medium text-slate-200"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end bg-slate-900/50">
          <button
            type="button"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
