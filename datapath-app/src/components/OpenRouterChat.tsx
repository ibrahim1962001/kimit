import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp, FileUp, Bot, User, Image as ImageIcon, X,
  AlertCircle, Loader2, Sparkles, Zap, LogOut
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AuthModal } from './AuthModal';
import type { DatasetInfo } from '../types';

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
  timestamp?: Date;
}

interface ModelConfig {
  id: string;
  name: string;
  description: string;
  vision: boolean;
  icon: React.ReactNode;
  badge?: string;
}

const MODELS: ModelConfig[] = [
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    description: 'سريع ومجاني + رؤية الصور',
    vision: true,
    icon: <Zap size={14} />,
    badge: 'مجاني'
  },
];

const SUGGESTED_PROMPTS = [
  'اشرح لي مفهوم الذكاء الاصطناعي',
  'ساعدني في تحليل البيانات',
  'اكتب لي كود Python',
  'لخص لي هذا الموضوع',
];

export const OpenRouterChat: React.FC<{ dataset?: DatasetInfo | null, onFileUpload?: (file: File) => void, onUpdate?: (dataset: DatasetInfo) => void }> = ({ dataset, onFileUpload, onUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel] = useState(MODELS[0]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textareaHeight, setTextareaHeight] = useState(52);

  // Auth state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const DEFAULT_KEY = import.meta.env.VITE_OPENROUTER_KEY || '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';
  const NEMOTRON_KEY = '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';
  const API_KEY = selectedModel.id.includes('nemotron') ? NEMOTRON_KEY : DEFAULT_KEY;

  // Listen for auth state changes and load chat history
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
      if (user) {
        try {
          const docRef = doc(db, 'userChats', user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.messages) {
              setMessages(data.messages.map((m: Record<string, unknown>) => {
                const ts = m.timestamp as string | number | Date | { toDate: () => Date } | undefined;
                let finalDate: Date;
                if (ts && typeof ts === 'object' && 'toDate' in ts) {
                  finalDate = ts.toDate();
                } else if (ts) {
                  finalDate = new Date(ts as string | number | Date);
                } else {
                  finalDate = new Date();
                }
                return { ...m, timestamp: finalDate } as ChatMessage;
              }));
            }
          }
        } catch (e) {
          console.error("Failed to load chat", e);
        }
      } else {
        setMessages([]);
      }
      setIsLoaded(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isLoaded && currentUser) {
      setDoc(doc(db, 'userChats', currentUser.uid), { messages }, { merge: true })
        .catch(e => console.error("Failed to save chat", e));
    }
  }, [messages, isLoaded, currentUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSignOut = async () => {
    try { await signOut(auth); setMessages([]); } catch { setError('فشل في تسجيل الخروج.'); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setAttachedImage(ev.target?.result as string); setError(null); };
    reader.readAsDataURL(file);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) onFileUpload(file);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    const newH = Math.min(ta.scrollHeight, 160);
    ta.style.height = newH + 'px';
    setTextareaHeight(newH);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || loading) return;
    if (!currentUser) { setShowAuthModal(true); return; }

    setLoading(true);
    setError(null);

    let userContent: string | MessageContent[];
    if (attachedImage && selectedModel.vision) {
      userContent = [
        { type: 'text', text: input.trim() || 'حلل هذه الصورة.' },
        { type: 'image_url', image_url: { url: attachedImage } }
      ];
    } else {
      userContent = input.trim();
    }

    const newUserMsg: ChatMessage = { role: 'user', content: userContent, timestamp: new Date() };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInput('');
    setAttachedImage(null);
    if (textareaRef.current) { textareaRef.current.style.height = '52px'; setTextareaHeight(52); }

    try {
      let systemPrompt = `أنت خبير تحليل بيانات (Data Scientist) ومساعد ذكي يدعى Kimit AI.
تواصلك دائماً باللغة العربية بأسلوب احترافي وودود.

قدراتك التقنية:
1. تحليل البيانات الإحصائية وتقديم رؤى عميقة.
2. تعديل البيانات مباشرة: عندما يطلب المستخدم تعديل البيانات (حذف عمود، إعادة تسمية، ملء القيم المفقودة، إضافة عمود محسوب، فلترة، ترتيب، استبدال قيم)، يجب أن ترد بكائن JSON فقط بالصيغة التالية وبدون أي نص إضافي:
{
  "action": "edit",
  "type": "delete_column" | "rename_column" | "fill_nulls" | "apply_formula" | "add_column" | "filter_rows" | "sort" | "replace_value",
  "target": "<اسم العمود أو شرط الصفوف>",
  "value": "<القيمة الجديدة أو الصيغة أو العملية>",
  "description": "<جملة واحدة تصف ما تم فعله بلغة المستخدم>"
}

أمثلة:
- "احذف عمود Age" → {"action":"edit","type":"delete_column","target":"Age","value":"","description":"تم حذف عمود Age"}
- "اضرب Sales في 1.1" → {"action":"edit","type":"apply_formula","target":"Sales","value":"* 1.1","description":"تم ضرب عمود Sales في 1.1"}
- "املأ القيم الفارغة في Price بالوسيط" → {"action":"edit","type":"fill_nulls","target":"Price","value":"median","description":"تم ملء القيم المفقودة في Price بالوسيط"}
- "أعد تسمية Name إلى الاسم" → {"action":"edit","type":"rename_column","target":"Name","value":"الاسم","description":"تم إعادة تسمية عمود Name إلى الاسم"}
- "أضف عمود Profit = Sales - Cost" → {"action":"edit","type":"add_column","target":"Profit","value":"Sales - Cost","description":"تم إضافة عمود Profit = Sales - Cost"}

إذا كان طلب المستخدم سؤالاً أو تحليلاً وليس تعديلاً، أجب نصياً بشكل طبيعي.
إذا كان الطلب يحتاج كود JavaScript معقد، ضع الكود داخل \`\`\`javascript ... \`\`\` وتأكد أنه يعيد (return) المصفوفة المعدلة.`;

      if (dataset) {
        const sampleData = dataset.workData.slice(0, 3);
        systemPrompt += `\n\nالسياق الحالي للبيانات المرفوعة:\n` +
          `اسم الملف: ${dataset.filename}\n` +
          `عدد الصفوف: ${dataset.rows} | عدد الأعمدة: ${dataset.columns.length}\n` +
          `قائمة الأعمدة: ${dataset.columns.map(c => `${c.name} (${c.type})`).join(', ')}\n` +
          `عينة من البيانات الفعليّة (أول 3 صفوف لمعرفة الأسماء الحقيقية المخفية إذا كانت الأعمدة تسمى __EMPTY_1 الخ):\n` +
          `${JSON.stringify(sampleData, null, 2)}\n\n` +
          `ملاحظة هامة جداً 🚨: إذا طلب المستخدم تعديلاً معقداً جداً، أو كانت أسماء الأعمدة مشوهة (مثل __EMPTY) والمستخدم يشير لاسم حقيقي موجود في العينة، **لا تستخدم الـ JSON السريع**. بدلاً من ذلك، اكتب كود JavaScript بداخل \`\`\`javascript ... \`\`\` يستقبل المتغير \`data\` (وهو مصفوفة البيانات)، يحلل المشكلة، يطبق التعديل المطلوب بدقة، ويعيد \`return\` المصفوفة الجديدة.`;
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Kimit AI Studio',
        },
        body: JSON.stringify({
          model: selectedModel.id,
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'فشل في الاتصال بـ OpenRouter');

      let aiContent = data.choices[0].message.content;

      // BUG #3 FIX: Try to parse structured JSON edit action first
      if (dataset && onUpdate) {
        try {
          // Try to extract JSON from the response (may be wrapped in markdown code block)
          let jsonStr = aiContent.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          const editAction = JSON.parse(jsonStr);
          if (editAction && editAction.action === 'edit' && editAction.type) {
            let newData = JSON.parse(JSON.stringify(dataset.workData));
            const { analyzeDataset } = await import('../lib/dataUtils');

            switch (editAction.type) {
              case 'delete_column':
                newData = newData.map((row: Record<string, unknown>) => {
                  const newRow = { ...row };
                  delete newRow[editAction.target];
                  return newRow;
                });
                break;
              case 'rename_column':
                newData = newData.map((row: Record<string, unknown>) => {
                  const newRow = { ...row };
                  if (editAction.target in newRow) {
                    newRow[editAction.value] = newRow[editAction.target];
                    delete newRow[editAction.target];
                  }
                  return newRow;
                });
                break;
              case 'fill_nulls': {
                const colVals = newData.map((r: Record<string, unknown>) => Number(r[editAction.target])).filter((v: number) => !isNaN(v));
                let fillVal: unknown;
                if (editAction.value === 'median') {
                  const sorted = [...colVals].sort((a: number, b: number) => a - b);
                  fillVal = sorted[Math.floor(sorted.length / 2)];
                } else if (editAction.value === 'mean') {
                  fillVal = colVals.reduce((a: number, b: number) => a + b, 0) / colVals.length;
                } else {
                  fillVal = editAction.value;
                }
                newData = newData.map((row: Record<string, unknown>) => {
                  if (row[editAction.target] === null || row[editAction.target] === undefined || row[editAction.target] === '') {
                    return { ...row, [editAction.target]: fillVal };
                  }
                  return row;
                });
                break;
              }
              case 'apply_formula': {
                const op = editAction.value.trim();
                newData = newData.map((row: Record<string, unknown>) => {
                  const val = Number(row[editAction.target]);
                  if (!isNaN(val)) {
                    let result = val;
                    if (op.startsWith('*')) result = val * Number(op.slice(1).trim());
                    else if (op.startsWith('+')) result = val + Number(op.slice(1).trim());
                    else if (op.startsWith('-')) result = val - Number(op.slice(1).trim());
                    else if (op.startsWith('/')) result = val / Number(op.slice(1).trim());
                    return { ...row, [editAction.target]: Number(result.toFixed(4)) };
                  }
                  return row;
                });
                break;
              }
              case 'add_column': {
                const formula = editAction.value;
                newData = newData.map((row: Record<string, unknown>) => {
                  try {
                    const fn = new Function(...Object.keys(row), `return ${formula}`);
                    return { ...row, [editAction.target]: fn(...Object.values(row)) };
                  } catch { return { ...row, [editAction.target]: null }; }
                });
                break;
              }
              case 'filter_rows': {
                try {
                  newData = newData.filter((row: Record<string, unknown>) => {
                    const fn = new Function(...Object.keys(row), `return ${editAction.value}`);
                    return fn(...Object.values(row));
                  });
                } catch { /* keep original */ }
                break;
              }
              case 'sort': {
                const col = editAction.target;
                const dir = editAction.value === 'desc' ? -1 : 1;
                newData.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                  const va = a[col], vb = b[col];
                  if (va === vb) return 0;
                  if (va === null || va === undefined) return 1;
                  if (vb === null || vb === undefined) return -1;
                  return (va < vb ? -1 : 1) * dir;
                });
                break;
              }
              case 'replace_value':
                newData = newData.map((row: Record<string, unknown>) => {
                  if (String(row[editAction.target]) === String(editAction.value.split('→')[0]?.trim())) {
                    return { ...row, [editAction.target]: editAction.value.split('→')[1]?.trim() };
                  }
                  return row;
                });
                break;
            }

            onUpdate(analyzeDataset(new File([], dataset.filename), newData));
            aiContent = editAction.description + "\n\n*(تم تحديث جدول البيانات بنجاح بناءً على طلبك ✨)*";
          }
        } catch {
          // Not valid JSON — try JS code block fallback
          const jsMatch = aiContent.match(/```(?:javascript|js)\n([\s\S]*?)```/);
          if (jsMatch) {
            try {
              const code = jsMatch[1];
              let newData = JSON.parse(JSON.stringify(dataset.workData));
              const fn = new Function('data', code);
              const result = fn(newData);
              if (Array.isArray(result)) newData = result;
              const { analyzeDataset } = await import('../lib/dataUtils');
              onUpdate(analyzeDataset(new File([], dataset.filename), newData));
              aiContent += "\n\n*(تم تحديث جدول البيانات بنجاح بناءً على طلبك ✨)*";
            } catch (err) {
              console.error("AI Error:", err);
              aiContent += "\n\n*(حدث خطأ أثناء محاولة تنفيذ التعديل)*";
            }
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent, timestamp: new Date() }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const clearChat = () => {
    if (window.confirm('هل تريد مسح سجل المحادثة؟')) {
      setMessages([]);
    }
  };

  if (!authChecked) return <div className="or-chat-root flex items-center justify-center h-full"><Loader2 size={32} className="spin text-indigo-400" /></div>;

  return (
    <div className="or-chat-root" dir="rtl">
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={() => {}} />
      <div className="or-ambient-glow" />
      
      <div className="or-header">
        <div className="or-header-brand">
          <div className="or-brand-icon"><Sparkles size={18} /></div>
          <div>
            <h1 className="or-brand-title">Kimit AI Studio</h1>
            <p className="or-brand-sub">{selectedModel.name}</p>
          </div>
        </div>
        <div className="or-header-actions">
          <button onClick={clearChat} className="p-2 text-gray-400 hover:text-red-400 transition-colors"><X size={18} /></button>
          {currentUser ? (
            <div className="or-user-profile">
              <img src={currentUser.photoURL || ''} alt="" className="or-user-avatar" />
              <div className="or-user-info">
                <span className="or-user-name">{currentUser.displayName}</span>
                <span className="or-user-status">متصل</span>
              </div>
              <button className="or-signout-btn" onClick={handleSignOut}><LogOut size={14} /></button>
            </div>
          ) : (
            <button className="or-signin-btn" onClick={() => setShowAuthModal(true)}><User size={14} /> تسجيل الدخول</button>
          )}
        </div>
      </div>

      <div className="or-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="or-empty-state">
            <Bot size={48} className="text-indigo-400 mb-4" />
            <h2 className="or-empty-title">كيف يمكنني مساعدتك؟</h2>
            <div className="or-suggestions">
              {SUGGESTED_PROMPTS.map(p => <button key={p} className="or-suggestion-chip" onClick={() => setInput(p)}>{p}</button>)}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`or-msg-row ${msg.role}`}>
            <div className={`or-avatar ${msg.role}`}>{msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}</div>
            <div className="or-bubble-wrap">
              <div className={`or-bubble ${msg.role}`}>
                <div className="or-markdown">
                  {typeof msg.content === 'string' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown> : null}
                </div>
              </div>
              <span className="or-timestamp">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="or-msg-row assistant">
            <div className="or-avatar assistant"><Bot size={16} /></div>
            <div className="or-bubble assistant or-typing">
              <span /><span /><span />
              <div className="ms-3 text-xs text-emerald-400 font-bold">جاري العمل...</div>
            </div>
          </div>
        )}
        {error && <div className="or-error-bar"><AlertCircle size={14} /> {error} <X size={12} className="cursor-pointer" onClick={() => setError(null)} /></div>}
      </div>

      <div className="or-input-area">
        {attachedImage && <div className="or-img-attach"><img src={attachedImage} alt="" /><button onClick={() => setAttachedImage(null)}><X size={12} /></button></div>}
        <div className="or-input-row">
          <div className="or-textarea-wrap">
             <textarea 
                ref={textareaRef} 
                className="or-textarea" 
                placeholder="اطلب تحليل أو تعديل البيانات..." 
                value={input} 
                onChange={handleTextareaInput}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                style={{ height: textareaHeight }}
             />
             <div className="or-attach-actions">
               <button className="or-img-btn" onClick={() => fileInputRef.current?.click()}><ImageIcon size={18} /></button>
               <button className="or-img-btn doc-btn" onClick={() => docInputRef.current?.click()}><FileUp size={18} /></button>
             </div>
          </div>
          <button className="or-send-btn" onClick={handleSend} disabled={loading || (!input.trim() && !attachedImage)}>
            {loading ? <Loader2 size={24} className="spin" /> : <ArrowUp size={24} />}
          </button>
        </div>
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={docInputRef} hidden accept=".csv,.xlsx,.xls,.json" onChange={handleDocUpload} />
      </div>

      <style>{`
        .or-chat-root { display: flex; flex-direction: column; height: 100%; background: #020617; position: relative; overflow: hidden; font-family: 'Cairo', sans-serif; }
        .or-ambient-glow { position: absolute; top: -150px; left: 50%; transform: translateX(-50%); width: 800px; height: 400px; background: radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%); pointer-events: none; }
        .or-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: rgba(15,23,42,0.8); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(20px); z-index: 10; }
        .or-header-brand { display: flex; align-items: center; gap: 12px; }
        .or-brand-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; }
        .or-brand-title { font-size: 14px; font-weight: 700; color: #f1f5f9; margin: 0; }
        .or-brand-sub { font-size: 10px; color: #64748b; margin: 0; }
        .or-user-profile { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .or-user-avatar { width: 28px; height: 28px; border-radius: 6px; }
        .or-user-info { display: flex; flex-direction: column; }
        .or-user-name { font-size: 11px; font-weight: 600; color: #e2e8f0; }
        .or-user-status { font-size: 8px; color: #10b981; }
        .or-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .or-msg-row { display: flex; gap: 12px; max-width: 85%; }
        .or-msg-row.user { align-self: flex-start; flex-direction: row; }
        .or-msg-row.assistant { align-self: flex-start; flex-direction: row; }
        .or-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .or-avatar.user { background: rgba(99,102,241,0.1); color: #818cf8; }
        .or-avatar.assistant { background: rgba(16,185,129,0.1); color: #34d399; }
        .or-bubble { padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.6; }
        .or-bubble.user { background: #1e293b; color: #f1f5f9; border: 1px solid rgba(255,255,255,0.05); }
        .or-bubble.assistant { background: rgba(15,23,42,0.5); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        .or-timestamp { font-size: 10px; color: #64748b; margin-top: 4px; display: block; padding: 0 4px; }
        .or-input-area { padding: 20px; background: rgba(15,23,42,0.9); border-top: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(20px); }
        .or-input-row { display: flex; gap: 12px; align-items: flex-end; max-width: 900px; margin: 0 auto; }
        .or-textarea-wrap { flex: 1; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 10px; position: relative; transition: all 0.2s; }
        .or-textarea-wrap:focus-within { border-color: #6366f1; box-shadow: 0 0 0 1px rgba(99,102,241,0.2); }
        .or-textarea { width: 100%; background: transparent; border: none; color: #f1f5f9; font-size: 14px; resize: none; padding: 4px; outline: none; }
        .or-attach-actions { display: flex; gap: 8px; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); pt-2; }
        .or-img-btn { color: #64748b; padding: 6px; border-radius: 8px; transition: all 0.2s; cursor: pointer; }
        .or-img-btn:hover { background: rgba(255,255,255,0.05); color: #f1f5f9; }
        .or-send-btn { width: 44px; height: 44px; background: #6366f1; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer; }
        .or-send-btn:hover:not(:disabled) { background: #4f46e5; transform: translateY(-2px); }
        .or-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .or-typing span { width: 4px; height: 4px; background: #34d399; border-radius: 50%; display: inline-block; animation: or-bounce 1s infinite; }
        .or-typing span:nth-child(2) { animation-delay: 0.2s; }
        .or-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes or-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .or-empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #64748b; }
        .or-empty-title { font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 24px; }
        .or-suggestions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 500px; }
        .or-suggestion-chip { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 8px 16px; border-radius: 12px; font-size: 13px; color: #94a3b8; transition: all 0.2s; cursor: pointer; }
        .or-suggestion-chip:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); color: #e2e8f0; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
