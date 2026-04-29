import React from 'react';
import { Search, Brain, BarChart2, FileText, BookOpen } from 'lucide-react';
import type { Lang } from '../types';

interface Props { lang: Lang; }

export const GuidePage: React.FC<Props> = ({ lang }) => {
  const isAr = lang === 'ar';
  
  const steps = [
    {
      icon: Search,
      title: isAr ? 'استكشاف البيانات' : 'Explore Data',
      desc: isAr ? 'ارفع ملفك وسيقوم Kimit بتحليل الهيكل والأنواع والارتباطات تلقائياً.' : 'Upload your file and Kimit will automatically analyze structure, types, and correlations.'
    },
    {
      icon: Brain,
      title: isAr ? 'الذكاء الاصطناعي' : 'AI Intelligence',
      desc: isAr ? 'اسأل المستشار الذكي عن أي شيء في بياناتك واحصل على إجابات دقيقة.' : 'Ask the smart consultant anything about your data and get accurate answers.'
    },
    {
      icon: BarChart2,
      title: isAr ? 'رسوم بيانية' : 'Visualizations',
      desc: isAr ? 'حول الأرقام إلى قصص بصرية مذهلة بضغطة زر واحدة.' : 'Turn numbers into stunning visual stories with a single click.'
    },
    {
      icon: FileText,
      title: isAr ? 'تصدير التقارير' : 'Export Reports',
      desc: isAr ? 'استخرج نتائجك في ملفات Excel أو PDF أو صور عالية الجودة.' : 'Extract your results in Excel, PDF, or high-quality images.'
    }
  ];

  return (
    <div className="p-section" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="p-header">
        <div className="p-flex-center" style={{ marginBottom: '16px' }}>
          <BookOpen size={32} className="p-icon-box" style={{ marginBottom: 0 }} />
          <h1 className="p-title" style={{ marginBottom: 0 }}>
            {isAr ? 'دليل الاستخدام' : 'User Guide'}
          </h1>
        </div>
        <p className="p-subtitle">
          {isAr ? 'تعلم كيف تستخدم Kimit AI Studio لتحويل بياناتك الخام إلى رؤى قيمة في دقائق.' : 'Learn how to use Kimit AI Studio to transform your raw data into valuable insights in minutes.'}
        </p>
      </header>

      <div style={{ position: 'relative' }}>
        {/* Connecting Line */}
        <div className="p-step-line" style={{ left: isAr ? 'auto' : '15px', right: isAr ? '15px' : 'auto' }} />

        <div style={{ display: 'grid', gap: '48px' }}>
          {steps.map((step, i) => (
            <div key={i} className="p-flex-row" style={{ position: 'relative', zIndex: 1 }}>
              <div className="p-badge">{i + 1}</div>
              
              <div className="p-card" style={{ flex: 1 }}>
                <div className="p-flex-center" style={{ marginBottom: '16px' }}>
                  <div className="p-icon-box" style={{ marginBottom: 0 }}>
                    <step.icon size={24} />
                  </div>
                  <h3 className="p-title" style={{ fontSize: '18px', marginBottom: 0 }}>
                    {step.title}
                  </h3>
                </div>
                <p className="p-subtitle">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="p-card" style={{ marginTop: '64px', background: 'linear-gradient(135deg, var(--bg-secondary), rgba(16, 185, 129, 0.05))', textAlign: 'center' }}>
        <h2 className="p-title" style={{ fontSize: '20px' }}>
          {isAr ? 'جاهز للبدء؟' : 'Ready to start?'}
        </h2>
        <p className="p-subtitle" style={{ marginBottom: '24px' }}>
          {isAr ? 'انتقل إلى الصفحة الرئيسية وارفع أول ملف بيانات لك الآن.' : 'Go to the home page and upload your first data file now.'}
        </p>
        <button className="p-pill" style={{ border: 'none', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
          {isAr ? 'ابدأ الآن' : 'Start Now'}
        </button>
      </footer>
    </div>
  );
};
