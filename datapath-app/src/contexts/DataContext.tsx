/**
 * DataContext.tsx — Enhanced with Cross-Filter Engine
 *
 * Cross-Filtering: clicking a chart element (bar / pie slice) sets
 * `crossFilter` which is broadcast to all DataGrid & Chart consumers
 * so only that segment's data is shown globally.
 */

import React, { createContext, useState, useCallback, useMemo } from 'react';
import type { DatasetInfo, DataRow } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single cross-filter selection: column + value pair from a chart click */
export interface CrossFilterEntry {
  column: string;
  value: string;
}

interface DataState {
  info: DatasetInfo | null;
  history: DatasetInfo[]; // Undo Engine Snapshots
  activeFilters: Record<string, string>;
  /** Cross-filter selections from chart clicks */
  crossFilters: CrossFilterEntry[];
}

interface DataContextType extends DataState {
  setDataset: (newInfo: DatasetInfo | null) => void;
  rollback: () => void;
  setFilter: (col: string, val: string) => void;
  clearFilters: () => void;
  resetData: () => void;
  /** Set (or replace) the cross-filter from a chart click event */
  setCrossFilter: (column: string, value: string) => void;
  /** Add an additional cross-filter (multi-select mode) */
  addCrossFilter: (column: string, value: string) => void;
  /** Remove a specific cross-filter entry */
  removeCrossFilter: (column: string) => void;
  /** Clear all cross-filter entries */
  clearCrossFilters: () => void;
  /** The derived, cross-filtered version of workData — ready for all consumers */
  crossFilteredData: DataRow[];
  /** True when at least one cross-filter is active */
  isCrossFiltered: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DataState>({
    info: null,
    history: [],
    activeFilters: {},
    crossFilters: [],
  });

  // ── Dataset management ────────────────────────────────────────────────────

  const setDataset = useCallback((newInfo: DatasetInfo | null) => {
    setState(prev => {
      if (!newInfo) {
        return { ...prev, info: null, crossFilters: [] };
      }
      return {
        ...prev,
        history: prev.info ? [...prev.history, prev.info].slice(-10) : prev.history,
        info: JSON.parse(JSON.stringify(newInfo)),
        crossFilters: [], // reset cross-filters when dataset changes
      };
    });
  }, []);

  const resetData = useCallback(() => {
    setState({
      info: null,
      history: [],
      activeFilters: {},
      crossFilters: [],
    });
  }, []);

  const rollback = useCallback(() => {
    setState(prev => {
      if (prev.history.length === 0) return prev;
      const lastSnapshot = prev.history[prev.history.length - 1];
      return {
        ...prev,
        info: lastSnapshot,
        history: prev.history.slice(0, -1),
        crossFilters: [],
      };
    });
  }, []);

  // ── Active filters (text search / NLQ) ───────────────────────────────────

  const setFilter = useCallback((col: string, val: string) => {
    setState(prev => ({
      ...prev,
      activeFilters: { ...prev.activeFilters, [col]: val },
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({ ...prev, activeFilters: {} }));
  }, []);

  // ── Cross-Filter Engine ───────────────────────────────────────────────────

  /**
   * setCrossFilter — replaces the current cross-filter with a single entry.
   * Clicking the same value a second time clears the filter (toggle behaviour).
   */
  const setCrossFilter = useCallback((column: string, value: string) => {
    setState(prev => {
      const existing = prev.crossFilters.find(cf => cf.column === column && cf.value === value);
      if (existing) {
        // Toggle off
        return { ...prev, crossFilters: prev.crossFilters.filter(cf => cf.column !== column) };
      }
      // Replace any filter on same column
      const filtered = prev.crossFilters.filter(cf => cf.column !== column);
      return { ...prev, crossFilters: [...filtered, { column, value }] };
    });
  }, []);

  /** addCrossFilter — stacks additional column/value pairs (AND logic) */
  const addCrossFilter = useCallback((column: string, value: string) => {
    setState(prev => {
      const filtered = prev.crossFilters.filter(cf => cf.column !== column);
      return { ...prev, crossFilters: [...filtered, { column, value }] };
    });
  }, []);

  const removeCrossFilter = useCallback((column: string) => {
    setState(prev => ({
      ...prev,
      crossFilters: prev.crossFilters.filter(cf => cf.column !== column),
    }));
  }, []);

  const clearCrossFilters = useCallback(() => {
    setState(prev => ({ ...prev, crossFilters: [] }));
  }, []);

  // ── Derived cross-filtered data ───────────────────────────────────────────

  const crossFilteredData = useMemo<DataRow[]>(() => {
    if (!state.info) return [];
    if (state.crossFilters.length === 0) return state.info.workData;

    return state.info.workData.filter(row => {
      return state.crossFilters.every(cf => {
        const cellVal = String(row[cf.column] ?? '');
        return cellVal === cf.value;
      });
    });
  }, [state.info, state.crossFilters]);

  const isCrossFiltered = state.crossFilters.length > 0;

  // ── Provider ──────────────────────────────────────────────────────────────

  return (
    <DataContext.Provider
      value={{
        ...state,
        setDataset,
        rollback,
        setFilter,
        clearFilters,
        resetData,
        setCrossFilter,
        addCrossFilter,
        removeCrossFilter,
        clearCrossFilters,
        crossFilteredData,
        isCrossFiltered,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
