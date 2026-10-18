/**
 * EditorLayout Component
 * Primary workspace layout housing TopToolbar, PageSidebar, PropertiesPanel,
 * DeletePageModal, and continuous PDF pages with Undo/Redo history.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TopToolbar } from './TopToolbar.jsx';
import { PropertiesPanel } from './PropertiesPanel.jsx';
import { PdfPage } from './PdfPage.jsx';
import { extractObjectProperties } from '../utils/objectProperties.js';
import { loadPdfDocument } from '../features/pdf-viewer/pdfLoader.js';
import { SignatureModal } from './SignatureModal.jsx';
import { DeletePageModal } from './DeletePageModal.jsx';
import { addTextBox } from '../features/editing/textTools.js';
import {
  addRectangle,
  addCircle,
  addLine,
  addArrow,
} from '../features/editing/shapeTools.js';
import { addImageFromDataUrl } from '../features/editing/imageTools.js';
import { addSignature } from '../features/editing/signatureTools.js';
import {
  initializePagesState,
  rotatePage,
  movePage,
  deletePage,
  addBlankPage,
} from '../features/page-management/pageOperations.js';
import { useEditorHistory } from '../hooks/useEditorHistory.js';
import { exportModifiedPdf } from '../features/export/exportPdf.js';
import { downloadBlob } from '../utils/downloadFile.js';
import { WatermarkModal } from './WatermarkModal.jsx';
import { MergePdfModal } from './MergePdfModal.jsx';
import { OrganizePagesModal } from './OrganizePagesModal.jsx';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal.jsx';
import { DEFAULT_WATERMARK_CONFIG, DEFAULT_PAGE_NUMBER_CONFIG } from '../features/advanced/watermarkManager.js';

export function EditorLayout({
  pdfDoc,
  fileName,
  rawBuffer,
  pagesMeta = [],
  onOpenFile,
}) {
  // Document Pages State with stable IDs
  const [pages, setPages] = useState(() => initializePagesState(pagesMeta));

  // Scale state: on mobile, initialize directly to fit device screen width (100% full width)
  const [scale, setScale] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const w = window.innerWidth - 16;
      const initialPageWidth = pagesMeta?.[0]?.width || 612;
      return Number(Math.min(2.5, Math.max(0.2, w / initialPageWidth)).toFixed(2));
    }
    return 1.0;
  });
  const [activePage, setActivePage] = useState(1);
  const [activeTool, setActiveTool] = useState('edit-content'); // 'edit-content' | 'pen'
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Phase 5 Advanced Features State
  const [watermarkModalOpen, setWatermarkModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [organizeModalOpen, setOrganizeModalOpen] = useState(false);
  const [watermarkConfig, setWatermarkConfig] = useState(DEFAULT_WATERMARK_CONFIG);
  const [pageNumberConfig, setPageNumberConfig] = useState(DEFAULT_PAGE_NUMBER_CONFIG);
  const [sourceBuffers, setSourceBuffers] = useState({});
  const [sourcePdfDocs, setSourcePdfDocs] = useState({});

  // Direct PDF Export state
  const [isExporting, setIsExporting] = useState(false);
  const [_exportProgress, setExportProgress] = useState({ current: 0, total: 1, phase: '' });

  // Delete page modal state
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    pageId: null,
    pageNumber: 1,
  });

  // Per-page serialized canvas state { [pageId]: fabricJson }
  const [pageEdits, setPageEdits] = useState({});

  // Active selected object and its host canvas
  const [selectedObjectProps, setSelectedObjectProps] = useState(null);
  const selectedCanvasRef = useRef(null);

  // Registry of mounted Fabric canvas instances by pageId
  const canvasRegistryRef = useRef(new Map());
  const workspaceRef = useRef(null);

  // Undo / Redo History Hook
  const {
    canUndo,
    canRedo,
    recordChange,
    undo,
    redo,
  } = useEditorHistory();

  const registerCanvas = useCallback((pageId, canvasInstance) => {
    canvasRegistryRef.current.set(pageId, canvasInstance);
  }, []);

  const unregisterCanvas = useCallback((pageId) => {
    canvasRegistryRef.current.delete(pageId);
    if (selectedCanvasRef.current === canvasRegistryRef.current.get(pageId)) {
      selectedCanvasRef.current = null;
      setSelectedObjectProps(null);
    }
  }, []);

  const handlePageEditsChange = useCallback((pageId, json) => {
    setPageEdits((prev) => ({
      ...prev,
      [pageId]: json,
    }));
  }, []);

  // Selection handlers
  const handleObjectSelected = useCallback((pageId, props, canvasInstance) => {
    selectedCanvasRef.current = canvasInstance;
    setSelectedObjectProps(props);
    const index = pages.findIndex((p) => p.id === pageId);
    if (index !== -1) {
      setActivePage(index + 1);
    }
  }, [pages]);

  const handleObjectDeselected = useCallback(() => {
    setSelectedObjectProps(null);
  }, []);

  // Smoothly scroll workspace to target page number
  const scrollToPage = useCallback((pageNum) => {
    setActivePage(pageNum);
    const targetEl = document.getElementById(`page-container-${pageNum}`);
    if (targetEl && workspaceRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Zoom to Fit Workspace Width (Automatic Full Width on mobile)
  const handleFitWidth = useCallback(() => {
    if (pages.length === 0) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // On mobile devices, use minimal margin (16px) so PDF spans 100% full width of the mobile device
    const margin = isMobile ? 16 : 64;
    const clientW =
      workspaceRef.current?.clientWidth && workspaceRef.current.clientWidth > 100
        ? workspaceRef.current.clientWidth
        : typeof window !== 'undefined'
          ? window.innerWidth
          : 612;
    const workspaceWidth = Math.max(200, clientW - margin);
    const pageWidth = pages[0]?.width || 612;
    const computedScale = Math.min(2.5, Math.max(0.2, workspaceWidth / pageWidth));
    setScale(Number(computedScale.toFixed(2)));
  }, [pages]);

  // Zoom to Fit Workspace Height
  const handleFitPage = useCallback(() => {
    if (!workspaceRef.current || pages.length === 0) return;
    const workspaceHeight = workspaceRef.current.clientHeight - 80;
    const pageHeight = pages[0]?.height || 792;
    const computedScale = Math.min(2.0, Math.max(0.4, workspaceHeight / pageHeight));
    setScale(Number(computedScale.toFixed(2)));
  }, [pages]);

  const handlePageVisible = useCallback((pageNum) => {
    setActivePage(pageNum);
  }, []);

  // Auto-fit full device width on mobile viewports on load, pages change, and window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const autoFitMobile = () => {
      if (window.innerWidth < 768) {
        handleFitWidth();
      }
    };
    autoFitMobile();
    const timer = setTimeout(autoFitMobile, 120);
    window.addEventListener('resize', autoFitMobile);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', autoFitMobile);
    };
  }, [handleFitWidth, pages]);

  // Helper to get active Fabric canvas
  const getActiveCanvas = useCallback(() => {
    const currentPageObj = pages[activePage - 1];
    if (!currentPageObj) return null;
    return canvasRegistryRef.current.get(currentPageObj.id) || null;
  }, [activePage, pages]);

  // ==========================================
  // UNDO & REDO HANDLERS
  // ==========================================

  const handleUndo = useCallback(() => {
    const restored = undo({ pages, pageEdits });
    if (restored) {
      if (restored.pages) setPages(restored.pages);
      if (restored.pageEdits) setPageEdits(restored.pageEdits);
      setSelectedObjectProps(null);
    }
  }, [undo, pages, pageEdits]);

  const handleRedo = useCallback(() => {
    const restored = redo({ pages, pageEdits });
    if (restored) {
      if (restored.pages) setPages(restored.pages);
      if (restored.pageEdits) setPageEdits(restored.pageEdits);
      setSelectedObjectProps(null);
    }
  }, [redo, pages, pageEdits]);

  // ==========================================
  // PAGE MANAGEMENT OPERATIONS
  // ==========================================

  // 1. Rotate Page
  const handleRotatePage = useCallback((pageId) => {
    recordChange({ pages, pageEdits });
    setPages((prevPages) => rotatePage(prevPages, pageId, 'cw'));
  }, [pages, pageEdits, recordChange]);

  // 2. Rotate Current Active Page
  const handleRotateCurrentPage = useCallback(() => {
    const currentPageObj = pages[activePage - 1];
    if (!currentPageObj) return;
    handleRotatePage(currentPageObj.id);
  }, [activePage, pages, handleRotatePage]);

  // 3. Move Page Up/Down
  const handleMovePage = useCallback((pageId, direction) => {
    recordChange({ pages, pageEdits });
    setPages((prevPages) => {
      const updated = movePage(prevPages, pageId, direction);
      const newIndex = updated.findIndex((p) => p.id === pageId);
      if (newIndex !== -1) {
        setActivePage(newIndex + 1);
      }
      return updated;
    });
  }, [pages, pageEdits, recordChange]);

  // 4. Delete Page Prompt
  const promptDeletePage = useCallback((pageId, pageNumber) => {
    if (pages.length <= 1) return;
    setDeleteModalState({
      isOpen: true,
      pageId,
      pageNumber,
    });
  }, [pages.length]);

  // 5. Confirm Delete Page
  const confirmDeletePage = useCallback(() => {
    const { pageId } = deleteModalState;
    if (!pageId) return;

    recordChange({ pages, pageEdits });

    const result = deletePage(pages, pageId);
    if (result.deleted) {
      setPages(result.pages);
      // Clean up edits for deleted page
      setPageEdits((prev) => {
        const next = { ...prev };
        delete next[pageId];
        return next;
      });

      // Adjust active page if needed
      setActivePage((prev) => Math.min(prev, result.pages.length));
    }
  }, [deleteModalState, pages, pageEdits, recordChange]);

  // 6. Add Blank Page
  const handleAddBlankPage = useCallback(() => {
    recordChange({ pages, pageEdits });
    const { pages: updatedPages, newPageId } = addBlankPage(pages, activePage);
    setPages(updatedPages);

    // Scroll to the new blank page
    const newPageIndex = updatedPages.findIndex((p) => p.id === newPageId);
    if (newPageIndex !== -1) {
      const newPageNum = newPageIndex + 1;
      setActivePage(newPageNum);
      setTimeout(() => scrollToPage(newPageNum), 50);
    }
  }, [pages, pageEdits, activePage, recordChange, scrollToPage]);

  // ==========================================
  // TOOL ACTIONS
  // ==========================================

  // 1. Add Text
  const handleAddText = useCallback(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    recordChange({ pages, pageEdits });
    const textObj = addTextBox(canvas);
    setActiveTool('select');
    if (textObj) {
      setSelectedObjectProps(extractObjectProperties(textObj));
      selectedCanvasRef.current = canvas;
    }
  }, [getActiveCanvas, pages, pageEdits, recordChange]);

  // 2. Add Shape
  const handleAddShape = useCallback(
    (shapeType) => {
      const canvas = getActiveCanvas();
      if (!canvas) return;

      recordChange({ pages, pageEdits });
      let shapeObj = null;
      if (shapeType === 'rectangle') {
        shapeObj = addRectangle(canvas);
      } else if (shapeType === 'circle') {
        shapeObj = addCircle(canvas);
      } else if (shapeType === 'line') {
        shapeObj = addLine(canvas);
      } else if (shapeType === 'arrow') {
        shapeObj = addArrow(canvas);
      }

      setActiveTool('select');
      if (shapeObj) {
        setSelectedObjectProps(extractObjectProperties(shapeObj));
        selectedCanvasRef.current = canvas;
      }
    },
    [getActiveCanvas, pages, pageEdits, recordChange]
  );

  // 3. Add Image
  const handleAddImage = useCallback(
    async (dataUrl) => {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      try {
        recordChange({ pages, pageEdits });
        const imgObj = await addImageFromDataUrl(canvas, dataUrl);
        setActiveTool('select');
        if (imgObj) {
          setSelectedObjectProps(extractObjectProperties(imgObj));
          selectedCanvasRef.current = canvas;
        }
      } catch (err) {
        console.error('Failed to add image:', err);
      }
    },
    [getActiveCanvas, pages, pageEdits, recordChange]
  );

  // 4. Add Signature
  const handleInsertSignature = useCallback(
    async (dataUrl) => {
      const canvas = getActiveCanvas();
      if (!canvas) return;
      try {
        recordChange({ pages, pageEdits });
        const sigObj = await addSignature(canvas, dataUrl);
        setActiveTool('select');
        if (sigObj) {
          setSelectedObjectProps(extractObjectProperties(sigObj));
          selectedCanvasRef.current = canvas;
        }
      } catch (err) {
        console.error('Failed to insert signature:', err);
      }
    },
    [getActiveCanvas, pages, pageEdits, recordChange]
  );

  // 5. Update Property from Properties Panel
  const handleUpdateProperty = useCallback((property, value) => {
    const canvas = selectedCanvasRef.current;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    recordChange({ pages, pageEdits });
    activeObj.set(property, value);
    canvas.renderAll();

    setSelectedObjectProps((prev) => ({
      ...prev,
      [property]: value,
    }));
  }, [pages, pageEdits, recordChange]);

  // 6. Delete Selected Object
  const handleDeleteSelected = useCallback(() => {
    const canvas = selectedCanvasRef.current;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    recordChange({ pages, pageEdits });
    canvas.remove(activeObj);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelectedObjectProps(null);
  }, [pages, pageEdits, recordChange]);

  // 7. Duplicate Selected Object
  const handleDuplicateSelected = useCallback(async () => {
    const canvas = selectedCanvasRef.current;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    try {
      recordChange({ pages, pageEdits });
      const cloned = await activeObj.clone();
      cloned.set({
        left: (cloned.left || 0) + 15,
        top: (cloned.top || 0) + 15,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      setSelectedObjectProps(extractObjectProperties(cloned));
    } catch (err) {
      console.error('Failed to duplicate object:', err);
    }
  }, [pages, pageEdits, recordChange]);

  // ==========================================
  // DIRECT PDF CONTENT EDIT HANDLERS
  // ==========================================

  // Select a text block on any page
  const handleSelectContentBlock = useCallback((pageId, pageNumber, block, currentText) => {
    setSelectedObjectProps({
      type: 'textbox',
      isPdfContentEdit: true,
      pageId,
      pageNumber,
      blockId: block.id,
      text: currentText,
      originalText: block.originalStr || block.str,
      block,
      fill: block.fill || block.color || '#000000',
      backgroundColor: block.backgroundColor || '#ffffff',
      fontSize: block.rawFontSize || block.fontSize || 12,
      fontFamily: block.fontFamily || 'Helvetica',
      fontWeight: block.fontWeight || (block.isBold ? 'bold' : 'normal'),
      fontStyle: block.fontStyle || (block.isItalic ? 'italic' : 'normal'),
    });
    const index = pages.findIndex((p) => p.id === pageId);
    if (index !== -1) {
      setActivePage(index + 1);
    }
  }, [pages]);

  // Save modified text content for a PDF block with exact font style, size, color, and layout preservation
  const handleSaveContentEdit = useCallback((selectedObj, newText, customColor) => {
    const { pageId, blockId, block, originalText } = selectedObj;
    if (!pageId || !blockId || !block) return;

    recordChange({ pages, pageEdits });

    const exactFontSize = block.rawFontSize || block.fontSize || block.pdfFontSize || 12;
    const exactFontFamily = block.fontFamily || 'Helvetica';
    const exactFontWeight = block.fontWeight || (block.isBold ? 'bold' : 'normal');
    const exactFontStyle = block.fontStyle || (block.isItalic ? 'italic' : 'normal');
    const exactColor = customColor || selectedObj.fill || block.fill || block.color || '#000000';
    const exactBg = selectedObj.backgroundColor || block.backgroundColor || '#ffffff';

    setPageEdits((prev) => {
      const prevPageData = prev[pageId] || { version: '6.0.0', objects: [] };
      const currentContentEdits = { ...(prevPageData.contentEdits || {}) };

      const filteredObjects = (prevPageData.objects || []).filter(
        (o) => o.originalBlockId !== blockId
      );

      const exportObj = {
        type: 'textbox',
        text: newText,
        left: block.pdfLeft,
        top: block.pdfTop,
        width: block.pdfWidth || block.width,
        height: block.pdfHeight || block.height,
        fontSize: exactFontSize,
        fontFamily: exactFontFamily,
        fontWeight: exactFontWeight,
        fontStyle: exactFontStyle,
        fill: exactColor,
        backgroundColor: exactBg,
        padding: 0,
        isPdfContentEdit: true,
        originalBlockId: blockId,
        linesInfo: [{
          pdfLeft: block.pdfLeft,
          pdfTop: block.pdfTop,
          pdfX: block.baseVx ?? block.pdfX,
          pdfWidth: block.pdfWidth || block.rawWidth,
          pdfHeight: block.pdfHeight,
          rawFontSize: exactFontSize,
          baseVy: block.baseVy,
        }],
        originalPdfCoords: {
          x: block.pdfX,
          y: block.pdfY,
          width: block.rawWidth,
          height: block.pdfHeightVal,
          fontSize: exactFontSize,
        },
      };

      return {
        ...prev,
        [pageId]: {
          ...prevPageData,
          contentEdits: {
            ...currentContentEdits,
            [blockId]: {
              text: newText,
              originalText: originalText || block.str,
              block: {
                ...block,
                str: newText,
                fontSize: exactFontSize,
                rawFontSize: exactFontSize,
                fontFamily: exactFontFamily,
                fontWeight: exactFontWeight,
                fontStyle: exactFontStyle,
                fill: exactColor,
                color: exactColor,
                backgroundColor: exactBg,
              },
            },
          },
          objects: [...filteredObjects, exportObj],
        },
      };
    });

    setSelectedObjectProps((prev) => (prev ? { ...prev, text: newText, fill: exactColor } : null));
  }, [pages, pageEdits, recordChange]);

  // Reset a PDF content block back to original
  const handleResetContentEdit = useCallback((selectedObj) => {
    const { pageId, blockId, block, originalText } = selectedObj;
    if (!pageId || !blockId) return;

    recordChange({ pages, pageEdits });

    setPageEdits((prev) => {
      const prevPageData = prev[pageId] || { version: '6.0.0', objects: [] };
      const currentContentEdits = { ...(prevPageData.contentEdits || {}) };

      if (block?.isParagraphMember && Array.isArray(block.paraLines) && block.paraLines.length > 1) {
        const paraLineIds = new Set(block.paraLines.map((l) => l.id));
        for (const id of paraLineIds) {
          delete currentContentEdits[id];
        }
        const filteredObjects = (prevPageData.objects || []).filter(
          (o) => !paraLineIds.has(o.originalBlockId)
        );
        return {
          ...prev,
          [pageId]: {
            ...prevPageData,
            contentEdits: currentContentEdits,
            objects: filteredObjects,
          },
        };
      }

      delete currentContentEdits[blockId];
      const filteredObjects = (prevPageData.objects || []).filter(
        (o) => o.originalBlockId !== blockId
      );

      return {
        ...prev,
        [pageId]: {
          ...prevPageData,
          contentEdits: currentContentEdits,
          objects: filteredObjects,
        },
      };
    });

    setSelectedObjectProps((prev) => (prev ? { ...prev, text: originalText } : null));
  }, [pages, pageEdits, recordChange]);

  // ==========================================
  // ADVANCED FEATURES HANDLERS (PHASE 5)
  // ==========================================

  const handleMergePdf = useCallback(async ({ buffer, numPages: _mergeNumPages, pagesMeta: mergePagesMeta, position }) => {
    recordChange({ pages, pageEdits });
    const mergeDocId = `doc-${Date.now()}`;
    setSourceBuffers((prev) => ({ ...prev, [mergeDocId]: buffer }));

    // Preload merged document in PDF.js so PdfPage can render and extract text from it
    try {
      const { pdfDoc: mergedPdfDoc } = await loadPdfDocument(buffer);
      setSourcePdfDocs((prev) => ({ ...prev, [mergeDocId]: mergedPdfDoc }));
    } catch (err) {
      console.warn('Could not parse merged PDF document in PDF.js:', err);
    }

    const newPages = mergePagesMeta.map((p, idx) => ({
      id: `page-merge-${mergeDocId}-${idx + 1}`,
      originalIndex: idx + 1,
      isBlank: false,
      width: p.width || 612,
      height: p.height || 792,
      rotation: p.rotation || 0,
      sourceDocId: mergeDocId,
    }));

    setPages((prev) => {
      return position === 'start' ? [...newPages, ...prev] : [...prev, ...newPages];
    });
  }, [pages, pageEdits, recordChange]);

  const handleSaveWatermarks = useCallback(({ watermark, pageNumbers }) => {
    setWatermarkConfig(watermark);
    setPageNumberConfig(pageNumbers);
  }, []);

  // ==========================================
  // EXPORT ENGINE HANDLERS (Direct PDF Download - No Modal)
  // ==========================================

  const handleDirectExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    const defaultFilename = (fileName ? fileName.replace(/\.pdf$/i, '') : 'document') + '-edited.pdf';

    try {
      // Ensure we have a valid, non-empty binary buffer of the source PDF.
      // If rawBuffer is missing or 0 bytes, extract bytes directly from pdfDoc.
      let exportBuffer = rawBuffer;
      if ((!exportBuffer || exportBuffer.byteLength === 0) && pdfDoc) {
        try {
          if (typeof pdfDoc.getData === 'function') {
            exportBuffer = await pdfDoc.getData();
          }
        } catch (e) {
          console.warn('Could not extract binary data from pdfDoc:', e);
        }
      }

      const { blob } = await exportModifiedPdf(
        exportBuffer,
        pages,
        pageEdits,
        {
          watermark: watermarkConfig,
          pageNumbers: pageNumberConfig,
          sourceBuffers,
        },
        (prog) => setExportProgress(prog)
      );

      // Directly trigger browser download without modal
      downloadBlob(blob, defaultFilename);
      setIsExporting(false);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to assemble and export PDF: ' + (err.message || 'Unknown error'));
      setIsExporting(false);
    }
  }, [isExporting, fileName, rawBuffer, pdfDoc, pages, pageEdits, watermarkConfig, pageNumberConfig, sourceBuffers]);

  // ==========================================
  // ==========================================
  // KEYBOARD SHORTCUTS (Ctrl+Z, Ctrl+Y, Ctrl+S, Del, Esc, ?)
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
      const canvas = selectedCanvasRef.current;
      const activeObj = canvas?.getActiveObject();
      const isTextEditing = !!activeObj?.isEditing;

      // 1. Export / Save: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleDirectExport();
        return;
      }

      // 2. Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isInputFocused && !isTextEditing) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // 3. Redo: Ctrl+Y / Cmd+Shift+Z / Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (!isInputFocused && !isTextEditing) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      // 4. Delete: Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInputFocused && !isTextEditing) {
          if (activeObj) {
            e.preventDefault();
            handleDeleteSelected();
          }
        }
        return;
      }

      // 5. Tool Shortcuts: E (Edit Content), V (Select), T (Text), P (Pen), H (Highlighter)
      if (!e.ctrlKey && !e.metaKey && !isInputFocused && !isTextEditing) {
        const k = e.key.toLowerCase();
        if (k === 'e') {
          e.preventDefault();
          setActiveTool((prev) => (prev === 'edit-content' ? 'select' : 'edit-content'));
          return;
        }
        if (k === 'v') {
          e.preventDefault();
          setActiveTool('select');
          return;
        }
        if (k === 't') {
          e.preventDefault();
          handleAddText();
          return;
        }
        if (k === 'p') {
          e.preventDefault();
          setActiveTool('pen');
          return;
        }
        if (k === 'h') {
          e.preventDefault();
          setActiveTool('highlighter');
          return;
        }
      }

      // 6. Help / Shortcuts Cheat-Sheet: ? or F1
      if ((e.key === '?' || e.key === 'F1') && !isInputFocused && !isTextEditing) {
        e.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }

      // 7. Escape: Deselect / Exit edit mode / Close modals
      if (e.key === 'Escape') {
        if (activeTool === 'edit-content') {
          setActiveTool('select');
          return;
        }
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          return;
        }
        if (watermarkModalOpen) {
          setWatermarkModalOpen(false);
          return;
        }
        if (mergeModalOpen) {
          setMergeModalOpen(false);
          return;
        }
        if (signatureModalOpen) {
          setSignatureModalOpen(false);
          return;
        }
        if (deleteModalState.isOpen) {
          setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        if (canvas) {
          canvas.discardActiveObject();
          canvas.renderAll();
          setSelectedObjectProps(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleDirectExport,
    signatureModalOpen,
    shortcutsModalOpen,
    deleteModalState.isOpen,
    watermarkModalOpen,
    mergeModalOpen,
    handleAddText,
    activeTool,
  ]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#0f141c]">
      {/* Top Toolbar */}
      <TopToolbar
        fileName={fileName}
        numPages={pages.length}
        activePage={activePage}
        scale={scale}
        activeTool={activeTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onRotateCurrentPage={handleRotateCurrentPage}
        onSelectPage={scrollToPage}
        onZoomChange={setScale}
        onFitWidth={handleFitWidth}
        onFitPage={handleFitPage}
        onOpenFile={onOpenFile}
        onSelectTool={setActiveTool}
        onAddText={handleAddText}
        onAddShape={handleAddShape}
        onAddImage={handleAddImage}
        onOpenSignatureModal={() => setSignatureModalOpen(true)}
        onExport={handleDirectExport}
        isExporting={isExporting}
        onOpenExport={handleDirectExport}
        onOpenWatermarkModal={() => setWatermarkModalOpen(true)}
        onOpenMergeModal={() => setMergeModalOpen(true)}
        onOpenOrganizeModal={() => setOrganizeModalOpen(true)}
        onOpenShortcutsModal={() => setShortcutsModalOpen(true)}
      />

      <div className="flex flex-1 w-full min-h-0 overflow-hidden relative">
        {/* Central PDF Workspace */}
        <main ref={workspaceRef} className="flex-1 h-full overflow-auto bg-[#0f141c] flex flex-col items-center py-6 px-2 md:py-10 md:px-6 gap-6 md:gap-8 scroll-smooth relative touch-pan-x touch-pan-y">
          {pages.map((page, index) => {
            const pageNum = index + 1;
            const pageDoc = (page.sourceDocId && sourcePdfDocs[page.sourceDocId])
              ? sourcePdfDocs[page.sourceDocId]
              : pdfDoc;

            return (
              <PdfPage
                key={page.id}
                pdfDoc={pageDoc}
                page={page}
                pageNumber={pageNum}
                scale={scale}
                activeTool={activeTool}
                savedEdits={pageEdits[page.id] || null}
                selectedBlockId={selectedObjectProps?.isPdfContentEdit ? selectedObjectProps.blockId : null}
                onSelectContentBlock={handleSelectContentBlock}
                onPageVisible={handlePageVisible}
                onPageEditsChange={handlePageEditsChange}
                onObjectSelected={handleObjectSelected}
                onObjectDeselected={handleObjectDeselected}
                onRegisterCanvas={registerCanvas}
                onUnregisterCanvas={unregisterCanvas}
              />
            );
          })}
        </main>

        {/* Right Properties Panel Mobile Backdrop */}
        {selectedObjectProps && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-35 lg:hidden"
            onClick={() => setSelectedObjectProps(null)}
            aria-label="Close properties"
          />
        )}

        {/* Right Properties Panel */}
        <PropertiesPanel
          selectedObject={selectedObjectProps}
          activeTool={activeTool}
          onUpdateProperty={handleUpdateProperty}
          onDeleteSelected={handleDeleteSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onSaveContentEdit={handleSaveContentEdit}
          onResetContentEdit={handleResetContentEdit}
          onClose={() => setSelectedObjectProps(null)}
        />
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onSave={handleInsertSignature}
      />

      {/* Delete Page Confirmation Modal */}
      <DeletePageModal
        isOpen={deleteModalState.isOpen}
        pageNumber={deleteModalState.pageNumber}
        onClose={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDeletePage}
      />

      {/* Organize Pages Grid Modal */}
      <OrganizePagesModal
        isOpen={organizeModalOpen}
        pages={pages}
        activePage={activePage}
        pdfDoc={pdfDoc}
        sourcePdfDocs={sourcePdfDocs}
        onClose={() => setOrganizeModalOpen(false)}
        onSelectPage={scrollToPage}
        onMovePage={handleMovePage}
        onRotatePage={handleRotatePage}
        onDeletePage={promptDeletePage}
        onAddBlankPage={handleAddBlankPage}
      />

      {/* Watermark & Page Numbers Modal */}
      <WatermarkModal
        isOpen={watermarkModalOpen}
        watermarkConfig={watermarkConfig}
        pageNumberConfig={pageNumberConfig}
        onClose={() => setWatermarkModalOpen(false)}
        onSave={handleSaveWatermarks}
      />

      {/* Merge PDF Modal */}
      <MergePdfModal
        isOpen={mergeModalOpen}
        currentPageCount={pages.length}
        onClose={() => setMergeModalOpen(false)}
        onMerge={handleMergePdf}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}
