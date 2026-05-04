import React, { useMemo, useState } from 'react';
import { LayoutDashboard, Shield, MessageCircle, Download, Home, Globe, X, Table, HelpCircle, Info, ShieldCheck, BookOpen, ArrowRightLeft, User, LogOut, Trash2, ChevronDown, ChevronRight, Rows3, Columns3, AlertTriangle, Copy, TrendingUp } from 'lucide-react';
import { AdSpace } from './AdSpace';
import { getActiveAdProviders } from '../config/adConfig';
import type { Lang } from '../types';
import { type User as FirebaseUser, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useKimitData } from '../hooks/useKimitData';
import { exportToExcel } from '../lib/exportUtils';

type Tab = 'home' | 'dashboard' | 'cleaning' | 'chat' | 'export' | 'files' | 'about' | 'privacy' | 'faq' | 'guide' | 'compare' | 'smart-dashboard';

interface Props {
  tab: Tab;
  lang: Lang;
  hasData: boolean;
  onTab: (t: Tab) => void;
  onLang: () => void;
  onClose: () => void;
  onClearSession?: () => void;
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
    files: 'الملفات المحفوظة',
    close: 'إغلاق الملف',
    clearSession: 'مسح الجلسة',
    about: 'كيان',
    privacy: 'أمان',
    faq: 'سؤال',
    guide: 'دليل',
    compare: 'مقارنة',
  },
  en: {
    home: 'Home',
    dashboard: 'Analytics',
    cleaning: 'Cleaning',
    chat: 'AI Chat',
    export: 'Export',
    files: 'Saved Files',
    close: 'Close File',
    clearSession: 'Clear Session',
    about: 'About Us',
    privacy: 'Privacy',
    faq: 'FAQ',
    guide: 'User Guide',
    compare: 'Compare Files',
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

// ── Smart Dashboard Button ──────────────────────────────────────
const SmartDashBtn: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: 'calc(100% - 20px)', margin: '4px 10px',
        padding: '11px 14px',
        background: active
          ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(99,102,241,0.15))'
          : hovered
          ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.08))'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active || hovered ? '#10b98177' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: active ? '0 0 18px rgba(16,185,129,0.25)' : hovered ? '0 0 12px rgba(16,185,129,0.12)' : 'none',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'linear-gradient(135deg, #10b981, #6366f1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
      }}>
        <span style={{ fontSize: 16 }}>📊</span>
      </div>
      <div style={{ textAlign: 'left', flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#10b981' : '#e2e8f0', lineHeight: 1.2 }}>Smart Dashboard</div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Context-aware analytics</div>
      </div>
      {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />}
    </button>
  );
};

// ── Sidebar Dashboard Panel ─────────────────────────────────────
const DashboardPanel: React.FC<{ onTab: (t: Tab) => void }> = ({ onTab }) => {
  const { info } = useKimitData();
  const [open, setOpen] = useState(true);

  const dataset = useMemo(() => info?.workData ?? [], [info]);

  const totalRows = dataset.length;
  const totalCols = useMemo(() => dataset.length > 0 ? Object.keys(dataset[0]).length : 0, [dataset]);

  const totalMissing = useMemo(() =>
    dataset.reduce((acc, row) =>
      acc + Object.values(row).filter(v => v === null || v === undefined || v === '').length, 0),
    [dataset]);

  const totalDuplicates = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    dataset.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) count++;
      else seen.add(key);
    });
    return count;
  }, [dataset]);

  const qualityScore = useMemo(() => {
    if (totalRows === 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((totalRows - totalMissing - totalDuplicates) / totalRows) * 100)));
  }, [totalRows, totalMissing, totalDuplicates]);

  const scoreColor = qualityScore >= 80 ? '#10b981' : qualityScore >= 60 ? '#f59e0b' : '#ef4444';

  const colTypes = useMemo(() => {
    if (dataset.length === 0) return { numeric: 0, text: 0, date: 0 };
    const cols = Object.keys(dataset[0]);
    let numeric = 0, text = 0, date = 0;
    cols.forEach(col => {
      const vals = dataset.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      if (vals.length === 0) { text++; return; }
      if (vals.every(v => !isNaN(Number(v)))) { numeric++; }
      else if (vals.some(v => !isNaN(Date.parse(String(v))))) { date++; }
      else { text++; }
    });
    return { numeric, text, date };
  }, [dataset]);

  if (!info || totalRows === 0) return null;

  const kpis = [
    { label: 'Rows', value: totalRows.toLocaleString(), color: '#10b981', icon: <Rows3 size={13} /> },
    { label: 'Cols', value: totalCols.toString(), color: '#3b82f6', icon: <Columns3 size={13} /> },
    { label: 'Missing', value: totalMissing.toString(), color: '#f59e0b', icon: <AlertTriangle size={13} /> },
    { label: 'Dupes', value: totalDuplicates.toString(), color: '#ef4444', icon: <Copy size={13} /> },
  ];

  return (
    <div style={{ margin: '8px 0' }}>
      {/* Section Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 14px', marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={13} color="#10b981" />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#10b981' }}>
            Dashboard
          </span>
        </div>
        {open
          ? <ChevronDown size={13} color="#64748b" />
          : <ChevronRight size={13} color="#64748b" />}
      </button>

      {open && (
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* File name */}
          <div style={{
            fontSize: 10, color: '#64748b', padding: '4px 8px',
            background: 'rgba(255,255,255,0.03)', borderRadius: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            borderLeft: '2px solid #10b981',
          }}>
            📄 {info.filename}
          </div>

          {/* KPI 2×2 Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {kpis.map(kpi => (
              <div key={kpi.label} style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${kpi.color}22`,
                borderLeft: `3px solid ${kpi.color}`,
                borderRadius: 8, padding: '7px 8px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: kpi.color }}>
                  {kpi.icon}
                  <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* Quality Score Bar */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>Data Quality</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor }}>{qualityScore}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${qualityScore}%`,
                background: `linear-gradient(90deg, ${scoreColor}aa, ${scoreColor})`,
                transition: 'width 0.8s ease',
              }} />
            </div>
          </div>

          {/* Column Type Breakdown */}
          <div style={{
            display: 'flex', gap: 4, flexWrap: 'wrap',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8, padding: '6px 8px',
          }}>
            {colTypes.numeric > 0 && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
                # {colTypes.numeric} Numeric
              </span>
            )}
            {colTypes.text > 0 && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                A {colTypes.text} Text
              </span>
            )}
            {colTypes.date > 0 && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                📅 {colTypes.date} Date
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <QuickBtn
              label="🧹 Clean Data"
              color="#10b981"
              onClick={() => onTab('cleaning')}
            />
            <QuickBtn
              label="🤖 AI Chat"
              color="#3b82f6"
              onClick={() => onTab('chat')}
            />
            <QuickBtn
              label="📥 Export Excel"
              color="#f59e0b"
              onClick={() => exportToExcel(info.workData, `Kimit_${info.filename}.xlsx`)}
            />
            <QuickBtn
              label="📊 Full Dashboard"
              color="#10b981"
              onClick={() => onTab('dashboard')}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
    </div>
  );
};

// ── Mini Quick Button ───────────────────────────────────────────
const QuickBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '7px 10px',
        background: hovered ? `${color}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? color + '55' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 8, color: hovered ? color : '#94a3b8',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        textAlign: 'left', transition: 'all 0.18s ease',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
    </button>
  );
};

// ── Main Sidebar ────────────────────────────────────────────────
export const Sidebar: React.FC<Props> = ({ tab, lang, hasData, onTab, onLang, onClose, onClearSession, onOpenEditor, isMobileOpen, onCloseMobile, currentUser, onLoginClick }) => {
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
      <div className="sidebar-mobile-header">
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

        <button
          className="mobile-close-btn"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCloseMobile?.(); }}
          aria-label="Close menu"
        >
          <X size={24} />
        </button>
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
            <div className="sidebar-login-icon"><User size={16} /></div>
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

        {/* ─── Smart Dashboard Button ─── */}
        {hasData && (
          <SmartDashBtn active={tab === 'smart-dashboard'} onClick={() => onTab('smart-dashboard')} />
        )}

        {/* ─── Dashboard Analyst Panel ─── */}
        {hasData && <DashboardPanel onTab={onTab} />}

        <div className="nav-divider" />

        <div className="nav-section">
          <p className="section-title">{isAr ? 'الدعم والمعلومات' : 'Support & Info'}</p>
          {supportItems.map(renderBtn)}
        </div>
      </nav>

      <div className="sidebar-footer">
        {hasData && (
          <>
            <button className="sidebar-close-btn" onClick={onClose} style={{ marginBottom: '8px' }}>
              <X size={15} />
              <span>{t.close}</span>
            </button>
            <button className="sidebar-close-btn" onClick={onClearSession} style={{ backgroundColor: '#fee2e2', color: '#ef4444', borderColor: '#ef4444', marginBottom: '8px' }}>
              <Trash2 size={15} />
              <span>{t.clearSession}</span>
            </button>
          </>
        )}
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
