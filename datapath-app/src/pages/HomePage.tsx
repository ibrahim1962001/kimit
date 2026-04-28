import React from 'react';
import { DropZone } from '../components/DropZone';
import { BarChart2, Search, Zap, Brain, Globe, Lock } from 'lucide-react';
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
    features: [
      { icon: BarChart2, title: 'رسوم بيانية تفاعلية', desc: 'Line، Bar، Area، Pie — تحليل بصري فوري' },
      { icon: Search, title: 'كشف القيم الشاذة', desc: 'خوارزمية Z-Score تكشف البيانات غير الطبيعية' },
      { icon: Zap, title: 'تنقية آلية ذكية', desc: 'ملء القيم المفقودة وإزالة التكرارات' },
      { icon: Brain, title: 'AI حقيقي', desc: 'اسأل أي سؤال — عن بياناتك أو أي موضوع' },
      { icon: Globe, title: 'عربي وإنجليزي', desc: 'واجهة كاملة بالغتين' },
      { icon: Lock, title: 'خصوصية تامة', desc: 'بياناتك لا تغادر متصفحك أبداً' },
    ],
    howTo: {
      title: 'كيفية عمل الموقع 🚀',
      steps: [
        'ارفع أي ملف بيانات (CSV أو Excel) وسيقوم النظام فوراً بتحليله.',
        'اكتشف لوحة التحكم (Dashboard) المليئة بالرسوم البيانية التفاعلية ومؤشر جودة البيانات.',
        'اذهب لقسم "الـ AI مستشار" واسأل أي سؤال عن بياناتك ليجيبك بذكاء.',
        'من قسم التنقية والتحليل، يمكنك تنفيذ أوامر حذف الأخطاء وتصدير التقرير النهائي (PDF).'
      ]
    },
    creator: 'تم التطوير والبرمجة بواسطة'
  },
  en: {
    badge: '✨ Fully browser-based',
    title: 'Kimit\nSmart Analytics',
    sub: 'Kimit Platform analyzes your data instantly, discovers patterns, and answers any question using the latest AI.',
    features: [
      { icon: BarChart2, title: 'Interactive Charts', desc: 'Line, Bar, Area, Pie — instant visual analysis' },
      { icon: Search, title: 'Anomaly Detection', desc: 'Z-Score algorithm finds abnormal data' },
      { icon: Zap, title: 'Smart Auto-Clean', desc: 'Fill missing values and remove duplicates' },
      { icon: Brain, title: 'Real AI', desc: 'Ask anything — about your data or any topic' },
      { icon: Globe, title: 'Arabic & English', desc: 'Full bilingual interface' },
      { icon: Lock, title: 'Full Privacy', desc: 'Your data never leaves your browser' },
    ],
    howTo: {
      title: 'How It Works 🚀',
      steps: [
        'Upload any data file (CSV or Excel) for instant automated analysis.',
        'Explore the Dashboard packed with interactive charts and Data Health scoring.',
        'Chat with the AI Consultant to extract deep insights or ask general questions.',
        'Use the automatic cleaning tools and export your final report (PDF).'
      ]
    },
    creator: 'Designed & Built by'
  }
};

// كل بانر يأخذ provider واحد مستقل لتفادي تعارض div id
const banner1 = AD_PROVIDERS.filter(p => p.id === 'adsterra_main');
const banner2 = AD_PROVIDERS.filter(p => p.id === 'native_banner');
const banner3 = AD_PROVIDERS.filter(p => p.id === 'social_banner');

export const HomePage: React.FC<Props> = ({ lang, onFile }) => {
  const t = T[lang];
  const lines = t.title.split('\n');

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-logo-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {/* Logo: mix-blend-mode:screen removes the black background baked into the PNG on our dark page */}
          <img
            src={logoImg}
            alt="Kimit Logo"
            style={{
              width: '90px',
              height: '90px',
              objectFit: 'contain',
              objectPosition: 'center',
              mixBlendMode: 'screen',
              filter: 'brightness(1.3) contrast(1.05) saturate(1.1)',
              borderRadius: '0',
              background: 'transparent',
            }}
          />
          <span className="home-site-name">Kimit AI Studio</span>
        </div>
        <div className="hero-badge">{t.badge}</div>
        <h1 className="hero-title">
          {lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}
        </h1>
        <p className="hero-sub">{t.sub}</p>
        <DropZone lang={lang} onFile={onFile} />

        {/* بانر 1 - تحت منطقة الرفع مباشرة */}
        <div className="home-ad-container">
          <AdSpace type="responsive" providers={banner1} minHeight={100} />
        </div>

        {/* بانر 2 */}
        <div className="home-ad-container">
          <AdSpace type="responsive" providers={banner2} minHeight={100} />
        </div>

        {/* بانر 3 */}
        <div className="home-ad-container">
          <AdSpace type="responsive" providers={banner3} minHeight={100} />
        </div>

        {/* Feature Cards */}
        <div className="features-grid">
          {t.features.map((f, i) => (
            <div key={i} className="premium-card p-6 flex flex-col items-center text-center group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 border border-primary/20 group-hover:scale-110 transition-transform">
                <f.icon size={24} className="text-primary" />
              </div>
              <div className="text-lg font-black text-white mb-2">{f.title}</div>
              <div className="text-xs text-text-dim leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* How to use */}
        <div className="how-to-section premium-card p-10 md:p-16">
          <h2 className="text-3xl md:text-4xl font-black mb-12 text-center text-white">{t.howTo.title}</h2>
          <ul className="grid md:grid-cols-2 gap-8">
            {t.howTo.steps.map((step, i) => (
              <li key={i} className="flex gap-5 items-start group">
                <span className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-black group-hover:bg-primary group-hover:text-bg transition-all">{i + 1}</span>
                <span className="text-text-dim text-sm md:text-base leading-relaxed pt-1">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* بانر أسفل الصفحة */}
        <div className="home-ad-container home-ad-bottom">
          <AdSpace type="responsive" providers={banner1} minHeight={100} lazyLoad />
        </div>

        <CreatorFooter lang={lang} />
      </div>
    </div>
  );
};
