import React, { useEffect, useState, useCallback } from 'react';
import type { Lang } from '../types';

interface SavedFile {
  object_name: string;
  filename: string;
  size_bytes: number;
  size_display: string;
  last_modified: string;
  download_url: string;
}

interface Props {
  lang: Lang;
}

const T = {
  ar: {
    title: 'الملفات المحفوظة',
    subtitle: 'ملفاتك المرفوعة في التخزين السحابي',
    refresh: 'تحديث',
    download: 'تحميل',
    empty_title: 'لا توجد ملفات بعد',
    empty_sub: 'ارفع ملفاً من الصفحة الرئيسية وسيظهر هنا تلقائياً',
    loading: 'جاري تحميل الملفات...',
    error: 'تعذر الاتصال بالتخزين السحابي',
    size: 'الحجم',
    date: 'تاريخ الرفع',
    name: 'اسم الملف',
  },
  en: {
    title: 'Saved Files',
    subtitle: 'Your uploaded files in cloud storage',
    refresh: 'Refresh',
    download: 'Download',
    empty_title: 'No files yet',
    empty_sub: 'Upload a file from the Home page and it will appear here automatically',
    loading: 'Loading files...',
    error: 'Could not connect to cloud storage',
    size: 'Size',
    date: 'Upload Date',
    name: 'Filename',
  },
};

const CsvIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="18" height="20" rx="2" fill="#10b981" opacity="0.15"/>
    <path d="M3 7h18" stroke="#10b981" strokeWidth="1.5"/>
    <path d="M8 2v5" stroke="#10b981" strokeWidth="1.5"/>
    <path d="M16 2v5" stroke="#10b981" strokeWidth="1.5"/>
    <text x="5" y="17" fill="#10b981" fontSize="5.5" fontWeight="bold" fontFamily="monospace">CSV</text>
  </svg>
);

const ExcelIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="18" height="20" rx="2" fill="#3b82f6" opacity="0.15"/>
    <path d="M3 7h18" stroke="#3b82f6" strokeWidth="1.5"/>
    <path d="M8 2v5" stroke="#3b82f6" strokeWidth="1.5"/>
    <path d="M16 2v5" stroke="#3b82f6" strokeWidth="1.5"/>
    <text x="3.5" y="17" fill="#3b82f6" fontSize="5" fontWeight="bold" fontFamily="monospace">XLSX</text>
  </svg>
);

const CloudEmptyIcon = () => (
  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 16v-4M12 12l-2 2M12 12l2 2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7 16.5a4.5 4.5 0 1 1 1.023-8.888A6 6 0 1 1 17.8 12.5H17A4 4 0 0 1 7 16.5Z" 
          stroke="#94a3b8" strokeWidth="1.5" fill="none"/>
  </svg>
);

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return <CsvIcon />;
  if (ext === 'xlsx' || ext === 'xls') return <ExcelIcon />;
  return <CsvIcon />;
}

function truncate(str: string, max = 42) {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

export const SavedFilesPage: React.FC<Props> = ({ lang }) => {
  const t = T[lang];
  const isAr = lang === 'ar';

  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleDownload = (objectName: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `/api/files/download/${encodeURIComponent(objectName)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container" style={{ padding: '32px 28px', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="saved-files-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 16.5a4.5 4.5 0 1 1 1.023-8.888A6 6 0 1 1 17.8 12.5H17A4 4 0 0 1 7 16.5Z"
                    stroke="#3b82f6" strokeWidth="1.8" fill="rgba(59,130,246,0.12)"/>
            </svg>
            {t.title}
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={fetchFiles}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.35)',
            background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 500,
            transition: 'all 0.2s', opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
          {t.refresh}
        </button>
      </div>

      {/* Card wrapper */}
      <div style={{
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Loading */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '60px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"
                 style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p style={{ color: '#94a3b8', margin: 0 }}>{t.loading}</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <p style={{ color: '#ef4444', margin: 0, fontWeight: 500 }}>{t.error}</p>
            <button onClick={fetchFiles} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.875rem' }}>
              {t.refresh}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && files.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '60px' }}>
            <CloudEmptyIcon />
            <h3 style={{ color: '#f8fafc', margin: 0, fontWeight: 600 }}>{t.empty_title}</h3>
            <p style={{ color: '#94a3b8', margin: 0, textAlign: 'center', maxWidth: '300px', fontSize: '0.9rem' }}>
              {t.empty_sub}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && files.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                  {[t.name, t.size, t.date, ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '13px 20px', textAlign: isAr ? (i === 3 ? 'left' : 'right') : (i === 3 ? 'right' : 'left'),
                      color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={idx} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Filename */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {getFileIcon(file.filename)}
                        <span style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 500 }} title={file.filename}>
                          {truncate(file.filename)}
                        </span>
                      </div>
                    </td>
                    {/* Size */}
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {file.size_display}
                    </td>
                    {/* Date */}
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {file.last_modified}
                    </td>
                    {/* Download */}
                    <td style={{ padding: '14px 20px', textAlign: isAr ? 'left' : 'right' }}>
                      <button
                        onClick={() => handleDownload(file.object_name, file.filename)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '6px 14px', borderRadius: '7px',
                          border: '1px solid rgba(16,185,129,0.35)',
                          background: 'rgba(16,185,129,0.1)', color: '#10b981',
                          cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.1)'; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 15V3m0 12-4-4m4 4 4-4"/>
                          <path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2"/>
                        </svg>
                        {t.download}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
