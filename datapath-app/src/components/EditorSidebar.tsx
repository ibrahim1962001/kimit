import React, { useMemo, useState, useEffect } from 'react';
import { X, Table, Sparkles, Save } from 'lucide-react';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import type { DataRow, DatasetInfo, Lang } from '../types';
import { analyzeDataset } from '../lib/dataUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  info: DatasetInfo | null;
  lang: Lang;
  onUpdate?: (info: DatasetInfo) => void;
}

const T = {
  ar: {
    title: 'جدول البيانات العبقري (Excel Playground)',
    hint: 'انقر نقراً مزدوجاً بالماوس على أي خلية لتعديلها. يمكنك تغيير أي بيانات يدوياً هنا قبل تصديرها!',
    saveBtn: 'حفظ التغييرات وتحديث الداشبورد',
  },
  en: {
    title: 'Excel Playground',
    hint: 'Double click on any cell to edit it. You can change any data manually before exporting!',
    saveBtn: 'Save & Update Dashboard',
  }
};

interface TextEditorProps {
  row: DataRow;
  column: { key: string };
  onRowChange: (r: DataRow) => void;
  onClose: (c: boolean) => void;
}

const CustomTextEditor = ({ row, column, onRowChange, onClose }: TextEditorProps) => {
  return (
    <input
      autoFocus
      value={String(row[column.key] ?? '')}
      onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value })}
      onBlur={() => onClose(true)}
      style={{ width: '100%', height: '100%', padding: '0 8px', border: 'none', background: '#334155', color: '#fff' }}
    />
  );
};

export const EditorSidebar: React.FC<Props> = ({ isOpen, onClose, info, lang, onUpdate }) => {
  const t = T[lang];
  const [gridData, setGridData] = useState<DataRow[]>([]);

  useEffect(() => {
    if (!info) return;
    const tId = setTimeout(() => {
      setGridData(info.workData as DataRow[]);
    }, 0);
    return () => clearTimeout(tId);
  }, [info]);

  const columns = useMemo(() => {
    if (!info) return [];
    return info.columns.map(c => ({
      key: c.name,
      name: c.name,
      renderEditCell: CustomTextEditor,
      resizable: true,
      minWidth: 120,
    }));
  }, [info]);

  const handleSave = () => {
     if (!onUpdate || !info) return;
     const dummyFile = new File([''], info.filename);
     Object.defineProperty(dummyFile, 'size', { value: info.fileSize });
     onUpdate(analyzeDataset(dummyFile, [...gridData]));
     alert(lang === 'ar' ? '✅ تم حفظ التعديلات وتحديث كل الرسوم البيانية بنجاح!' : '✅ Edits saved and all charts updated successfully!');
  };

  if (!info) return null;

  return (
    <div className={`editor-sidebar ${isOpen ? 'open' : ''}`} style={{ width: '90%', maxWidth: '1200px', 
      background: 'var(--bg)', borderLeft: '1px solid var(--border)', transform: isOpen ? 'translateX(0)' : 'translateX(100%)', padding: 0 }}>
      
      <div className="editor-header" style={{ padding: '20px 30px', borderBottom: '1px solid var(--border)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
           <Table size={24} color="#10b981" />
           <span className="editor-title" style={{ fontSize: 18 }}>{t.title}</span>
         </div>
         <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
           <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 16px', fontSize: 12, background: '#3b82f6' }}>
             <Save size={16} style={{ marginRight: 6 }} /> {t.saveBtn}
           </button>
           <button className="editor-close" onClick={onClose}><X size={26} /></button>
         </div>
      </div>

      <div className="editor-content" style={{ padding: '20px 30px' }}>
         <div className="clean-banner" style={{ fontSize: 13, padding: 15, marginBottom: 20 }}>
           <Sparkles size={16} color="#10b981" />
           <p>{t.hint}</p>
         </div>
         
         <div style={{ height: 'calc(100vh - 180px)', width: '100%' }} className="rdg-dark">
           {/* Custom CSS for React-Data-Grid Dark Mode */}
           <style>
             {`
               .rdg-dark .rdg {
                  background-color: #0f172a;
                  color: #e2e8f0;
                  border: 1px solid rgba(255,255,255,0.1);
                  font-size: 13px;
                  height: 100%;
               }
               .rdg-dark .rdg-header-row {
                  background-color: #1e293b;
               }
               .rdg-dark .rdg-row {
                  background-color: #0f172a;
                  border-bottom: 1px solid rgba(255,255,255,0.05);
               }
               .rdg-dark .rdg-row:hover {
                  background-color: rgba(255,255,255,0.05);
               }
               .rdg-dark .rdg-cell {
                  border-right: 1px solid rgba(255,255,255,0.05);
               }
               /* Fix RTL text alignment */
               .rdg-dark[dir="rtl"] .rdg-cell {
                  text-align: right;
               }
             `}
           </style>
           <DataGrid
             columns={columns}
             rows={gridData}
             onRowsChange={setGridData}
             className="rdg-light"
             direction={lang === 'ar' ? 'rtl' : 'ltr'}
           />
         </div>
      </div>
    </div>
  );
};
