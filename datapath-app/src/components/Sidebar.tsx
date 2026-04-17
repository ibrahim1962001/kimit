import React from 'react';
import { LayoutDashboard, Shield, MessageCircle, Download, Home, Globe, X, Table } from 'lucide-react';
import { AdSpace } from './AdSpace';
import { getActiveAdProviders } from '../config/adConfig';
import type { Lang } from '../types';

type Tab = 'home' | 'dashboard' | 'cleaning' | 'chat' | 'export';

interface Props {
  tab: Tab;
  lang: Lang;
  hasData: boolean;
  onTab: (t: Tab) => void;
  onLang: () => void;
  onClose: () => void;
  onOpenEditor: () => void;
}

const T = {
  ar: { home: 'الرئيسية', dashboard: 'التحليل', cleaning: 'التنقية', chat: 'المستشار', export: 'تصدير', close: 'إغلاق الملف' },
  en: { home: 'Home', dashboard: 'Analytics', cleaning: 'Cleaning', chat: 'AI Chat', export: 'Export', close: 'Close File' },
};

const navItems = [
  { tab: 'home' as Tab, icon: Home, keyAr: 'home', keyEn: 'home' },
  { tab: 'dashboard' as Tab, icon: LayoutDashboard, keyAr: 'dashboard', keyEn: 'dashboard' },
  { tab: 'cleaning' as Tab, icon: Shield, keyAr: 'cleaning', keyEn: 'cleaning' },
  { tab: 'chat' as Tab, icon: MessageCircle, keyAr: 'chat', keyEn: 'chat' },
  { tab: 'export' as Tab, icon: Download, keyAr: 'export', keyEn: 'export' },
];

export const Sidebar: React.FC<Props> = ({ tab, lang, hasData, onTab, onLang, onClose, onOpenEditor }) => {
  const t = T[lang];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '15px' }}>
        <img 
          src="/logo.png" 
          alt="KEMET" 
          style={{ width: '100%', maxHeight: '120px', objectFit: 'contain', padding: '0 10px', mixBlendMode: 'screen' }} 
          onError={(e) => {
             // If image fails, show a stylized placeholder library-style
             (e.target as HTMLImageElement).src = "https://img.icons8.com/clouds/200/egyptian-pyramids.png";
          }}
        />
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ tab: tabId, icon: Icon, keyAr }) => {
          const label = t[keyAr as keyof typeof t];
          const disabled = tabId !== 'home' && !hasData;
          return (
            <button
              key={tabId}
              className={`nav-btn ${tab === tabId ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && onTab(tabId)}
              title={disabled ? (lang === 'ar' ? 'ارفع ملف أولاً' : 'Upload a file first') : ''}
            >
              <Icon size={20} strokeWidth={2} />
              <span className="nav-label">{label}</span>
            </button>
          );
        })}

        {hasData && (
          <button className="nav-btn" style={{ marginTop: 24, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }} onClick={onOpenEditor}>
            <Table size={19} strokeWidth={1.8} />
            <span className="nav-label">{lang === 'ar' ? 'جدول الإكسيل' : 'Excel Editor'}</span>
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        {hasData && (
          <button className="sidebar-close-btn" onClick={onClose}>
            <X size={15} />
            <span>{t.close}</span>
          </button>
        )}
        <button className="lang-toggle" onClick={onLang}>
          <Globe size={15} />
          <span>{lang === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        {/* Ad Space - Sidebar */}
        <div style={{ padding: '10px 0', marginTop: 'auto' }}>
          <AdSpace
            type="responsive"
            providers={getActiveAdProviders()}
            minHeight={120}
          />
        </div>
      </div>
    </aside>
  );
};
