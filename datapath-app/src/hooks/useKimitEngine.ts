import { useCallback } from 'react';
import { useKimitData } from './useKimitData';

export const useKimitEngine = () => {
  const { info, setDataset } = useKimitData();

  // 1. Remove Duplicates Action
  const removeDuplicates = useCallback(() => {
    if (!info) return;
    const seen = new Set();
    const cleaned = info.workData.filter(row => {
      const hash = JSON.stringify(row);
      return seen.has(hash) ? false : seen.add(hash);
    });
    
    setDataset({
      ...info,
      workData: cleaned,
      duplicates: 0
    });
  }, [info, setDataset]);

  // 2. Fill Missing Values Action
  const fillMissingValues = useCallback(() => {
    if (!info) return;
    const newData = info.workData.map(row => {
      const newRow = { ...row };
      Object.keys(newRow).forEach(key => {
        if (newRow[key] == null || newRow[key] === '') {
          // Heuristic: If numeric column, try to use median/mean or 0
          const colInfo = info.columns.find(c => c.name === key);
          if (colInfo?.type === 'numeric') {
             newRow[key] = colInfo.mean !== undefined ? Number(colInfo.mean.toFixed(2)) : 0;
          } else {
             newRow[key] = 'Fixed';
          }
        }
      });
      return newRow;
    });

    setDataset({ ...info, workData: newData, totalNulls: 0 });
  }, [info, setDataset]);

  // 3. Health Scorer logic
  const getHealthStats = useCallback(() => {
    if (!info) return { score: 0, label: 'N/A', color: '#888' };
    const totalCells = info.rows * info.columns.length;
    if (totalCells === 0) return { score: 100, label: 'Clean', color: '#10b981' };
    
    const nullPct = (info.totalNulls / totalCells) * 100;
    const score = Math.max(0, 100 - nullPct - (info.duplicates > 0 ? 5 : 0));
    
    let label = 'Critical';
    let color = '#ef4444';
    if (score > 85) { label = 'Excellent'; color = '#10b981'; }
    else if (score > 60) { label = 'Good'; color = '#f59e0b'; }
    
    return { score: Math.round(score), label, color };
  }, [info]);

  // 4. Command Execution (for AI integration)
  const executeDataCommand = useCallback(async (actionType: string, target?: string) => {
    if (!info) return;
    console.log(`Executing ${actionType} on ${target}`);
    
    if (actionType === 'remove_duplicates') {
      removeDuplicates();
    } else if (actionType === 'fill_nulls') {
      fillMissingValues();
    }
  }, [info, removeDuplicates, fillMissingValues]);

  return { removeDuplicates, fillMissingValues, getHealthStats, executeDataCommand };
};
