import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const GOOGLE_API_KEY   = import.meta.env.VITE_GOOGLE_API_KEY   || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const APP_ID           = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';

// Scopes needed to open Picker + read sheet data
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
].join(' ');

interface Props {
  onFile: (file: File) => void;
  
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export const GoogleSheetsPicker: React.FC<Props> = ({ onFile }) => {
  const [status, setStatus]     = useState<Status>('idle');
  const [msg, setMsg]           = useState('');
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady]   = useState(false);
  const tokenRef = useRef<string | null>(null);
  const clientRef = useRef<any>(null);

  /* ── load scripts once ───────────────────────────────── */
  useEffect(() => {
    let mounted = true;

    const loadScript = (src: string, cb: () => void) => {
      if (document.querySelector(`script[src="${src}"]`)) { cb(); return; }
      const s = Object.assign(document.createElement('script'), { src, async: true, defer: true });
      s.onload = cb;
      document.head.appendChild(s);
    };

    // 1) Load GAPI (needed for Picker)
    loadScript('https://apis.google.com/js/api.js', () => {
      if (window.gapi) {
        window.gapi.load('picker', () => {
          if (mounted) setGapiReady(true);
        });
      }
    });

    // 2) Load GIS (OAuth token client)
    loadScript('https://accounts.google.com/gsi/client', () => {
      if (!GOOGLE_CLIENT_ID || !mounted) return;
      try {
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (resp: any) => {
            if (resp?.access_token) {
              tokenRef.current = resp.access_token;
              openPicker(resp.access_token);
            } else {
              setStatus('error');
              setMsg('Login failed');
            }
          },
        });
        if (mounted) setGisReady(true);
      } catch (e) {
        console.error('GIS init:', e);
      }
    });

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── fetch sheet as CSV ──────────────────────────────── */
  const fetchSheet = useCallback(async (doc: { id: string; name: string }, token: string) => {
    setStatus('loading');
    const name = doc.name;
    setMsg(`Loading "${name}"…`);

    try {
      const url = `https://docs.google.com/spreadsheets/d/${doc.id}/export?format=csv&gid=0`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (window.gapi?.client?.sheets) {
          const gRes = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: doc.id,
            range: 'Sheet1',
          });
          const rows: string[][] = gRes.result.values || [];
          const csv = rows.map((r: string[]) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
          if (!csv.trim()) throw new Error('empty');
          onFile(new File([csv], `${name}.csv`, { type: 'text/csv' }));
          setStatus('success');
          setMsg(`✅ "${name}" loaded!`);
          setTimeout(() => { setStatus('idle'); setMsg(''); }, 1400);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const text = await res.text();
      if (!text.trim()) throw new Error('empty response');

      setStatus('success');
      setMsg(`✅ "${name}" loaded!`);
      setTimeout(() => {
        setStatus('idle');
        setMsg('');
        onFile(new File([text], `${name}.csv`, { type: 'text/csv' }));
      }, 1400);

    } catch (e: unknown) {
      console.error('Sheet fetch error:', e);
      setStatus('error');
      setMsg('Could not read file. Check sharing permissions or re-authenticate.');
    }
  }, [onFile]);

  /* ── open Picker ─────────────────────────────────────── */
  const openPicker = useCallback((token: string) => {
    if (!window.google?.picker) {
      setStatus('error');
      setMsg('Google Picker not loaded. Retry.');
      return;
    }

    // ✅ Google Sheets ONLY — My Drive tab
    const sheetsView = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
    sheetsView.setMimeTypes('application/vnd.google-apps.spreadsheet');
    sheetsView.setIncludeFolders(false);
    sheetsView.setSelectFolderEnabled(false);

    // ✅ Shared with me — Sheets only
    const sharedView = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
    sharedView.setMimeTypes('application/vnd.google-apps.spreadsheet');
    sharedView.setIncludeFolders(false);
    sharedView.setOwnedByMe(false);

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(APP_ID)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .addView(sheetsView)
      .addView(sharedView)
      .setTitle('📊 Select a Google Sheet')
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
          fetchSheet(data.docs[0], token);
        } else if (data.action === 'cancel') {
          setStatus('idle');
          setMsg('');
        }
      })
      .build();

    picker.setVisible(true);
  }, [fetchSheet]);

  /* ── button click ────────────────────────────────────── */
  const handleClick = () => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      setStatus('error');
      setMsg('Google API keys missing');
      return;
    }
    if (!gapiReady || !gisReady) {
      setStatus('loading');
      setMsg('Loading Google services…');
      // retry after a second
      setTimeout(handleClick, 1000);
      return;
    }

    if (tokenRef.current) {
      // reuse token directly
      openPicker(tokenRef.current);
    } else {
      setStatus('loading');
      setMsg('Signing in with Google…');
      // prompt: '' tries silent auth first; '' = consent if needed
      clientRef.current?.requestAccessToken({ prompt: '' });
    }
  };

  return (
    <div className="gsp2-wrapper">
      <button
        className={`gsp2-btn ${status}`}
        onClick={handleClick}
        disabled={status === 'loading' || status === 'success'}
        title="Pick a spreadsheet from Google Drive"
        type="button"
      >
        {status === 'loading'  ? <Loader2 size={18} className="gsp2-spin" />  :
         status === 'success'  ? <CheckCircle2 size={18} />                   :
         status === 'error'    ? <AlertCircle size={18} />                    :
                                 <Sheet size={18} />}
        <span>
          {status === 'loading' && !msg
            ? 'Loading…'
            : 'Load from Google Sheets'}
        </span>
      </button>

      {msg && <div className={`gsp2-status ${status}`}>{msg}</div>}
    </div>
  );
};
