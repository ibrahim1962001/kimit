import { useContext } from 'react';
import { DataContext } from '../contexts/DataContext';

export const useKimitData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useKimitData must be used within DataProvider');
  return context;
};
