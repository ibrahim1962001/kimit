import React, { useEffect, useRef } from 'react';
import { DropZone } from '../components/DropZone';
import { BarChart2, Search, Zap, Brain, Globe, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { AdSpace } from '../components/AdSpace';
import { CreatorFooter } from '../components/CreatorFooter';
import { AD_PROVIDERS } from '../config/adConfig';
import type { Lang } from '../types';
import logoImg from '../assets/logo.png';

interface Props { lang: Lang; onFile: (f: File) => void; }

const T = {
  ar: {
    badge: '✨ يعمل بالكامل في المتصفح',
    title: 'Kimit\nمنصة التحليل الذكية',
    sub: 'منصة Kimit تحلل بياناتك فوراً، تكتشف الأنماط، وتجيب على أسئلتك باستخدام أحدث تقنيات الذكاء الاصطناعي.',
    featuresTitle: 'كل ما تحتاجه',
    features: [
      { icon: BarChart2, title: 'رسوم بيانية تفاعلية', desc: 'Line، Bar، Area، Pie — تحليل بصري فوري', color: '#10b981' },
      { icon: Search,   title: 'كشف القيم الشاذة',   desc: 'خوارزمية Z-Score تكشف البيانات غير الطبيعية', color: '#3b82f6' },
      { icon: Zap,      title: 'تنقية آلية ذكية',    desc: 'ملء القيم المفقودة وإزالة التكرارات', color: '#f59e0b' },
      { icon: Brain,    title: 'AI حقيقي',           desc: 'اسأل أي سؤال — عن بياناتك أو أي موضوع', color: '#8b5cf6' },
      { icon: Globe,    title: 'عربي وإنجليزي',      desc: 'واجهة كاملة بالغتين', color: '#06b6d4' },
      { icon: Lock,     title: 'خصوصية تامة',        desc: 'بياناتك لا تغادر متصفحك أبداً', color: '#f43f5e' },
    ],
    howTo: {
      title: 'كيفية عمل الموقع',
      steps: [
        { label: 'ارفع الملف', desc: 'ارفع أي ملف بيانات (CSV أو Excel) وسيقوم النظام فوراً بتحليله.' },
        { label: 'استكشف', desc: 'اكتشف لوحة التحكم المليئة بالرسوم البيانية ومؤشر جودة البيانات.' },
        { label: 'اسأل الـ AI', desc: 'اذهب لقسم "الـ AI مستشار" واسأل أي سؤال عن بياناتك.' },
        { label: 'صدّر', desc: 'من قسم التنقية والتحليل، يمكنك تصدير التقرير النهائي (PDF).' },
      ],
    },
  },
  en: {
    badge: '✨ Fully browser-based',
    title: 'Kimit\nSmart Analytics',
    sub: 'Kimit analyzes your data instantly, discovers patterns, and answers any question using the latest AI.',
    featuresTitle: 'Everything You Need',
    features: [
      { icon: BarChart2, title: 'Interactive Charts', desc: 'Line, Bar, Area, Pie — instant visual analysis', color: '#10b981' },
      { icon: Search,   title: 'Anomaly Detection',  desc: 'Z-Score algorithm finds abnormal data', color: '#3b82f6' },
      { icon: Zap,      title: 'Smart Auto-Clean',   desc: 'Fill missing values and remove duplicates', color: '#f59e0b' },
      { icon: Brain,    title: 'Real AI',            desc: 'Ask anything — about your data or any topic', color: '#8b5cf6' },
      { icon: Globe,    title: 'Arabic & English',   desc: 'Full bilingual interface', color: '#06b6d4' },
      { icon: Lock,     title: 'Full Privacy',       desc: 'Your data never leaves your browser', color: '#f43f5e' },
    ],
    howTo: {
      title: 'How It Works',
      steps: [
        { label: 'Upload', desc: 'Upload any data file (CSV or Excel) for instant automated analysis.' },
        { label: 'Explore', desc: 'Explore the Dashboard packed with interactive charts and Data Health scoring.' },
        { label: 'Ask AI', desc: 'Chat with the AI Consultant to extract deep insights or ask general questions.' },
        { label: 'Export', desc: 'Use the automatic cleaning tools and export your final report (PDF).' },
      ],
    },
  },
};

const banner1 = AD_PROVIDERS.filter(p => p.id === 'adsterra_main');
const banner2 = AD_PROVIDERS.filter(p => p.id === 'native_banner');
const banner3 = AD_PROVIDERS.filter(p => p.id === 'social_banner');

/* ── Inline styles ── */
const S = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Syne', 'Cairo', system-ui, sans-serif",
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  orb1: {
    position: 'fixed' as const, top: '-20%', left: '-10%',
    width: 600, height: 600, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
    pointerEvents: 'none' as const, zIndex: 0,
    animation: 'hp-orb1 14s ease-in-out infinite alternate',
  },
  orb2: {
    position: 'fixed' as const, bottom: '-20%', right: '-10%',
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
    pointerEvents: 'none' as const, zIndex: 0,
    animation: 'hp-orb2 18s ease-in-out infinite alternate',
  },
  inner: {
    position: 'relative' as const, zIndex: 1,
    maxWidth: 900, margin: '0 auto', padding: '0 20px 60px',
  },
  hero: {
    textAlign: 'center' as const,
    padding: '60px 0 40px',
    animation: 'hp-fade 0.7s cubic-bezier(0.16,1,0.3,1) both',
  },
  logoWrap: {
    display: 'inline-flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 10, marginBottom: 24,
    animation: 'hp-pop 0.8s cubic-bezier(0.34,1.56,0.64,1) both',
  },
  logoImg: {
    width: 92, height: 92, objectFit: 'contain' as const,
    mixBlendMode: 'screen' as const,
    filter: 'brightness(1.3) contrast(1.05) saturate(1.1)',
    animation: 'hp-float 4s ease-in-out infinite',
  },
  siteName: {
    fontSize: 15, fontWeight: 800, letterSpacing: 2,
    textTransform: 'uppercase' as const,
    background: 'linear-gradient(135deg, #fff 30%, #10b981 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 18px', borderRadius: 99,
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    color: '#10b981', fontSize: 12, fontWeight: 700,
    marginBottom: 20, letterSpacing: '0.06em',
    animation: 'hp-badge 3s ease-in-out infinite',
  },
  title: {
    fontSize: 'clamp(38px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.1,
    marginBottom: 20, letterSpacing: '-1.5px',
    background: 'linear-gradient(135deg, #fff 0%, #86efcd 40%, #10b981 70%, #6366f1 100%)',
    backgroundSize: '300% 300%',
    WebkitBackgroundClip: 'text', backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'hp-title-grad 6s ease-in-out infinite',
  },
  sub: {
    fontSize: 'clamp(14px, 2vw, 17px)', color: '#94a3b8', lineHeight: 1.7,
    maxWidth: 580, margin: '0 auto 36px',
    animation: 'hp-fade 0.9s 0.2s cubic-bezier(0.16,1,0.3,1) both',
  },
  dropWrap: {
    animation: 'hp-fade 1s 0.35s cubic-bezier(0.16,1,0.3,1) both',
    marginBottom: 32,
  },
  adWrap: { margin: '16px 0' },
  /* ── Section ── */
  section: { marginTop: 64 },
  sectionHeader: {
    textAlign: 'center' as const, marginBottom: 36,
    animation: 'hp-fade 0.7s cubic-bezier(0.16,1,0.3,1) both',
  },
  sectionLabel: {
    display: 'inline-block', fontSize: 11, fontWeight: 800,
    letterSpacing: '0.2em', textTransform: 'uppercase' as const,
    color: '#10b981', marginBottom: 8,
    background: 'rgba(16,185,129,0.08)', padding: '4px 14px',
    borderRadius: 99, border: '1px solid rgba(16,185,129,0.2)',
  },
  sectionTitle: {
    fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900,
    background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  /* ── Feature grid ── */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 16,
  },
  howGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  howCard: {
    background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20, padding: '24px 22px',
    transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    cursor: 'default',
  },
};

export const HomePage: React.FC<Props> = ({ lang, onFile }) => {
  const t = T[lang];
  const lines = t.title.split('\n');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* tiny particle canvas */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${p.o})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="home-page" style={S.page}>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes hp-fade { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hp-pop  { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
        @keyframes hp-float{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes hp-badge{ 0%,100%{box-shadow:0 0 0 rgba(16,185,129,0)} 50%{box-shadow:0 0 18px rgba(16,185,129,0.2)} }
        @keyframes hp-title-grad{ 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes hp-orb1 { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,40px) scale(1.15)} }
        @keyframes hp-orb2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-50px,-30px) scale(1.1)} }
        @keyframes hp-card { from{opacity:0;transform:translateY(28px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        .hp-feat-card:hover { transform:translateY(-8px) scale(1.02) !important; }
        .hp-feat-card:hover .hp-icon-ring { transform:scale(1.15) rotate(8deg) !important; }
        .hp-how-card:hover { border-color:rgba(16,185,129,0.3) !important; transform:translateY(-5px) !important; box-shadow:0 16px 40px rgba(0,0,0,0.3) !important; }
      `}</style>

      {/* Ambient orbs */}
      <div style={S.orb1} />
      <div style={S.orb2} />

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.6 }} />

      <div style={S.inner}>
        {/* ── Hero ── */}
        <div style={S.hero}>
          <div style={S.logoWrap}>
            <img src={logoImg} alt="Kimit Logo" style={S.logoImg} />
            <span style={S.siteName}>Kimit AI Studio</span>
          </div>

          <div style={S.badge}>
            <Sparkles size={12} />
            {t.badge}
          </div>

          <h1 style={S.title}>
            {lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}
          </h1>

          <p style={S.sub}>{t.sub}</p>

          <div style={S.dropWrap}>
            <DropZone lang={lang} onFile={onFile} />
          </div>

          <div style={S.adWrap}><AdSpace type="responsive" providers={banner1} minHeight={100} /></div>
          <div style={S.adWrap}><AdSpace type="responsive" providers={banner2} minHeight={100} /></div>
          <div style={S.adWrap}><AdSpace type="responsive" providers={banner3} minHeight={100} /></div>
        </div>

        {/* ── Feature Cards ── */}
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionLabel}>Features</div>
            <div style={S.sectionTitle}>{t.featuresTitle}</div>
          </div>
          <div style={S.grid}>
            {t.features.map((f, i) => (
              <div
                key={i}
                className="hp-feat-card"
                style={{
                  background: 'rgba(15,23,42,0.6)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${f.color}18`,
                  borderTop: `2px solid ${f.color}`,
                  borderRadius: 20,
                  padding: '26px 22px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                  animation: `hp-card 0.6s ${i * 0.08}s cubic-bezier(0.16,1,0.3,1) both`,
                  cursor: 'default',
                }}
              >
                <div
                  className="hp-icon-ring"
                  style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: `${f.color}14`,
                    border: `1px solid ${f.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    boxShadow: `0 0 16px ${f.color}20`,
                  }}
                >
                  <f.icon size={22} color={f.color} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: f.color, fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
                  <ArrowRight size={11} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── How It Works ── */}
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionLabel}>How It Works 🚀</div>
            <div style={S.sectionTitle}>{t.howTo.title}</div>
          </div>
          <div style={S.howGrid}>
            {t.howTo.steps.map((step, i) => (
              <div
                key={i}
                className="hp-how-card"
                style={{
                  ...S.howCard,
                  animation: `hp-card 0.6s ${i * 0.1}s cubic-bezier(0.16,1,0.3,1) both`,
                }}
              >
                {/* Step number */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 16, color: '#fff',
                  marginBottom: 16,
                  boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>{step.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.65 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Ad ── */}
        <div style={{ ...S.adWrap, marginTop: 40 }}>
          <AdSpace type="responsive" providers={banner1} minHeight={100} lazyLoad />
        </div>

        <CreatorFooter lang={lang} />
      </div>
    </div>
  );
};
