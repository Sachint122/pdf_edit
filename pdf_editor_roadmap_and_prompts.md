# Frontend-Only PDF Editor --- Development Roadmap & Prompt Guide

## Project goal

Build a browser-based PDF editor using React. A user uploads a PDF,
edits it in one editor window, then downloads the edited PDF.

### Non-negotiable rules

-   Frontend only: no backend, Node.js API server, MongoDB,
    authentication, or cloud storage.
-   PDF content stays in the browser; do not send documents to external
    APIs.
-   Keep the original PDF bytes unchanged until export.
-   Preserve existing working code. Inspect before modifying.
-   Do not implement fake buttons or mark untested features complete.
-   Update `PROJECT_BRAIN.md`, `IMPLEMENTATION_PLAN.md`,
    `DEVELOPMENT_RULES.md`, and `FEATURE_STATUS.md` as appropriate.
-   Run build and relevant tests after each phase.
-   Do not skip ahead when a phase's acceptance criteria fail.

## Recommended stack

-   React + Vite
-   PDF.js (`pdfjs-dist`) for PDF parsing and rendering
-   `pdf-lib` for PDF modifications and export
-   Fabric.js for interactive canvas objects
-   `lucide-react` for icons
-   CSS for layout and styling

Check existing dependencies and their installed versions before changing
packages.

------------------------------------------------------------------------

# Phase-by-phase plan

## Phase 0 --- Audit, Setup & Architecture

### Do

1.  Inspect the repository, scripts, dependencies, and existing code.
2.  Verify Vite/React configuration.
3.  Install only necessary compatible dependencies.
4.  Create:
    -   `PROJECT_BRAIN.md`
    -   `IMPLEMENTATION_PLAN.md`
    -   `DEVELOPMENT_RULES.md`
    -   `FEATURE_STATUS.md`
5.  Run `npm run build` and start the development server.

### Done when

-   The app builds and the dev server starts.
-   Project architecture and roadmap are documented.
-   Existing code has not been unnecessarily replaced.

### Prompt to use

> Audit the existing repository before coding. Verify the React/Vite
> setup and dependency compatibility, create or update the four project
> documentation files, run `npm run build`, and verify the dev server
> starts. Fix only necessary setup issues. Do not build the full editor
> yet. Report actual commands and results.

------------------------------------------------------------------------

## Phase 1 --- PDF Foundation

### Do

1.  Create a drag-and-drop PDF upload screen and file picker.
2.  Validate file type, size, and parse errors.
3.  Configure PDF.js and its worker for Vite.
4.  Render PDF pages to canvas with correct scaling and
    device-pixel-ratio handling.
5.  Add thumbnails, page navigation, page counter, zoom, and
    fit-to-page.
6.  Handle loading, invalid PDFs, encrypted files, and errors.
7.  Clean up render tasks, document references, canvases, and object
    URLs.

### Done when

-   Single-page and multi-page PDFs load.
-   Thumbnails and zoom work.
-   Replacing a document does not show stale pages.
-   Invalid files produce clear errors.
-   Build succeeds.

### Prompt to use

> Implement Phase 1 only, following the project brain and development
> rules. Inspect the current code first. Build upload, validation,
> PDF.js worker setup, page rendering, thumbnails, navigation, zoom,
> error handling, and resource cleanup. Do not implement editing tools
> yet. Test single-page, multi-page, invalid-file, and
> document-replacement cases. Update project docs and report actual
> results.

------------------------------------------------------------------------

## Phase 2 --- Interactive Editing Tools

### Do

1.  Add Fabric.js overlays aligned with PDF pages.
2.  Store editing objects separately for each page.
3.  Implement coordinate conversion between PDF points and canvas
    pixels, including zoom and rotation.
4.  Add text boxes with font size, family, color, bold, italic,
    alignment, and line spacing.
5.  Add freehand drawing and transparent highlighter.
6.  Add rectangles, ellipses, lines, and arrows.
7.  Add image insertion and transformation.
8.  Add signature drawing/import.
9.  Add selection, move, resize, rotate, duplicate, and delete.
10. Add a contextual properties panel.

### Done when

-   Tools work on multiple pages.
-   Page-specific edits persist when navigating.
-   Zoom does not misalign objects.
-   Properties update the selected object.
-   Existing Phase 1 features still work.

### Prompt to use

> Implement Phase 2 only. First audit the existing viewer and verify
> Phase 1. Add a Fabric.js editing overlay, page-specific object state,
> accurate coordinate transforms, text, drawing, highlighter, shapes,
> image insertion, signatures, selection, transformations, and a
> properties panel. Keep all processing local. Do not implement
> undo/redo, page operations, or final export in this phase. Test
> multi-page persistence, zoom alignment, document replacement, and
> build. Update project documentation and report actual results.

------------------------------------------------------------------------

## Phase 3 --- History & Page Operations

### Do

1.  Implement reliable undo/redo for editing actions.
2.  Add keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Y, Delete, Escape.
3.  Rotate individual pages.
4.  Reorder pages with drag-and-drop or explicit controls.
5.  Delete pages with confirmation; do not allow deletion of the only
    remaining page.
6.  Insert blank pages.
7.  Keep page order, thumbnails, page state, and editing objects
    synchronized.

### Done when

-   Undo/redo restores the correct object and page state.
-   Page operations update the viewer consistently.
-   Edits remain attached to the correct page after
    reorder/rotation/deletion.

### Prompt to use

> Implement Phase 3 only after verifying Phases 1 and 2. Design a
> consistent history model for editing actions and document/page
> operations. Add undo/redo, keyboard shortcuts, page rotation, page
> reordering, page deletion with confirmation, and blank-page insertion.
> Keep page IDs and page-specific objects synchronized. Test
> combinations of edits, undo/redo, reorder, rotate, and delete. Do not
> implement final PDF export yet. Update project docs and report actual
> results.

------------------------------------------------------------------------

## Phase 4 --- PDF Export Engine

### Do

1.  Load the original PDF bytes in the browser.
2.  Apply page deletion, ordering, rotation, and blank-page operations.
3.  Apply text, shapes, drawings, images, and signatures at accurate PDF
    coordinates.
4.  Preserve opacity, line width, alignment, and page dimensions where
    supported.
5.  Add export progress and meaningful error states.
6.  Download the generated PDF with a sensible filename.
7.  Reopen the downloaded file in a PDF viewer and verify actual
    content.

### Important technical rules

-   PDF coordinates and canvas coordinates use different origins; handle
    Y-axis conversion.
-   Use appropriate font embedding for text where needed.
-   Rasterization can reduce editability or quality; choose vector
    output where practical.
-   Do not claim that adding a text box edits existing PDF text.
-   A white/black rectangle over content is only visual covering, not
    secure redaction. Do not label it secure redaction.
-   If a PDF contains unsupported features, report limitations rather
    than silently dropping content.

### Done when

-   Exported PDFs open in standard viewers.
-   Edits appear in the correct places.
-   Page operations are reflected in the file.
-   Original document bytes were not mutated during editing.
-   Export failures are handled gracefully.

### Prompt to use

> Implement Phase 4 only after verifying Phases 1--3. Build the
> browser-only export pipeline using pdf-lib or another justified
> compatible client-side approach. Apply page operations and all
> supported editing objects with accurate coordinate conversion, correct
> opacity, and suitable font/image handling. Add export progress, error
> handling, and direct browser download. Do not claim existing text was
> edited if the implementation only overlays new text. Do not claim
> opaque rectangles provide secure redaction. Test the downloaded PDF
> itself by reopening it and checking text, drawings, images,
> signatures, page order, rotation, and dimensions. Update project docs
> and report actual results.

------------------------------------------------------------------------

## Phase 5 --- Advanced Features

### Recommended order

1.  Watermarks.
2.  Page numbers and headers/footers.
3.  Merge another PDF into the current document.
4.  Extract/split selected pages.
5.  PDF metadata editing.
6.  Optional password-protected PDF support, if library/browser
    constraints allow it.
7.  Optional OCR for scanned PDFs, only if a reliable browser-based
    implementation is practical.

### Done when

Each feature has its own tested acceptance criteria and works in the
exported PDF.

### Prompt to use

> Implement Phase 5 features incrementally, one feature at a time, after
> verifying the core editor and export. Start with watermarks and page
> numbers, then PDF merge/split and metadata. Assess password support
> and browser-based OCR separately before implementation. Keep document
> processing local and avoid adding unrelated dependencies. Test each
> feature in the exported file, update project docs, and do not mark
> features complete until verified.

------------------------------------------------------------------------

## Phase 6 --- Quality, Security & Performance

### Do

1.  Test small and large multi-page PDFs.
2.  Optimize rendering with lazy rendering/virtualization where
    appropriate.
3.  Clean up PDF.js tasks, Fabric canvases, listeners, and temporary
    resources.
4.  Test keyboard shortcuts and responsive layouts.
5.  Add accessible labels, focus states, and clear error messages.
6.  Test malformed, encrypted, rotated, image-heavy, and scanned PDFs.
7.  Check that no PDF content is sent to external services.
8.  Run production build and regression tests.

### Done when

-   Production build passes.
-   Core workflows work reliably.
-   Known limitations are documented.
-   Memory and rendering behavior are acceptable on tested documents.

### Prompt to use

> Perform Phase 6 quality assurance without rewriting working
> architecture. Audit performance, memory cleanup, accessibility,
> responsiveness, keyboard shortcuts, error handling, and local-only
> document processing. Run regression tests for upload, rendering,
> editing, page operations, export, and advanced features. Fix verified
> bugs, run the production build, and update the feature status
> honestly. Report tested browser/environment details and known
> limitations.

------------------------------------------------------------------------

# Rules for every phase

1.  Inspect before editing.
2.  Read the project brain documents before coding.
3.  Work only on the current phase.
4.  Preserve existing working features.
5.  Do not rewrite the whole app unless there is a documented technical
    reason.
6.  Do not add a backend, database, login, cloud storage, or external
    PDF API.
7.  Do not add fake buttons or mock success states.
8.  Run build/tests and report real outcomes.
9.  Update documentation after implementation.
10. Mark `[x]` only when implementation and verification are complete.
11. If a test fails, fix it before proceeding.
12. Keep a list of technical limitations and unresolved bugs.
13. Prefer small, reviewable changes over a giant code dump.
14. Do not proceed to the next phase until current acceptance criteria
    pass.

# Final Master Prompt --- Use at the Start of Every New Coding Session

> You are the senior frontend engineer responsible for this existing
> Frontend-Only PDF Editor.
>
> Before coding, read `PROJECT_BRAIN.md`, `IMPLEMENTATION_PLAN.md`,
> `DEVELOPMENT_RULES.md`, and `FEATURE_STATUS.md`. Inspect the current
> repository and verify the actual code state; do not assume previous
> progress claims are correct.
>
> Implement only the phase I explicitly request. Follow its checklist
> and acceptance criteria. Preserve working functionality, use
> compatible dependencies, keep PDF processing entirely in the browser,
> and do not introduce backend services, databases, cloud storage, or
> external PDF-processing APIs.
>
> Write maintainable, modular code. Avoid fake tools, placeholder
> success messages, unnecessary rewrites, duplicated logic, and
> unverified claims. Test actual behavior, run the production build, fix
> regressions, and update project documentation. Mark features complete
> only after they have been implemented and verified.
>
> At the end, report files changed, functionality implemented, commands
> executed, actual test/build results, known limitations, and remaining
> tasks. If a requirement cannot be implemented reliably with the
> current architecture, explain the limitation and propose a concrete
> alternative rather than pretending it works.
>
> Begin by checking the current project state, then work on the
> requested phase only.

------------------------------------------------------------------------

# Suggested execution order

1.  Phase 0: Audit and setup.
2.  Phase 1: Upload and rendering.
3.  Phase 2: Editing tools.
4.  Phase 3: Undo/redo and page operations.
5.  Phase 4: Export.
6.  Phase 5: Advanced features.
7.  Phase 6: QA and optimization.

**Important:** If an AI tool reports that a phase is complete, verify
the application yourself. A successful build does not prove that PDF
editing or exported content is correct.
