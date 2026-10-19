/**
 * Custom Hook: usePdfDocument
 * Manages PDF document lifecycle, loading, parsing, errors, memory cleanup,
 * and seamless Image-to-Editable-PDF conversion with OCR.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  validatePdfHeader,
  readFileAsArrayBuffer,
  validateDocumentOrImageFile,
  isImageFile,
} from '../utils/fileValidation.js';
import { generateSamplePdf } from '../utils/samplePdf.js';
import { loadPdfDocument, destroyPdfDocument } from '../features/pdf-viewer/pdfLoader.js';
import { convertImageToEditablePdf } from '../utils/imageToPdf.js';

export function usePdfDocument() {
  const [docState, setDocState] = useState({
    docId: null,
    pdfDoc: null,
    fileName: '',
    fileSize: 0,
    rawBuffer: null,
    numPages: 0,
    pagesMeta: [],
    loading: false,
    loadingMessage: '',
    error: null,
    isPasswordProtected: false,
    initialOcrBlocks: null,
  });

  const currentDocRef = useRef(null);

  // Keep ref updated to ensure clean unmount
  useEffect(() => {
    currentDocRef.current = docState.pdfDoc;
  }, [docState.pdfDoc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentDocRef.current) {
        destroyPdfDocument(currentDocRef.current);
      }
    };
  }, []);

  /**
   * Internal loader for an ArrayBuffer
   */
  const loadBuffer = useCallback(async (buffer, fileName, fileSize = 0, extraMeta = {}) => {
    // 1. Validate PDF header
    if (!validatePdfHeader(buffer)) {
      setDocState((prev) => ({
        ...prev,
        loading: false,
        loadingMessage: '',
        error: 'The file header does not match a valid PDF signature (%PDF-).',
      }));
      return false;
    }

    setDocState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      isPasswordProtected: false,
    }));

    // 2. Clean up previous document if one was open
    if (currentDocRef.current) {
      await destroyPdfDocument(currentDocRef.current);
      currentDocRef.current = null;
    }

    try {
      const preservedBuffer = buffer.slice(0);
      const { pdfDoc, numPages, pagesMeta } = await loadPdfDocument(buffer.slice(0));
      currentDocRef.current = pdfDoc;

      setDocState({
        docId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pdfDoc,
        fileName,
        fileSize: fileSize || preservedBuffer.byteLength,
        rawBuffer: preservedBuffer,
        numPages,
        pagesMeta,
        loading: false,
        loadingMessage: '',
        error: null,
        isPasswordProtected: false,
        initialOcrBlocks: extraMeta?.ocrBlocks || null,
        isImage: !!extraMeta?.isImage,
        imageMeta: extraMeta?.imageMeta || null,
      });
      return true;
    } catch (err) {
      console.error('Failed to load PDF document:', err);
      setDocState((prev) => ({
        ...prev,
        loading: false,
        loadingMessage: '',
        error: err.message || 'Failed to parse PDF document.',
        isPasswordProtected: !!err.isPasswordProtected,
      }));
      return false;
    }
  }, []);

  /**
   * Load from a browser File object (drag-and-drop or file picker)
   * Handles both standard PDF files and Image files (PNG, JPG, WebP) with OCR text detection.
   */
  const loadFromFile = useCallback(
    async (file) => {
      const validation = validateDocumentOrImageFile(file);
      if (!validation.valid) {
        setDocState((prev) => ({
          ...prev,
          loading: false,
          loadingMessage: '',
          error: validation.error,
        }));
        return false;
      }

      // If an image is uploaded, convert to PDF with embedded image and run OCR
      if (validation.isImage || isImageFile(file)) {
        setDocState((prev) => ({
          ...prev,
          loading: true,
          loadingMessage: 'Reading image and detecting text...',
          error: null,
        }));

        try {
          const result = await convertImageToEditablePdf(file, {
            fileName: file.name,
            onProgress: (m) => {
              if (m.status === 'recognizing text') {
                const pct = Math.round((m.progress || 0) * 100);
                setDocState((prevDoc) => ({
                  ...prevDoc,
                  loadingMessage: `Detecting text (${pct}%)...`,
                }));
              }
            },
          });

          return await loadBuffer(result.pdfBytes.buffer || result.pdfBytes, result.fileName, result.pdfBytes.byteLength, {
            ocrBlocks: result.textBlocks,
            isImage: true,
            imageMeta: {
              originalImageFile: result.originalImageFile,
              originalFileName: result.originalFileName,
              originalFormat: result.originalFormat,
              naturalWidth: result.naturalWidth,
              naturalHeight: result.naturalHeight,
              scaleFactor: result.scaleFactor,
            },
          });
        } catch (imgErr) {
          console.error('Image to PDF OCR conversion failed:', imgErr);
          setDocState((prev) => ({
            ...prev,
            loading: false,
            loadingMessage: '',
            error: imgErr.message || 'Could not process and extract text from the image.',
          }));
          return false;
        }
      }

      setDocState((prev) => ({
        ...prev,
        loading: true,
        loadingMessage: 'Opening PDF document...',
        error: null,
      }));

      try {
        const buffer = await readFileAsArrayBuffer(file);
        return await loadBuffer(buffer, file.name, file.size);
      } catch (err) {
        setDocState((prev) => ({
          ...prev,
          loading: false,
          loadingMessage: '',
          error: err.message || 'Could not read file from disk.',
        }));
        return false;
      }
    },
    [loadBuffer]
  );

  /**
   * Load the dynamically generated local sample PDF
   */
  const loadSamplePdf = useCallback(async () => {
    setDocState((prev) => ({
      ...prev,
      loading: true,
      loadingMessage: 'Generating sample document...',
      error: null,
    }));
    try {
      const buffer = await generateSamplePdf();
      return await loadBuffer(buffer, 'Executive-Services-Agreement.pdf', buffer.byteLength);
    } catch (err) {
      console.error('Sample generation failed:', err);
      setDocState((prev) => ({
        ...prev,
        loading: false,
        loadingMessage: '',
        error: 'Failed to generate local sample PDF.',
      }));
      return false;
    }
  }, [loadBuffer]);

  /**
   * Close the currently open document and free all memory
   */
  const closeDocument = useCallback(async () => {
    if (currentDocRef.current) {
      await destroyPdfDocument(currentDocRef.current);
      currentDocRef.current = null;
    }

    setDocState({
      docId: null,
      pdfDoc: null,
      fileName: '',
      fileSize: 0,
      rawBuffer: null,
      numPages: 0,
      pagesMeta: [],
      loading: false,
      loadingMessage: '',
      error: null,
      isPasswordProtected: false,
      initialOcrBlocks: null,
    });
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setDocState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...docState,
    loadFromFile,
    loadBuffer,
    loadSamplePdf,
    closeDocument,
    clearError,
  };
}

export default usePdfDocument;
