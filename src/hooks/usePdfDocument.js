/**
 * Custom Hook: usePdfDocument
 * Manages PDF document lifecycle, loading, parsing, errors, and memory cleanup.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { validatePdfFile, validatePdfHeader, readFileAsArrayBuffer } from '../utils/fileValidation.js';
import { generateSamplePdf } from '../utils/samplePdf.js';
import { loadPdfDocument, destroyPdfDocument } from '../features/pdf-viewer/pdfLoader.js';

export function usePdfDocument() {
  const [docState, setDocState] = useState({
    pdfDoc: null,
    fileName: '',
    fileSize: 0,
    rawBuffer: null,
    numPages: 0,
    pagesMeta: [],
    loading: false,
    error: null,
    isPasswordProtected: false,
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
  const loadBuffer = useCallback(async (buffer, fileName, fileSize = 0) => {
    // 1. Validate PDF header
    if (!validatePdfHeader(buffer)) {
      setDocState((prev) => ({
        ...prev,
        loading: false,
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
        error: null,
        isPasswordProtected: false,
      });
      return true;
    } catch (err) {
      console.error('Failed to load PDF document:', err);
      setDocState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to parse PDF document.',
        isPasswordProtected: !!err.isPasswordProtected,
      }));
      return false;
    }
  }, []);

  /**
   * Load from a browser File object (drag-and-drop or file picker)
   */
  const loadFromFile = useCallback(
    async (file) => {
      const validation = validatePdfFile(file);
      if (!validation.valid) {
        setDocState((prev) => ({
          ...prev,
          loading: false,
          error: validation.error,
        }));
        return false;
      }

      setDocState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const buffer = await readFileAsArrayBuffer(file);
        return await loadBuffer(buffer, file.name, file.size);
      } catch (err) {
        setDocState((prev) => ({
          ...prev,
          loading: false,
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
    setDocState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const buffer = await generateSamplePdf();
      return await loadBuffer(buffer, 'Sample-Document.pdf', buffer.byteLength);
    } catch (err) {
      console.error('Sample generation failed:', err);
      setDocState((prev) => ({
        ...prev,
        loading: false,
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
      pdfDoc: null,
      fileName: '',
      fileSize: 0,
      rawBuffer: null,
      numPages: 0,
      pagesMeta: [],
      loading: false,
      error: null,
      isPasswordProtected: false,
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
