import React from 'react';
import { BookOpen, Search, Brain, BarChart, FileText } from 'lucide-react';
import type { Lang } from '../types';

interface Props { lang: Lang; }

export const GuidePage: React.FC<Props> = ({ lang }) => {
  const isAr = lang === 'ar';
  
  return (
    <div className="page p-6 md:p-12 max-w-6xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mb-24 animate-fade-in text-center lg:text-start">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-8 uppercase tracking-widest">
           <BookOpen size={18} /> {isAr ? 'مركز المساعدة' : 'Knowledge Hub'}
        </div>
        <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-white via-primary to-white/40 bg-clip-text text-transparent leading-tight">
          {isAr ? 'دليل الاستخدام السريع' : 'Quick Usage Guide'}
        </h1>
        <p className="mt-8 text-xl text-text-dim max-w-3xl leading-relaxed">
          {isAr 
            ? 'رحلتك من البيانات الخام إلى الرؤى الذكية تبدأ من هنا. اكتشف كيف تستخدم Kimit بأفضل طريقة لتحويل بياناتك لقرارات.' 
            : 'Your journey from raw data to smart insights starts here. Discover how to use Kimit effectively to turn data into decisions.'}
        </p>
      </div>

      <div className="relative space-y-16">
        {/* Step 1: Z-Score */}
        <section className="relative flex flex-col lg:flex-row gap-12 items-start group">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0 text-primary font-black text-3xl z-10 shadow-[0_0_30px_rgba(0,229,255,0.15)] group-hover:scale-110 transition-transform">
            1
          </div>
          {/* Connecting line */}
          <div className="absolute top-20 bottom-0 left-10 w-0.5 bg-gradient-to-b from-primary/40 to-transparent hidden lg:block" />
          
          <div className="premium-card p-12 flex-1 group-hover:border-primary/40">
            <div className="absolute -right-24 -top-24 w-72 h-72 bg-primary/5 blur-[120px] pointer-events-none" />
            <h2 className="text-3xl font-black mb-8 flex items-center gap-5">
              <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                <Search className="text-primary" size={30} />
              </div>
              {isAr ? 'ميزة Z-Score (كشف القيم الشاذة)' : 'Z-Score Anomaly Detection'}
            </h2>
            <p className="text-lg text-text-dim mb-10 leading-relaxed">
              {isAr 
                ? 'تستخدم المنصة خوارزمية Z-Score إحصائياً لتحديد القيم التي تبعد بشكل غير طبيعي عن متوسط البيانات. أي قيمة تزيد عن 3 في مقياس Z تُعتبر شاذة ومحتمل أن تكون خطأ في الإدخال أو حالة خاصة تستدعي الانتباه.'
                : 'The platform uses the Z-Score statistical algorithm to identify values that are abnormally far from the data mean. Any value higher than 3 on the Z-scale is considered an anomaly, potentially representing input errors.'}
            </p>
            <div className="bg-white/5 p-8 rounded-3xl border border-white/10 inline-flex items-center gap-6 group/formula">
               <span className="text-text-dim text-sm font-bold uppercase tracking-wider">{isAr ? 'المعادلة:' : 'Formula:'}</span>
               <code className="text-primary text-2xl font-mono tracking-tighter group-hover/formula:scale-105 transition-transform">Z = (x - μ) / σ</code>
            </div>
          </div>
        </section>

        {/* Step 2: AI Advisor */}
        <section className="relative flex flex-col lg:flex-row gap-12 items-start group">
          <div className="w-20 h-20 rounded-3xl bg-secondary/10 border-2 border-secondary/20 flex items-center justify-center shrink-0 text-secondary font-black text-3xl z-10 shadow-[0_0_30px_rgba(124,58,237,0.15)] group-hover:scale-110 transition-transform">
            2
          </div>
          <div className="absolute top-20 bottom-0 left-10 w-0.5 bg-gradient-to-b from-secondary/40 to-transparent hidden lg:block" />
          
          <div className="premium-card p-12 flex-1 group-hover:border-secondary/40">
            <div className="absolute -left-24 -bottom-24 w-72 h-72 bg-secondary/5 blur-[120px] pointer-events-none" />
            <h2 className="text-3xl font-black mb-8 flex items-center gap-5">
              <div className="p-4 bg-secondary/10 rounded-2xl border border-secondary/20">
                <Brain className="text-secondary" size={30} />
              </div>
              {isAr ? 'كيف يعمل "مستشار AI"؟' : 'AI Advisor Intelligence'}
            </h2>
            <p className="text-lg text-text-dim leading-relaxed">
              {isAr 
                ? 'يقوم المستشار الذكي بقراءة ملخص إحصائي لبياناتك ويربطه بمعارفه الواسعة ليقدم لك تحليلات، توجهات، وتوقعات دقيقة. يمكنك سؤاله عن علاقة المتغيرات ببعضها أو طلب اقتراحات مخصصة لتحسين الأداء.'
                : 'The AI Advisor reads a statistical summary of your data and links it with its extensive knowledge to provide precise insights, trends, and forecasts. Ask about variable correlations or request tailored suggestions.'}
            </p>
          </div>
        </section>

        {/* Step 3: Visuals & Export */}
        <section className="relative flex flex-col lg:flex-row gap-12 items-start group">
          <div className="w-20 h-20 rounded-3xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center shrink-0 text-accent font-black text-3xl z-10 shadow-[0_0_30px_rgba(16,185,129,0.15)] group-hover:scale-110 transition-transform">
            3
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 flex-1">
            <div className="premium-card p-10 group/item">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-8 border border-accent/20 group-hover/item:scale-110 transition-transform">
                <BarChart className="text-accent" size={28} />
              </div>
              <h3 className="text-2xl font-black mb-5 text-white">{isAr ? 'الرسوم التفاعلية' : 'Interactive Visuals'}</h3>
              <p className="text-text-dim leading-relaxed text-sm md:text-base">
                {isAr 
                  ? 'رسوم بيانية ذكية تتيح لك التفاعل المباشر مع البيانات وفهم التوزيعات والأنماط بلمسة واحدة لسهولة القراءة.'
                  : 'Smart charts that allow direct interaction with data to understand distributions and patterns at a glance.'}
              </p>
            </div>
            <div className="premium-card p-10 group/item">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-8 border border-accent/20 group-hover/item:scale-110 transition-transform">
                <FileText className="text-accent" size={28} />
              </div>
              <h3 className="text-2xl font-black mb-5 text-white">{isAr ? 'تصدير ذكي' : 'Smart Export'}</h3>
              <p className="text-text-dim leading-relaxed text-sm md:text-base">
                {isAr 
                  ? 'احصل على بياناتك المنقحة بصيغ CSV/JSON أو حمل تقريراً كاملاً بصيغة PDF احترافي لتقديمه لفريقك.'
                  : 'Get your cleaned data in CSV/JSON or download a professional full PDF report for your team.'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-32 text-center">
         <button 
           onClick={() => window.location.hash = '#/'}
           className="btn-primary px-16 py-6 text-xl"
         >
           {isAr ? 'ابدأ رحلتك الآن' : 'Start Your Journey'}
         </button>
      </div>
    </div>
  );
};
