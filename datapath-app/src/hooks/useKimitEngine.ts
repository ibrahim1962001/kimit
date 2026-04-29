import { useCallback, useMemo } from 'react';
import { useKimitData } from './useKimitData';
import {
  calcAllIQR,
  calcCorrelationMatrix,
  calcGrowthIndicators,
  detectDateColumn,
  calcPredictions,
} from '../lib/stats';
import type { IQRResult, CorrelationMatrix, GrowthIndicator, PredictionResult } from '../lib/stats';

export type { IQRResult, CorrelationMatrix, GrowthIndicator, PredictionResult };

export const useKimitEngine = () => {
  const { info, setDataset } = useKimitData();

  // ── Derived helpers ──────────────────────────────────────
  const numericCols = useMemo(
    () => info?.columns.filter(c => c.type === 'numeric').map(c => c.name) ?? [],
    [info],
  );

  const dateCol = useMemo(
    () => (info ? detectDateColumn(info.workData, info.columns.map(c => c.name)) : undefined),
    [info],
  );

  // ── 1. Remove Duplicates ─────────────────────────────────
  const removeDuplicates = useCallback(() => {
    if (!info) return;
    const seen = new Set<string>();
    const cleaned = info.workData.filter(row => {
      const hash = JSON.stringify(row);
      return seen.has(hash) ? false : !!seen.add(hash);
    });
    setDataset({ ...info, workData: cleaned, duplicates: 0 });
  }, [info, setDataset]);

  // ── 2. Fill Missing Values ───────────────────────────────
  const fillMissingValues = useCallback(() => {
    if (!info) return;
    const newData = info.workData.map(row => {
      const newRow = { ...row };
      Object.keys(newRow).forEach(key => {
        if (newRow[key] == null || newRow[key] === '') {
          const colInfo = info.columns.find(c => c.name === key);
          newRow[key] = colInfo?.type === 'numeric'
            ? (colInfo.mean !== undefined ? Number(colInfo.mean.toFixed(2)) : 0)
            : 'Fixed';
        }
      });
      return newRow;
    });
    setDataset({ ...info, workData: newData, totalNulls: 0 });
  }, [info, setDataset]);

  // ── 3. Health Score ──────────────────────────────────────
  const getHealthStats = useCallback(() => {
    if (!info) return { score: 0, label: 'N/A', color: '#888' };
    const totalCells = info.rows * info.columns.length;
    if (totalCells === 0) return { score: 100, label: 'Clean', color: '#10b981' };
    const nullPct = (info.totalNulls / totalCells) * 100;
    const score = Math.max(0, 100 - nullPct - (info.duplicates > 0 ? 5 : 0));
    let label = 'Critical', color = '#ef4444';
    if (score > 85) { label = 'Excellent'; color = '#10b981'; }
    else if (score > 60) { label = 'Good'; color = '#f59e0b'; }
    return { score: Math.round(score), label, color };
  }, [info]);

  // ── 4. AI Command Router ─────────────────────────────────
  const executeDataCommand = useCallback(async (actionType: string, target?: string) => {
    if (!info) return;
    console.log(`Executing ${actionType} on ${target}`);
    if (actionType === 'remove_duplicates') removeDuplicates();
    else if (actionType === 'fill_nulls') fillMissingValues();
    else if (actionType === 'magic_clean') magicClean();
  }, [info, removeDuplicates, fillMissingValues]);

  // ── 5. Magic Clean (Dedup + Mean Fill in one pass) ───────
  /**
   * Atomic operation: removes duplicate rows, then fills null/empty
   * numeric values with the column mean. Single dataset update = one re-render.
   */
  const magicClean = useCallback(() => {
    if (!info) return;

    // Step 1: Deduplication
    const seen = new Set<string>();
    const deduped = info.workData.filter(row => {
      const hash = JSON.stringify(row);
      return seen.has(hash) ? false : !!seen.add(hash);
    });

    // Step 2: Mean-fill nulls
    const filled = deduped.map(row => {
      const newRow = { ...row };
      for (const col of info.columns) {
        if (newRow[col.name] == null || newRow[col.name] === '') {
          newRow[col.name] = col.type === 'numeric'
            ? (col.mean !== undefined ? Number(col.mean.toFixed(2)) : 0)
            : 'N/A';
        }
      }
      return newRow;
    });

    setDataset({ ...info, workData: filled, duplicates: 0, totalNulls: 0 });
  }, [info, setDataset]);

  // ── 5. IQR Outlier Detection (memoized) ─────────────────
  /**
   * Returns a Map<columnName, IQRResult> for all numeric columns.
   * IQRResult.outlierRowIndices is a Set<rowIndex> for O(1) highlight lookup.
   */
  const outlierMap = useMemo<Map<string, IQRResult>>(() => {
    if (!info || numericCols.length === 0) return new Map();
    return calcAllIQR(info.workData, numericCols);
  }, [info, numericCols]);

  /**
   * Returns the set of all row indices that are outliers in ANY column.
   * Used by DataGrid to highlight entire rows.
   */
  const allOutlierRowIndices = useMemo<Set<number>>(() => {
    const combined = new Set<number>();
    for (const result of outlierMap.values()) {
      result.outlierRowIndices.forEach(i => combined.add(i));
    }
    return combined;
  }, [outlierMap]);

  // ── 6. Correlation Matrix (memoized) ────────────────────
  /**
   * Full n×n Pearson correlation matrix for up to 20 numeric columns.
   * Computed on a 5000-row sample for performance.
   */
  const correlationMatrix = useMemo<CorrelationMatrix | null>(() => {
    if (!info || numericCols.length < 2) return null;
    return calcCorrelationMatrix(info.workData, numericCols);
  }, [info, numericCols]);

  // ── 7. Growth Indicators (memoized) ─────────────────────
  /**
   * Compares first-half vs second-half averages (or date-sorted halves).
   * Returns trend direction and % change per numeric column.
   */
  const growthIndicators = useMemo<GrowthIndicator[]>(() => {
    if (!info || numericCols.length === 0) return [];
    return calcGrowthIndicators(info.workData, numericCols, dateCol);
  }, [info, numericCols, dateCol]);

  // ── 8. Predictive Analytics (memoized) ──────────────────
  /**
   * Generates next 3 data points using simple linear regression.
   */
  const predictions = useMemo<Map<string, PredictionResult>>(() => {
    const map = new Map<string, PredictionResult>();
    if (!info) return map;
    for (const col of numericCols) {
      const res = calcPredictions(info.workData, col);
      if (res) map.set(col, res);
    }
    return map;
  }, [info, numericCols]);

  return {
    // Existing
    removeDuplicates,
    fillMissingValues,
    magicClean,
    getHealthStats,
    executeDataCommand,
    // New engines
    outlierMap,
    allOutlierRowIndices,
    correlationMatrix,
    growthIndicators,
    predictions,
    numericCols,
    dateCol,
  };
};
