import React, { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, PlayCircle } from 'lucide-react';
import { GoogleSheetsPicker } from './GoogleSheetsPicker';
import { getAppLang } from '../lib/i18n';
import { isCloudSyncEnabled } from '../lib/cloudSyncPreference';
import './dropzone-redesign.css';

interface Props {
  onFile: (file: File) => void;
}

const T = {
  en: {
    title: 'Drag your data file here',
    sub: 'or click to choose a file from your device',
    hint: 'Supports CSV & Excel (XLSX, XLS)',
    badgeLocal: 'Under 10MB: analyzed locally in your browser',
    badgeLarge: 'Over 10MB: processed on Kimit servers',
    badgeCloud: 'Optional cloud backup is ON',
    sampleBtn: 'Try Sample File',
    or: '— OR —',
  },
  ar: {
    title: 'اسحب ملف البيانات هنا',
    sub: 'أو انقر لاختيار ملف من جهازك',
    hint: 'يدعم CSV و Excel (XLSX, XLS)',
    badgeLocal: 'أقل من 10MB: تحليل محلي في المتصفح',
    badgeLarge: 'أكثر من 10MB: معالجة على خوادم Kimit',
    badgeCloud: 'النسخ السحابي الاختياري مفعّل',
    sampleBtn: 'جرب ملفاً تجريبياً',
    or: '— أو —',
  },
};

const SAMPLE_CSV = `Name,Age,Country,Sales,Date
Ahmed,28,Egypt,1200,2023-01-15
John,34,USA,2500,2023-01-20
Maria,25,Spain,1800,2023-02-05
Li,29,China,3100,2023-02-10
Sarah,31,UK,1400,2023-02-15
Omar,22,Jordan,900,2023-03-01
Elena,27,Italy,2100,2023-03-05`;

export const DropZone: React.FC<Props> = ({ onFile }) => {
  const lang = getAppLang();
  const t = lang === 'ar' ? T.ar : T.en;
  const [error, setError] = useState<string | null>(null);
  const cloudOn = isCloudSyncEnabled();

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        setError(lang === 'ar' ? 'نوع الملف غير مدعوم' : 'Sorry, this file type is not supported');
        return;
      }
      if (acceptedFiles[0]) {
        setError(null);
        onFile(acceptedFiles[0]);
      }
    },
    [onFile, lang],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
  });

  const handleSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    const file = new File([SAMPLE_CSV], 'sample_data.csv', { type: 'text/csv' });
    onFile(file);
  };

  return (
    <div className="dz2-shell">
      <div
        {...getRootProps()}
        onClick={open}
        className={`dz2-drop ${isDragActive ? 'is-drag' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dz2-icon">
          {isDragActive ? (
            <FileSpreadsheet size={28} />
          ) : (
            <UploadCloud size={28} strokeWidth={1.6} />
          )}
        </div>
        <h3 className="dz2-title">{t.title}</h3>
        <p className="dz2-sub">{t.sub}</p>
        <p className="dz2-hint">{t.hint}</p>
        <div className="dz2-badges">
          <span className="dz2-badge dz2-badge--local">{t.badgeLocal}</span>
          {cloudOn && <span className="dz2-badge dz2-badge--cloud">{t.badgeCloud}</span>}
        </div>
        {error && <p className="dz2-error">{error}</p>}
      </div>

      <div className="dz2-or">{t.or}</div>

      <GoogleSheetsPicker onFile={onFile} />

      <button type="button" className="dz2-sample" onClick={handleSample}>
        <PlayCircle size={16} />
        {t.sampleBtn}
      </button>
    </div>
  );
};
