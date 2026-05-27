import React from 'react';
import { Shield, Database, Lock, Cloud, Server } from 'lucide-react';
import { isArabic } from '../lib/i18n';
import { isCloudSyncEnabled } from '../lib/cloudSyncPreference';

interface Props {}

export const PrivacyPage: React.FC<Props> = () => {
  const isAr = isArabic();
  const cloudOn = isCloudSyncEnabled();

  const sections = isAr
    ? [
        {
          icon: Shield,
          title: 'التحليل المحلي أولاً',
          desc: 'الملفات الأصغر من 10MB تُعالَج في متصفحك. لا نرفع محتوى الصفوف للسحابة إلا إذا فعّلت «النسخ السحابي الاختياري» من الصفحة الرئيسية.',
        },
        {
          icon: Server,
          title: 'الملفات الكبيرة (>10MB)',
          desc: 'للأداء، تُرسل الملفات الكبيرة إلى خوادم Kimit المشفّرة للمعالجة ثم تُعرض النتائج في التطبيق. يمكنك تجنب ذلك بتقسيم الملف أو استخدام نسخة أصغر.',
        },
        {
          icon: Cloud,
          title: 'النسخ السحابي الاختياري',
          desc: cloudOn
            ? 'الوضع الحالي: مفعّل — قد يُحفظ نسخة من الملف في التخزين السحابي عند تسجيل الدخول.'
            : 'الوضع الحالي: متوقف — لا يُرفع ملفك تلقائياً للتخزين السحابي.',
        },
        {
          icon: Database,
          title: 'الجلسة في المتصفح',
          desc: 'يُحفظ مجموع البيانات مؤقتاً في ذاكرة المتصفح (IndexedDB) لاستئناف عملك. امسح الجلسة من القائمة الجانبية في أي وقت.',
        },
        {
          icon: Lock,
          title: 'الذكاء الاصطناعي',
          desc: 'عند استخدام AI Chat، تُرسل مقتطفات من بياناتك إلى مزود AI (Groq) لإنتاج الإجابات. لا ترفع بيانات حساسة إذا لم تكن موافقاً على ذلك.',
        },
        {
          icon: Cloud,
          title: 'الإعلانات والكوكيز',
          desc: 'نعرض الإعلانات فقط بعد موافقتك على الكوكيز. يمكنك رفض الإعلانات وسيستمر التحليل المحلي بدون تعطيل.',
        },
      ]
    : [
        {
          icon: Shield,
          title: 'Local-first analysis',
          desc: 'Files under 10MB are processed in your browser. Row data is not uploaded unless you enable “Optional cloud backup” on the home page.',
        },
        {
          icon: Server,
          title: 'Large files (>10MB)',
          desc: 'For performance, large files are sent to Kimit servers for processing, then results are shown in the app. Split files or use a smaller export to stay local.',
        },
        {
          icon: Cloud,
          title: 'Optional cloud backup',
          desc: cloudOn
            ? 'Current setting: ON — a copy of your file may be stored in cloud storage when you are signed in.'
            : 'Current setting: OFF — your file is not auto-uploaded to cloud storage.',
        },
        {
          icon: Database,
          title: 'Browser session',
          desc: 'Your working dataset is cached in the browser (IndexedDB) so you can resume. Clear the session anytime from the sidebar.',
        },
        {
          icon: Lock,
          title: 'AI features',
          desc: 'When you use AI Chat, excerpts of your data are sent to our AI provider (Groq) to generate answers. Avoid highly sensitive data if you do not consent.',
        },
        {
          icon: Cloud,
          title: 'Ads & cookies',
          desc: 'Ads are shown only after your cookie consent. You can reject ads and continue local analysis without interruption.',
        },
      ];

  return (
    <div className="p-section" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="p-header p-flex-center">
        <Shield size={36} className="p-icon-box" style={{ marginBottom: 0 }} />
        <h1 className="p-title" style={{ marginBottom: 0 }}>
          {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </h1>
      </header>

      <p className="p-subtitle" style={{ maxWidth: 720, margin: '0 auto 24px', textAlign: 'center' }}>
        {isAr
          ? 'نلتزم بشفافية كاملة: لا نعد بأن «البيانات لا تغادر جهازك أبداً» — نشرح بالضبط متى تبقى محلية ومتى تستخدم السحابة.'
          : 'We are fully transparent: we do not claim “data never leaves your device.” Below is exactly when processing stays local vs uses the cloud.'}
      </p>

      <div className="p-grid-2">
        {sections.map((item, i) => (
          <div key={i} className="p-card">
            <div className="p-icon-box">
              <item.icon size={24} />
            </div>
            <h3 className="p-title" style={{ fontSize: '18px' }}>
              {item.title}
            </h3>
            <p className="p-subtitle">{item.desc}</p>
          </div>
        ))}
      </div>

      <footer style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p className="p-subtitle">
          {isAr ? 'آخر تحديث: مايو 2026' : 'Last updated: May 2026'}
        </p>
        <p className="p-subtitle" style={{ marginTop: 8 }}>
          {isAr ? 'تواصل: support@kimit.cloud' : 'Contact: support@kimit.cloud'}
        </p>
      </footer>
    </div>
  );
};
