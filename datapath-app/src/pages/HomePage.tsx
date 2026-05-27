import React from 'react';
import { DropZone } from '../components/DropZone';
import { BarChart2, Search, Zap, Brain, Globe, Lock, Sparkles, LayoutDashboard } from 'lucide-react';
import { AdSpace } from '../components/AdSpace';
import { CreatorFooter } from '../components/CreatorFooter';
import { CloudSyncToggle } from '../components/CloudSyncToggle';
import { LangSwitch } from '../components/LangSwitch';
import { AD_PROVIDERS } from '../config/adConfig';
import { getAppLang } from '../lib/i18n';
import logoImg from '../assets/logo.png';
import './home-redesign.css';

interface Props {
  onFile: (f: File) => void;
  onTrySmartDashboard?: () => void;
}

const T = {
  en: {
    badge: 'Local-first · AI-powered',
    title1: 'Kimit',
    title2: 'Smart Analytics',
    sub: 'Upload Excel or CSV — get an interactive Smart Dashboard, cleaning tools, and AI insights in seconds. No install required.',
    vp: [
      'Smart Dashboard auto-builds up to 6 charts for your data type',
      'Files under 10MB analyze in your browser (private by default)',
      'One-click export: Excel workbook + interactive HTML dashboard',
    ],
    featuresTitle: 'Everything You Need',
    featuresSub: 'All core tools in one workspace.',
    smartDashCta: 'See Smart Dashboard',
    smartDashHint: 'Upload a file first, then open Smart Dashboard from the sidebar.',
    features: [
      { icon: LayoutDashboard, title: 'Smart Dashboard', desc: 'Auto charts by data type — sales, HR, finance & more', color: '#10b981' },
      { icon: BarChart2, title: 'Interactive Charts', desc: 'Line, bar, donut, heatmap — filter and explore live', color: '#3b82f6' },
      { icon: Search, title: 'Anomaly Detection', desc: 'Z-Score finds outliers in numeric columns', color: '#06b6d4' },
      { icon: Zap, title: 'Smart Auto-Clean', desc: 'Fill missing values and remove duplicates', color: '#f59e0b' },
      { icon: Brain, title: 'AI Consultant', desc: 'Ask questions about your dataset in plain language', color: '#8b5cf6' },
      { icon: Globe, title: 'Arabic & English', desc: 'Switch language anytime from the header', color: '#6366f1' },
      { icon: Lock, title: 'Honest Privacy', desc: 'Local analysis by default; optional cloud backup only if you enable it', color: '#f43f5e' },
    ],
    howTo: {
      title: 'How It Works',
      sub: 'Four steps from upload to export.',
      steps: [
        { label: 'Upload', desc: 'Drop CSV or Excel (or connect Google Sheets).' },
        { label: 'Explore', desc: 'Open Smart Dashboard — KPIs and charts generated automatically.' },
        { label: 'Ask AI', desc: 'Chat with the AI consultant about patterns in your data.' },
        { label: 'Export', desc: 'Download Excel + interactive HTML dashboard in one click.' },
      ],
    },
    sponsored: 'Sponsored',
  },
  ar: {
    badge: 'محلي أولاً · مدعوم بالذكاء الاصطناعي',
    title1: 'Kimit',
    title2: 'تحليلات ذكية',
    sub: 'ارفع Excel أو CSV — واحصل على سمارت داشبورد تفاعلي، تنظيف بيانات، ورؤى AI خلال ثوانٍ. بدون تثبيت.',
    vp: [
      'السمارت داشبورد يبني حتى 6 شارتات تلقائياً حسب نوع بياناتك',
      'الملفات أقل من 10MB تُحلَّل في المتصفح (خصوصية افتراضية)',
      'تصدير بنقرة: ملف Excel + داشبورد HTML تفاعلي',
    ],
    featuresTitle: 'كل ما تحتاجه',
    featuresSub: 'أدوات التحليل في مكان واحد.',
    smartDashCta: 'عرض السمارت داشبورد',
    smartDashHint: 'ارفع ملفاً أولاً، ثم افتح السمارت داشبورد من القائمة الجانبية.',
    features: [
      { icon: LayoutDashboard, title: 'سمارت داشبورد', desc: 'شارتات تلقائية حسب نوع البيانات', color: '#10b981' },
      { icon: BarChart2, title: 'شارتات تفاعلية', desc: 'خط، أعمدة، دونات، خريطة حرارية', color: '#3b82f6' },
      { icon: Search, title: 'كشف الشذوذ', desc: 'خوارزمية Z-Score للقيم غير الطبيعية', color: '#06b6d4' },
      { icon: Zap, title: 'تنظيف ذكي', desc: 'ملء القيم الناقصة وإزالة التكرار', color: '#f59e0b' },
      { icon: Brain, title: 'مستشار AI', desc: 'اسأل عن بياناتك بلغة طبيعية', color: '#8b5cf6' },
      { icon: Globe, title: 'عربي وإنجليزي', desc: 'بدّل اللغة من أعلى الصفحة', color: '#6366f1' },
      { icon: Lock, title: 'خصوصية واضحة', desc: 'تحليل محلي افتراضياً؛ نسخ سحابي اختياري فقط عند تفعيله', color: '#f43f5e' },
    ],
    howTo: {
      title: 'كيف يعمل',
      sub: 'أربع خطوات من الرفع إلى التصدير.',
      steps: [
        { label: 'رفع', desc: 'اسحب CSV أو Excel (أو Google Sheets).' },
        { label: 'استكشاف', desc: 'افتح السمارت داشبورد — KPIs وشارتات تلقائية.' },
        { label: 'اسأل AI', desc: 'تحدث مع المستشار الذكي عن أنماط بياناتك.' },
        { label: 'تصدير', desc: 'حمّل Excel + داشبورد HTML تفاعلي بنقرة واحدة.' },
      ],
    },
    sponsored: 'إعلان',
  },
};

const railAds = AD_PROVIDERS.filter(p =>
  ['adsterra_main', 'native_banner', 'social_banner'].includes(p.id),
);

export const HomePage: React.FC<Props> = ({ onFile, onTrySmartDashboard }) => {
  const lang = getAppLang();
  const t = lang === 'ar' ? T.ar : T.en;

  return (
    <div className="home-page">
      <div className="home-calm">
        <div className="home-calm-topbar">
          <LangSwitch />
        </div>

        <div className="home-calm-layout">
          <div className="home-calm-main">
            <section className="home-calm-hero">
              <div className="home-calm-panel">
                <div className="home-calm-brand">
                  <img src={logoImg} alt="Kimit Logo" />
                  <div className="home-calm-brand-copy">
                    <div className="home-calm-brand-title">Kimit AI Studio</div>
                    <div className="home-calm-brand-sub">
                      {lang === 'ar' ? 'منصة تحليل بيانات ذكية' : 'Smart data intelligence platform'}
                    </div>
                  </div>
                </div>

                <div className="home-calm-kicker">
                  <Sparkles size={12} />
                  {t.badge}
                </div>

                <h1 className="home-calm-title">
                  <span className="home-calm-title-accent">{t.title1}</span>
                  <span className="home-calm-title-line">{t.title2}</span>
                </h1>
                <p className="home-calm-subtitle">{t.sub}</p>

                <ul className="home-calm-vp">
                  {t.vp.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>

                <CloudSyncToggle />

                {onTrySmartDashboard && (
                  <button type="button" className="home-smart-dash-cta" onClick={onTrySmartDashboard}>
                    <LayoutDashboard size={16} />
                    {t.smartDashCta}
                  </button>
                )}
              </div>

              <div className="home-calm-panel home-calm-uploader">
                <div className="home-calm-upload-head">
                  {lang === 'ar' ? 'ابدأ برفع ملفك' : 'Start with your dataset'}
                </div>
                <DropZone onFile={onFile} />
              </div>
            </section>

            <section className="home-calm-section">
              <div className="home-calm-section-head">
                <div>
                  <h2 className="home-calm-section-title">{t.featuresTitle}</h2>
                  <p className="home-calm-section-sub">{t.featuresSub}</p>
                </div>
              </div>

              <div className="home-calm-features">
                {t.features.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <article className="home-calm-feature" key={i}>
                      <div className="home-calm-feature-icon" style={{ color: f.color }}>
                        <Icon size={19} />
                      </div>
                      <h4>{f.title}</h4>
                      <p>{f.desc}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="home-calm-section">
              <div className="home-calm-section-head">
                <div>
                  <h2 className="home-calm-section-title">{t.howTo.title}</h2>
                  <p className="home-calm-section-sub">{t.howTo.sub}</p>
                </div>
              </div>
              <div className="home-calm-steps">
                {t.howTo.steps.map((step, i) => (
                  <article className="home-calm-step" key={i}>
                    <div className="home-calm-step-num">{i + 1}</div>
                    <h5>{step.label}</h5>
                    <p>{step.desc}</p>
                  </article>
                ))}
              </div>
            </section>

            <div className="home-calm-ad home-calm-ad--footer">
              <span className="home-ad-label">{t.sponsored}</span>
              <AdSpace type="responsive" providers={railAds.slice(0, 1)} minHeight={90} lazyLoad />
            </div>

            <CreatorFooter />
          </div>

          <aside className="home-calm-ad-rail" aria-label={t.sponsored}>
            <span className="home-ad-label">{t.sponsored}</span>
            {railAds.map((provider, i) => (
              <div className="home-calm-ad-rail-slot" key={provider.id}>
                <AdSpace
                  type="responsive"
                  providers={[provider]}
                  minHeight={i === 0 ? 280 : 120}
                  lazyLoad={i > 0}
                />
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
};
