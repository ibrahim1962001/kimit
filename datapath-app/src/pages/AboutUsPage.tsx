import React from 'react';
import { Mail, ShieldCheck, Users, Zap, Link } from 'lucide-react';
import { CreatorFooter } from '../components/CreatorFooter';
import type { Lang } from '../types';

interface Props { lang: Lang; }

export const AboutUsPage: React.FC<Props> = ({ lang }) => {
  const isAr = lang === 'ar';
  
  const features = [
    {
      icon: ShieldCheck,
      title: isAr ? 'خصوصية تامة' : 'Full Privacy',
      desc: isAr ? 'بياناتك لا تغادر متصفحك أبداً. نحن لا نخزن أي بيانات على خوادمنا.' : 'Your data never leaves your browser. We don\'t store any data on our servers.'
    },
    {
      icon: Zap,
      title: isAr ? 'سرعة فائقة' : 'Ultra Fast',
      desc: isAr ? 'تم تحسين Kimit للعمل بسرعة البرق حتى مع الملفات الكبيرة.' : 'Kimit is optimized to run lightning fast even with large files.'
    },
    {
      icon: Users,
      title: isAr ? 'سهولة الاستخدام' : 'User Friendly',
      desc: isAr ? 'مصمم للجميع، من المبتدئين إلى محترفي البيانات.' : 'Designed for everyone, from beginners to data professionals.'
    }
  ];

  return (
    <div className="p-section" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="p-header">
        <h1 className="p-title">
          {isAr ? 'عن Kimit AI' : 'About Us'}
        </h1>
        <p className="p-subtitle">
          {isAr 
            ? 'Kimit هو مشروع طموح يهدف لتبسيط تحليل البيانات باستخدام الذكاء الاصطناعي، لنجعل البيانات تتحدث بلغة يفهمها الجميع.' 
            : 'Kimit is an ambitious project aimed at simplifying data analysis using AI, making data speak a language everyone understands.'}
        </p>
      </header>

      <div className="p-grid-3" style={{ marginBottom: '48px' }}>
        {features.map((f, i) => (
          <div key={i} className="p-card">
            <div className="p-icon-box">
              <f.icon size={24} />
            </div>
            <h3 className="p-title" style={{ fontSize: '17px', marginBottom: '8px' }}>{f.title}</h3>
            <p className="p-subtitle" style={{ fontSize: '14px' }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <section className="p-card">
        <h2 className="p-title" style={{ fontSize: '20px', marginBottom: '32px' }}>
          {isAr ? 'تواصل مع المطور' : 'Contact the Developer'}
        </h2>
        
        <div className="p-flex-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="p-avatar">IS</div>
          
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h3 className="p-title" style={{ fontSize: '18px', marginBottom: '8px' }}>
              {isAr ? 'إبراهيم صبري' : 'Ibrahim Sabrey'}
            </h3>
            <p className="p-subtitle" style={{ marginBottom: '24px' }}>
              {isAr 
                ? 'مطور برمجيات شغوف ببناء أدوات ذكية تحل مشاكل حقيقية وتجعل حياة المستخدمين أسهل.' 
                : 'A software developer passionate about building smart tools that solve real problems and make users\' lives easier.'}
            </p>
            
            <div className="p-flex-center" style={{ flexWrap: 'wrap' }}>
              <a href="mailto:ebrahimsabrey2001@gmail.com" className="p-pill">
                <Mail size={16} />
                {isAr ? 'البريد الإلكتروني' : 'Email'}
              </a>
              <a href="https://linkedin.com/in/ibrahimsabrey" target="_blank" rel="noopener noreferrer" className="p-pill">
                <Link size={16} />
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: '48px' }}>
        <CreatorFooter lang={lang} />
      </footer>
    </div>
  );
};
