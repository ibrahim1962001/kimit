import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface SharedChart {
  title: string;
  subtitle?: string;
  option: object;
}

export interface SharedDashboardDoc {
  datasetName: string;
  theme: 'light' | 'dark';
  isAr: boolean;
  sheetTypeLabel?: string;
  brandLogoDataUrl?: string;
  ownerName?: string;
  kpis: Array<{ title: string; value: string | number; sub?: string }>;
  charts: SharedChart[];
  createdAt?: unknown;
  views?: number;
}

const COLLECTION = 'shared_dashboards';

/** Short, URL-friendly, hard-to-guess id. */
function generateId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export interface ShareResult {
  id: string;
  url: string;
}

/**
 * Persist a dashboard snapshot (charts + KPIs only — NO raw data rows)
 * to Firestore and return a public shareable URL.
 */
export async function createSharedDashboard(
  payload: Omit<SharedDashboardDoc, 'createdAt' | 'views'>,
): Promise<ShareResult> {
  const id = generateId();
  const ownerUid = auth.currentUser?.uid ?? null;

  // Firestore rejects `undefined` — strip it out.
  const clean: Record<string, unknown> = {
    datasetName: payload.datasetName,
    theme: payload.theme,
    isAr: payload.isAr,
    kpis: payload.kpis ?? [],
    charts: payload.charts ?? [],
    ownerUid,
    createdAt: serverTimestamp(),
    views: 0,
  };
  if (payload.sheetTypeLabel) clean.sheetTypeLabel = payload.sheetTypeLabel;
  if (payload.brandLogoDataUrl) clean.brandLogoDataUrl = payload.brandLogoDataUrl;
  if (payload.ownerName) clean.ownerName = payload.ownerName;

  await setDoc(doc(db, COLLECTION, id), clean);

  const url = `${window.location.origin}/shared?id=${id}`;
  return { id, url };
}

export async function getSharedDashboard(id: string): Promise<SharedDashboardDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return snap.data() as SharedDashboardDoc;
}
