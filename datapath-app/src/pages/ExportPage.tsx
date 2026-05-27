import React from 'react';
import { FileText, Code, FileSpreadsheet, ArrowDownCircle, LayoutDashboard } from 'lucide-react';
import type { DatasetInfo } from '../types';
import { exportCSV, exportJSON } from '../lib/dataUtils';
import { getAppLang } from '../lib/i18n';
import * as XLSX from 'xlsx';

interface Props {
  info: DatasetInfo;
  onOpenSmartDashboard?: () => void;
}

const T = {
  en: {
    title: 'Export Data',
    sub: 'Download a clean version of your data or the full Smart Dashboard package',
    csvTitle: 'Export CSV',
    csvDesc: 'Comma-separated file, compatible with Excel and all tools',
    jsonTitle: 'Export JSON',
    jsonDesc: 'Perfect format for developers and APIs',
    xlsxTitle: 'Export Excel',
    xlsxDesc: 'Microsoft Excel (.xlsx) with your current rows',
    smartTitle: 'Smart Dashboard Export',
    smartDesc: 'Excel workbook + interactive HTML dashboard — one click',
    smartBtn: 'Open Smart Dashboard to Export',
    rows: 'records ready for export',
    noData: 'No data available',
  },
  ar: {
    title: 'تصدير البيانات',
    sub: 'حمّل نسخة نظيفة من بياناتك أو حزمة السمارت داشبورد الكاملة',
    csvTitle: 'تصدير CSV',
    csvDesc: 'ملف مفصول بفواصل — متوافق مع Excel',
    jsonTitle: 'تصدير JSON',
    jsonDesc: 'مناسب للمطورين وواجهات API',
    xlsxTitle: 'تصدير Excel',
    xlsxDesc: 'ملف Excel (.xlsx) بالصفوف الحالية',
    smartTitle: 'تصدير السمارت داشبورد',
    smartDesc: 'Excel + داشبورد HTML تفاعلي — بنقرة واحدة',
    smartBtn: 'افتح السمارت داشبورد للتصدير',
    rows: 'سجل جاهز للتصدير',
    noData: 'لا توجد بيانات',
  },
};

export const ExportPage: React.FC<Props> = ({ info, onOpenSmartDashboard }) => {
  const t = getAppLang() === 'ar' ? T.ar : T.en;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">{t.title}</h2>
          <p className="page-sub">{t.sub}</p>
        </div>
      </div>
      <div className="export-info-bar">
        <span>📦</span>
        <strong>{info.rows.toLocaleString()}</strong>
        <span>{t.rows}</span>
        <span>·</span>
        <span>{info.filename}</span>
      </div>
      <div className="export-grid">
        <div
          className="export-card"
          style={{ borderColor: 'rgba(16,185,129,0.45)', gridColumn: '1 / -1' }}
          onClick={() => onOpenSmartDashboard?.()}
          onKeyDown={e => e.key === 'Enter' && onOpenSmartDashboard?.()}
          role="button"
          tabIndex={0}
        >
          <div className="export-card-icon">
            <LayoutDashboard size={28} color="#10b981" />
          </div>
          <div className="export-card-title">{t.smartTitle}</div>
          <div className="export-card-desc">{t.smartDesc}</div>
          <button type="button" className="export-btn" style={{ background: '#10b981' }}>
            <ArrowDownCircle size={16} style={{ marginRight: 8 }} />
            {t.smartBtn}
          </button>
        </div>

        <div className="export-card csv" onClick={() => exportCSV(info.workData, info.filename)}>
          <div className="export-card-icon">
            <FileText size={28} />
          </div>
          <div className="export-card-title">{t.csvTitle}</div>
          <div className="export-card-desc">{t.csvDesc}</div>
          <button type="button" className="export-btn">
            <ArrowDownCircle size={16} style={{ marginRight: 8 }} />
            {t.csvTitle}
          </button>
        </div>
        <div className="export-card json" onClick={() => exportJSON(info.workData, info.filename)}>
          <div className="export-card-icon">
            <Code size={28} />
          </div>
          <div className="export-card-title">{t.jsonTitle}</div>
          <div className="export-card-desc">{t.jsonDesc}</div>
          <button type="button" className="export-btn">
            <ArrowDownCircle size={16} style={{ marginRight: 8 }} />
            {t.jsonTitle}
          </button>
        </div>
        <div
          className="export-card json"
          onClick={() => {
            const ws = XLSX.utils.json_to_sheet(info.workData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Kimit Data');
            XLSX.writeFile(wb, info.filename.replace(/\.[^/.]+$/, '') + '_kimit.xlsx');
          }}
        >
          <div className="export-card-icon">
            <FileSpreadsheet size={28} />
          </div>
          <div className="export-card-title">{t.xlsxTitle}</div>
          <div className="export-card-desc">{t.xlsxDesc}</div>
          <button type="button" className="export-btn">
            <ArrowDownCircle size={16} style={{ marginRight: 8 }} />
            {t.xlsxTitle}
          </button>
        </div>
      </div>
    </div>
  );
};
