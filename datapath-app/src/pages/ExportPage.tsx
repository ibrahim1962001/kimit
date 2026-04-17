import React from 'react';
import { FileText, Code, FileSpreadsheet, ArrowDownCircle } from 'lucide-react';
import type { DatasetInfo, Lang } from '../types';
import { exportCSV, exportJSON } from '../lib/dataUtils';
import * as XLSX from 'xlsx';

interface Props { info: DatasetInfo; lang: Lang; }

const T = {
  ar: {
    title: 'تصدير البيانات', sub: 'حمّل نسخة منقحة من بياناتك',
    csvTitle: 'تصدير CSV', csvDesc: 'ملف نصي مفصول بفواصل، متوافق مع Excel وكل البرامج',
    jsonTitle: 'تصدير JSON', jsonDesc: 'تنسيق مثالي للمطورين والتطبيقات البرمجية',
    xlsxTitle: 'تصدير Excel', xlsxDesc: 'ملف إكسيل حديث (.xlsx) مباشر مع الحفاظ على التنسيق',
    rows: 'سجل جاهز للتصدير', noData: 'لا توجد بيانات'
  },
  en: {
    title: 'Export Data', sub: 'Download a clean version of your data',
    csvTitle: 'Export CSV', csvDesc: 'Comma-separated file, compatible with Excel and all tools',
    jsonTitle: 'Export JSON', jsonDesc: 'Perfect format for developers and APIs',
    xlsxTitle: 'Export Excel', xlsxDesc: 'Modern Microsoft Excel (.xlsx) file format',
    rows: 'records ready for export', noData: 'No data available'
  }
};

export const ExportPage: React.FC<Props> = ({ info, lang }) => {
  const t = T[lang];
  return (
    <div className="page">
      <div className="page-header">
        <div><h2 className="page-title">{t.title}</h2><p className="page-sub">{t.sub}</p></div>
      </div>
      <div className="export-info-bar">
        <span>📦</span>
        <strong>{info.rows.toLocaleString()}</strong>
        <span>{t.rows}</span>
        <span>·</span>
        <span>{info.filename}</span>
      </div>
      <div className="export-grid">
        <div className="export-card csv" onClick={() => exportCSV(info.workData, info.filename)}>
          <div className="export-card-icon"><FileText size={28} /></div>
          <div className="export-card-title">{t.csvTitle}</div>
          <div className="export-card-desc">{t.csvDesc}</div>
          <button className="export-btn"><ArrowDownCircle size={16} style={{ marginRight: 8 }} />{t.csvTitle}</button>
        </div>
        <div className="export-card json" onClick={() => exportJSON(info.workData, info.filename)}>
          <div className="export-card-icon"><Code size={28} /></div>
          <div className="export-card-title">{t.jsonTitle}</div>
          <div className="export-card-desc">{t.jsonDesc}</div>
          <button className="export-btn"><ArrowDownCircle size={16} style={{ marginRight: 8 }} />{t.jsonTitle}</button>
        </div>
        <div className="export-card json" onClick={() => {
            const ws = XLSX.utils.json_to_sheet(info.workData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Kemet Data");
            XLSX.writeFile(wb, info.filename.replace(/\.[^/.]+$/, "") + "_kemet.xlsx");
        }}>
          <div className="export-card-icon"><FileSpreadsheet size={28} /></div>
          <div className="export-card-title">{t.xlsxTitle}</div>
          <div className="export-card-desc">{t.xlsxDesc}</div>
          <button className="export-btn"><ArrowDownCircle size={16} style={{ marginRight: 8 }} />{t.xlsxTitle}</button>
        </div>
      </div>
    </div>
  );
};
