import { useState, useCallback, useEffect } from 'react';
import { Menu, Bot, Loader2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { CleaningPage } from './pages/CleaningPage';
import { OpenRouterChat } from './components/OpenRouterChat';
import { ExportPage } from './pages/ExportPage';
import { EditorSidebar } from './components/EditorSidebar';
import { AboutUsPage } from './pages/AboutUsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { FAQPage } from './pages/FAQPage';
import { GuidePage } from './pages/GuidePage';
import { ComparisonPage } from './pages/ComparisonPage';
import { parseFile, analyzeDataset, cleanDataset } from './lib/dataUtils';
import type { Lang } from './types';
import { auth } from './lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { get, set, del } from 'idb-keyval';
// AuthModal removed — login is now optional via LoginPopup
import { LoginPopup } from './components/LoginPopup';
import './App.css';
import './premium-theme.css';
import { useKimitData } from './hooks/useKimitData';


type Tab = 'home' | 'dashboard' | 'cleaning' | 'chat' | 'export' | 'about' | 'privacy' | 'faq' | 'guide' | 'compare';

function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [tab, setTab] = useState<Tab>('home');
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
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    
    // Session Persistence 1.1
    get('kimit_session_dataset').then((savedDataset) => {
      if (savedDataset) {
        setDataset(savedDataset);
        setTab('dashboard');
        // Toast is not shown here directly to avoid UI blocking early, but we could.
      }
    });
    
    return () => unsub();
  }, [setDataset]);

  useEffect(() => {
    if (dataset) {
      set('kimit_session_dataset', dataset).catch(console.error);
    } else {
      del('kimit_session_dataset').catch(console.error);
    }
  }, [dataset]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setLoadMsg(lang === 'ar' ? 'جاري التحليل... انتظر قليلاً' : 'Analyzing... please wait');
    setProgress(0);
    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('exceeds 50MB');
      }
      
      const rows = await parseFile(file, setProgress);
      setProgress(90);
      
      if (!rows.length) throw new Error('Empty file');
      const info = analyzeDataset(file, rows);
      setDataset(info);
      setProgress(100);
      showToast(lang === 'ar' ? `✅ تم تحميل ${info.rows.toLocaleString()} سجل` : `✅ Loaded ${info.rows.toLocaleString()} records`);
      setTimeout(() => setTab('dashboard'), 500);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const msg = errorMessage === 'exceeds 50MB' 
        ? (lang === 'ar' ? '❌ الملف كبير جداً (أقصى حد 50 ميجابايت)' : '❌ File too large (Max 50MB)')
        : (lang === 'ar' ? '❌ تعذر قراءة الملف' : '❌ Could not read file');
      showToast(msg, 'err');
    } finally { 
      setLoading(false); 
      setProgress(0);
    }
  }, [lang, setDataset]);

  const handleChatFile = useCallback(async (file: File) => {
    setLoading(true);
    setLoadMsg(lang === 'ar' ? 'جاري إرفاق وتحليل الملف...' : 'Attaching and analyzing file...');
    setProgress(0);
    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('exceeds 50MB');
      }
      const rows = await parseFile(file, setProgress);
      setProgress(90);
      if (!rows.length) throw new Error('Empty file');
      const info = analyzeDataset(file, rows);
      setDataset(info);
      setProgress(100);
      showToast(lang === 'ar' ? `✅ تم إرفاق ${info.rows.toLocaleString()} سجل بنجاح` : `✅ Attached ${info.rows.toLocaleString()} records`);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const msg = errorMessage === 'exceeds 50MB' 
        ? (lang === 'ar' ? '❌ الملف كبير جداً (أقصى حد 50 ميجابايت)' : '❌ File too large (Max 50MB)')
        : (lang === 'ar' ? '❌ تعذر قراءة الملف' : '❌ Could not read file');
      showToast(msg, 'err');
    } finally { 
      setLoading(false); 
      setProgress(0);
    }
  }, [lang, setDataset]);

  const handleClean = useCallback(() => {
    if (!dataset) return;
    const cleaned = cleanDataset(dataset);
    setDataset(cleaned);
    showToast(lang === 'ar' ? '✅ تمت التنقية بنجاح!' : '✅ Data cleaned successfully!');
  }, [dataset, lang, setDataset]);

  const handleClose = () => { 
    setDataset(null); 
    setTab('home'); 
    del('kimit_session_dataset');
  };
  
  const handleClearSession = () => {
    handleClose();
    showToast(lang === 'ar' ? '🗑️ تم مسح الجلسة بنجاح' : '🗑️ Session cleared successfully');
  };

  const toggleLang = () => setLang(l => l === 'ar' ? 'en' : 'ar');
  

  // لا يوجد جدار تسجيل إجباري — التطبيق متاح للجميع
  // زر تسجيل الدخول موجود في الشريط الجانبي ويفتح LoginPopup الصغيرة

  return (
    <div className={`app ${lang === 'en' ? 'ltr' : 'rtl'} flex flex-col min-h-screen relative`}>
      {/* Mobile Top Bar */}
      <div className="mobile-top-bar">
        <div className="mobile-logo-small">
          <img 
            src="/logo.png" 
            alt="Logo" 
            onError={(e) => { (e.target as HTMLImageElement).src = "https://img.icons8.com/clouds/200/egyptian-pyramids.png"; }}
          />
          <span>Kimit AI Studio</span>
          <span style={{ fontSize: '10px', background: 'var(--primary)', color: '#000', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold' }}>v2.1</span>
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
        lang={lang} 
        hasData={!!dataset} 
        onTab={(t) => { setTab(t); setMobileMenuOpen(false); }} 
        onLang={toggleLang} 
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
          {tab === 'home' && <HomePage lang={lang} onFile={handleFile} />}
          {tab === 'dashboard' && dataset && <DashboardPage lang={lang} />}
          {tab === 'cleaning' && dataset && <CleaningPage info={dataset} lang={lang} onClean={handleClean} onUpdate={setDataset} />}
          {tab === 'chat' && <OpenRouterChat dataset={dataset} onFileUpload={handleChatFile} onUpdate={setDataset} />}
          {tab === 'export' && dataset && <ExportPage info={dataset} lang={lang} />}
          {tab === 'about' && <AboutUsPage lang={lang} />}
          {tab === 'privacy' && <PrivacyPage lang={lang} />}
          {tab === 'faq' && <FAQPage lang={lang} />}
          {tab === 'guide' && <GuidePage lang={lang} />}
          {tab === 'compare' && <ComparisonPage lang={lang} />}
        </div>

        {dataset && (
          <EditorSidebar isOpen={sidePanelOpen} onClose={() => setSidePanelOpen(false)} info={dataset} lang={lang} onUpdate={setDataset} />
        )}
      </main>

      {/* نافذة تسجيل الدخول المنبثقة الصغيرة */}
      <LoginPopup
        isOpen={loginPopupOpen}
        onClose={() => setLoginPopupOpen(false)}
        onSuccess={() => setLoginPopupOpen(false)}
      />
    </div>
  );
}

export default App;
