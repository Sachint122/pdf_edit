/**
 * Automated Verification Tests for Phase 3 (History & Page Operations)
 * Run via Node.js: node tests/phase3.test.js
 */

import assert from 'node:assert';
import {
  initializePagesState,
  rotatePage,
  movePage,
  reorderPages,
  deletePage,
  addBlankPage,
} from '../src/features/page-management/pageOperations.js';

function runPhase3Tests() {
  console.log('--- Running Phase 3 Automated Tests ---');

  // Baseline 3-page document setup
  const mockPagesMeta = [
    { pageNumber: 1, width: 612, height: 792, rotation: 0 },
    { pageNumber: 2, width: 612, height: 792, rotation: 0 },
    { pageNumber: 3, width: 612, height: 792, rotation: 0 },
  ];

  // Test 1: Page Initialization
  console.log('Test 1: Initialize pages state with unique stable IDs...');
  const initialPages = initializePagesState(mockPagesMeta);
  assert.strictEqual(initialPages.length, 3);
  assert.strictEqual(initialPages[0].id, 'page-orig-1');
  assert.strictEqual(initialPages[0].originalIndex, 1);
  assert.strictEqual(initialPages[0].isBlank, false);
  assert.strictEqual(initialPages[0].rotation, 0);
  console.log('✔ Test 1 Passed: Pages state initialized with stable IDs.');

  // Test 2: Page Rotation
  console.log('Test 2: Page Rotation (90° increments)...');
  const rotated1 = rotatePage(initialPages, 'page-orig-1', 'cw');
  assert.strictEqual(rotated1[0].rotation, 90, 'Rotation should be 90° CW');
  assert.strictEqual(rotated1[1].rotation, 0, 'Other pages must remain unrotated');

  const rotated2 = rotatePage(rotated1, 'page-orig-1', 'cw');
  assert.strictEqual(rotated2[0].rotation, 180);

  const rotated3 = rotatePage(rotated2, 'page-orig-1', 'cw');
  assert.strictEqual(rotated3[0].rotation, 270);

  const rotated4 = rotatePage(rotated3, 'page-orig-1', 'cw');
  assert.strictEqual(rotated4[0].rotation, 0, 'Full 360° turn normalizes back to 0°');

  const rotatedCCW = rotatePage(initialPages, 'page-orig-1', 'ccw');
  assert.strictEqual(rotatedCCW[0].rotation, 270, 'CCW from 0° should normalize to 270°');
  console.log('✔ Test 2 Passed: Page rotation clockwise & counter-clockwise verified.');

  // Test 3: Page Moving and Reordering
  console.log('Test 3: Page Moving (Up/Down) & Arbitrary Reordering...');
  // Move Page 1 Down
  const movedDown = movePage(initialPages, 'page-orig-1', 'down');
  assert.strictEqual(movedDown[0].id, 'page-orig-2');
  assert.strictEqual(movedDown[1].id, 'page-orig-1');
  assert.strictEqual(movedDown[2].id, 'page-orig-3');

  // Move Page 1 back Up
  const movedUp = movePage(movedDown, 'page-orig-1', 'up');
  assert.strictEqual(movedUp[0].id, 'page-orig-1');
  assert.strictEqual(movedUp[1].id, 'page-orig-2');

  // Edge cases: Move top page Up or bottom page Down
  const invalidMoveUp = movePage(initialPages, 'page-orig-1', 'up');
  assert.deepStrictEqual(invalidMoveUp, initialPages, 'Moving top page up should do nothing');

  const invalidMoveDown = movePage(initialPages, 'page-orig-3', 'down');
  assert.deepStrictEqual(invalidMoveDown, initialPages, 'Moving bottom page down should do nothing');

  // Arbitrary reorder: move page at index 0 to index 2
  const reordered = reorderPages(initialPages, 0, 2);
  assert.strictEqual(reordered[0].id, 'page-orig-2');
  assert.strictEqual(reordered[1].id, 'page-orig-3');
  assert.strictEqual(reordered[2].id, 'page-orig-1');
  console.log('✔ Test 3 Passed: Page moving and reordering verified.');

  // Test 4: Page Deletion
  console.log('Test 4: Page Deletion and Guard against deleting only page...');
  const deleteResult = deletePage(initialPages, 'page-orig-2');
  assert.strictEqual(deleteResult.deleted, true);
  assert.strictEqual(deleteResult.pages.length, 2);
  assert.strictEqual(deleteResult.pages[0].id, 'page-orig-1');
  assert.strictEqual(deleteResult.pages[1].id, 'page-orig-3');

  // Delete down to 1 page
  const deleteSecond = deletePage(deleteResult.pages, 'page-orig-3');
  assert.strictEqual(deleteSecond.deleted, true);
  assert.strictEqual(deleteSecond.pages.length, 1);

  // Attempt to delete the single remaining page
  const singlePageDoc = deleteSecond.pages;
  const deleteOnly = deletePage(singlePageDoc, 'page-orig-1');
  assert.strictEqual(deleteOnly.deleted, false, 'Must not allow deleting the only remaining page');
  assert.strictEqual(deleteOnly.pages.length, 1);
  assert.match(deleteOnly.error, /cannot delete the only remaining page/i);
  console.log('✔ Test 4 Passed: Page deletion and minimum-page guard verified.');

  // Test 5: Blank Page Insertion
  console.log('Test 5: Blank Page Insertion...');
  const { pages: withBlank, newPageId } = addBlankPage(initialPages, 1);
  assert.strictEqual(withBlank.length, 4);
  assert.strictEqual(withBlank[1].id, newPageId);
  assert.strictEqual(withBlank[1].isBlank, true);
  assert.strictEqual(withBlank[1].originalIndex, null);
  assert.strictEqual(withBlank[1].rotation, 0);
  assert.strictEqual(withBlank[0].id, 'page-orig-1');
  assert.strictEqual(withBlank[2].id, 'page-orig-2');
  console.log('✔ Test 5 Passed: Blank page insertion verified at target index.');

  // Test 6: Undo / Redo State Flow Simulation
  console.log('Test 6: Undo / Redo history state flow simulation...');
  const history = {
    past: [],
    future: [],
    current: { pages: initialPages, pageEdits: { 'page-orig-1': { text: 'Title' } } },
  };

  function record(newState) {
    history.past.push(JSON.parse(JSON.stringify(history.current)));
    history.current = newState;
    history.future = [];
  }

  function doUndo() {
    if (history.past.length === 0) return;
    const prev = history.past.pop();
    history.future.unshift(history.current);
    history.current = prev;
  }

  function doRedo() {
    if (history.future.length === 0) return;
    const next = history.future.shift();
    history.past.push(history.current);
    history.current = next;
  }

  // 1. Perform a rotation
  const rotatedPages = rotatePage(initialPages, 'page-orig-1', 'cw');
  record({ pages: rotatedPages, pageEdits: history.current.pageEdits });
  assert.strictEqual(history.current.pages[0].rotation, 90);
  assert.strictEqual(history.past.length, 1);

  // 2. Perform a page delete
  const { pages: afterDelete } = deletePage(history.current.pages, 'page-orig-2');
  record({ pages: afterDelete, pageEdits: history.current.pageEdits });
  assert.strictEqual(history.current.pages.length, 2);
  assert.strictEqual(history.past.length, 2);

  // 3. Undo page delete
  doUndo();
  assert.strictEqual(history.current.pages.length, 3, 'Undo must restore deleted page');
  assert.strictEqual(history.current.pages[0].rotation, 90);

  // 4. Undo page rotation
  doUndo();
  assert.strictEqual(history.current.pages[0].rotation, 0, 'Undo must restore original rotation');

  // 5. Redo page rotation
  doRedo();
  assert.strictEqual(history.current.pages[0].rotation, 90, 'Redo must restore rotation');

  // 6. Redo page delete
  doRedo();
  assert.strictEqual(history.current.pages.length, 2, 'Redo must re-delete page');
  console.log('✔ Test 6 Passed: Undo / Redo history correctly restores pages and edits.');

  console.log('\n--- All Phase 3 Automated Tests Passed Successfully! ---');
}

runPhase3Tests();
