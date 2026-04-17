import React from 'react';
import { DropZone } from '../components/DropZone';
import { BarChart2, Search, Zap, Brain, Globe, Lock } from 'lucide-react';
import { AdSpace } from '../components/AdSpace';
import { getActiveAdProviders, getAdProviderById } from '../config/adConfig';
import type { Lang } from '../types';
import logoImg from '../assets/logo.png';

interface Props { lang: Lang; onFile: (f: File) => void; }

const T = {
  ar: {
    badge: '✨ يعمل بالكامل في المتصفح',
    title: 'Kemet\nمنصة التحليل الذكية',
    sub: 'منصة Kemet تحلل بياناتك فوراً، تكتشف الأنماط، وتجيب على أسئلتك باستخدام أحدث تقنيات الذكاء الاصطناعي.',
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
    title: 'Kemet\nSmart Analytics',
    sub: 'Kemet Platform analyzes your data instantly, discovers patterns, and answers any question using the latest AI.',
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

export const HomePage: React.FC<Props> = ({ lang, onFile }) => {
  const t = T[lang];
  const lines = t.title.split('\n');
  const nativeAd = getAdProviderById('native_banner');
  const socialAd = getAdProviderById('social_banner');
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-logo-container">
          <img src={logoImg} alt="Kemet Logo" className="home-logo" />
          <span className="home-site-name">Kemet AI Studio</span>
        </div>
        <div className="hero-badge">{t.badge}</div>
        <h1 className="hero-title">
          {lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}
        </h1>
        <p className="hero-sub">{t.sub}</p>
        <DropZone lang={lang} onFile={onFile} />
        {socialAd && (
          <div className="home-social-banner">
            <AdSpace type="horizontal" providers={[socialAd]} minHeight={110} />
          </div>
        )}
        <div className="home-ad-container">
          <AdSpace type="horizontal" providers={nativeAd ? [nativeAd] : getActiveAdProviders()} minHeight={90} />
        </div>
        <div className="features-grid">
          {t.features.map((f, i) => (
            <div key={i} className="feature-card">
              <f.icon size={26} className="feature-icon" />
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
         </div>

        {/* Ad Break - Horizontal Banner */}
        <div className="home-ad-container">
          <AdSpace
            type="horizontal"
            providers={getActiveAdProviders()}
            minHeight={90}
          />
        </div>

        {/* How to use section */}
        <div className="how-to-section">
          <h2>{t.howTo.title}</h2>
          <ul className="how-to-list">
            {t.howTo.steps.map((step, i) => (
              <li key={i} className="how-to-step">
                <span className="how-to-step-number">{i + 1}</span>
                <span className="how-to-step-text">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Creator Footer */}
        <div className="creator-footer">
          <p>
            {t.creator} <strong>IBRAHIM SABREY</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
