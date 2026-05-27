import { exportSmartDashboardExcel, type SmartDashboardExcelPayload } from './exportUtils';

export interface SmartDashboardExportChart {
  title: string;
  subtitle?: string;
  option: object;
}

export interface SmartDashboardBundlePayload extends SmartDashboardExcelPayload {
  charts: SmartDashboardExportChart[];
  theme?: 'light' | 'dark';
  isAr?: boolean;
  sheetTypeLabel?: string;
  brandLogoDataUrl?: string;
  user?: {
    name?: string;
    email?: string;
    photoURL?: string;
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStandaloneDashboardHtml(payload: SmartDashboardBundlePayload): string {
  const isAr = payload.isAr ?? false;
  const theme = payload.theme ?? 'light';
  const dark = theme === 'dark';
  const createdAt = new Date();
  const embed = JSON.stringify({
    datasetName: payload.datasetName,
    generated: createdAt.toISOString(),
    theme,
    kpis: payload.kpis ?? [],
    insights: payload.insights ?? [],
    quality: payload.quality ?? null,
    charts: payload.charts,
    sheetTypeLabel: payload.sheetTypeLabel ?? null,
    brandLogoDataUrl: payload.brandLogoDataUrl ?? null,
    user: payload.user ?? null,
  });
  const brandLogo = payload.brandLogoDataUrl?.trim() || '';

  const userName = payload.user?.name?.trim() || (isAr ? 'مستخدم' : 'User');
  const userEmail = payload.user?.email?.trim() || (isAr ? 'زائر' : 'Guest');
  const userPhoto = payload.user?.photoURL?.trim() || '';
  const userInitial = (userName[0] || 'U').toUpperCase();
  const userCard = `
    <div class="hero-user" title="${escapeHtml(userEmail)}">
      <div class="hero-user-avatar-wrap">
        ${
          userPhoto
            ? `<img src="${escapeHtml(userPhoto)}" alt="${escapeHtml(userName)}" class="hero-user-avatar" referrerpolicy="no-referrer" />`
            : `<span class="hero-user-fallback">${escapeHtml(userInitial)}</span>`
        }
        <span class="hero-user-status" aria-hidden="true"></span>
      </div>
      <div class="hero-user-meta">
        <div class="hero-user-name">${escapeHtml(userName)}</div>
        <div class="hero-user-email">${escapeHtml(userEmail)}</div>
      </div>
    </div>`;

  const kpiHtml = (payload.kpis ?? [])
    .map(
      k => `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(k.title)}</div>
      <div class="kpi-value">${escapeHtml(String(k.value))}</div>
      ${k.sub ? `<div class="kpi-sub">${escapeHtml(k.sub)}</div>` : ''}
    </div>`,
    )
    .join('');

  const chartCards = payload.charts
    .map(
      (c, i) => `
    <section class="chart-card">
      <h3>${escapeHtml(c.title)}</h3>
      ${c.subtitle ? `<p class="chart-sub">${escapeHtml(c.subtitle)}</p>` : ''}
      <div id="chart-${i}" class="chart-host"></div>
    </section>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KIMIT — ${escapeHtml(payload.datasetName)}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: ${dark ? '#0f172a' : '#f1f5f9'};
      color: ${dark ? '#e2e8f0' : '#0f172a'};
    }
    .wrap { max-width: 1280px; margin: 0 auto; padding: 24px 20px 48px; }
    .hero {
      background: linear-gradient(135deg, #0d9488, #2563eb);
      color: #fff;
      border-radius: 16px;
      padding: 22px 24px;
      margin-bottom: 20px;
    }
    .hero-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .hero-user {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.28);
      min-width: 170px;
      max-width: 100%;
    }
    .hero-user-avatar-wrap {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.2);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .hero-user-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hero-user-fallback {
      font-size: 13px;
      font-weight: 800;
      color: #fff;
    }
    .hero-user-status {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #22c55e;
      border: 2px solid rgba(13,148,136,0.9);
    }
    .hero-user-meta {
      min-width: 0;
    }
    .hero-user-name, .hero-user-email {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
      line-height: 1.2;
    }
    .hero-user-name {
      font-size: 12px;
      font-weight: 700;
    }
    .hero-user-email {
      font-size: 11px;
      opacity: 0.85;
    }
    .hero-brand {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      object-fit: contain;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.35);
      padding: 4px;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.2);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi {
      background: ${dark ? '#1e293b' : '#fff'};
      border: 1px solid ${dark ? '#334155' : '#e2e8f0'};
      border-radius: 12px;
      padding: 14px 16px;
    }
    .kpi-label { font-size: 0.72rem; color: ${dark ? '#94a3b8' : '#64748b'}; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-value { font-size: 1.35rem; font-weight: 700; margin-top: 4px; }
    .kpi-sub { font-size: 0.75rem; color: ${dark ? '#94a3b8' : '#64748b'}; margin-top: 4px; }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }
    .chart-card {
      background: ${dark ? '#1e293b' : '#fff'};
      border: 1px solid ${dark ? '#334155' : '#e2e8f0'};
      border-radius: 14px;
      padding: 14px 14px 8px;
      min-height: 320px;
    }
    .chart-card h3 { margin: 0 0 4px; font-size: 0.95rem; }
    .chart-sub { margin: 0 0 8px; font-size: 0.78rem; color: ${dark ? '#94a3b8' : '#64748b'}; }
    .chart-host { width: 100%; height: 280px; }
    .footer-site {
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 11px;
      color: ${dark ? '#94a3b8' : '#64748b'};
      opacity: 0.9;
    }
    .footer-created-label {
      opacity: 0.85;
    }
    .footer-created-value {
      color: ${dark ? '#cbd5e1' : '#334155'};
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="hero-head">
        <div>
          ${brandLogo ? `<img src="${escapeHtml(brandLogo)}" alt="Brand Logo" class="hero-brand" />` : ''}
        </div>
        ${userCard}
      </div>
      <span class="badge">${escapeHtml(payload.sheetTypeLabel || (isAr ? 'عام' : 'General'))}</span>
    </header>
    ${kpiHtml ? `<div class="kpi-grid">${kpiHtml}</div>` : ''}
    <div class="charts">${chartCards}</div>
    <p class="footer-site">
      <span>KIMIT.CLOUD</span>
      <span>
        <span class="footer-created-label">${isAr ? 'تاريخ الإنشاء' : 'Created on'}</span>
        <span class="footer-created-value"> ${createdAt.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </span>
    </p>
  </div>
  <script type="application/json" id="kimit-payload">${embed.replace(/</g, '\\u003c')}<\/script>
  <script>
    const payload = JSON.parse(document.getElementById('kimit-payload').textContent);
    const instances = [];
    function initCharts() {
      payload.charts.forEach(function (chart, i) {
        const el = document.getElementById('chart-' + i);
        if (!el || !window.echarts) return;
        const inst = echarts.init(el, null, { renderer: 'canvas' });
        inst.setOption(chart.option, true);
        instances.push(inst);
      });
    }
    window.addEventListener('resize', function () {
      instances.forEach(function (c) { c.resize(); });
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCharts);
    } else {
      initCharts();
    }
  <\/script>
</body>
</html>`;
}

export function downloadTextFile(content: string, filename: string, mime = 'text/html;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function openHtmlDashboardInBrowser(html: string, isAr = false): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    alert(
      isAr
        ? 'اسمح بالنوافذ المنبثقة لعرض الداشبورد، أو افتح ملف .html الذي تم تنزيله.'
        : 'Please allow pop-ups to view the interactive dashboard, or open the downloaded .html file.',
    );
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** One click: Excel workbook + interactive HTML dashboard (opens in browser). */
export function exportSmartDashboardBundle(payload: SmartDashboardBundlePayload): void {
  const baseName = (payload.filename ?? `Smart_Dashboard_${payload.datasetName}`).replace(/\.xlsx$/i, '');
  exportSmartDashboardExcel({ ...payload, filename: `${baseName}.xlsx` });
  const html = buildStandaloneDashboardHtml(payload);
  downloadTextFile(html, `${baseName}.html`);
  openHtmlDashboardInBrowser(html, payload.isAr);
}
