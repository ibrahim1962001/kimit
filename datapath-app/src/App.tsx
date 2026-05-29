import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Menu, Bot, Loader2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { EditorSidebar } from './components/EditorSidebar';
import { parseFile, analyzeDataset, cleanDataset } from './lib/dataUtils';
import { datasetsApi } from './api/datasets.api';
import { auth } from './lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { get, set, del } from 'idb-keyval';
// AuthModal removed — login is now optional via LoginPopup
import { LoginPopup } from './components/LoginPopup';
import './App.css';
import './premium-theme.css';
import './gamma-web-theme.css';
import { useKimitData } from './hooks/useKimitData';
import { WorkflowStepper } from './components/WorkflowStepper';
import {
  type AppTab,
  navigateToTab,
  readInitialTab,
  tabFromPathname,
} from './lib/appNavigation';
import { isCloudSyncEnabled } from './lib/cloudSyncPreference';
import { getAppLang, setAppLang, isArabic } from './lib/i18n';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })),
);
const SmartDashboardPage = lazy(() =>
  import('./pages/SmartDashboardPage').then(m => ({ default: m.SmartDashboardPage })),
);
const ExportedDashboardPage = lazy(() =>
  import('./pages/ExportedDashboardPage').then(m => ({ default: m.ExportedDashboardPage })),
);
const CleaningPage = lazy(() =>
  import('./pages/CleaningPage').then(m => ({ default: m.CleaningPage })),
);
const OpenRouterChat = lazy(() =>
  import('./components/OpenRouterChat').then(m => ({ default: m.OpenRouterChat })),
);
const ExportPage = lazy(() =>
  import('./pages/ExportPage').then(m => ({ default: m.ExportPage })),
);
const AboutUsPage = lazy(() =>
  import('./pages/AboutUsPage').then(m => ({ default: m.AboutUsPage })),
);
const PrivacyPage = lazy(() =>
  import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })),
);
const FAQPage = lazy(() => import('./pages/FAQPage').then(m => ({ default: m.FAQPage })));
const GuidePage = lazy(() => import('./pages/GuidePage').then(m => ({ default: m.GuidePage })));
const ComparisonPage = lazy(() =>
  import('./pages/ComparisonPage').then(m => ({ default: m.ComparisonPage })),
);
const SavedFilesPage = lazy(() =>
  import('./pages/SavedFilesPage').then(m => ({ default: m.SavedFilesPage })),
);

const PageFallback = () => (
  <div className="loading-overlay" style={{ position: 'relative', minHeight: 200 }}>
    <Loader2 size={32} className="analyzing-spinner" />
  </div>
);

type Tab = AppTab;

interface ExcelBridgeMessage {
  type: string;
  payload?: {
    rows?: Array<Record<string, unknown>>;
    filename?: string;
  };
}

function App() {
  const [tab, setTabState] = useState<Tab>(() => readInitialTab());
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    navigateToTab(next);
  }, []);
  const { info: dataset, setDataset } = useKimitData();
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loginPopupOpen, setLoginPopupOpen] = useState(false);

  useEffect(() => {
    setAppLang(getAppLang());
    const onPop = () => setTabState(tabFromPathname(window.location.pathname));
    window.addEventListener('popstate', onPop);
    if (!window.history.state?.tab) {
      navigateToTab(readInitialTab(), true);
    }
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    
    // Session Persistence 1.1
    get('kimit_session_dataset').then((savedDataset) => {
      if (savedDataset) {
        setDataset(savedDataset);
        setTabState('smart-dashboard');
        navigateToTab('smart-dashboard', true);
        // Toast is not shown here directly to avoid UI blocking early, but we could.
      }
    });
    
    return () => unsub();
  }, [setDataset]);

  // Listen for navigation events from DashboardPage Quick Actions
  useEffect(() => {
    const handler = (e: Event) => {
      const navTab = (e as CustomEvent<string>).detail as Tab;
      if (navTab) {
        setTabState(navTab);
        navigateToTab(navTab);
      }
    };
    window.addEventListener('kimit:navigate', handler);
    return () => window.removeEventListener('kimit:navigate', handler);
  }, []);

  useEffect(() => {
    const onPreview = () => setTabState('dashboard-preview');
    window.addEventListener('kimit:open-export-preview', onPreview);
    return () => window.removeEventListener('kimit:open-export-preview', onPreview);
  }, []);

  useEffect(() => {
    const openLogin = () => setLoginPopupOpen(true);
    window.addEventListener('kimit:open-login', openLogin);
    return () => window.removeEventListener('kimit:open-login', openLogin);
  }, []);

  useEffect(() => {
    if (dataset) {
      set('kimit_session_dataset', dataset).catch(console.error);
    } else {
      del('kimit_session_dataset').catch(console.error);
    }
  }, [dataset]);

  // Excel Add-in bridge: import/export dataset via postMessage
  useEffect(() => {
    const postToParent = (type: string, payload?: unknown) => {
      if (typeof window === 'undefined' || !window.parent) return;
      window.parent.postMessage({ type, payload }, '*');
    };

    const buildDatasetFromRows = (rows: Array<Record<string, unknown>>, filename?: string) => {
      const cleanRows = rows
        .filter(r => r && typeof r === 'object')
        .map(r => Object.fromEntries(Object.entries(r)) as Record<string, string | number | null>);
      if (cleanRows.length === 0) return null;
      const fileName = filename?.trim() || 'Excel_Workbook_Data.xlsx';
      const dummyFile = new File([''], fileName);
      return analyzeDataset(dummyFile, cleanRows);
    };

    const handler = (event: MessageEvent<ExcelBridgeMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      if (msg.type === 'KIMIT_EXCEL_IMPORT_ROWS') {
        const rows = msg.payload?.rows ?? [];
        const imported = buildDatasetFromRows(rows, msg.payload?.filename);
        if (!imported) {
          postToParent('KIMIT_APP_ERROR', { message: 'No valid rows received from Excel.' });
          return;
        }
        setDataset(imported);
        setTab('dashboard');
        postToParent('KIMIT_APP_IMPORTED', { rows: imported.rows, filename: imported.filename });
        return;
      }

      if (msg.type === 'KIMIT_EXCEL_REQUEST_ROWS') {
        const rows = dataset?.workData ?? [];
        postToParent('KIMIT_APP_ROWS', {
          rows,
          filename: dataset?.filename ?? 'Kimit_Export.xlsx',
          columns: dataset?.columns.map(c => c.name) ?? [],
        });
      }
    };

    window.addEventListener('message', handler);
    postToParent('KIMIT_APP_READY', { hasDataset: !!dataset });
    return () => window.removeEventListener('message', handler);
  }, [dataset, setDataset]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setProgress(0);
    setLoadMsg('Analyzing... please wait');
    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('exceeds 50MB');
      }

      if (file.size > 10 * 1024 * 1024) {
        // Large file (> 10MB) -> Try backend first, fallback to browser if backend unavailable
        setLoadMsg('Uploading and processing on server...');
        try {
          const res = await datasetsApi.uploadLarge(file);
          const jobId = res.job_id;
          let statusRes;
          
          while (true) {
            await new Promise(r => setTimeout(r, 2000));
            statusRes = await datasetsApi.getUploadStatus(jobId);
            
            if (statusRes.status === 'processing') {
              setProgress(statusRes.progress || 10);
              setLoadMsg(statusRes.message || 'Processing...');
            } else if (statusRes.status === 'done' || statusRes.status === 'success') {
              break;
            } else if (statusRes.status === 'error' || statusRes.status === 'failure') {
              throw new Error(statusRes.message || 'Backend error');
            }
          }
          
          const { convertBackendResultToDatasetInfo } = await import('./lib/dataUtils');
          const info = convertBackendResultToDatasetInfo(statusRes as any);
          setDataset(info);
          setProgress(100);
          showToast(
            isArabic()
              ? `✅ تمت المعالجة على السيرفر — ${info.rows.toLocaleString()} صف`
              : `✅ Processed on server — ${info.rows.toLocaleString()} rows`,
          );
        } catch (_backendErr) {
          // Backend unavailable → fallback to browser parsing
          console.warn('Backend unavailable, falling back to browser parsing:', _backendErr);
          setLoadMsg('Analyzing in browser (offline mode)...');
          const rows = await parseFile(file, setProgress);
          setProgress(90);
          if (!rows.length) throw new Error('Empty file');
          const info = analyzeDataset(file, rows);
          setDataset(info);
          setProgress(100);
          showToast(`✅ Loaded ${info.rows.toLocaleString()} records`);
        }
      } else {
        // Small file -> Parse in browser
        const rows = await parseFile(file, setProgress);
        setProgress(90);
        if (!rows.length) throw new Error('Empty file');
        const info = analyzeDataset(file, rows);
        setDataset(info);
        setProgress(100);
        showToast(
          isArabic()
            ? `✅ تم التحميل محلياً — ${info.rows.toLocaleString()} صف`
            : `✅ Loaded locally — ${info.rows.toLocaleString()} rows`,
        );

        if (isCloudSyncEnabled()) {
          datasetsApi.storeFileOnly(file)
            .then(res => {
              if (res.saved_to_storage) {
                showToast(
                  isArabic() ? '☁️ تم النسخ الاحتياطي السحابي (اختياري)' : '☁️ Optional cloud backup saved',
                );
              }
            })
            .catch(err => console.error('Cloud save failed:', err));
        }
      }

      setTimeout(() => setTab('smart-dashboard'), 500);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const msg = errorMessage === 'exceeds 50MB'
        ? '❌ File too large (Max 50MB)'
        : '❌ Could not read file';
      showToast(msg, 'err');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [setDataset]);


  const handleChatFile = useCallback(async (file: File) => {
    setLoading(true);
    setLoadMsg('Attaching and analyzing file...');
    setProgress(0);
    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('exceeds 50MB');
      }

      if (file.size > 10 * 1024 * 1024) {
        // Large file (> 10MB) -> Send to backend Celery worker
        setLoadMsg('Attaching and processing on server...');
        const res = await datasetsApi.uploadLarge(file);
        
        const jobId = res.job_id;
        let statusRes;
        
        while (true) {
          await new Promise(r => setTimeout(r, 2000));
          statusRes = await datasetsApi.getUploadStatus(jobId);
          
          if (statusRes.status === 'processing') {
            setProgress(statusRes.progress || 10);
            setLoadMsg(statusRes.message || 'Processing...');
          } else if (statusRes.status === 'done' || statusRes.status === 'success') {
            break;
          } else if (statusRes.status === 'error' || statusRes.status === 'failure') {
            throw new Error(statusRes.message || 'Error processing file');
          }
        }
        
        const { convertBackendResultToDatasetInfo } = await import('./lib/dataUtils');
        const info = convertBackendResultToDatasetInfo(statusRes as any);
        setDataset(info);
        setProgress(100);
        showToast(`✅ Attached ${info.rows.toLocaleString()} records ultra-fast`);
        
      } else {
        // Small file -> Parse in browser
        const rows = await parseFile(file, setProgress);
        setProgress(90);
        if (!rows.length) throw new Error('Empty file');
        const info = analyzeDataset(file, rows);
        setDataset(info);
        setProgress(100);
        showToast(`✅ Attached ${info.rows.toLocaleString()} records`);
        
        if (isCloudSyncEnabled()) {
          datasetsApi.storeFileOnly(file).catch(err => console.error('Cloud save failed:', err));
        }
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const msg = errorMessage === 'exceeds 50MB' 
        ? '❌ File too large (Max 50MB)'
        : '❌ Could not read file';
      showToast(msg, 'err');
    } finally { 
      setLoading(false); 
      setProgress(0);
    }
  }, [setDataset]);

  const handleClean = useCallback(() => {
    if (!dataset) return;
    const cleaned = cleanDataset(dataset);
    setDataset(cleaned);
    showToast('✅ Data cleaned successfully!');
  }, [dataset, setDataset]);

  const handleClose = () => { 
    setDataset(null); 
    setTab('home'); 
    del('kimit_session_dataset');
  };
  
  const handleClearSession = () => {
    handleClose();
    showToast('🗑️ Session cleared successfully');
  };

    

  // No forced login wall — app is available to everyone
  // Login button is in the sidebar and opens the small LoginPopup

  const lang = getAppLang();
  const showWorkflow =
    !!dataset &&
    (tab === 'dashboard' ||
      tab === 'cleaning' ||
      tab === 'chat' ||
      tab === 'export' ||
      tab === 'smart-dashboard');

  return (
    <div className={`app ${lang === 'ar' ? 'rtl' : 'ltr'} flex flex-col min-h-screen relative`}>
      {/* Mobile Top Bar */}
      <div className="mobile-top-bar">
        <div className="mobile-logo-small">
          <img 
            src="/logo.png" 
            alt="Logo" 
            onError={(e) => { (e.target as HTMLImageElement).src = "https://img.icons8.com/clouds/200/egyptian-pyramids.png"; }}
          />
          <span>Kimit AI Studio</span>
          <span className="mobile-version-tag">v2.1</span>
        </div>
        <button className="mobile-menu-btn-icon" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      <Sidebar 
        tab={tab} 
        
        hasData={!!dataset} 
        onTab={(t) => { setTab(t); setMobileMenuOpen(false); }} 
        
        onClose={handleClose} 
        onClearSession={handleClearSession}
        onOpenEditor={() => { setSidePanelOpen(true); setMobileMenuOpen(false); }} 
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onLoginClick={() => setLoginPopupOpen(true)}
      />

      <main className="main flex-1 flex flex-col min-h-full">
        {loading && (
          <div className="loading-overlay">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
               <Bot size={64} color="var(--primary)" className="analyzing-bot" />
               <Loader2 size={32} color="var(--primary)" className="analyzing-spinner" style={{ position: 'absolute', bottom: -10, right: -10 }} />
            </div>
            <div className="loading-content">
              <p className="loading-msg">{loadMsg}</p>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
                <span className="progress-text">{progress}%</span>
              </div>
            </div>
          </div>
        )}

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

        <div className="flex-1 animate-fade-in">
          {showWorkflow && (
            <WorkflowStepper current={tab} onStep={setTab} />
          )}
          <Suspense fallback={<PageFallback />}>
            {tab === 'home' && (
              <HomePage
                onFile={handleFile}
                onTrySmartDashboard={() => {
                  if (dataset) setTab('smart-dashboard');
                  else showToast(isArabic() ? 'ارفع ملفاً أولاً' : 'Upload a file first', 'err');
                }}
              />
            )}
            {tab === 'dashboard' && dataset && <DashboardPage />}
            {tab === 'cleaning' && dataset && (
              <CleaningPage info={dataset} onClean={handleClean} onUpdate={setDataset} />
            )}
            {tab === 'chat' && (
              <OpenRouterChat dataset={dataset} onFileUpload={handleChatFile} onUpdate={setDataset} />
            )}
            {tab === 'export' && dataset && (
              <ExportPage info={dataset} onOpenSmartDashboard={() => setTab('smart-dashboard')} />
            )}
            {tab === 'files' && <SavedFilesPage />}
            {tab === 'about' && <AboutUsPage />}
            {tab === 'privacy' && <PrivacyPage />}
            {tab === 'faq' && <FAQPage />}
            {tab === 'guide' && <GuidePage />}
            {tab === 'compare' && <ComparisonPage />}
            {tab === 'smart-dashboard' && (
              <SmartDashboardPage onBack={() => setTab(dataset ? 'dashboard' : 'home')} />
            )}
            {tab === 'dashboard-preview' && (
              <ExportedDashboardPage onBack={() => setTab('smart-dashboard')} />
            )}
          </Suspense>
        </div>

        {dataset && (
          <EditorSidebar isOpen={sidePanelOpen} onClose={() => setSidePanelOpen(false)} info={dataset} onUpdate={setDataset} />
        )}
      </main>

      {/* Small Login Popup Window */}
      <LoginPopup
        isOpen={loginPopupOpen}
        onClose={() => setLoginPopupOpen(false)}
        onSuccess={() => setLoginPopupOpen(false)}
      />

    </div>
  );
}

export default App;
