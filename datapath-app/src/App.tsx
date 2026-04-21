import { useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
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
import type { DatasetInfo, Lang } from './types';
import './App.css';

type Tab = 'home' | 'dashboard' | 'cleaning' | 'chat' | 'export' | 'about' | 'privacy' | 'faq' | 'guide' | 'compare';

function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [tab, setTab] = useState<Tab>('home');
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setLoadMsg(lang === 'ar' ? 'جاري التحليل... انتظر قليلاً' : 'Analyzing... please wait');
    setProgress(10);
    try {
      // Simulate progress for better UX
      const timer = setInterval(() => setProgress(p => p < 90 ? p + 10 : p), 200);
      const rows = await parseFile(file);
      clearInterval(timer);
      setProgress(90);
      
      if (!rows.length) throw new Error('Empty file');
      const info = analyzeDataset(file, rows);
      setDataset(info);
      setProgress(100);
      showToast(lang === 'ar' ? `✅ تم تحميل ${info.rows.toLocaleString()} سجل` : `✅ Loaded ${info.rows.toLocaleString()} records`);
      setTimeout(() => setTab('dashboard'), 500);
    } catch {
      showToast(lang === 'ar' ? '❌ تعذر قراءة الملف' : '❌ Could not read file', 'err');
    } finally { 
      setLoading(false); 
      setProgress(0);
    }
  }, [lang]);

  const handleClean = useCallback(() => {
    if (!dataset) return;
    const cleaned = cleanDataset(dataset);
    setDataset(cleaned);
    showToast(lang === 'ar' ? '✅ تمت التنقية بنجاح!' : '✅ Data cleaned successfully!');
  }, [dataset, lang]);

  const handleClose = () => { setDataset(null); setTab('home'); };
  const toggleLang = () => setLang(l => l === 'ar' ? 'en' : 'ar');
  

  return (
    <div className={`app ${lang === 'en' ? 'ltr' : 'rtl'} flex flex-col min-h-screen relative`}>
      {/* Mobile Menu Button */}
      <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
        <Menu size={24} />
      </button>

      <Sidebar 
        tab={tab} 
        lang={lang} 
        hasData={!!dataset} 
        onTab={(t) => { setTab(t); setMobileMenuOpen(false); }} 
        onLang={toggleLang} 
        onClose={handleClose} 
        onOpenEditor={() => { setSidePanelOpen(true); setMobileMenuOpen(false); }} 
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="main flex-1 flex flex-col min-h-full">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
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

        {tab === 'home' && <HomePage lang={lang} onFile={handleFile} />}
        {tab === 'dashboard' && dataset && <DashboardPage info={dataset} lang={lang} />}
        {tab === 'cleaning' && dataset && <CleaningPage info={dataset} lang={lang} onClean={handleClean} onUpdate={setDataset} />}
        {tab === 'chat' && <OpenRouterChat />}
        {tab === 'export' && dataset && <ExportPage info={dataset} lang={lang} />}
        {tab === 'about' && <AboutUsPage lang={lang} />}
        {tab === 'privacy' && <PrivacyPage lang={lang} />}
        {tab === 'faq' && <FAQPage lang={lang} />}
        {tab === 'guide' && <GuidePage lang={lang} />}
        {tab === 'compare' && <ComparisonPage lang={lang} />}

        {dataset && (
          <EditorSidebar isOpen={sidePanelOpen} onClose={() => setSidePanelOpen(false)} info={dataset} lang={lang} onUpdate={setDataset} />
        )}
      </main>
    </div>
  );
}

export default App;
