import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import type { Lang } from '../types';

interface Props { lang: Lang; }

const getFaqs = (isAr: boolean) => [
  {
    q: isAr ? 'هل البيانات آمنة؟' : 'Is my data safe?',
    a: isAr ? 'نعم تماماً! Kimit يعمل محلياً بالكامل (Client-side). بياناتك لا تُرفع إلى أي سيرفر، بل يتم تحليلها في الذاكرة المؤقتة لمتصفحك فقط.' : 'Absolutely! Kimit runs entirely locally (Client-side). Your data is never uploaded to any server; it is analyzed only in your browser\'s temporary memory.'
  },
  {
    q: isAr ? 'ماذا أفعل إذا تجمد المتصفح؟' : 'What if the browser freezes?',
    a: isAr ? 'هذا قد يحدث مع الملفات الضخمة جداً (أكثر من مليون سجل) نظراً لقيود الذاكرة في المتصفح. ننصح بتقسيم الملف أو استخدام متصفح قوي مثل Chrome وإغلاق التبويبات غير الضرورية.' : 'This might happen with massive files (over 1 million records) due to browser memory limits. We recommend splitting the file or using a robust browser like Chrome and closing unnecessary tabs.'
  },
  {
    q: isAr ? 'هل يدعم ملفات JSON؟' : 'Does it support JSON files?',
    a: isAr ? 'حالياً ندعم CSV و Excel بشكل كامل. دعم JSON في خطتنا المستقبلية القريبة جداً!' : 'Currently we fully support CSV and Excel. JSON support is in our near-future roadmap!'
  },
  {
    q: isAr ? 'هل الموقع مجاني؟' : 'Is it free?',
    a: isAr ? 'نعم، الموقع مجاني بالكامل للاستخدام الشخصي والتجاري.' : 'Yes, the site is completely free for personal and commercial use.'
  }
];

export const FAQPage: React.FC<Props> = ({ lang }) => {
  const isAr = lang === 'ar';
  const faqs = React.useMemo(() => getFaqs(isAr), [isAr]);
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <div className="page p-6 md:p-12 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="text-center mb-24 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-[2rem] border border-primary/20 flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(0,229,255,0.1)] rotate-6">
          <HelpCircle size={48} className="text-primary" />
        </div>
        <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-white via-primary to-white/40 bg-clip-text text-transparent mb-6">
          {isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
        </h1>
        <p className="text-xl text-text-dim max-w-xl mx-auto leading-relaxed">
          {isAr ? 'كل ما تحتاج معرفته عن منصة Kimit وكيفية التعامل مع بياناتك بذكاء واحترافية.' : 'Everything you need to know about Kimit and how to handle your data with intelligence and precision.'}
        </p>
      </div>

      <div className="space-y-8">
        {faqs.map((faq, i) => (
          <div 
            key={i} 
            className={`premium-card transition-all duration-500 ${
              openIndex === i 
                ? 'border-primary/40 bg-primary/5 shadow-[0_0_50px_-10px_rgba(0,229,255,0.15)]' 
                : 'hover:border-white/20'
            }`}
          >
            <button 
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full px-10 py-8 flex justify-between items-center text-start focus:outline-none group"
            >
              <span className={`text-xl md:text-2xl font-black transition-colors duration-300 ${openIndex === i ? 'text-white' : 'text-text-dim'}`}>
                {faq.q}
              </span>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                openIndex === i ? 'bg-primary text-bg rotate-180 shadow-[0_0_20px_rgba(0,229,255,0.4)]' : 'bg-white/5 text-white/30 group-hover:bg-white/10'
              }`}>
                <ChevronDown size={24} />
              </div>
            </button>
            <div 
              className={`px-10 transition-all duration-500 ease-in-out ${
                openIndex === i ? 'max-h-[500px] pb-10 opacity-100 scale-100' : 'max-h-0 pb-0 opacity-0 scale-95'
              }`}
            >
              <div className="pt-8 border-t border-white/5">
                <p className="text-xl text-text-dim leading-relaxed font-medium">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-32 premium-card p-16 text-center group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <h3 className="text-3xl font-black mb-6 text-white">{isAr ? 'لديك سؤال آخر؟' : 'Still have questions?'}</h3>
        <p className="text-lg text-text-dim mb-12 max-w-2xl mx-auto">{isAr ? 'نحن هنا للمساعدة! فريق الدعم جاهز للإجابة على جميع استفساراتك التقنية.' : "We're here to help! Our support team is ready to answer all your technical inquiries."}</p>
        <a 
          href="mailto:ebrahimsabrey2001@gmail.com" 
          className="btn-primary px-12 py-5"
        >
          {isAr ? 'تواصل مع الدعم الآن' : 'Contact Support'}
        </a>
      </div>
    </div>
  );
};
