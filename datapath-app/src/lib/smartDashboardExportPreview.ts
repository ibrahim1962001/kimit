import { navigateToTab } from './appNavigation';
import type { SmartDashboardBundlePayload } from './smartDashboardHtmlExport';

export const EXPORT_PREVIEW_STORAGE_KEY = 'kimit_export_preview_v1';

let inMemoryPreview: SmartDashboardBundlePayload | null = null;

/** Slim payload for sessionStorage (charts + KPIs only; avoids quota errors). */
function toStorablePreview(payload: SmartDashboardBundlePayload): SmartDashboardBundlePayload {
  return {
    ...payload,
    data: [],
    topRows: [],
  };
}

/** Open full-screen interactive preview immediately (works on mobile; no pop-ups). */
export function openExportedDashboardPreview(payload: SmartDashboardBundlePayload): void {
  inMemoryPreview = payload;
  try {
    sessionStorage.setItem(EXPORT_PREVIEW_STORAGE_KEY, JSON.stringify(toStorablePreview(payload)));
  } catch {
    try {
      sessionStorage.removeItem(EXPORT_PREVIEW_STORAGE_KEY);
      sessionStorage.setItem(EXPORT_PREVIEW_STORAGE_KEY, JSON.stringify(toStorablePreview(payload)));
    } catch {
      /* charts still available from inMemoryPreview */
    }
  }
  navigateToTab('smart-dashboard');
  window.dispatchEvent(new CustomEvent('kimit:open-export-preview'));
}

export function readExportedDashboardPreview(): SmartDashboardBundlePayload | null {
  if (inMemoryPreview) {
    return inMemoryPreview;
  }
  try {
    const raw = sessionStorage.getItem(EXPORT_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SmartDashboardBundlePayload;
  } catch {
    return null;
  }
}

export function clearExportedDashboardPreview(): void {
  inMemoryPreview = null;
  try {
    sessionStorage.removeItem(EXPORT_PREVIEW_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
