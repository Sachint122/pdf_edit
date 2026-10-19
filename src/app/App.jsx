/**
 * App Root Component
 * Coordinates document lifecycle, upload screen, and editor workspace.
 */

import React from 'react';
import { usePdfDocument } from '../hooks/usePdfDocument.js';
import { UploadScreen } from '../components/UploadScreen.jsx';
import { EditorLayout } from '../components/EditorLayout.jsx';

export default function App() {
  const {
    docId,
    pdfDoc,
    fileName,
    numPages,
    pagesMeta,
    rawBuffer,
    loading,
    loadingMessage,
    error,
    loadFromFile,
    loadSamplePdf,
    clearError,
    initialOcrBlocks,
  } = usePdfDocument();

  // If no document is currently loaded, render the Upload / Welcome Screen
  if (!pdfDoc) {
    return (
      <UploadScreen
        onFileSelect={loadFromFile}
        onLoadSample={loadSamplePdf}
        loading={loading}
        loadingMessage={loadingMessage}
        error={error}
        onClearError={clearError}
      />
    );
  }

  // Once PDF document is parsed, render the full Editor Layout
  return (
    <EditorLayout
      key={docId || fileName}
      pdfDoc={pdfDoc}
      fileName={fileName}
      rawBuffer={rawBuffer}
      numPages={numPages}
      pagesMeta={pagesMeta}
      onOpenFile={loadFromFile}
      initialOcrBlocks={initialOcrBlocks}
    />
  );
}
