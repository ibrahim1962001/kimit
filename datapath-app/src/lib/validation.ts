import type { DataRow, ParseResult } from '../types/index';

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataValidationError';
  }
}

/**
 * Validates the parsed data before it reaches the UI layers.
 */
export function validateDataset(parseResult: ParseResult): boolean {
  if (!parseResult.data || !Array.isArray(parseResult.data)) {
    throw new DataValidationError("Parsed data is not an array");
  }

  if (parseResult.data.length === 0) {
    throw new DataValidationError("Dataset is empty");
  }

  if (!parseResult.columns || parseResult.columns.length === 0) {
    throw new DataValidationError("Dataset has no columns");
  }

  // Check for severe corruption: rows that don't match column structure
  const sampleSize = Math.min(100, parseResult.data.length);
  let corruptRows = 0;
  for (let i = 0; i < sampleSize; i++) {
    const row = parseResult.data[i];
    if (typeof row !== 'object' || row === null) {
      corruptRows++;
    }
  }

  if (corruptRows > sampleSize * 0.5) {
    throw new DataValidationError("Over 50% of sampled rows are corrupted or malformed");
  }

  return true;
}

/**
 * System Health Check to verify modular stability.
 * Mocks a 50k row dataset and runs basic validations.
 */
export async function runSystemHealthCheck(): Promise<{ status: string; memoryUsed?: number }> {
  console.log("[Health Check] Starting system health verification...");

  return new Promise((resolve) => {
    try {
      // 1. Generate Mock Data (50k rows)
      const mockData: DataRow[] = [];
      for (let i = 0; i < 50000; i++) {
        mockData.push({
          id: i,
          value: Math.random() * 100,
          category: i % 2 === 0 ? 'A' : 'B'
        });
      }

      // 2. Validate Mock Data
      validateDataset({
        data: mockData,
        columns: ['id', 'value', 'category'],
        errors: [],
        meta: { fields: ['id', 'value', 'category'], truncated: false }
      });

      console.log("[Health Check] Validation passed for 50k rows.");

      // 3. Memory estimation (rough)
      let memoryUsed = 0;
      const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
      if (perf && perf.memory) {
        memoryUsed = perf.memory.usedJSHeapSize / (1024 * 1024);
        console.log(`[Health Check] Estimated Memory Use: ${memoryUsed.toFixed(2)} MB`);
      }

      // 4. Cleanup to prevent leaks
      mockData.length = 0;

      resolve({ status: 'HEALTHY', memoryUsed });
    } catch (error) {
      console.error("[Health Check] Failed:", error);
      resolve({ status: 'UNHEALTHY', memoryUsed: 0 });
    }
  });
}
