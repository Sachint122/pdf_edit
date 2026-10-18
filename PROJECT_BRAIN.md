# PROJECT BRAIN: Frontend-Only PDF Editor

## 1. Project Objective & Vision
Build a professional, client-side, browser-based PDF editor using React.js and Vite.
The user uploads a PDF, edits it inside a single unified editor window using rich, practical tools (text, shapes, pen/highlighter, signatures, images, page management, redactions, watermarks), and exports/downloads the modified PDF.

### Non-Negotiable Requirements
- **100% Client-Side Processing**: No backend server, no Node.js API server, no MongoDB or database, no user authentication, no cloud storage.
- **Zero External Document Leaks**: Document bytes must NEVER be uploaded to any external service or analytics API. All parsing, rendering, canvas editing, and PDF manipulation must happen strictly locally in the browser memory.
- **Original Document Immutability**: The original PDF file is never overwritten directly; all edits are stored as non-destructive overlay/state representations until export.
- **Continuous Single-Window Workflow**: Never reload the page or navigate away during normal editing.
- **Multi-page Scalability**: Maintain responsiveness and reasonable memory limits for multi-page documents (virtualized/lazy page rendering, resource disposal).
- **Truth in Capabilities**: Adding new text overlay is NOT "editing existing text". No fake tools (e.g. putting a white box over text and calling it existing text editing). Genuine tools must be clearly identified and tested.

---

## 2. Technology Stack & Compatibility Analysis

| Component | Library / Tool | Version | Responsibility & Notes |
| :--- | :--- | :--- | :--- |
| **Framework** | React + Vite | React 19+, Vite 8+ | Component lifecycle, UI rendering, reactive state. |
| **Language** | JavaScript (ESM) | ES2022+ | Clean modular structure, standard modern JS. |
| **PDF Rendering** | `pdfjs-dist` | ^4.x / ^6.x | Page parsing, rendering to HTML5 canvas viewport, thumbnail generation, text layer extraction. |
| **PDF Manipulation**| `pdf-lib` | ^1.17.1 | Page manipulation (rotation, deletion, reordering, adding blanks), embedding images, drawing text/shapes/redaction rects, saving final PDF. |
| **Interactive Canvas** | `fabric` | ^6.x / ^7.x | High-performance interactive overlay per page for selectable objects, text boxes, freehand pen, drawings, image transformations, undo/redo canvas state. |
| **Icons** | `lucide-react` | ^1.x | Modern, consistent iconography for toolbars, sidebars, and property controls. |
| **Styling** | Vanilla CSS | Custom Design System | High-end dark/light theme, modern typography (Inter/system-ui), glassmorphism accents, responsive collapsible sidebars. |

### Technical Risks & Mitigations
1. **PDF.js Web Worker in Vite**:
   - *Risk*: PDF.js requires a web worker (`pdf.worker.min.mjs`). Incorrect bundling in Vite can cause blank page renders or worker path resolution failures.
   - *Mitigation*: Configure `GlobalWorkerOptions.workerSrc` using Vite's modern URL resolution: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`.
2. **Coordinate Synchronization**:
   - *Risk*: PDF.js renders at a specific scale and device pixel ratio (DPR), while Fabric.js coordinates must align with PDF points (72 DPI) during `pdf-lib` export.
   - *Mitigation*: Establish a single source of truth for page dimensions (`pdfWidthPt`, `pdfHeightPt`) and a strict `coordinateTransform.js` utility that maps `(fabricX, fabricY)` in canvas space to `(pdfLibX, pdfLibY)` in PDF point space (taking bottom-left origin and page rotation into account).
3. **Browser Memory Leaks with Large PDFs**:
   - *Risk*: Multiple high-res canvas elements and Fabric instances across 50+ pages can exhaust browser memory.
   - *Mitigation*: Page virtualization / lazy mounting. Only initialize active/visible Fabric instances; release rendered canvas bitmaps when pages leave the active viewport. Revoke Object URLs upon document unload.
4. **Font Availability in Browser PDF Export**:
   - *Risk*: Standard fonts (Helvetica, Times Roman, Courier) are embedded natively by `pdf-lib`. Custom fonts require font bytes.
   - *Mitigation*: Map user-selected UI fonts to StandardFonts in `pdf-lib` or embed custom TTF/OTF bytes explicitly when advanced typography is required.

---

## 3. Architecture & Data Flow

### Layered Architecture
```text
┌─────────────────────────────────────────────────────────────┐
│                       Top Toolbar                           │
│ (File, Undo/Redo, Zoom, Page Nav, Mode Selection, Export)   │
├───────────────┬─────────────────────────────┬───────────────┤
│ Left Sidebar  │      Central Workspace      │ Right Sidebar │
│               │                             │               │
│ - Thumbnails  │  ┌───────────────────────┐  │ - Object      │
│ - Reorder     │  │  Page Canvas (PDF.js) │  │   Properties  │
│ - Rotate      │  ├───────────────────────┤  │ - Typography  │
│ - Delete      │  │  Fabric.js Overlay    │  │ - Stroke/Fill │
│ - Add Blank   │  │  (Vector/Text/Draw)   │  │ - Redaction   │
│               │  └───────────────────────┘  │ - Watermark   │
└───────────────┴─────────────────────────────┴───────────────┘
                               │
                       [ Export Engine ]
                               ▼
            pdf-lib reads original PDF bytes +
            overlays Fabric annotations into PDF primitives
                               ▼
                     Blob Download in Browser
```

### State Ownership Separation
1. **Document State**:
   - `originalFile`: File object / ArrayBuffer.
   - `pdfDocument`: PDF.js document proxy.
   - `pageCount`: Total pages.
   - `pagesMeta`: Array of per-page metadata `{ pageNumber, originalIndex, widthPt, heightPt, rotation }`.
2. **Editor & Tool State**:
   - `activeTool`: `'select' | 'text' | 'draw' | 'highlighter' | 'shape' | 'image' | 'signature' | 'redact'`.
   - `activePage`: Current page in view (1-indexed).
   - `zoom`: Zoom factor (e.g., 1.0, 1.25, 1.5, 'fit-width', 'fit-page').
   - `selectedObject`: Active Fabric object reference and serialized properties.
3. **Canvas Edits State**:
   - `pageEdits`: Map of `pageIndex -> Fabric JSON serialization`.
   - Canvas states are serialized on change to guarantee isolation across page switches.
4. **History State**:
   - `undoStack`: Array of state snapshots (diffs or target page edits).
   - `redoStack`: Array of undone state snapshots.
5. **Export State**:
   - `isExporting`: Boolean.
   - `exportProgress`: `{ current, total, phase }`.
   - `exportError`: String | null.

---

## 4. Feature Definitions & Genuine Capabilities

- **Add New Text**: Creates draggable, resizable text boxes using Fabric `IText`/`Textbox`. Rendered onto PDF during export using `pdf-lib` font drawing.
- **Draw & Highlight**: Freehand pen with configurable brush color, stroke width, opacity, and blend modes (e.g. multiply/opacity for highlighter).
- **Shapes**: Rectangles, circles, lines, arrows with stroke/fill customization.
- **Signatures**: Dual-mode modal: draw freehand signature on mini-canvas or upload signature image PNG. Placed as scalable transparent image object.
- **Images**: PNG, JPG, WebP insertion with scale, rotate, opacity, and layer ordering.
- **Redaction**: Blackout bounding box. At export time, permanently draws opaque solid rectangle over the specified coordinates (genuine visual redaction).
- **Page Management**: Reorder pages via drag-and-drop or move buttons; rotate pages in 90-degree increments; delete pages; add blank pages.
- **Watermark & Page Numbers**: Global overlay options applied across selected or all pages during export.

---

## 5. Decisions Already Made
1. **Single Page Viewport with Virtualized Scroll**: Allow smooth scrolling through all pages while lazy-loading Fabric canvases only for visible and adjacent pages to optimize memory.
2. **Vanilla CSS Design System**: Clean, responsive layout with high-contrast dark/light modern UI, CSS variables for theme tokens, avoiding bloated external CSS libraries.
3. **Strict Separation of Concerns**: PDF parsing and rendering logic lives in `features/pdf-viewer/`, Fabric canvas bindings live in `features/editing/`, page manipulation in `features/page-management/`, and PDF writing in `features/export/`.
4. **Local Sample PDF Generator**: Generated completely client-side in memory using `pdf-lib`; provides an instant 3-page test document with zero external network requests.
5. **Bundled PDF.js Worker in Vite**: Configured via Vite URL resolution (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`), resulting in a dedicated client-side asset (`dist/assets/pdf.worker.min-...mjs`) with zero CDN or third-party dependence.
6. **Unscaled Base Coordinate System for Fabric Overlays**: Fabric canvas instances use base unscaled page dimensions (72 DPI PDF points) and scale via `canvas.setZoom(scale)`. All objects (text, shapes, drawings, images) maintain exact spatial consistency without drift when zooming, directly matching `pdf-lib` export coordinates.
7. **Contextual Properties Panel**: Real-time two-way synchronization between Fabric canvas active objects and the Properties inspector; changes to typography, fill, stroke, and opacity apply immediately with live re-rendering.
8. **Stable Page Identity (`page.id`)**: Pages carry permanent unique IDs so that canvas edits (`pageEdits[page.id]`) stay strictly attached to their respective pages during reordering, deletion, and rotation.
9. **Unified Undo/Redo Snapshots**: The history stack captures combined structural document snapshots (page order, rotations, additions, deletions) and vector edits, enabling reliable state rollback and rollforward via standard desktop shortcuts (`Ctrl+Z`, `Ctrl+Y`).
10. **Minimum Page Deletion Guard**: The editor prohibits deleting the only remaining page in the document, preventing invalid empty PDF states.
11. **Client-Side Export Engine with `pdf-lib`**: The document compilation copies pages from the original ArrayBuffer, applies rotations and deletions, inserts blank pages, embeds standard fonts (Helvetica, Times Roman, Courier), and draws text, shapes, lines, images, and SVG paths using bottom-left PDF coordinate conversion (`y = pageHeight - obj.top - obj.height`). The resulting Uint8Array is converted to a Blob and downloaded via an ephemeral DOM anchor with zero server round-trips.
12. **Multi-Source Client-Side Merging & Advanced Stamping**: External PDFs merged into an active session are parsed in memory and assigned unique document IDs. Pages retain their source document references so `exportModifiedPdf` extracts vector pages from their respective source buffers without any backend involvement. Watermarks and page numbers calculate true page centers and header/footer margins (`x`, `y`) taking page dimensions and orientation into account.
13. **Robustness & WinAnsi Safety (Phase 6)**: Text overlays, watermarks, and page numbers pass through `sanitizeForWinAnsi` to safely map currency symbols (₹ to Rs., € to EUR, £ to GBP), bullets, and emojis without crashing pdf-lib's standard fonts. Conforming ISO 32000-1 binary header detection scans the initial 1024 bytes, preventing false rejection of PDFs with BOMs or scanner comments. Freehand drawings compute exact stroke displacement offsets, and object rotations are preserved into the output PDF. All in-flight PDF.js render tasks can be cancelled immediately on zoom/scroll, and unmounted canvas elements release their GPU backing memory immediately.

---

## 6. Known Bugs & Technical Watchlist
- Automated browser testing using Playwright manager in sandbox was blocked due to external network download restrictions on playwright driver binaries; core functionality is validated via direct automated unit/integration test suites (`npm test`, 30/30 assertions verified across Phases 1-6), oxlint linter (0 errors, 0 warnings across 46 files), and production build verification (`npm run build`).
