import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { X, Table, Sparkles, Save } from 'lucide-react';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import type { DataRow, DatasetInfo } from '../types';
import { analyzeDataset } from '../lib/dataUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  info: DatasetInfo | null;
  
  onUpdate?: (info: DatasetInfo) => void;
}

const T = {
  en: {
    title: 'Excel Playground',
    hint: 'Double click on any cell to edit it. You can change any data manually before exporting!',
    saveBtn: 'Save & Update Dashboard',
    liveSync: 'Live Sync',
    on: 'ON',
    off: 'OFF',
    syncing: 'Syncing…',
    notSynced: 'Not synced yet',
    lastSynced: 'Last synced',
    manualOnly: 'Manual save only (large dataset)',
  },
  ar: {
    title: 'محرر Excel',
    hint: 'انقر مرتين على أي خلية للتعديل. يمكنك تعديل البيانات يدويًا قبل التصدير!',
    saveBtn: 'حفظ وتحديث الداشبورد',
    liveSync: 'مزامنة مباشرة',
    on: 'تشغيل',
    off: 'إيقاف',
    syncing: 'جاري المزامنة…',
    notSynced: 'لم تتم المزامنة بعد',
    lastSynced: 'آخر مزامنة',
    manualOnly: 'حفظ يدوي فقط (بيانات كبيرة)',
  },
};

function formatSyncTime(date: Date, isAr: boolean): string {
  return date.toLocaleString(isAr ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

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

export const EditorSidebar: React.FC<Props> = ({ isOpen, onClose, info, onUpdate }) => {
  const lang = (typeof localStorage !== 'undefined' ? localStorage.getItem('kimit_lang') : null) || 'en';
  const isAr = lang === 'ar';
  const t = isAr ? T.ar : T.en;
  const [gridData, setGridData] = useState<DataRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const autoSyncTimerRef = useRef<number | null>(null);
  const canAutoSync = (info?.workData.length ?? 0) <= 5000;
  const liveSyncOn = canAutoSync;

  useEffect(() => {
    if (!info) return;
    const tId = setTimeout(() => {
      setGridData(JSON.parse(JSON.stringify(info.workData)) as DataRow[]);
      setIsDirty(false);
      setLastSyncedAt(new Date());
    }, 0);
    return () => clearTimeout(tId);
  }, [info]);

  useEffect(() => {
    return () => {
      if (autoSyncTimerRef.current) {
        window.clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, []);

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

  const buildUpdatedDataset = useCallback((rows: DataRow[]): DatasetInfo | null => {
     if (!info) return null;
     const dummyFile = new File([''], info.filename);
     Object.defineProperty(dummyFile, 'size', { value: info.fileSize });
     const analyzed = analyzeDataset(dummyFile, [...rows]);
     return {
       ...analyzed,
       datasetId: info.datasetId,
       sourceUrl: info.sourceUrl,
     };
  }, [info]);

  useEffect(() => {
    if (!isOpen || !isDirty || !onUpdate || !info || !canAutoSync) return;
    if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);
    setIsSyncing(true);
    autoSyncTimerRef.current = window.setTimeout(() => {
      const updated = buildUpdatedDataset(gridData);
      if (updated) {
        onUpdate(updated);
        setIsDirty(false);
        setLastSyncedAt(new Date());
      }
      setIsSyncing(false);
    }, 700);
  }, [gridData, isDirty, isOpen, onUpdate, info, canAutoSync, buildUpdatedDataset]);

  const handleSave = () => {
     if (!onUpdate || !info) return;
     const updated = buildUpdatedDataset(gridData);
     if (!updated) return;
     onUpdate(updated);
     setIsDirty(false);
     setLastSyncedAt(new Date());
     alert(isAr ? '✅ تم الحفظ وتحديث كل الشارتات بنجاح!' : '✅ Edits saved and all charts updated successfully!');
  };

  const syncStatusText = useMemo(() => {
    if (!liveSyncOn) return t.manualOnly;
    if (isSyncing) return t.syncing;
    if (isDirty && canAutoSync) return isAr ? 'تغييرات بانتظار المزامنة…' : 'Changes pending sync…';
    if (lastSyncedAt) return `${t.lastSynced}: ${formatSyncTime(lastSyncedAt, isAr)}`;
    return t.notSynced;
  }, [liveSyncOn, isSyncing, isDirty, canAutoSync, lastSyncedAt, t, isAr]);

  if (!info) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: isOpen ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', opacity: isOpen ? 1 : 0, transition: 'opacity 0.3s ease' }}>
      <div className="editor-modal" style={{ width: '95%', maxWidth: '1200px', height: '90vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', transform: isOpen ? 'scale(1)' : 'scale(0.95)', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
      
      <div className="editor-header" style={{ padding: '20px 30px 12px', borderBottom: '1px solid var(--border)' }}>
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

      <div
        className={`editor-sync-bar ${liveSyncOn ? 'editor-sync-bar--on' : 'editor-sync-bar--off'}${isSyncing ? ' editor-sync-bar--syncing' : ''}`}
        role="status"
        aria-live="polite"
      >
        <div className="editor-sync-bar-main">
          <span className={`editor-sync-pill ${liveSyncOn ? 'is-on' : 'is-off'}`}>
            <span className="editor-sync-dot" aria-hidden />
            {t.liveSync}: {liveSyncOn ? t.on : t.off}
          </span>
          <span className="editor-sync-meta">{syncStatusText}</span>
        </div>
        {isDirty && liveSyncOn && !isSyncing && (
          <span className="editor-sync-pending">{isAr ? 'معلّق' : 'Pending'}</span>
        )}
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
            onRowsChange={(rows) => {
              setGridData(rows);
              setIsDirty(true);
            }}
             className="rdg-light"
             direction="ltr"
           />
         </div>
      </div>
      </div>
    </div>
  );
};
