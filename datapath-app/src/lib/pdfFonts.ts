import type { jsPDF } from 'jspdf';

export const PDF_FONT_LATIN = 'helvetica';
export const PDF_FONT_ARABIC = 'NotoArabic';

/** Noto Sans Arabic — loaded at runtime (jsPDF needs embedded TTF for UTF-8). */
const NOTO_ARABIC_TTF =
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@5.2.5/arabic-400-normal.ttf';

let registerPromise: Promise<boolean> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Register Noto Sans Arabic once per app session (required for Arabic in jsPDF). */
export async function ensurePdfArabicFont(doc: jsPDF): Promise<boolean> {
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    try {
      const res = await fetch(NOTO_ARABIC_TTF);
      if (!res.ok) return false;
      const base64 = arrayBufferToBase64(await res.arrayBuffer());
      doc.addFileToVFS('NotoArabic-Regular.ttf', base64);
      doc.addFont('NotoArabic-Regular.ttf', PDF_FONT_ARABIC, 'normal');
      return true;
    } catch (e) {
      console.warn('PDF Arabic font load failed', e);
      return false;
    }
  })();

  return registerPromise;
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function containsArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function datasetNeedsArabicFont(columns: { name: string }[], texts: string[] = []): boolean {
  if (columns.some(c => containsArabic(c.name))) return true;
  return texts.some(containsArabic);
}

export function pickPdfFont(
  arabicFontOk: boolean,
  columns: { name: string }[],
  texts: string[] = [],
): typeof PDF_FONT_LATIN | typeof PDF_FONT_ARABIC {
  return arabicFontOk && datasetNeedsArabicFont(columns, texts) ? PDF_FONT_ARABIC : PDF_FONT_LATIN;
}
