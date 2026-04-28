import { Mail, ExternalLink, ShieldCheck, Users, Zap, Link } from 'lucide-react';
import { CreatorFooter } from '../components/CreatorFooter';
import type { Lang } from '../types';

interface Props { lang: Lang; }

export const AboutUsPage: React.FC<Props> = ({ lang }) => {
  const isAr = lang === 'ar';
  
  return (
    <div className="page p-6 md:p-12 max-w-6xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="text-center mb-20 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20 text-primary text-xs font-bold mb-6 uppercase tracking-widest">
          <ShieldCheck size={14} /> {isAr ? 'منصة موثوقة' : 'Trusted Platform'}
        </div>
        <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-white via-primary to-secondary bg-clip-text text-transparent mb-8 leading-tight">
          {isAr ? 'عن Kimit AI' : 'About Kimit AI'}
        </h1>
        <p className="text-lg md:text-xl text-text-dim max-w-3xl mx-auto leading-relaxed">
          {isAr 
            ? 'Kimit هو مشروع طموح يهدف لتبسيط تحليل البيانات باستخدام الذكاء الاصطناعي، لنجعل البيانات تتحدث بلغة يفهمها الجميع بخصوصية تامة وسرعة فائقة.' 
            : 'Kimit is an ambitious project aimed at simplifying data analysis using AI, making data speak a language everyone understands with full privacy and ultra speed.'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-24">
        {[
          { icon: ShieldCheck, color: 'var(--primary)', title: isAr ? 'خصوصية تامة' : 'Full Privacy', desc: isAr ? 'بياناتك لا تغادر متصفحك أبداً. نحن لا نخزن أي بيانات على خوادمنا.' : 'Your data never leaves your browser. We don\'t store any data on our servers.' },
          { icon: Zap, color: 'var(--secondary)', title: isAr ? 'سرعة فائقة' : 'Ultra Fast', desc: isAr ? 'تم تحسين Kimit للعمل بسرعة البرق حتى مع الملفات الكبيرة والعمليات المعقدة.' : 'Kimit is optimized to run lightning fast even with large files and complex operations.' },
          { icon: Users, color: 'var(--accent)', title: isAr ? 'سهولة الاستخدام' : 'User Friendly', desc: isAr ? 'مصمم للجميع، من المبتدئين الذين يريدون إجابات سريعة إلى محترفي البيانات.' : 'Designed for everyone, from beginners wanting quick answers to data professionals.' }
        ].map((item, i) => (
          <div key={i} className="premium-card p-10 group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3" style={{ background: `rgba(${item.color === 'var(--primary)' ? '0,229,255' : item.color === 'var(--secondary)' ? '124,58,237' : '16,185,129'}, 0.1)`, border: `1px solid rgba(${item.color === 'var(--primary)' ? '0,229,255' : item.color === 'var(--secondary)' ? '124,58,237' : '16,185,129'}, 0.2)` }}>
              <item.icon style={{ color: item.color }} size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">{item.title}</h3>
            <p className="text-text-dim leading-relaxed text-sm md:text-base">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="premium-card p-12 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full pointer-events-none" />
        
        <h2 className="text-3xl font-black mb-12 flex items-center gap-4">
          <div className="w-1.5 h-10 bg-primary rounded-full shadow-[0_0_15px_rgba(0,229,255,0.5)]" />
          {isAr ? 'تواصل مع المطور' : 'Contact the Developer'}
        </h2>

        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary to-secondary rounded-[3rem] blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative w-48 h-48 rounded-[2.5rem] border-2 border-white/10 p-2 bg-bg overflow-hidden group">
               <div className="w-full h-full rounded-[2rem] bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-6xl font-black text-white shadow-2xl transition-transform group-hover:scale-110">
                 IS
               </div>
               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <Users size={32} />
               </div>
            </div>
          </div>

          <div className="flex-1 space-y-8 text-center lg:text-start">
            <div>
              <p className="text-4xl font-black text-white mb-3">
                {isAr ? 'إبراهيم صبري' : 'Ibrahim Sabrey'}
              </p>
              <p className="text-xl text-primary font-bold tracking-tight">Software Architect & Data Analyst</p>
            </div>
            <p className="text-lg text-text-dim max-w-2xl leading-relaxed">
              {isAr 
                ? 'مطور برمجيات شغوف ببناء أدوات ذكية تحل مشاكل حقيقية وتجعل حياة المستخدمين أسهل عبر دمج قوة الذكاء الاصطناعي مع بساطة واجهة المستخدم.' 
                : 'A software developer passionate about building smart tools that solve real problems and make users\' lives easier by merging the power of AI with UI simplicity.'}
            </p>
            
            <div className="flex flex-wrap gap-5 justify-center lg:justify-start pt-4">
              <a href="mailto:ebrahimsabrey2001@gmail.com" className="flex items-center gap-4 px-8 py-4 bg-white/5 hover:bg-primary/10 rounded-2xl border border-white/10 hover:border-primary/40 transition-all group">
                <Mail size={22} className="text-primary group-hover:rotate-12 transition-transform" />
                <span className="text-base font-bold">Email Me</span>
              </a>
              <a href="https://www.linkedin.com/in/ibrahimsabrey" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 px-8 py-4 bg-white/5 hover:bg-secondary/10 rounded-2xl border border-white/10 hover:border-secondary/40 transition-all group">
                <Link size={22} className="text-secondary group-hover:rotate-12 transition-transform" />
                <span className="text-base font-bold">LinkedIn</span>
                <ExternalLink size={16} className="opacity-40" />
              </a>
            </div>
          </div>
        </div>
      </div>
      <CreatorFooter lang={lang} />
    </div>
  );
};
