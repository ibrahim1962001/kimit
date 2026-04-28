import { useMemo } from 'react';
import type { DataRow, ColumnMetadata, DataHealthScore } from '../types/index';

export function useAnalytics(data: DataRow[], columns: string[]) {
  return useMemo(() => {
    if (!data || data.length === 0) return { metadata: [], healthScore: null, anomalies: [] };

    const metadata: ColumnMetadata[] = columns.map(col => {
      const isNumeric = data.some(row => typeof row[col] === 'number');
      const vals = data.map(r => r[col]);
      const nullCount = vals.filter(v => v === null || v === undefined || v === '').length;
      const uniqueCount = new Set(vals).size;
      
      const meta: ColumnMetadata = {
        id: col,
        name: col,
        type: isNumeric ? 'numeric' : 'text',
        nullCount,
        uniqueCount
      };

      if (isNumeric) {
        const numVals = vals.map(v => Number(v)).filter(v => !isNaN(v));
        if (numVals.length > 0) {
          meta.min = Math.min(...numVals);
          meta.max = Math.max(...numVals);
          meta.mean = numVals.reduce((a, b) => a + b, 0) / numVals.length;
          // Calculate median (simplified)
          numVals.sort((a, b) => a - b);
          meta.median = numVals[Math.floor(numVals.length / 2)];
        }
      }

      return meta;
    });

    // Detect Anomalies (Z-Score > 3)
    const anomalies: Array<{ column: string; rowIdx: number; value: number; zScore: number; severity: string; description: string }> = [];
    metadata.filter(c => c.type === 'numeric' && c.mean !== undefined).forEach(col => {
      const vals = data.map(r => Number(r[col.name])).filter(v => !isNaN(v));
      if (vals.length === 0) return;
      
      const mean = col.mean!;
      const variance = vals.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / vals.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        vals.forEach((val, idx) => {
          const zScore = Math.abs((val - mean) / stdDev);
          if (zScore > 3) {
            anomalies.push({
              column: col.name,
              rowIdx: idx,
              value: val,
              zScore,
              severity: zScore > 5 ? 'high' : 'medium',
              description: `Value ${val} is unusually far from the average of ${mean.toFixed(2)}`
            });
          }
        });
      }
    });

    // Calculate Data Health Score
    const totalCells = data.length * columns.length;
    const totalNulls = metadata.reduce((sum, col) => sum + col.nullCount, 0);
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (totalNulls > 0) {
      issues.push(`${totalNulls} missing values detected across dataset.`);
      recommendations.push("Consider imputing missing values or dropping highly sparse columns.");
    }

    if (anomalies.length > 0) {
      issues.push(`${anomalies.length} statistical anomalies detected.`);
      recommendations.push("Investigate high-severity outliers to ensure data integrity.");
    }

    const missingPenalty = (totalNulls / totalCells) * 100;
    const anomalyPenalty = Math.min(20, (anomalies.length / data.length) * 100);
    const score = Math.max(0, Math.round(100 - missingPenalty - anomalyPenalty));

    const healthScore: DataHealthScore = { score, issues, recommendations };

    return { metadata, anomalies, healthScore };
  }, [data, columns]);
}
