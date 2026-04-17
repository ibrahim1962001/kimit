import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import type { Lang } from '../types';

interface Props {
  lang: Lang;
  onFile: (file: File) => void;
}

const T = {
  ar: { title: 'اسحب ملف البيانات هنا', sub: 'أو اضغط لاختيار ملف', hint: 'يدعم CSV و Excel (XLSX, XLS)', badge: 'يعمل بالكامل في المتصفح · بدون رفع بيانات' },
  en: { title: 'Drag your data file here', sub: 'or click to choose a file', hint: 'Supports CSV & Excel (XLSX, XLS)', badge: 'Fully browser-based · No data is uploaded' },
};

export const DropZone: React.FC<Props> = ({ lang, onFile }) => {
  const t = T[lang];
  const [dragging, setDragging] = React.useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onClick={() => document.getElementById('file-input')?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input id="file-input" type="file" hidden accept=".csv,.xlsx,.xls" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      <div className="dropzone-icon"><UploadCloud size={52} strokeWidth={1.5} /></div>
      <h3 className="dropzone-title">{t.title}</h3>
      <p className="dropzone-sub">{t.sub}</p>
      <div className="dropzone-formats">
        {['CSV', 'XLSX', 'XLS'].map(f => <span key={f} className="format-tag">{f}</span>)}
      </div>
      <div className="dropzone-badge">{t.badge}</div>
    </div>
  );
};
