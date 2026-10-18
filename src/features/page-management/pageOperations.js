/**
 * Page Management Operations Module
 * Pure functions for document page manipulation: rotate, reorder, delete, and blank page insertion.
 */

/**
 * Generate unique ID for a page
 */
export function generatePageId(prefix = 'page') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Initialize page objects from loaded PDF metadata.
 * @param {Array<object>} pagesMeta
 * @returns {Array<object>}
 */
export function initializePagesState(pagesMeta = []) {
  return pagesMeta.map((meta, index) => ({
    id: `page-orig-${index + 1}`,
    originalIndex: meta.pageNumber || index + 1,
    isBlank: false,
    width: meta.width || 612,
    height: meta.height || 792,
    aspectRatio: (meta.width || 612) / (meta.height || 792),
    rotation: meta.rotation || 0,
  }));
}

/**
 * Rotate a page by 90 degrees clockwise or counter-clockwise.
 * @param {Array<object>} pages
 * @param {string} pageId
 * @param {'cw'|'ccw'} [direction='cw']
 * @returns {Array<object>}
 */
export function rotatePage(pages, pageId, direction = 'cw') {
  const delta = direction === 'cw' ? 90 : -90;

  return pages.map((page) => {
    if (page.id !== pageId) return page;

    const newRotation = (page.rotation + delta + 360) % 360;

    return {
      ...page,
      rotation: newRotation,
    };
  });
}

/**
 * Move a page up (earlier in document) or down (later in document).
 * @param {Array<object>} pages
 * @param {string} pageId
 * @param {'up'|'down'} direction
 * @returns {Array<object>}
 */
export function movePage(pages, pageId, direction) {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1) return pages;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= pages.length) return pages;

  const newPages = [...pages];
  const [removed] = newPages.splice(index, 1);
  newPages.splice(targetIndex, 0, removed);
  return newPages;
}

/**
 * Reorder a page from one index to another.
 * @param {Array<object>} pages
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Array<object>}
 */
export function reorderPages(pages, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= pages.length || toIndex < 0 || toIndex >= pages.length) {
    return pages;
  }
  const newPages = [...pages];
  const [moved] = newPages.splice(fromIndex, 1);
  newPages.splice(toIndex, 0, moved);
  return newPages;
}

/**
 * Delete a page by ID.
 * Returns null if attempting to delete the only page remaining.
 * @param {Array<object>} pages
 * @param {string} pageId
 * @returns {{ pages: Array<object>, deleted: boolean, error?: string }}
 */
export function deletePage(pages, pageId) {
  if (pages.length <= 1) {
    return {
      pages,
      deleted: false,
      error: 'Cannot delete the only remaining page in the document.',
    };
  }

  const updatedPages = pages.filter((p) => p.id !== pageId);
  return {
    pages: updatedPages,
    deleted: true,
  };
}

/**
 * Insert a clean blank page into the document.
 * @param {Array<object>} pages
 * @param {number} [targetIndex] - Index where blank page is inserted (defaults to end)
 * @param {object} [dimensions] - { width, height }
 * @returns {{ pages: Array<object>, newPageId: string }}
 */
export function addBlankPage(pages, targetIndex = -1, dimensions = { width: 612, height: 792 }) {
  const newPageId = generatePageId('blank');
  const blankPage = {
    id: newPageId,
    originalIndex: null, // Blank pages have no original PDF page
    isBlank: true,
    width: dimensions.width || 612,
    height: dimensions.height || 792,
    aspectRatio: (dimensions.width || 612) / (dimensions.height || 792),
    rotation: 0,
  };

  const newPages = [...pages];
  const insertAt = targetIndex >= 0 && targetIndex <= pages.length ? targetIndex : pages.length;
  newPages.splice(insertAt, 0, blankPage);

  return {
    pages: newPages,
    newPageId,
  };
}
