/**
 * Technology Evaluation: In-Browser PDF Editing Engines
 *
 * Comparative architectural analysis of:
 * 1. ONLYOFFICE Docs Community
 * 2. MuPDF.js (Artifex)
 * 3. Client-Side Hybrid Architecture (PDF.js + pdf-lib + Semantic Document Flow)
 */

export const ENGINE_EVALUATION = {
  onlyoffice: {
    name: 'ONLYOFFICE Docs Community Edition',
    license: 'GNU AGPL v3',
    deployment: 'Client-Server Backend Required (Docker / Linux VM with PostgreSQL, Redis, RabbitMQ, C++ core)',
    clientSideOnly: false,
    hardwareRequirement: '4GB - 8GB RAM, 40GB disk storage',
    interactiveReflow: true, // within its own server-backed document editor
    offlineCapability: false,
    feasibilityVerdict: 'UNFEASIBLE for client-side static web application',
    rationale: [
      'ONLYOFFICE Document Server cannot run client-side in the browser.',
      'The frontend library is an iframe connector (DocumentEditor) requiring an active remote server daemon.',
      'AGPL v3 license imposes viral copyleft obligations on network-deployed applications.',
      'Contradicts project requirement for lightweight, client-side, zero-backend browser execution.',
    ],
  },

  mupdf: {
    name: 'MuPDF.js (Artifex Software)',
    license: 'GNU AGPL v3 or Commercial (Paid)',
    deployment: 'Client-Side WebAssembly (Emscripten build ~15MB WASM)',
    clientSideOnly: true,
    hardwareRequirement: 'Browser WASM runtime',
    interactiveReflow: false,
    offlineCapability: true,
    feasibilityVerdict: 'UNSUITABLE for automatic paragraph reflow and AGPL-constrained',
    rationale: [
      'MuPDF is a PDF rendering and parsing engine, NOT a word-processing or text reflow engine.',
      'Replacing text in MuPDF requires low-level PDF operator editing at fixed 2D point positions, identical to pdf-lib.',
      'MuPDF does not provide an interactive browser-based text reflow, line-wrapping, or section displacement UI.',
      'AGPL v3 licensing requires open-sourcing the entire proprietary codebase or purchasing costly Artifex commercial licenses.',
      'Adds significant WASM binary overhead (~15MB) without solving the layout reflow problem.',
    ],
  },

  hybridArchitecture: {
    name: 'Dual-Mode Architecture (PDF.js + pdf-lib + Semantic Document Flow)',
    license: 'Apache 2.0 (PDF.js) + MIT (pdf-lib, Fabric.js)',
    deployment: '100% Client-Side Pure JavaScript & WebAssembly',
    clientSideOnly: true,
    hardwareRequirement: 'Standard browser memory footprint (< 100MB)',
    interactiveReflow: true, // via Mode 2 Document Flow Editor
    offlineCapability: true,
    feasibilityVerdict: 'SELECTED OPTIMAL ARCHITECTURE',
    rationale: [
      'Completely free and open-source with permissive business-friendly licenses (MIT & Apache 2.0).',
      'Zero backend server required: runs 100% in-browser offline on desktop and mobile devices.',
      'Solves the fundamental PDF limitation by separating concerns into two explicit modes:',
      '  Mode 1 (Original PDF Editor): Strictly preserves original 2D layout fidelity, original typography, and coordinates with zero downstream element shifting.',
      '  Mode 2 (Document Flow Editor): Converts fixed 2D PDF coordinates into a semantic document flow (Word/Docs-like), allowing unlimited text expansion and natural paragraph reflow with clear fidelity warnings.',
    ],
  },
};

export const ENGINE_COMPARISON_MATRIX = [
  {
    name: ENGINE_EVALUATION.onlyoffice.name,
    license: ENGINE_EVALUATION.onlyoffice.license,
    clientSideOnly: ENGINE_EVALUATION.onlyoffice.clientSideOnly,
    interactiveReflow: ENGINE_EVALUATION.onlyoffice.interactiveReflow,
    verdict: 'Rejected for In-Browser App',
    reason: ENGINE_EVALUATION.onlyoffice.rationale[0],
  },
  {
    name: ENGINE_EVALUATION.mupdf.name,
    license: ENGINE_EVALUATION.mupdf.license,
    clientSideOnly: ENGINE_EVALUATION.mupdf.clientSideOnly,
    interactiveReflow: ENGINE_EVALUATION.mupdf.interactiveReflow,
    verdict: 'Rejected for In-Place Editor',
    reason: ENGINE_EVALUATION.mupdf.rationale[0],
  },
  {
    name: ENGINE_EVALUATION.hybridArchitecture.name,
    license: ENGINE_EVALUATION.hybridArchitecture.license,
    clientSideOnly: ENGINE_EVALUATION.hybridArchitecture.clientSideOnly,
    interactiveReflow: ENGINE_EVALUATION.hybridArchitecture.interactiveReflow,
    verdict: 'Selected Architecture',
    reason: ENGINE_EVALUATION.hybridArchitecture.rationale[0],
  },
];

export const ARCHITECTURE_RECOMMENDATION = {
  status: 'APPROVED',
  selectedEngine: 'Dual-Mode Hybrid Client Architecture',
  mode1: 'Original PDF Editor (PDF.js + Fabric.js + in-place direct editing, zero shifting, 100% layout fidelity)',
  mode2: 'Document Flow Editor (Semantic DocumentModel + FlowLayoutEngine + Word-like continuous reflow + pdf-lib flow export)',
};

