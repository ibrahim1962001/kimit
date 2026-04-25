import React, { useCallback, useEffect, useState } from 'react';
import { Sheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    gapi: {
      load: (api: string, cb: () => void) => void;
      client?: {
        init: (config: object) => Promise<void>;
        sheets?: {
          spreadsheets: {
            values: {
              get: (params: object) => Promise<{ result: { values?: string[][] } }>;
            };
          };
        };
      };
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      picker: any;
    };
  }
}

const GOOGLE_API_KEY    = import.meta.env.VITE_GOOGLE_API_KEY    || '';
const GOOGLE_CLIENT_ID  = import.meta.env.VITE_GOOGLE_CLIENT_ID  || '';
const GOOGLE_APP_ID     = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';

interface Props {
  onFile: (file: File) => void;
  lang?: 'ar' | 'en';
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export const GoogleSheetsPicker: React.FC<Props> = ({ onFile, lang = 'ar' }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [tokenClient, setTokenClient] = useState<{ requestAccessToken: (opts?: { prompt?: string }) => void } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  // --- Load Google API Script ---
  useEffect(() => {
    const loadScript = (src: string, onLoad: () => void) => {
      if (document.querySelector(`script[src="${src}"]`)) { onLoad(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = onLoad;
      document.body.appendChild(s);
    };

    loadScript('https://apis.google.com/js/api.js', () => {
      window.gapi.load('client:picker', async () => {
        try {
          await window.gapi.client!.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
          });
          setGapiReady(true);
        } catch (e) {
          console.error('GAPI init error:', e);
          setGapiReady(true); // still allow picker even if sheets client fails
        }
      });
    });

    loadScript('https://accounts.google.com/gsi/client', () => {
      if (!GOOGLE_CLIENT_ID) return;
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (resp) => {
            if (resp.access_token) {
              setAccessToken(resp.access_token);
            } else {
              setStatus('error');
              setStatusMsg(lang === 'ar' ? 'فشل في المصادقة' : 'Authentication failed');
            }
          },
        });
        setTokenClient(client);
        setGisReady(true);
      } catch (e) {
        console.error('GIS init error:', e);
      }
    });
  }, [lang]);

  // --- Open Picker when accessToken is set ---
  const openPicker = useCallback((token: string) => {
    if (!window.google?.picker) {
      setStatus('error');
      setStatusMsg(lang === 'ar' ? 'Google Picker غير جاهز بعد' : 'Google Picker not ready yet');
      return;
    }

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
    view.setMimeTypes('application/vnd.google-apps.spreadsheet');

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(GOOGLE_APP_ID)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .addView(view)
      .setCallback(async (rawData: unknown) => {
        const data = rawData as { action: string; docs?: Array<{ id: string; name: string }> };
        if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
          const doc = data.docs[0];
          setStatus('loading');
          setStatusMsg(lang === 'ar' ? `جاري تحميل "${doc.name}"...` : `Loading "${doc.name}"...`);
          try {
            // Export the sheet directly as CSV (works reliably)
            const csvUrl = `https://docs.google.com/spreadsheets/d/${doc.id}/export?format=csv`;
            const resp = await fetch(csvUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            if (!text.trim()) throw new Error('empty');
            const file = new File([text], `${doc.name}.csv`, { type: 'text/csv' });
            setStatus('success');
            setStatusMsg(lang === 'ar' ? `✅ تم تحميل "${doc.name}" بنجاح!` : `✅ Loaded "${doc.name}" successfully!`);
            setTimeout(() => {
              setStatus('idle');
              setStatusMsg('');
              onFile(file);
            }, 1200);
          } catch (e) {
            console.error(e);
            setStatus('error');
            setStatusMsg(lang === 'ar' ? 'فشل في تحميل الملف. تأكد من الصلاحيات.' : 'Failed to load. Check permissions.');
          }
        }
      })
      .build();

    picker.setVisible(true);
  }, [lang, onFile]);

  useEffect(() => {
    if (accessToken) openPicker(accessToken);
  }, [accessToken, openPicker]);

  // --- Trigger Auth + Picker ---
  const handleClick = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      setStatus('error');
      setStatusMsg(lang === 'ar' ? 'مفاتيح Google API غير مضبوطة' : 'Google API keys not configured');
      return;
    }
    if (!gapiReady || !gisReady) {
      setStatus('loading');
      setStatusMsg(lang === 'ar' ? 'جاري تحميل خدمات Google...' : 'Loading Google services...');
      return;
    }
    if (accessToken) {
      openPicker(accessToken);
    } else if (tokenClient) {
      setStatus('loading');
      setStatusMsg(lang === 'ar' ? 'جاري المصادقة...' : 'Authenticating...');
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }, [gapiReady, gisReady, accessToken, tokenClient, openPicker, lang]);

  return (
    <div className="gsp-wrapper">
      <button
        className={`gsp-btn ${status}`}
        onClick={handleClick}
        disabled={status === 'loading'}
        title={lang === 'ar' ? 'اختر جدول بيانات من Google Drive' : 'Pick a spreadsheet from Google Drive'}
      >
        {status === 'loading' ? (
          <Loader2 size={18} className="gsp-spin" />
        ) : status === 'success' ? (
          <CheckCircle2 size={18} />
        ) : status === 'error' ? (
          <AlertCircle size={18} />
        ) : (
          <Sheet size={18} />
        )}
        <span>{lang === 'ar' ? 'تحميل من Google Sheets' : 'Load from Google Sheets'}</span>
      </button>

      {statusMsg && (
        <div className={`gsp-status ${status}`}>
          {statusMsg}
        </div>
      )}

      <style>{`
        .gsp-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .gsp-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          border-radius: 99px;
          border: 1px solid rgba(66, 133, 244, 0.35);
          background: linear-gradient(135deg, rgba(66, 133, 244, 0.12), rgba(52, 168, 83, 0.08));
          color: #93c5fd;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          font-family: inherit;
          white-space: nowrap;
          backdrop-filter: blur(10px);
          position: relative;
          overflow: hidden;
        }

        .gsp-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(66,133,244,0.05), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .gsp-btn:hover:not(:disabled) {
          border-color: rgba(66, 133, 244, 0.6);
          background: linear-gradient(135deg, rgba(66, 133, 244, 0.22), rgba(52, 168, 83, 0.15));
          color: #bfdbfe;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(66, 133, 244, 0.25);
        }

        .gsp-btn:hover::before { opacity: 1; }

        .gsp-btn.loading {
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.2);
          cursor: wait;
        }

        .gsp-btn.success {
          border-color: rgba(16, 185, 129, 0.4);
          color: #6ee7b7;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08));
        }

        .gsp-btn.error {
          border-color: rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), transparent);
        }

        @keyframes gsp-spin {
          to { transform: rotate(360deg); }
        }
        .gsp-spin { animation: gsp-spin 0.8s linear infinite; }

        .gsp-status {
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 99px;
          text-align: center;
          animation: gsp-fade-in 0.3s ease;
        }

        @keyframes gsp-fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gsp-status.loading { color: #94a3b8; }
        .gsp-status.success {
          color: #6ee7b7;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .gsp-status.error {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
      `}</style>
    </div>
  );
};
