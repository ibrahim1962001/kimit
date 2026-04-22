import React from 'react';
import { LayoutDashboard, Shield, MessageCircle, Download, Home, Globe, X, Table, HelpCircle, Info, ShieldCheck, BookOpen, ArrowRightLeft, User, LogOut } from 'lucide-react';
import { AdSpace } from './AdSpace';
import { getActiveAdProviders } from '../config/adConfig';
import type { Lang } from '../types';
import { type User as FirebaseUser, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type Tab = 'home' | 'dashboard' | 'cleaning' | 'chat' | 'export' | 'about' | 'privacy' | 'faq' | 'guide' | 'compare';

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
  currentUser?: FirebaseUser | null;
  onLoginClick?: () => void;
}

const T = {
  ar: { 
    home: 'الرئيسية', 
    dashboard: 'التحليل', 
    cleaning: 'التنقية', 
    chat: 'المستشار', 
    export: 'تصدير', 
    close: 'إغلاق الملف',
    about: 'من نحن',
    privacy: 'الخصوصية',
    faq: 'الأسئلة الشائعة',
    guide: 'الدليل',
    compare: 'مقارنة ملفين'
  },
  en: { 
    home: 'Home', 
    dashboard: 'Analytics', 
    cleaning: 'Cleaning', 
    chat: 'AI Chat', 
    export: 'Export', 
    close: 'Close File',
    about: 'About Us',
    privacy: 'Privacy',
    faq: 'FAQ',
    guide: 'User Guide',
    compare: 'Compare Files'
  },
};

const mainItems: { tab: Tab; icon: React.ElementType; key: string }[] = [
  { tab: 'home', icon: Home, key: 'home' },
  { tab: 'dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { tab: 'cleaning', icon: Shield, key: 'cleaning' },
  { tab: 'chat', icon: MessageCircle, key: 'chat' },
  { tab: 'compare', icon: ArrowRightLeft, key: 'compare' },
  { tab: 'export', icon: Download, key: 'export' },
];

const supportItems: { tab: Tab; icon: React.ElementType; key: string }[] = [
  { tab: 'guide', icon: BookOpen, key: 'guide' },
  { tab: 'faq', icon: HelpCircle, key: 'faq' },
  { tab: 'about', icon: Info, key: 'about' },
  { tab: 'privacy', icon: ShieldCheck, key: 'privacy' },
];

export const Sidebar: React.FC<Props> = ({ tab, lang, hasData, onTab, onLang, onClose, onOpenEditor, isMobileOpen, onCloseMobile, currentUser, onLoginClick }) => {
  const t = T[lang];
  const isAr = lang === 'ar';

  const renderBtn = (item: { tab: Tab; icon: React.ElementType; key: string }) => {
    const Icon = item.icon;
    const label = t[item.key as keyof typeof t];
    const dataNeeded = ['dashboard', 'cleaning', 'export'].includes(item.tab);
    const disabled = dataNeeded && !hasData;
    
    return (
      <button
        key={item.tab}
        className={`nav-btn ${tab === item.tab ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && onTab(item.tab)}
        title={disabled ? (isAr ? 'ارفع ملف أولاً' : 'Upload a file first') : ''}
      >
        <Icon size={18} strokeWidth={2} />
        <span className="nav-label">{label}</span>
      </button>
    );
  };

  return (
    <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <button className="mobile-close-btn" onClick={onCloseMobile}>
        <X size={28} />
      </button>

      <div className="sidebar-logo">
        <div className="logo-img-wrapper">
          <img 
            src="/logo.png" 
            alt="Kimit Logo" 
            className="logo-img"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://img.icons8.com/clouds/200/egyptian-pyramids.png"; }}
          />
        </div>
        <span className="site-name">Kimit AI Studio</span>
      </div>

      {/* User Profile / Login Section */}
      <div className="sidebar-profile-section">
        {currentUser ? (
          <div className="sidebar-user-card">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="User" className="sidebar-avatar" referrerPolicy="no-referrer" />
            ) : (
              <div className="sidebar-avatar-placeholder"><User size={16} /></div>
            )}
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={currentUser.displayName || currentUser.email || ''}>
                {currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'مستخدم')}
              </span>
              <button className="sidebar-logout-btn" onClick={() => signOut(auth)} title={isAr ? 'تسجيل الخروج' : 'Sign out'}>
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button className="sidebar-login-btn-top" onClick={onLoginClick}>
            <div className="sidebar-login-icon">
              <User size={16} />
            </div>
            <div className="sidebar-login-texts">
              <span className="sidebar-login-title">{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              <span className="sidebar-login-sub">{isAr ? 'للوصول لجميع الميزات' : 'Unlock all features'}</span>
            </div>
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {mainItems.map(renderBtn)}
        </div>

        {hasData && (
          <button className="excel-btn" onClick={onOpenEditor}>
            <Table size={19} strokeWidth={1.8} />
            <span className="nav-label">{isAr ? 'جدول الإكسيل' : 'Excel Editor'}</span>
          </button>
        )}

        <div className="nav-divider" />
        
        <div className="nav-section">
          <p className="section-title">{isAr ? 'الدعم والمعلومات' : 'Support & Info'}</p>
          {supportItems.map(renderBtn)}
        </div>
      </nav>

      <div className="sidebar-footer">
        {hasData && (
          <button className="sidebar-close-btn" onClick={onClose}>
            <X size={15} />
            <span>{t.close}</span>
          </button>
        )}
        {/* زر تسجيل الدخول تم نقله للأعلى */}
        <button className="lang-toggle" onClick={onLang}>
          <Globe size={15} />
          <span>{isAr ? 'English' : 'عربي'}</span>
        </button>

        <div className="sidebar-ad">
          <AdSpace type="responsive" providers={getActiveAdProviders()} minHeight={100} />
        </div>
      </div>
    </aside>
  );
};

