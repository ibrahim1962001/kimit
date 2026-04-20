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
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
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

export const Sidebar: React.FC<Props> = ({ tab, lang, hasData, onTab, onLang, onClose, onOpenEditor, isMobileOpen, onCloseMobile }) => {
  const t = T[lang];
  return (
    <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* زر إغلاق القائمة في الموبايل */}
      <button className="mobile-close-btn" onClick={onCloseMobile}>
        <X size={28} />
      </button>

      <div className="sidebar-logo" style={{ padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', height: '70px', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <img 
            src="/logo.png" 
            alt="Kimit Logo" 
            style={{ width: '100px', height: '100px', objectFit: 'cover', objectPosition: 'top', mixBlendMode: 'screen' }} 
            onError={(e) => {
               (e.target as HTMLImageElement).src = "https://img.icons8.com/clouds/200/egyptian-pyramids.png";
            }}
          />
        </div>
        <span style={{ 
          fontSize: '18px', 
          fontWeight: 900, 
          letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg, #fff 30%, #10b981 100%)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginTop: '2px'
        }}>
          Kimit AI Studio
        </span>
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
