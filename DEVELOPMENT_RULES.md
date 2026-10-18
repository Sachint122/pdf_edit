# DEVELOPMENT RULES: Frontend-Only PDF Editor

## 1. Core Principles & Philosophy
- **Client-Side Sovereignity**: All operations must execute strictly inside the user's browser. Do NOT make network calls containing PDF data or user edits.
- **Honesty in Capabilities**: Adding an overlay text box is NOT "editing existing text". Real text replacement requires specialized detection and replacement. Clearly delineate "Overlay Text", "Redaction", and "Annotations".
- **Non-Destructive Editing**: Keep the raw source PDF ArrayBuffer pristine. Store all modifications as state/edits until explicit export.
- **Progressive Delivery**: Build and test one phase at a time. Never mark a feature "done" without verification.

---

## 2. Code Organization & Separation of Concerns
- **`src/app/`**: Root component (`App.jsx`) and top-level providers.
- **`src/components/`**: Modular UI components (`TopToolbar.jsx`, `PageSidebar.jsx`, `PropertiesPanel.jsx`, `PdfPage.jsx`, `UploadScreen.jsx`, `SignatureModal.jsx`, `ExportModal.jsx`).
- **`src/features/`**:
  - `pdf-viewer/`: PDF.js document loading, page rendering, worker initialization.
  - `editing/`: Fabric.js canvas bindings, tools (text, draw, shape, image, signature).
  - `page-management/`: Page reorder, rotate, delete, blank page insertion.
  - `export/`: `pdf-lib` document assembly and PDF byte compilation.
- **`src/hooks/`**: Custom hooks (`usePdfDocument`, `useEditorHistory`, `useKeyboardShortcuts`).
- **`src/state/`**: Reducer actions and state management (`editorReducer.js`).
- **`src/utils/`**: Coordinate conversion (`coordinateTransform.js`), memory cleanup, file validation, file download.
- **`src/styles/`**: Vanilla CSS modular files (`editor.css`, `toolbar.css`, `panels.css`, `index.css`).

---

## 3. Strict Prohibitions
1. **No Giant Monolithic Components**: Do not dump toolbar, canvas, pdf.js, and export logic into a single 1500-line file.
2. **No Placeholder / Fake Buttons**: Every button on screen must either perform its designated action or be cleanly disabled with an explanatory tooltip.
3. **No External PDF Uploads**: Never pass PDF buffers or base64 data to any third-party API or remote server.
4. **No Premature Redux**: Use standard React state and `useReducer` to manage editor state cleanly without heavy external state libraries.
5. **No Memory Leaks**: Always revoke Object URLs (`URL.revokeObjectURL`), dispose Fabric canvas instances on unmount, and cancel in-flight PDF.js render tasks.

---

## 4. Testing & Verification Checklist
- [ ] Upload single-page PDF, multi-page PDF, and invalid file (e.g. text/image) to test error handling.
- [ ] Verify zoom scaling (e.g., 50%, 100%, 150%, 200%) keeps interactive overlays aligned.
- [ ] Add and move multiple object types (text, shape, pen line, signature, image) on multiple pages.
- [ ] Perform undo and redo across multiple sequential operations.
- [ ] Reorder, rotate, and delete pages.
- [ ] Export modified PDF and open in browser/PDF viewer to inspect correctness and alignment.
- [ ] Test production build (`npm run build`) and linting (`npm run lint`).
