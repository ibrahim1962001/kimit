import React, { useState, useCallback, useEffect } from 'react';
import { useCsvParser } from '../../hooks/useCsvParser';
import { useAnalytics } from '../../hooks/useAnalytics';
import { DataGrid } from './DataGrid';
import { AnalysisChart } from './Charts';
import { ErrorBoundary } from './ErrorBoundary';
import { validateDataset, runSystemHealthCheck } from '../../lib/validation';
import type { DataRow } from '../../types/index';

export const AnalysisModule: React.FC = () => {
  const { parseFile, isParsing, error: parseError } = useCsvParser();
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [healthStatus, setHealthStatus] = useState<string>('UNKNOWN');

  // Compute stats and anomalies independent of rendering
  const { metadata, anomalies, healthScore } = useAnalytics(data, columns);

  // Run System Health Check on mount
  useEffect(() => {
    runSystemHealthCheck().then(res => setHealthStatus(res.status));
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseFile(file);
      
      // Validation layer intercepts bad data
      validateDataset(result);

      setData(result.data);
      setColumns(result.columns);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload failed: ${msg}`);
    }
  }, [parseFile]);

  return (
    <div className="analysis-module" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100vh', background: 'var(--bg-color)', color: '#fff' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Strict Modular Analysis Engine</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: healthStatus === 'HEALTHY' ? '#10b981' : '#ef4444' }}>
            System: {healthStatus}
          </span>
          <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isParsing} />
          {isParsing && <span style={{ color: '#3b82f6' }}>Parsing in Background...</span>}
        </div>
      </header>

      {parseError && (
        <div style={{ color: '#ef4444', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
          Parser Error: {parseError}
        </div>
      )}

      {data.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', flex: 1, overflow: 'hidden' }}>
          
          {/* Module B: Virtualized Grid wrapped in Error Boundary */}
          <ErrorBoundary moduleName="Data Grid">
            <DataGrid data={data} columns={columns} />
          </ErrorBoundary>

          {/* Sidebar logic */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            
            {/* Logic Results */}
            <ErrorBoundary moduleName="Health Score">
              <div style={{ background: 'var(--card-bg)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h3>Data Health Score</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: healthScore?.score && healthScore.score > 80 ? '#10b981' : '#f59e0b' }}>
                  {healthScore?.score}%
                </div>
                <div style={{ marginTop: '10px' }}>
                  {healthScore?.issues.map((issue, idx) => <p key={idx} style={{ fontSize: '12px', color: '#ef4444', margin: '4px 0' }}>- {issue}</p>)}
                </div>
                {anomalies && anomalies.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#f59e0b' }}>
                    <p>Detected {anomalies.length} outliers.</p>
                  </div>
                )}
              </div>
            </ErrorBoundary>

            {/* Module D: Charts wrapped in Error Boundary */}
            <ErrorBoundary moduleName="Visualizations">
              <div style={{ background: 'var(--card-bg)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)', height: '300px' }}>
                <AnalysisChart 
                  data={data} 
                  config={{ type: 'bar', xAxisKey: columns[0] || 'Unknown', yAxisKey: columns.find(c => metadata.find(m => m.name === c)?.type === 'numeric') || columns[1] || 'Unknown', title: 'Distribution Overview' }} 
                />
              </div>
            </ErrorBoundary>

          </div>
        </div>
      )}
    </div>
  );
};
