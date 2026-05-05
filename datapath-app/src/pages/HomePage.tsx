import React from 'react';
import { DropZone } from '../components/DropZone';
import { BarChart2, Search, Zap, Brain, Globe, Lock, ArrowRight } from 'lucide-react';
import { AdSpace } from '../components/AdSpace';
import { CreatorFooter } from '../components/CreatorFooter';
import { AD_PROVIDERS } from '../config/adConfig';
import type { Lang } from '../types';
import logoImg from '../assets/logo.png';
import { motion, type Variants } from 'framer-motion';

interface Props { lang: Lang; onFile: (f: File) => void; }

const T = {
  ar: {
    badge: '✨ يعمل بالكامل في المتصفح',
    title: 'Kimit\nمنصة التحليل الذكية',
    sub: 'منصة Kimit تحلل بياناتك فوراً، تكتشف الأنماط، وتجيب على أسئلتك باستخدام أحدث تقنيات الذكاء الاصطناعي.',
    features: [
      { icon: BarChart2, title: 'رسوم بيانية تفاعلية', desc: 'Line، Bar، Area، Pie — تحليل بصري فوري', span: 'col-span-2' },
      { icon: Search, title: 'كشف القيم الشاذة', desc: 'خوارزمية Z-Score تكشف البيانات غير الطبيعية', span: 'col-span-2' },
      { icon: Zap, title: 'تنقية آلية ذكية', desc: 'ملء القيم المفقودة وإزالة التكرارات', span: 'col-span-2' },
      { icon: Brain, title: 'AI حقيقي', desc: 'اسأل أي سؤال — عن بياناتك أو أي موضوع', span: 'col-span-3' },
      { icon: Globe, title: 'عربي وإنجليزي', desc: 'واجهة كاملة بالغتين', span: 'col-span-1' },
      { icon: Lock, title: 'خصوصية تامة', desc: 'بياناتك لا تغادر متصفحك أبداً', span: 'col-span-2' },
    ],
    howTo: {
      title: 'كيفية العمل 🚀',
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
      { icon: BarChart2, title: 'Interactive Charts', desc: 'Line, Bar, Area, Pie — instant visual analysis', span: 'col-span-2' },
      { icon: Search, title: 'Anomaly Detection', desc: 'Z-Score algorithm finds abnormal data', span: 'col-span-2' },
      { icon: Zap, title: 'Smart Auto-Clean', desc: 'Fill missing values and remove duplicates', span: 'col-span-2' },
      { icon: Brain, title: 'Real AI', desc: 'Ask anything — about your data or any topic', span: 'col-span-3' },
      { icon: Globe, title: 'Arabic & English', desc: 'Full bilingual interface', span: 'col-span-1' },
      { icon: Lock, title: 'Full Privacy', desc: 'Your data never leaves your browser', span: 'col-span-2' },
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

const banner1 = AD_PROVIDERS.filter(p => p.id === 'adsterra_main');
const banner2 = AD_PROVIDERS.filter(p => p.id === 'native_banner');
const banner3 = AD_PROVIDERS.filter(p => p.id === 'social_banner');

export const HomePage: React.FC<Props> = ({ lang, onFile }) => {
  const t = T[lang];
  const lines = t.title.split('\n');

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="home-page overflow-x-hidden">
      <div className="home-hero relative">
        {/* Animated Background Orbs */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -top-20 -right-40 w-60 h-60 bg-secondary/20 rounded-full blur-[80px] animate-pulse delay-700" />

        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="home-logo-container"
        >
          <img
            src={logoImg}
            alt="Kimit Logo"
            className="w-[100px] h-[100px] mix-blend-screen brightness-125 hover:scale-110 transition-transform duration-500"
          />
          <span className="home-site-name text-4xl font-black">Kimit AI Studio</span>
        </motion.div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="hero-badge mt-4"
        >
          {t.badge}
        </motion.div>

        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hero-title leading-tight mt-8"
        >
          {lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="hero-sub text-lg text-text-dim max-w-2xl mx-auto mt-6"
        >
          {t.sub}
        </motion.p>

        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12"
        >
          <DropZone lang={lang} onFile={onFile} />
        </motion.div>

        {/* Ad Banners */}
        <div className="grid md:grid-cols-3 gap-4 mt-12 mb-16">
          <div className="glass-panel p-2"><AdSpace type="responsive" providers={banner1} minHeight={100} /></div>
          <div className="glass-panel p-2"><AdSpace type="responsive" providers={banner2} minHeight={100} /></div>
          <div className="glass-panel p-2"><AdSpace type="responsive" providers={banner3} minHeight={100} /></div>
        </div>

        {/* ── Features Bento Grid ── */}
        <div className="mt-20">
          <div className="flex items-center gap-4 mb-10">
            <h2 className="text-2xl font-black text-white">{lang === 'ar' ? 'مميزات المنصة' : 'Platform Features'}</h2>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-6 gap-6"
          >
            {t.features.map((f, i) => (
              <motion.div 
                key={i} 
                variants={itemVariants}
                className={`${f.span} glass-panel shimmer-bg glow-on-hover p-8 flex flex-col items-start text-start relative group overflow-hidden`}
              >
                {/* Decorative background glow */}
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <f.icon size={28} className="text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-sm text-text-dim leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── How It Works Modern Section ── */}
        <div className="mt-32 mb-20 relative">
          <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full" />
          
          <div className="relative glass-panel p-12 md:p-20 overflow-hidden border-primary/10">
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            
            <motion.h2 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-black mb-16 text-center text-white tracking-tight"
            >
              {t.howTo.title}
            </motion.h2>

            <div className="grid md:grid-cols-4 gap-8 relative">
              {t.howTo.steps.map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex flex-col items-center text-center group"
                >
                  <div className="relative mb-8">
                    {/* Connection line for desktop */}
                    {i < 3 && (
                      <div className="hidden md:block absolute top-1/2 left-[100%] w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent -translate-y-1/2 z-0" />
                    )}
                    <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-primary/30 flex items-center justify-center text-2xl font-black text-primary shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:bg-primary group-hover:text-bg group-hover:scale-110 transition-all duration-500 z-10 relative">
                      {i + 1}
                    </div>
                  </div>
                  <p className="text-text-dim text-base leading-relaxed group-hover:text-white transition-colors duration-300">
                    {step}
                  </p>
                  {i < 3 && (
                    <ArrowRight className="mt-6 text-primary/30 block md:hidden" size={24} />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <CreatorFooter lang={lang} />

        {/* بانر أسفل الصفحة */}
        <div className="home-ad-container home-ad-bottom mt-12">
          <AdSpace type="responsive" providers={banner1} minHeight={100} lazyLoad />
        </div>
      </div>
    </div>
  );
};
