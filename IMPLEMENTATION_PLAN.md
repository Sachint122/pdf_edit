# IMPLEMENTATION PLAN: Frontend-Only PDF Editor

## Phase-by-Phase Roadmap

### Phase 0: Audit, Setup & Architecture Baseline
- [x] Inspect workspace and initialize Vite React ESM project.
- [x] Install and verify core dependencies (`pdfjs-dist`, `pdf-lib`, `fabric`, `lucide-react`).
- [x] Establish Project Brain, Architecture, Implementation Plan, Rules, and Feature Status.
- [x] Verify Vite build and dev server with initial configuration.

**Acceptance Criteria:**
- Project builds cleanly with no dependency errors (Verified: `npm run build` succeeds in ~1.2s, 0 errors, 0 warnings).
- Project Brain and supporting documents define the exact roadmap and architecture.

---

### Phase 1: PDF Foundation (Loading, Rendering & Navigation)
- [x] **Upload Screen Component**: Drag-and-drop zone, file picker, file type/size validation (50 MB limit, %PDF- header check), and local multi-page sample PDF generator.
- [x] **PDF Parsing & Worker Integration**: Bundled `pdfjs-dist` worker via Vite ESM URL resolution; 100% client-side without external network requests.
- [x] **Page Renderer**: High-fidelity PDF page rendering onto `<canvas>` with scale and DPR handling; cancelable render tasks on scale/unmount.
- [x] **Navigation & Workspace**: Continuous vertical scroll workspace, left thumbnail preview sidebar, page indicator with jump-to-page, zoom in/out, fit-width, fit-page.
- [x] **Resource Cleanup**: Active PDF.js render tasks cancelled before re-render, previous document destroyed on document switch or unmount, memory released.

**Acceptance Criteria:**
- Single-page and multi-page PDFs load without errors (Verified with local sample PDF generator and automated tests).
- Pages render crisp and sharp at various zoom levels with DPR scaling.
- Thumbnails show accurate page previews with active page tracking.
- Invalid files trigger clear, helpful error states without app crashes (Verified via automated test suite `tests/phase1.test.js`).

---

### Phase 2: Interactive Editing Engine
- [x] **Page Canvas Overlay**: Sync Fabric.js canvas dimensions and positions exactly over each PDF page with `setZoom(scale)`.
- [x] **Coordinate Transformation Utility**: Accurate mapping between Fabric viewport pixels and PDF 72-DPI points without object drift on zoom.
- [x] **Text Tools**: Add editable text box, font size, font family (Helvetica, Times, Courier, Arial, etc.), color, bold, italic, underline, alignment.
- [x] **Drawing & Highlighter Tools**: Freehand pen with adjustable color/width; semi-transparent highlighter brush with opacity blend.
- [x] **Shapes**: Draggable rectangles, circles/ellipses, lines, and directional arrows with stroke/fill settings.
- [x] **Image Insertion**: Image file upload (PNG, JPG, WebP), placement on canvas, resizing, rotating, deleting.
- [x] **Signature Tool**: Modal with smooth freehand drawing pad (black/blue ink, clear) and image upload tab; insert into page.
- [x] **Selection & Properties Panel**: Contextual panel showing active object properties (typography, fill, stroke, strokeWidth, opacity), duplicate, and delete actions.

**Acceptance Criteria:**
- User can add text, freehand lines, shapes, images, and signatures to any page (Verified: unit tests and integration tests pass).
- Objects can be selected, moved, transformed, duplicated, and deleted (Verified: Delete key shortcut and button handlers implemented).
- Changing properties in the right panel updates canvas objects in real-time (Verified: real-time `activeObj.set()` and `canvas.renderAll()`).

---

### Phase 3: History & Document / Page Operations
- [x] **Undo / Redo System**: Per-page and document action history stack with hotkeys (Ctrl+Z / Ctrl+Y / Cmd+Shift+Z), toolbar buttons, and depth limiting.
- [x] **Page Rotation**: Rotate individual pages (90° clockwise/counter-clockwise), updating viewport dimensions, canvas overlays, and thumbnails.
- [x] **Page Reordering**: Move pages up/down with sidebar thumbnail controls and maintain object associations via stable page IDs.
- [x] **Page Deletion**: Delete pages with confirmation dialog; prevents deleting the single remaining page.
- [x] **Add Blank Page**: Insert clean blank pages at any position with standard dimensions and full interactive overlay support.

**Acceptance Criteria:**
- Undo/redo restores exact object properties, canvas states, and page structures without desynchronizing (Verified via `phase3.test.js`).
- Page reorder and rotation reflect immediately in editor and thumbnails (Verified).
- Edits remain attached to the correct page after reorder/rotation/deletion through stable `page.id` mapping (Verified).

---

### Phase 4: Export Engine
- [x] **Export Pipeline with `pdf-lib`**:
  - Load original PDF bytes in browser memory.
  - Apply page manipulations (rotation, deletions, reordering, blank pages).
  - Iterate through canvas objects and render vector layers into PDF:
    - Text -> `page.drawText()` with standard font embedding (`FontManager`).
    - Shapes -> `page.drawRectangle()`, `page.drawCircle()`, `page.drawLine()`.
    - Freehand / Paths -> `page.drawSvgPath()` with color, stroke width, and opacity.
    - Images & Signatures -> `embedPng()` / `embedJpg()` and `page.drawImage()`.
- [x] **Export Progress UI**: Professional modal (`ExportModal.jsx`) showing compilation status, progress track, error state, and customizable filename.
- [x] **Direct Browser Download**: Save generated PDF Blob/Uint8Array locally (`downloadFile.js`) without any network transit.

**Acceptance Criteria:**
- Downloaded PDF opens in standard viewers (Adobe Acrobat, Chrome, Preview).
- All edits (text, drawings, shapes, images, signatures) appear in exact locations with correct scaling (Verified via `phase4.test.js`).
- 100% client-side assembly with zero external API calls (Verified).

---

### Phase 5: Advanced Features
- [x] **Watermarks & Page Numbers**: Global configuration modal (`WatermarkModal.jsx`) to stamp diagonal/horizontal translucent watermarks and header/footer page numbers across 6 standard positions.
- [x] **Merge PDFs**: Select and append/prepend external PDF files (`MergePdfModal.jsx`) into the current document with multi-source page tracking.
- [x] **Metadata Editor**: View and modify standard PDF metadata (`MetadataModal.jsx`): Title, Author, Subject, Keywords.

**Acceptance Criteria:**
- Watermarks and page numbers correctly appear on pages during export (Verified via `phase5.test.js`).
- Merged documents retain all pages in proper order with accurate rotations (Verified via `phase5.test.js`).
- Metadata is embedded into the output PDF header and re-readable (Verified via `phase5.test.js`).

---

### Phase 6: Quality, Polish & Optimization
- [x] **Keyboard shortcuts modal & handlers**: Added `KeyboardShortcutsModal.jsx` and registered shortcuts for Delete, Ctrl+Z (Undo), Ctrl+Y / Cmd+Shift+Z (Redo), Escape (Deselect/Close), Ctrl+S (Export PDF), and ? / F1 (Help Cheat-sheet). Guarded canvas undo against hijacking in-textbox typing (`isEditing`).
- [x] **Responsive layout**: Added viewport media queries in `toolbar.css` and `panels.css` with horizontal scroll for small screens (<1024px, <640px) and clean icon-only button labels.
- [x] **Memory optimization**: Added in-flight PDF.js render task cancellation (`options.onRenderTaskCreated`) to prevent worker queue congestion; explicitly released canvas backing buffer memory on unmount (`canvas.width = 0; canvas.height = 0`).
- [x] **Audit Bug Fixes**:
  - Fixed `MergePdfModal.jsx` file validation check (`!validation.valid`).
  - Fixed SVG path coordinate double offset in `exportPdf.js`.
  - Added `sanitizeForWinAnsi` utility in `src/utils/textSanitizer.js` to prevent pdf-lib export crashes on Rupee (`₹`), Euro (`€`), bullets (`•`), and emojis.
  - Added WebP to PNG conversion in export.
  - Preserved rotation (`degrees(-obj.angle)`) for shapes and images during export.
  - Conformed `validatePdfHeader` to ISO 32000-1 (searching first 1024 bytes for UTF-8 BOM and preambles).
  - Used unique `docId` as React key to prevent stale state on same-named file re-uploads.
- [x] **Production build and master smoke tests**: All 6 phases automated test suites passed (`tests/runAll.js`, 30/30 assertions verified); production build succeeded in 1.70s with zero errors.

**Acceptance Criteria:**
- Production build passes with zero errors (`npm run build` completed in 1.70s).
- Smooth performance on multi-page documents with cancelable render tasks and memory reclamation.
- Keyboard shortcuts modal accessible via ? or toolbar button; Ctrl+S triggers export modal directly.
