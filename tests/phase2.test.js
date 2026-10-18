/**
 * Automated Verification Tests for Phase 2 (Interactive Editing Tools)
 * Run via Node.js: node tests/phase2.test.js
 */

import assert from 'node:assert';

// Polyfill minimal browser globals for Fabric.js in Node
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      measureText: () => ({ width: 60 }),
      fillRect: () => {},
      clearRect: () => {},
      save: () => {},
      restore: () => {},
    }),
  }),
};

import { addTextBox } from '../src/features/editing/textTools.js';
import {
  addRectangle,
  addCircle,
  addLine,
  addArrow,
} from '../src/features/editing/shapeTools.js';
import {
  enablePenMode,
  enableHighlighterMode,
  disableDrawingMode,
} from '../src/features/editing/drawingTools.js';
import { extractObjectProperties } from '../src/utils/objectProperties.js';
import {
  normalizeFontFamily,
  createInPlaceTextBox,
  extractPageTextBlocks,
  reflowParagraphText,
} from '../src/features/editing/pdfContentEditor.js';

// Mock Fabric Canvas for headless testing
function createMockCanvas(width = 612, height = 792) {
  const objects = [];
  let activeObj = null;

  return {
    width,
    height,
    isDrawingMode: false,
    freeDrawingBrush: null,
    getCenterPoint: () => ({ x: width / 2, y: height / 2 }),
    add: (obj) => {
      objects.push(obj);
      return obj;
    },
    remove: (obj) => {
      const idx = objects.indexOf(obj);
      if (idx !== -1) objects.splice(idx, 1);
    },
    getObjects: () => [...objects],
    setActiveObject: (obj) => {
      activeObj = obj;
    },
    getActiveObject: () => activeObj,
    discardActiveObject: () => {
      activeObj = null;
    },
    renderAll: () => {},
    toJSON: () => ({
      objects: objects.map((o) => ({
        type: o.type,
        left: o.left,
        top: o.top,
        fill: o.fill,
        stroke: o.stroke,
      })),
    }),
  };
}

async function runPhase2Tests() {
  console.log('--- Running Phase 2 Automated Tests ---');

  // Test 1: Text Tool
  console.log('Test 1: Text Box creation and typography defaults...');
  const canvas1 = createMockCanvas();
  const textObj = addTextBox(canvas1, {
    text: 'Invoice Title',
    fontSize: 24,
    fontFamily: 'Helvetica',
    fill: '#1e293b',
    left: 80,
    top: 100,
  });

  assert(textObj, 'addTextBox must return a Textbox instance');
  assert.strictEqual(textObj.type, 'textbox');
  assert.strictEqual(textObj.text, 'Invoice Title');
  assert.strictEqual(textObj.fontSize, 24);
  assert.strictEqual(textObj.fontFamily, 'Helvetica');
  assert.strictEqual(textObj.fill, '#1e293b');
  assert.strictEqual(textObj.left, 80);
  assert.strictEqual(textObj.top, 100);
  assert.strictEqual(canvas1.getObjects().length, 1);
  assert.strictEqual(canvas1.getActiveObject(), textObj, 'Created text box must become active object');
  console.log('✔ Test 1 Passed: Text Box creation verified.');

  // Test 2: Shape Tools (Rectangle, Circle, Line, Arrow)
  console.log('Test 2: Geometric Shape creation (Rect, Circle, Line, Arrow)...');
  const canvas2 = createMockCanvas();

  const rect = addRectangle(canvas2, { left: 50, top: 50, width: 120, height: 80, stroke: '#2563eb' });
  assert.strictEqual(rect.type, 'rect');
  assert.strictEqual(rect.width, 120);
  assert.strictEqual(rect.height, 80);
  assert.strictEqual(rect.stroke, '#2563eb');

  const circle = addCircle(canvas2, { left: 200, top: 50, radius: 40 });
  assert.strictEqual(circle.type, 'circle');
  assert.strictEqual(circle.radius, 40);

  const line = addLine(canvas2, { left: 50, top: 200, length: 180, strokeWidth: 4 });
  assert.strictEqual(line.type, 'line');
  assert.strictEqual(line.strokeWidth, 4);

  const arrow = addArrow(canvas2, { left: 50, top: 250, length: 150 });
  assert.strictEqual(arrow.type, 'group', 'Arrow should be a grouped object');

  assert.strictEqual(canvas2.getObjects().length, 4, 'All 4 shapes must be on canvas');
  console.log('✔ Test 2 Passed: Geometric shapes created and added successfully.');

  // Test 3: Drawing Modes (Pen & Highlighter)
  console.log('Test 3: Freehand Pen and Highlighter modes...');
  const canvas3 = createMockCanvas();

  // Enable Pen
  enablePenMode(canvas3, { color: '#dc2626', width: 4 });
  assert.strictEqual(canvas3.isDrawingMode, true, 'isDrawingMode must be true in pen mode');
  assert(canvas3.freeDrawingBrush, 'freeDrawingBrush must be instantiated');
  assert.strictEqual(canvas3.freeDrawingBrush.color, '#dc2626');
  assert.strictEqual(canvas3.freeDrawingBrush.width, 4);

  // Enable Highlighter
  enableHighlighterMode(canvas3, { color: 'rgba(250, 204, 21, 0.45)', width: 24 });
  assert.strictEqual(canvas3.isDrawingMode, true);
  assert.strictEqual(canvas3.freeDrawingBrush.color, 'rgba(250, 204, 21, 0.45)');
  assert.strictEqual(canvas3.freeDrawingBrush.width, 24);

  // Disable Drawing
  disableDrawingMode(canvas3);
  assert.strictEqual(canvas3.isDrawingMode, false, 'isDrawingMode must be false after disable');
  console.log('✔ Test 3 Passed: Pen and Highlighter modes configure brush correctly.');

  // Test 4: Properties Extraction
  console.log('Test 4: Object properties extraction for inspector...');
  const props = extractObjectProperties(rect);
  assert.strictEqual(props.type, 'rect');
  assert.strictEqual(props.left, 50);
  assert.strictEqual(props.top, 50);
  assert.strictEqual(props.width, 120);
  assert.strictEqual(props.height, 80);
  assert.strictEqual(props.stroke, '#2563eb');
  assert.strictEqual(props.opacity, 1);

  const textProps = extractObjectProperties(textObj);
  assert.strictEqual(textProps.type, 'textbox');
  assert.strictEqual(textProps.fontSize, 24);
  assert.strictEqual(textProps.fontFamily, 'Helvetica');
  console.log('✔ Test 4 Passed: Properties extraction produces expected plain representation.');

  // Test 5: Multi-Page Isolation
  console.log('Test 5: Multi-page state isolation...');
  const page1Canvas = createMockCanvas();
  const page2Canvas = createMockCanvas();

  addTextBox(page1Canvas, { text: 'Page 1 Header' });
  addRectangle(page2Canvas, { width: 100, height: 100 });

  assert.strictEqual(page1Canvas.getObjects().length, 1);
  assert.strictEqual(page1Canvas.getObjects()[0].type, 'textbox');

  assert.strictEqual(page2Canvas.getObjects().length, 1);
  assert.strictEqual(page2Canvas.getObjects()[0].type, 'rect');

  // Verify JSON serializations remain independent
  const page1Json = page1Canvas.toJSON();
  const page2Json = page2Canvas.toJSON();
  assert.notDeepStrictEqual(page1Json, page2Json);
  assert.strictEqual(page1Json.objects[0].type, 'textbox');
  assert.strictEqual(page2Json.objects[0].type, 'rect');
  // Test 6: In-Place PDF Content Editing Textbox
  console.log('Test 6: In-place PDF text content replacement...');
  assert.strictEqual(normalizeFontFamily('TimesNewRoman', 'serif'), 'Times');
  assert.strictEqual(normalizeFontFamily('CourierNew', 'monospace'), 'Courier');
  assert.strictEqual(normalizeFontFamily('Arial', 'sans-serif'), 'Helvetica');

  const contentCanvas = createMockCanvas();
  const mockBlock = {
    id: 'text-block-1-1',
    str: 'Original Document Header',
    left: 80,
    top: 120,
    width: 240,
    height: 28,
    fontSize: 20,
    fontFamily: 'Helvetica',
    pdfX: 80,
    pdfY: 672,
    pdfWidth: 240,
    pdfHeight: 28,
    pdfFontSize: 20,
  };

  const inPlaceBox = createInPlaceTextBox(contentCanvas, mockBlock);
  assert.ok(inPlaceBox, 'In-place text box must be created');
  assert.strictEqual(inPlaceBox.text, 'Original Document Header');
  assert.strictEqual(inPlaceBox.fontSize, 20);
  assert.strictEqual(inPlaceBox.fontFamily, 'Helvetica');
  assert.strictEqual(inPlaceBox.backgroundColor, '#ffffff', 'Background must be white to mask original PDF text');
  assert.strictEqual(inPlaceBox.isPdfContentEdit, true);
  console.log('✔ Test 6 Passed: In-place text replacement box created with exact font, size, and whiteout mask.');

  // Test 7: Line method selection and automatic paragraph reflow
  console.log('Test 7: Line method selection and automatic paragraph reflow...');
  const mockPage = {
    getViewport: () => ({
      convertToViewportPoint: (x, y) => [x, 792 - y],
    }),
    getTextContent: async () => ({
      items: [
        // Summary line 1 (baseline at y=650)
        { str: 'Full Stack Developer with hands-on experience in MERN Stack.', transform: [11, 0, 0, 11, 50, 650], width: 350, fontName: 'g_font1' },
        // Summary line 2 (baseline at y=636, delta y = 14)
        { str: 'Experienced in developing REST APIs and web applications.', transform: [11, 0, 0, 11, 50, 636], width: 320, fontName: 'g_font1' },
      ],
      styles: {
        g_font1: { fontFamily: 'Helvetica', ascent: 0.76, descent: 0.20 },
      },
    }),
  };
  const mockPdfDoc = {
    getPage: async () => mockPage,
  };

  const lineBlocks = await extractPageTextBlocks(mockPdfDoc, 1, 1.0, 0);
  assert.strictEqual(lineBlocks.length, 2, 'Line method extracts each line as an independent selectable block');
  assert.strictEqual(lineBlocks[0].isParagraph, false);
  assert.strictEqual(lineBlocks[0].isParagraphMember, true, 'Lines in paragraph cluster should link as paragraph members');
  assert.strictEqual(lineBlocks[0].paraLines.length, 2);

  // Test automatic paragraph reflow when text in line 1 is modified or deleted
  const reflowed = reflowParagraphText(lineBlocks[0].paraLines, lineBlocks[0].id, 'Full Stack Developer.');
  assert.strictEqual(reflowed.length, 2);
  assert.ok(reflowed[0].text.startsWith('Full Stack Developer. Experienced'));
  assert.strictEqual(reflowed[0].originalText, lineBlocks[0].str);

  // Overlap verification: ensure line 1's bottom whiteout margin leaves clearance above line 2's ascenders
  const line1BaseVy = lineBlocks[0].baseVy; // 792 - 650 = 142
  const line2BaseVy = lineBlocks[1].baseVy; // 792 - 636 = 156
  const fontSize = 11;
  const line1WhiteoutBottomVy = line1BaseVy + fontSize * 0.20; // 142 + 2.2 = 144.2
  const line2TopVy = line2BaseVy - fontSize * 0.76; // 156 - 8.36 = 147.64
  assert.ok(line1WhiteoutBottomVy < line2TopVy, `Line 1 whiteout bottom (${line1WhiteoutBottomVy}) must be strictly above line 2 top (${line2TopVy})`);
  console.log('✔ Test 7 Passed: Line method selection and automatic paragraph reflow verified.');

  console.log('\n--- All Phase 2 Automated Tests Passed Successfully! ---');
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 Test Failed:', err);
  process.exit(1);
});
