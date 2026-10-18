/**
 * Custom Hook: useEditorHistory
 * Manages undo/redo stacks for editing actions and page operations.
 */

import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY_STATES = 30;

/**
 * Deep clone state snapshot
 */
function cloneState(state) {
  try {
    return JSON.parse(JSON.stringify(state));
  } catch (err) {
    console.error('Failed to clone history snapshot:', err);
    return state;
  }
}

export function useEditorHistory() {
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const isUndoRedoActionRef = useRef(false);

  /**
   * Save a state snapshot to history before making a modification.
   * @param {object} currentState - { pages, pageEdits }
   */
  const recordChange = useCallback((currentState) => {
    if (isUndoRedoActionRef.current) {
      isUndoRedoActionRef.current = false;
      return;
    }

    setPast((prevPast) => {
      const snapshot = cloneState(currentState);
      const updated = [...prevPast, snapshot];
      if (updated.length > MAX_HISTORY_STATES) {
        return updated.slice(updated.length - MAX_HISTORY_STATES);
      }
      return updated;
    });

    // Clear redo stack on new action
    setFuture([]);
  }, []);

  /**
   * Undo the previous action and return the restored state.
   * @param {object} currentState
   * @returns {object|null}
   */
  const undo = useCallback((currentState) => {
    if (past.length === 0) return null;

    const previousSnapshot = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    isUndoRedoActionRef.current = true;
    setPast(newPast);
    setFuture((prevFuture) => [cloneState(currentState), ...prevFuture]);

    return previousSnapshot;
  }, [past]);

  /**
   * Redo the undone action and return the restored state.
   * @param {object} currentState
   * @returns {object|null}
   */
  const redo = useCallback((currentState) => {
    if (future.length === 0) return null;

    const nextSnapshot = future[0];
    const newFuture = future.slice(1);

    isUndoRedoActionRef.current = true;
    setFuture(newFuture);
    setPast((prevPast) => [...prevPast, cloneState(currentState)]);

    return nextSnapshot;
  }, [future]);

  /**
   * Clear all history stacks (e.g. when opening a new document)
   */
  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
    isUndoRedoActionRef.current = false;
  }, []);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
    recordChange,
    undo,
    redo,
    clearHistory,
  };
}
