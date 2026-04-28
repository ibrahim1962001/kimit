import React, { createContext, useContext, useState, useCallback } from 'react';
import type { DatasetInfo } from '../types';

interface DataState {
  info: DatasetInfo | null;
  history: DatasetInfo[]; // Undo Engine Snapshots
  activeFilters: Record<string, string>;
}

interface DataContextType extends DataState {
  setDataset: (newInfo: DatasetInfo) => void;
  rollback: () => void;
  setFilter: (col: string, val: string) => void;
  clearFilters: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DataState>({
    info: null,
    history: [],
    activeFilters: {}
  });

  const setDataset = useCallback((newInfo: DatasetInfo) => {
    setState(prev => ({
      ...prev,
      // Save current state to history before updating (Undo Engine)
      // Limit history to 10 steps for performance
      history: prev.info ? [...prev.history, prev.info].slice(-10) : prev.history,
      info: JSON.parse(JSON.stringify(newInfo)) // Deep copy to ensure history remains immutable
    }));
  }, []);

  const rollback = useCallback(() => {
    setState(prev => {
      if (prev.history.length === 0) return prev;
      const lastSnapshot = prev.history[prev.history.length - 1];
      return {
        ...prev,
        info: lastSnapshot,
        history: prev.history.slice(0, -1)
      };
    });
  }, []);

  const setFilter = useCallback((col: string, val: string) => {
    setState(prev => ({
      ...prev,
      activeFilters: { ...prev.activeFilters, [col]: val }
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({ ...prev, activeFilters: {} }));
  }, []);

  return (
    <DataContext.Provider value={{ ...state, setDataset, rollback, setFilter, clearFilters }}>
      {children}
    </DataContext.Provider>
  );
};

export const useKimitData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useKimitData must be used within DataProvider');
  return context;
};
