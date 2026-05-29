import type { DatasetInfo, DataRow } from '../types';
import { analyzeDataset } from './dataUtils';

/**
 * Recompute a DatasetInfo (columns, stats, charts, anomalies…) from new rows,
 * preserving identity fields. Reuses the canonical analyzeDataset logic.
 */
export function rebuildDatasetInfo(
  base: DatasetInfo,
  newData: DataRow[],
  filename?: string,
): DatasetInfo {
  const name = filename ?? base.filename;
  const fakeFile = new File([''], name, { type: 'text/csv' });
  const rebuilt = analyzeDataset(fakeFile, newData);
  rebuilt.datasetId = base.datasetId;
  rebuilt.sourceUrl = base.sourceUrl;
  rebuilt.fileSize = base.fileSize;
  return rebuilt;
}
