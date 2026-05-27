import type { DatasetInfo, SummaryReport } from '../types';

export type ReportLang = 'en' | 'ar';

const L = {
  en: {
    execSummary: 'EXECUTIVE SUMMARY',
    keyInsights: 'KEY INSIGHTS',
    risks: 'RISKS & ANOMALIES',
    quality: 'DATA QUALITY',
    actions: 'RECOMMENDED ACTIONS',
    opportunities: 'STRATEGIC OPPORTUNITIES',
    prepared: 'Prepared by Kimit AI Studio — automated analysis',
    localNote: 'Analysis generated from statistical profiling (offline mode).',
  },
  ar: {
    execSummary: 'الملخص التنفيذي',
    keyInsights: 'أهم الرؤى',
    risks: 'المخاطر والشذوذ',
    quality: 'جودة البيانات',
    actions: 'إجراءات موصى بها',
    opportunities: 'فرص تحليلية',
    prepared: 'أعدّه Kimit AI Studio — تحليل آلي',
    localNote: 'تم إنشاء التحليل من الإحصاءات المحلية (وضع بدون اتصال).',
  },
};

export function getReportLang(): ReportLang {
  return typeof localStorage !== 'undefined' && localStorage.getItem('kimit_lang') === 'ar'
    ? 'ar'
    : 'en';
}

/** Rich narrative text for PDF page (supports **bold** markers). */
export function formatExecutiveNarrative(report: SummaryReport, lang: ReportLang = 'en'): string {
  const t = L[lang];
  const sections: string[] = [];

  sections.push(`**${t.execSummary}**`);
  sections.push(report.executiveSummary);
  if (report.isLocal) sections.push(`*${t.localNote}*`);

  if (report.insights.length) {
    sections.push(`\n**${t.keyInsights}**`);
    report.insights.forEach((item, i) => sections.push(`${i + 1}. ${item}`));
  }

  if (report.warnings.length) {
    sections.push(`\n**${t.risks}**`);
    report.warnings.forEach((item, i) => sections.push(`${i + 1}. ${item}`));
  }

  if (report.qualityIssues.length) {
    sections.push(`\n**${t.quality}**`);
    report.qualityIssues.forEach((item, i) => sections.push(`${i + 1}. ${item}`));
  }

  if (report.recommendations.length) {
    sections.push(`\n**${t.actions}**`);
    report.recommendations.forEach((item, i) => sections.push(`${i + 1}. ${item}`));
  }

  if (report.opportunities.length) {
    sections.push(`\n**${t.opportunities}**`);
    report.opportunities.forEach((item, i) => sections.push(`${i + 1}. ${item}`));
  }

  sections.push(`\n*${t.prepared}*`);
  return sections.join('\n');
}

export function summaryToInsightCards(report: SummaryReport): {
  title: string;
  description: string;
  type: 'info' | 'positive' | 'warning';
}[] {
  const cards: { title: string; description: string; type: 'info' | 'positive' | 'warning' }[] = [];

  report.insights.slice(0, 3).forEach((text, i) => {
    cards.push({ title: `Insight ${i + 1}`, description: text, type: 'info' });
  });
  report.warnings.slice(0, 2).forEach((text, i) => {
    cards.push({ title: `Risk ${i + 1}`, description: text, type: 'warning' });
  });
  report.recommendations.slice(0, 2).forEach((text, i) => {
    cards.push({ title: `Recommendation ${i + 1}`, description: text, type: 'positive' });
  });

  return cards.slice(0, 6);
}

export function buildReportMeta(info: DatasetInfo, lang: ReportLang) {
  const completeness =
    info.rows * info.columns.length > 0
      ? (100 - (info.totalNulls / (info.rows * info.columns.length)) * 100).toFixed(1)
      : '100.0';

  const numericCols = info.columns.filter(c => c.type === 'numeric');
  const topMetric = numericCols[0];

  return {
    title: lang === 'ar' ? 'التقرير التنفيذي للبيانات' : 'Executive Intelligence Report',
    subtitle:
      lang === 'ar'
        ? `تحليل استراتيجي — ${info.filename}`
        : `Strategic Analysis — ${info.filename}`,
    completeness,
    topMetricName: topMetric?.name,
    topMetricMean: topMetric?.mean,
  };
}
