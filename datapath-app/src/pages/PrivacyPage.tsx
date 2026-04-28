import React from 'react';
import { ShieldAlert, ServerOff, Database, ShieldCheck } from 'lucide-react';
import type { Lang } from '../types';

interface Props { lang: Lang; }

export const PrivacyPage: React.FC<Props> = ({ lang }) => {
  const isAr = lang === 'ar';
  
  return (
    <div className="page p-6 md:p-12 max-w-6xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="text-center mb-24 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-[2rem] border border-primary/20 flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(0,229,255,0.2)]">
          <ShieldAlert size={48} className="text-primary" />
        </div>
        <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-white via-primary to-white/40 bg-clip-text text-transparent mb-6 leading-tight">
          {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </h1>
        <p className="text-xl text-text-dim max-w-2xl mx-auto leading-relaxed">
          {isAr 
            ? 'نحن نؤمن بأن بياناتك هي ملكك وحدك. Kimit مصمم تقنياً لضمان عدم مغادرة أي معلومة لجهازك الشخصي.' 
            : 'We believe your data belongs to you alone. Kimit is technically architected to ensure no information ever leaves your local device.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        {[
          { icon: ServerOff, color: '#f87171', title: isAr ? 'طرفي' : 'Edge Computing', desc: isAr ? 'معالجة بياناتك محلياً بالكامل دون مغادرة جهازك عبر تقنيات Edge الحديثة لضمان الأمان.' : 'End-to-end local data processing powered by pure Edge computing technology for maximum security.' },
          { icon: Database, color: '#34d399', title: isAr ? 'حصين' : 'Isolated Vault', desc: isAr ? 'تشفير سيادي وتخزين محلي للمفاتيح داخل خزنة Vault مشفرة تماماً لا يمكن الوصول إليها خارجياً.' : 'Sovereign encryption with local key storage inside a fully isolated Vault that cannot be accessed externally.' },
          { icon: ShieldCheck, color: '#60a5fa', title: isAr ? 'سيادة' : 'Data Sovereignty', desc: isAr ? 'امتثال مطلق لمعايير خصوصية أبريل 2026 العالمية مع سيادة بيانات محلية كاملة للمستخدم.' : 'Full compliance with April 2026 global privacy standards ensuring absolute local data sovereignty.' }
        ].map((item, i) => (
          <section key={i} className="premium-card p-10 flex flex-col items-center text-center group">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110" style={{ background: `${item.color}10`, border: `1px solid ${item.color}30` }}>
              <item.icon style={{ color: item.color }} size={36} />
            </div>
            <h2 className="text-2xl font-black text-white mb-5">
              {item.title}
            </h2>
            <p className="text-text-dim text-base leading-relaxed">
              {item.desc}
            </p>
          </section>
        ))}
      </div>

      <div className="text-center pt-8">
        <div className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/40">
          {isAr ? 'تحديث: أبريل 2026' : 'Updated: April 2026'}
        </div>
      </div>
    </div>
  );
};
