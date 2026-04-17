import { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { CleaningPage } from './pages/CleaningPage';
import { ChatPanel } from './components/ChatPanel';
import { ExportPage } from './pages/ExportPage';
import { EditorSidebar } from './components/EditorSidebar';
import { parseFile, analyzeDataset, cleanDataset } from './lib/dataUtils';
import type { DatasetInfo, Lang } from './types';
import './App.css';

type Tab = 'home' | 'dashboard' | 'cleaning' | 'chat' | 'export';

function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [tab, setTab] = useState<Tab>('home');
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [apiKey] = useState(() => localStorage.getItem('groq_key') || '');

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setLoadMsg(lang === 'ar' ? 'جاري تحليل الملف...' : 'Analyzing file...');
    try {
      const rows = await parseFile(file);
      if (!rows.length) throw new Error('Empty file');
      const info = analyzeDataset(file, rows);
      setDataset(info);
      showToast(lang === 'ar' ? `✅ تم تحميل ${info.rows.toLocaleString()} سجل` : `✅ Loaded ${info.rows.toLocaleString()} records`);
      setTab('dashboard');
    } catch {
      showToast(lang === 'ar' ? '❌ تعذر قراءة الملف' : '❌ Could not read file', 'err');
    } finally { setLoading(false); }
  }, [lang]);

  const handleClean = useCallback(() => {
    if (!dataset) return;
    const cleaned = cleanDataset(dataset);
    setDataset(cleaned);
    showToast(lang === 'ar' ? '✅ تمت التنقية بنجاح!' : '✅ Data cleaned successfully!');
  }, [dataset, lang]);

  const handleClose = () => { setDataset(null); setTab('home'); };
  const toggleLang = () => setLang(l => l === 'ar' ? 'en' : 'ar');
  
  const handleApplyAction = (action: string) => {
    if (action === 'clean' && dataset) {
      handleClean();
    }
  };

  return (
    <div className={`app ${lang === 'en' ? 'ltr' : 'rtl'} flex flex-col min-h-screen relative`}>
      <Sidebar tab={tab} lang={lang} hasData={!!dataset} onTab={setTab} onLang={toggleLang} onClose={handleClose} onOpenEditor={() => setSidePanelOpen(true)} />

      <main className="main flex-1 flex flex-col min-h-full">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p className="loading-msg">{loadMsg}</p>
          </div>
        )}

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

        {tab === 'home' && <HomePage lang={lang} onFile={handleFile} />}
        {tab === 'dashboard' && dataset && <DashboardPage info={dataset} lang={lang} />}
        {tab === 'cleaning' && dataset && <CleaningPage info={dataset} lang={lang} onClean={handleClean} onUpdate={setDataset} />}
        {tab === 'chat' && (
          <div className="page">
            <div className="page-header">
              <div>
                <h2 className="page-title">{lang === 'ar' ? 'المستشار الذكي' : 'AI Consultant'}</h2>
                <p className="page-sub">{lang === 'ar' ? 'اسألني أي شيء' : 'Ask me anything'}</p>
              </div>
            </div>
            <ChatPanel lang={lang} dataset={dataset} apiKey={apiKey} onApplyAction={handleApplyAction} />
          </div>
        )}
        {tab === 'export' && dataset && <ExportPage info={dataset} lang={lang} />}

        {dataset && (
          <EditorSidebar isOpen={sidePanelOpen} onClose={() => setSidePanelOpen(false)} info={dataset} lang={lang} onUpdate={setDataset} />
        )}
      </main>
    </div>
  );
}

export default App;
