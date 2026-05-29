import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface SharedChart {
  title: string;
  subtitle?: string;
  option: object;
}

/** How charts are stored in Firestore: option serialized to JSON to avoid
 *  Firestore's "nested arrays are not supported" limitation. */
interface StoredChart {
  title: string;
  subtitle?: string;
  optionJson: string;
}

export interface SharedDashboardInput {
  datasetName: string;
  theme: 'light' | 'dark';
  isAr: boolean;
  sheetTypeLabel?: string;
  brandLogoDataUrl?: string;
  ownerName?: string;
  kpis: Array<{ title: string; value: string | number; sub?: string }>;
  charts: SharedChart[];
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

// Firestore hard limit per document is ~1 MiB. Stay safely under it.
const MAX_DOC_BYTES = 950_000;

/**
 * Persist a dashboard snapshot (charts + KPIs only — NO raw data rows)
 * to Firestore and return a public shareable URL.
 * Chart options are serialized to JSON strings to sidestep Firestore's
 * "nested arrays are not supported" restriction.
 */
export async function createSharedDashboard(
  payload: SharedDashboardInput,
): Promise<ShareResult> {
  const id = generateId();
  const ownerUid = auth.currentUser?.uid ?? null;

  // Serialize charts, dropping the largest ones if we approach the size limit.
  const stored: StoredChart[] = [];
  let runningBytes = 2000; // rough overhead for metadata + kpis
  for (const c of payload.charts) {
    const optionJson = JSON.stringify(c.option);
    const chartBytes = optionJson.length + (c.title?.length ?? 0) + (c.subtitle?.length ?? 0) + 40;
    if (runningBytes + chartBytes > MAX_DOC_BYTES) break;
    runningBytes += chartBytes;
    const entry: StoredChart = { title: c.title, optionJson };
    if (c.subtitle) entry.subtitle = c.subtitle;
    stored.push(entry);
  }

  if (stored.length === 0) {
    throw new Error('Dashboard is too large to share.');
  }

  // Firestore rejects `undefined` — only include defined fields.
  const clean: Record<string, unknown> = {
    datasetName: payload.datasetName,
    theme: payload.theme,
    isAr: payload.isAr,
    kpis: payload.kpis ?? [],
    charts: stored,
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
  const raw = snap.data() as Record<string, unknown>;
  const rawCharts = (raw.charts as StoredChart[] | undefined) ?? [];
  const charts: SharedChart[] = rawCharts.map(c => {
    let option: object = {};
    try {
      option = c.optionJson ? JSON.parse(c.optionJson) : ((c as unknown as SharedChart).option ?? {});
    } catch {
      option = {};
    }
    return { title: c.title, subtitle: c.subtitle, option };
  });
  return {
    datasetName: String(raw.datasetName ?? 'Dashboard'),
    theme: (raw.theme as 'light' | 'dark') ?? 'light',
    isAr: Boolean(raw.isAr),
    sheetTypeLabel: raw.sheetTypeLabel as string | undefined,
    brandLogoDataUrl: raw.brandLogoDataUrl as string | undefined,
    ownerName: raw.ownerName as string | undefined,
    kpis: (raw.kpis as SharedDashboardDoc['kpis']) ?? [],
    charts,
  };
}
