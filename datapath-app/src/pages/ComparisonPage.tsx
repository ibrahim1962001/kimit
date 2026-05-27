import React, { useState } from 'react';
import { Columns, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { DropZone } from '../components/DropZone';
import { parseFile, analyzeDataset } from '../lib/dataUtils';
import type { DatasetInfo } from '../types';
import './comparison-redesign.css';

interface Props {}

export const ComparisonPage: React.FC<Props> = ({}) => {
  const [file1, setFile1] = useState<DatasetInfo | null>(null);
  const [file2, setFile2] = useState<DatasetInfo | null>(null);

  const handleFile1 = async (file: File) => {
    try {
      const rows = await parseFile(file);
      const info = analyzeDataset(file, rows);
      setFile1(info);
    } catch (e) { console.error(e); }
  };

  const handleFile2 = async (file: File) => {
    try {
      const rows = await parseFile(file);
      const info = analyzeDataset(file, rows);
      setFile2(info);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="page compare2 p-6 md:p-12 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold flex justify-center items-center gap-3">
          <ArrowRightLeft className="text-primary" />
          File Comparison
        </h1>
        <p className="text-white/50 mt-2">Compare two files to discover differences in patterns and data</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="space-y-4">
          <h3 className="text-center text-white/70">First File</h3>
          {!file1 ? (
            <DropZone onFile={handleFile1} />
          ) : (
            <div className="glass p-6 rounded-2xl border border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-green-500" />
                <div>
                  <div className="font-bold">{file1.filename}</div>
                  <div className="text-xs text-white/50">{file1.rows.toLocaleString()} rows</div>
                </div>
              </div>
              <button onClick={() => setFile1(null)} className="text-xs text-red-400 hover:underline">Remove</button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-center text-white/70">Second File</h3>
          {!file2 ? (
            <DropZone onFile={handleFile2} />
          ) : (
            <div className="glass p-6 rounded-2xl border border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-green-500" />
                <div>
                  <div className="font-bold">{file2.filename}</div>
                  <div className="text-xs text-white/50">{file2.rows.toLocaleString()} rows</div>
                </div>
              </div>
              <button onClick={() => setFile2(null)} className="text-xs text-red-400 hover:underline">Remove</button>
            </div>
          )}
        </div>
      </div>

      {file1 && file2 && (
        <div className="glass p-8 rounded-3xl border border-white/20 animate-fade-in">
          <h2 className="text-2xl font-bold mb-8 text-center">Comparison Results</h2>
          
          <div className="overflow-x-auto">
             <table className="w-full text-center table-fixed">
                <thead>
                  <tr className="text-white/40 text-sm">
                    <th className="pb-4">Feature</th>
                    <th className="pb-4">{file1.filename}</th>
                    <th className="pb-4">{file2.filename}</th>
                  </tr>
                </thead>
                <tbody className="text-white/90">
                  <tr className="border-t border-white/5">
                    <td className="py-4 font-medium">Row Count</td>
                    <td className="py-4">{file1.rows.toLocaleString()}</td>
                    <td className="py-4">{file2.rows.toLocaleString()}</td>
                  </tr>
                  <tr className="border-t border-white/5">
                    <td className="py-4 font-medium">Column Count</td>
                    <td className="py-4">{file1.columns.length}</td>
                    <td className="py-4">{file2.columns.length}</td>
                  </tr>
                  <tr className="border-t border-white/5">
                    <td className="py-4 font-medium">Missing Values</td>
                    <td className="py-4 text-red-400">{file1.totalNulls}</td>
                    <td className="py-4 text-red-400">{file2.totalNulls}</td>
                  </tr>
                  <tr className="border-t border-white/5">
                    <td className="py-4 font-medium">Anomalies</td>
                    <td className="py-4">{file1.anomalies.length}</td>
                    <td className="py-4">{file2.anomalies.length}</td>
                  </tr>
                </tbody>
             </table>
          </div>

          <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10">
             <h4 className="font-bold mb-2 flex items-center gap-2">
               <Columns size={18} className="text-primary" />
               Common Columns Analysis
             </h4>
             <div className="flex flex-wrap gap-2 mt-4">
                {file1.columns.map(c => c.name).filter(c => file2.columns.some(c2 => c2.name === c)).map(c => (
                  <span key={c} className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs">
                    {c}
                  </span>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
