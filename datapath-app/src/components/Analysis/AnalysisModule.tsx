import React, { useState, useCallback, useEffect } from 'react';
import { useCsvParser } from '../../hooks/useCsvParser';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useKimitExtra } from '../../hooks/useKimitExtra';
import { useKimitEngine } from '../../hooks/useKimitEngine';
import { DataGrid } from './DataGrid';
import { AnalysisChart } from './Charts';
import { ErrorBoundary } from './ErrorBoundary';
import { InsightSummary } from './InsightSummary';
import { SmartFilter } from './SmartFilter';
import { ExportActions } from './ExportActions';
import { TextAnalytics } from './TextAnalytics';
import { validateDataset, runSystemHealthCheck } from '../../lib/validation';
import type { DataRow } from '../../types/index';

export const AnalysisModule: React.FC = () => {
  const { parseFile, isParsing, error: parseError } = useCsvParser();
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [healthStatus, setHealthStatus] = useState<string>('UNKNOWN');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const { metadata, anomalies, healthScore } = useAnalytics(data, columns);
  const { outlierMap, correlationMatrix } = useKimitEngine();
  const { isGeneratingInsights, insights, generateInsights, parseNlqQuery } = useKimitExtra(data, columns);
  const [nlqFilter, setNlqFilter] = useState<Array<{ id: string, value: { operator: string, value: string } }> | null>(null);

  const textColumns = React.useMemo(() => metadata.filter(m => m.type === 'text').map(m => m.name), [metadata]);

  const filteredData = React.useMemo(() => {
    if (!nlqFilter || nlqFilter.length === 0) return data;
    const { id, value: { operator, value } } = nlqFilter[0];
    return data.filter(row => {
      const rowVal = Number(row[id]) || String(row[id]).toLowerCase();
      const numVal = Number(value);
      const strVal = String(value).toLowerCase();
      
      switch (operator) {
        case '>': return typeof rowVal === 'number' && rowVal > numVal;
        case '<': return typeof rowVal === 'number' && rowVal < numVal;
        case '>=': return typeof rowVal === 'number' && rowVal >= numVal;
        case '<=': return typeof rowVal === 'number' && rowVal <= numVal;
        case '=': return rowVal === (isNaN(numVal) ? strVal : numVal);
        case '!=': return rowVal !== (isNaN(numVal) ? strVal : numVal);
        case 'contains': return String(rowVal).includes(strVal);
        default: return true;
      }
    });
  }, [data, nlqFilter]);

  useEffect(() => {
    runSystemHealthCheck().then(res => setHealthStatus(res.status));
  }, []);

  const dynamicInsights = React.useMemo(() => {
    const list: Array<{ title: string, content: string, type: 'info' | 'positive' | 'warning' }> = [];
    
    // Outliers Insight
    let totalOutliers = anomalies?.length || 0;
    if (outlierMap && outlierMap.size > 0) {
      totalOutliers = Array.from(outlierMap.values()).reduce((sum, r) => sum + r.outlierCount, 0);
    }
    list.push({
      title: 'Anomaly Detection',
      content: `Found ${totalOutliers} outliers across all columns using the IQR method.`,
      type: totalOutliers > 0 ? 'warning' : 'positive'
    });
    
    // Data Quality Insight
    const score = healthScore?.score ?? 100;
    list.push({
      title: 'Data Integrity',
      content: `Data quality: ${score}% - ${score > 80 ? 'Excellent ready for analysis.' : 'Needs cleaning.'}`,
      type: score > 80 ? 'positive' : 'warning'
    });
    
    // Correlation Insight
    if (correlationMatrix && correlationMatrix.columns.length >= 2) {
      let maxR = -1;
      let pair = ['', ''];
      for (let i = 0; i < correlationMatrix.columns.length; i++) {
        for (let j = i + 1; j < correlationMatrix.columns.length; j++) {
          const r = Math.abs(correlationMatrix.matrix[i][j]);
          if (r > maxR) {
            maxR = r;
            pair = [correlationMatrix.columns[i], correlationMatrix.columns[j]];
          }
        }
      }
      if (maxR > 0.5) {
        list.push({
          title: 'Strong Relationship',
          content: `Strongest correlation between ${pair[0]} and ${pair[1]} (r ≈ ${maxR.toFixed(2)}).`,
          type: 'info'
        });
      }
    } else {
      // Fallback if no correlation matrix
      const numCol = metadata.find(m => m.type === 'numeric')?.name;
      if (numCol && data.length > 0) {
        let maxVal = -Infinity;
        data.forEach(r => { const v = Number(r[numCol]); if (v > maxVal) maxVal = v; });
        list.push({
          title: 'Key Metric',
          content: `Highest value recorded in ${numCol} is ${maxVal}.`,
          type: 'info'
        });
      }
    }
    
    return list;
  }, [anomalies, healthScore, outlierMap, correlationMatrix, metadata, data]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseFile(file);
      validateDataset(result);
      setData(result.data);
      setColumns(result.columns);
      setNlqFilter(null);
      generateInsights({ rows: result.data.length, cols: result.columns.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload failed: ${msg}`);
    }
  }, [parseFile, generateInsights]);

  const handleSmartSearch = (query: string) => {
    const filter = parseNlqQuery(query);
    if (filter) {
      setNlqFilter(filter);
    } else {
      alert("Could not parse query. Try 'ColumnName > 100' or 'ColumnName contains text'");
      setNlqFilter(null);
    }
  };

  return (
    <div className="analysis-module" style={{ padding: isMobile ? '10px' : '30px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100vh', background: 'var(--bg-color)', color: '#fff' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800 }}>Kimit Analysis Engine</h2>
          <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '100px', background: healthStatus === 'HEALTHY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: healthStatus === 'HEALTHY' ? '#10b981' : '#ef4444', border: healthStatus === 'HEALTHY' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)' }}>
            {healthStatus}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <SmartFilter onSearch={handleSmartSearch} />
          
          <div style={{ position: 'relative' }}>
            <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isParsing} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            <button className="premium-button" style={{ fontSize: '13px', padding: '10px 20px' }}>
              {isParsing ? 'Parsing...' : 'Upload CSV'}
            </button>
          </div>
          
          {data.length > 0 && (
            <ExportActions data={filteredData} columns={columns} elementIdToCapture="dashboard-export-area" />
          )}
        </div>
      </header>

      {parseError && (
        <div style={{ color: '#ef4444', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          Parser Error: {parseError}
        </div>
      )}

      {data.length === 0 && !isParsing && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
          <div style={{ padding: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', marginBottom: '20px' }}>
             <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          </div>
          <p style={{ fontSize: '18px', fontWeight: 600 }}>Drop your CSV here to start analysis</p>
          <p style={{ color: 'var(--text-dim)', marginTop: '8px' }}>AI will automatically profile your data</p>
        </div>
      )}

      {isParsing && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ animation: 'pulse 1.5s infinite', background: 'rgba(255,255,255,0.05)', height: '100px', borderRadius: '12px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 350px', gap: '20px', flex: 1 }}>
             <div style={{ animation: 'pulse 1.5s infinite', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', minHeight: '400px' }} />
             <div style={{ animation: 'pulse 1.5s infinite', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />
          </div>
        </div>
      )}

      {data.length > 0 && !isParsing && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 350px', 
          gap: '24px', 
          flex: 1,
          alignItems: 'start'
        }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
            {/* Module B: Data Grid */}
            <div className="glass-panel" style={{ height: isMobile ? '50vh' : '65vh', padding: 0, overflow: 'hidden' }}>
              <ErrorBoundary moduleName="Data Grid">
                <DataGrid data={filteredData} columns={columns} />
              </ErrorBoundary>
            </div>

            {/* Module D: Charts */}
            <div className="glass-panel" style={{ padding: isMobile ? '15px' : '24px' }}>
              <ErrorBoundary moduleName="Visualizations">
                <AnalysisChart 
                  data={filteredData} 
                  config={{ 
                    type: 'bar', 
                    xAxisKey: columns[0] || 'Unknown', 
                    yAxisKey: columns.find(c => metadata.find(m => m.name === c)?.type === 'numeric') || columns[1] || 'Unknown', 
                    title: 'Analysis Overview' 
                  }} 
                />
              </ErrorBoundary>
            </div>

            {/* Module E: Text Analytics */}
            <TextAnalytics data={filteredData} textColumns={textColumns} />
          </div>

          {/* Sidebar / Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <ErrorBoundary moduleName="AI Storyteller">
              <InsightSummary
                insights={insights && insights.length > 0 ? insights.map(ins => ({
                  title: ins.title,
                  description: ins.content,
                  type: 'info' as const,
                })) : dynamicInsights.map(ins => ({
                  title: ins.title,
                  description: ins.content,
                  type: ins.type,
                }))}
                isLoading={isGeneratingInsights}
              />
            </ErrorBoundary>

            <ErrorBoundary moduleName="Health Score">
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Data Integrity</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '42px', fontWeight: 900, color: healthScore?.score && healthScore.score > 80 ? '#10b981' : '#f59e0b' }}>
                    {healthScore?.score}%
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Overall dataset reliability score
                  </div>
                </div>
                {healthScore?.issues && healthScore.issues.length > 0 && (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {healthScore.issues.map((issue, idx) => (
                      <div key={idx} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', fontSize: '11px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                        ⚠️ {issue}
                      </div>
                    ))}
                  </div>
                )}
                {anomalies && anomalies.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.05)', color: '#f59e0b', fontSize: '11px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                    Outliers: {anomalies.length} detected
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
};
