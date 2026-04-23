import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp, FileUp, Bot, User, Image as ImageIcon, X, Trash2,
  ChevronDown, AlertCircle, Loader2, Sparkles, Zap, Brain, Code2, LogOut
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
  {
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick',
    description: 'نموذج قوي ومجاني',
    vision: false,
    icon: <Brain size={14} />,
    badge: 'مجاني'
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    description: 'متوازن + رؤية الصور',
    vision: true,
    icon: <Sparkles size={14} />,
    badge: 'مجاني'
  },
  {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen 3 235B',
    description: 'متخصص في البرمجة',
    vision: false,
    icon: <Code2 size={14} />,
    badge: 'كودينج'
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Nemotron 3 Super',
    description: 'قوي ومتقدم من انفيديا',
    vision: false,
    icon: <Brain size={14} />,
    badge: 'NVIDIA'
  },
];

const SUGGESTED_PROMPTS = [
  'اشرح لي مفهوم الذكاء الاصطناعي',
  'ساعدني في تحليل البيانات',
  'اكتب لي كود Python',
  'لخص لي هذا الموضوع',
];

export const OpenRouterChat: React.FC<{ dataset?: DatasetInfo | null, onFileUpload?: (file: File) => void }> = ({ dataset, onFileUpload }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
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
              setMessages(data.messages.map((m: any) => ({
                ...m,
                timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp || Date.now())
              })));
            }
          }
        } catch (e) {
          console.error("Failed to load chat from firestore", e);
        }
      } else {
        setMessages([]);
      }
      setIsLoaded(true);
    });
    return () => unsub();
  }, []);

  // Save messages to firestore whenever they change
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
    try {
      await signOut(auth);
      setMessages([]);
    } catch {
      setError('فشل في تسجيل الخروج.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى رفع صورة صالحة.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage(event.target?.result as string);
      setError(null);
    };
    reader.onerror = () => setError('فشل في قراءة الصورة.');
    reader.readAsDataURL(file);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onFileUpload) {
      onFileUpload(file);
    } else {
      setError('إرفاق الملفات غير مدعوم حالياً.');
    }
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

    // Check auth - show modal if not logged in
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (!API_KEY) {
      setError('مفتاح OpenRouter API غير موجود. تحقق من ملف .env');
      return;
    }

    setLoading(true);
    setError(null);
    setModelMenuOpen(false);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
      setTextareaHeight(52);
    }

    try {
      let systemPrompt = "أنت مساعد ذكي ومحلل بيانات للرد على أسئلة المستخدم باللغة العربية. يمكنك المساعدة في أي موضوع وخاصة تحليل البيانات والمساعدة في الأكواد وكتابة التقارير.";
      if (dataset) {
        systemPrompt += `\n\nالسياق الحالي للبيانات المرفوعة على النظام:\n` +
          `اسم الملف: ${dataset.filename}\n` +
          `عدد الصفوف: ${dataset.rows} | عدد الأعمدة: ${dataset.columns.length}\n` +
          `قائمة الأعمدة: ${dataset.columns.map(c => `${c.name} (${c.type})`).join(', ')}`;
      }

      const openRouterMessages = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
      ];

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
          messages: openRouterMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'فشل في الاتصال بـ OpenRouter');
      }

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  if (!authChecked) {
    return (
      <div className="or-chat-root" dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: '#818cf8' }} />
      </div>
    );
  }

  return (
    <div className="or-chat-root" dir="rtl">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {/* user is now signed in */}}
      />

      {/* Ambient background glow */}
      <div className="or-ambient-glow" />

      {/* Header */}
      <div className="or-header">
        <div className="or-header-brand">
          <div className="or-brand-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="or-brand-title">Kimit AI Studio</h1>
            <p className="or-brand-sub">مدعوم بواسطة OpenRouter · {selectedModel.name}</p>
          </div>
        </div>

        <div className="or-header-actions">
          {/* User Profile / Auth */}
          {currentUser ? (
            <div className="or-user-profile">
              <img
                src={currentUser.photoURL || ''}
                alt={currentUser.displayName || 'User'}
                className="or-user-avatar"
                referrerPolicy="no-referrer"
              />
              <div className="or-user-info">
                <span className="or-user-name">{currentUser.displayName || 'مستخدم'}</span>
                <span className="or-user-status">متصل</span>
              </div>
              <button className="or-signout-btn" onClick={handleSignOut} title="تسجيل الخروج">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button className="or-signin-btn" onClick={() => setShowAuthModal(true)}>
              <User size={14} />
              <span>تسجيل الدخول</span>
            </button>
          )}

          {/* Model Selector */}
          <div className="or-model-selector-wrap">
            <button
              className="or-model-btn"
              onClick={() => setModelMenuOpen(v => !v)}
            >
              <span className="or-model-icon">{selectedModel.icon}</span>
              <span className="or-model-name-short">{selectedModel.name}</span>
              <ChevronDown size={14} className={`or-model-chevron ${modelMenuOpen ? 'open' : ''}`} />
            </button>

            {modelMenuOpen && (
              <>
                <div className="or-model-backdrop" onClick={() => setModelMenuOpen(false)} />
                <div className="or-model-dropdown">
                  <p className="or-dropdown-label">اختر النموذج</p>
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      className={`or-dropdown-item ${selectedModel.id === m.id ? 'active' : ''}`}
                      onClick={() => { setSelectedModel(m); setModelMenuOpen(false); }}
                    >
                      <span className="or-di-icon">{m.icon}</span>
                      <div className="or-di-info">
                        <span className="or-di-name">{m.name}</span>
                        <span className="or-di-desc">{m.description}</span>
                      </div>
                      {m.badge && <span className="or-di-badge">{m.badge}</span>}
                      {m.vision && <span className="or-vision-dot" title="يدعم الصور" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="or-messages">
        {messages.length === 0 && (
          <div className="or-empty-state">
            <div className="or-empty-icon">
              <Sparkles size={32} />
            </div>
            <h2 className="or-empty-title">
              {currentUser ? `أهلاً ${currentUser.displayName?.split(' ')[0] || ''}! كيف يمكنني مساعدتك؟` : 'كيف يمكنني مساعدتك؟'}
            </h2>
            <p className="or-empty-sub">
              {currentUser
                ? 'ابدأ بكتابة سؤالك أو اختر من الاقتراحات أدناه'
                : 'سجّل دخولك لبدء المحادثة'}
            </p>
            <div className="or-suggestions">
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button key={i} className="or-suggestion-chip" onClick={() => setInput(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`or-msg-row ${msg.role}`}>
            <div className={`or-avatar ${msg.role}`}>
              {msg.role === 'user' ? (
                currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="or-avatar-img" referrerPolicy="no-referrer" />
                ) : (
                  <User size={16} />
                )
              ) : (
                <Bot size={16} />
              )}
            </div>
            <div className="or-bubble-wrap">
              <div className={`or-bubble ${msg.role}`}>
                {typeof msg.content === 'string' ? (
                  <div className="or-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="or-multipart">
                    {msg.content.map((c, j) => (
                      <div key={j}>
                        {c.type === 'text' && <p className="or-text-part">{c.text}</p>}
                        {c.type === 'image_url' && (
                          <img src={c.image_url?.url} alt="مرفق" className="or-img-preview" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="or-timestamp">
                {msg.role === 'user' ? (currentUser?.displayName || 'أنت') : selectedModel.name} · {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="or-msg-row assistant">
            <div className="or-avatar assistant">
              <Bot size={16} />
            </div>
            <div className="or-bubble assistant or-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="or-input-area">
        {attachedImage && (
          <div className="or-img-attach">
            <img src={attachedImage} alt="معاينة" />
            <button className="or-img-remove" onClick={() => setAttachedImage(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {error && (
          <div className="or-error-bar">
            <AlertCircle size={14} />
            <span>{error}</span>
            <button onClick={() => setError(null)}><X size={12} /></button>
          </div>
        )}

        <div className="or-input-row">
          <div className="or-textarea-wrap">
            {dataset && (
              <div className="or-ds-badge" title="هناك ملف بيانات مرفوع يمكن الاستفسار عنه" onClick={(e) => { e.preventDefault(); }}>
                <FileUp size={11} />
                <span>{dataset.filename}</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={currentUser ? 'اكتب رسالتك هنا...' : 'سجّل دخولك أولاً لبدء المحادثة...'}
              className={`or-textarea ${dataset ? 'has-ds' : ''}`}
              style={{ height: textareaHeight }}
            />
            <div className="or-attach-actions">
              <button
                className={`or-img-btn ${attachedImage ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                title="إرفاق صورة"
                disabled={!selectedModel.vision}
              >
                <ImageIcon size={18} />
              </button>
              <button
                className="or-img-btn doc-btn"
                onClick={() => docInputRef.current?.click()}
                title="إرفاق ملف بيانات"
              >
                <FileUp size={18} />
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <input type="file" ref={docInputRef} onChange={handleDocUpload} accept=".csv,.xlsx,.xls,.json" className="hidden" />
          </div>

          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !attachedImage)}
            className="or-send-btn"
          >
            {loading ? <Loader2 size={24} className="spin" /> : <ArrowUp size={24} className="send-icon" strokeWidth={2.5} />}
          </button>
        </div>

        <div className="or-footer-bar">
          <p className="or-hint">Enter للإرسال · Shift+Enter للسطر الجديد</p>
          <button onClick={() => { setMessages([]); setError(null); }} className="or-clear-btn">
            <Trash2 size={11} /> مسح المحادثة
          </button>
        </div>
      </div>

      <style>{`
        .or-chat-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          position: relative;
          background: #020617;
          overflow: hidden;
          font-family: 'Tajawal', 'Inter', sans-serif;
        }

        .or-ambient-glow {
          position: absolute;
          top: -150px;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, rgba(16,185,129,0.1) 40%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Header */
        .or-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: rgba(15,23,42,0.8);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(20px);
          z-index: 10;
          flex-shrink: 0;
          gap: 12px;
        }

        .or-header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .or-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .or-brand-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
          flex-shrink: 0;
        }

        .or-brand-title {
          font-size: 15px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.3px;
          margin: 0;
        }

        .or-brand-sub {
          font-size: 11px;
          color: #64748b;
          margin: 0;
          font-weight: 500;
        }

        /* User Profile */
        .or-user-profile {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px 6px 6px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 12px;
          transition: all 0.2s;
        }

        .or-user-avatar {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          object-fit: cover;
          border: 2px solid rgba(16,185,129,0.3);
        }

        .or-user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .or-user-name {
          font-size: 12px;
          font-weight: 600;
          color: #e2e8f0;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .or-user-status {
          font-size: 9px;
          color: #34d399;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .or-user-status::before {
          content: '';
          width: 5px;
          height: 5px;
          background: #34d399;
          border-radius: 50%;
          display: inline-block;
        }

        .or-signout-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.15);
          color: #f87171;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .or-signout-btn:hover {
          background: rgba(239,68,68,0.2);
          border-color: rgba(239,68,68,0.4);
          transform: scale(1.05);
        }

        .or-signin-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2));
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 10px;
          color: #a5b4fc;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .or-signin-btn:hover {
          background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3));
          border-color: rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }

        /* Avatar image for messages */
        .or-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          object-fit: cover;
        }

        /* Model selector */
        .or-model-selector-wrap {
          position: relative;
        }

        .or-model-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px;
          background: rgba(30,41,59,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .or-model-btn:hover {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.4);
          color: #a5b4fc;
        }

        .or-model-icon { display: flex; align-items: center; color: #818cf8; }
        .or-model-name-short { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .or-model-chevron { transition: transform 0.2s; color: #64748b; }
        .or-model-chevron.open { transform: rotate(180deg); }

        .or-model-backdrop {
          position: fixed; inset: 0; z-index: 40;
        }

        .or-model-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: auto;
          min-width: 280px;
          background: rgba(15,23,42,0.98);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 16px;
          padding: 8px;
          z-index: 50;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1);
          backdrop-filter: blur(20px);
          animation: or-dropdown-in 0.15s ease;
        }

        @keyframes or-dropdown-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .or-dropdown-label {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 4px 10px 8px;
          margin: 0;
        }

        .or-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #cbd5e1;
          transition: all 0.15s;
          text-align: right;
        }

        .or-dropdown-item:hover { background: rgba(99,102,241,0.1); color: #e2e8f0; }
        .or-dropdown-item.active { background: rgba(99,102,241,0.2); color: #a5b4fc; }

        .or-di-icon { color: #818cf8; flex-shrink: 0; display: flex; }
        .or-di-info { flex: 1; display: flex; flex-direction: column; align-items: flex-start; }
        .or-di-name { font-size: 13px; font-weight: 600; }
        .or-di-desc { font-size: 10px; color: #64748b; }
        .or-di-badge {
          font-size: 9px; font-weight: 700;
          padding: 2px 7px;
          background: rgba(16,185,129,0.15);
          color: #34d399;
          border-radius: 99px;
          border: 1px solid rgba(16,185,129,0.2);
        }
        .or-vision-dot {
          width: 7px; height: 7px;
          background: #818cf8;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Messages */
        .or-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 20px;
          scroll-behavior: smooth;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 0;
        }

        .or-messages::-webkit-scrollbar { width: 4px; }
        .or-messages::-webkit-scrollbar-track { background: transparent; }
        .or-messages::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 99px; }

        /* Empty state */
        .or-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
          padding: 40px 20px;
          gap: 12px;
          animation: or-fade-in 0.5s ease;
        }

        @keyframes or-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .or-empty-icon {
          width: 80px; height: 80px;
          background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(16,185,129,0.25));
          border: 1px solid rgba(99,102,241,0.4);
          border-radius: 24px;
          display: flex; align-items: center; justify-content: center;
          color: #a5b4fc;
          margin-bottom: 8px;
          box-shadow: 0 10px 40px rgba(99,102,241,0.2);
          animation: or-float 3s ease-in-out infinite;
        }

        @keyframes or-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .or-empty-title {
          font-size: 24px; font-weight: 800; color: #f8fafc; margin: 0;
          letter-spacing: -0.5px;
        }

        .or-empty-sub {
          font-size: 14px; color: #94a3b8; margin: 0;
        }

        .or-suggestions {
          display: flex; flex-wrap: wrap; gap: 8px;
          justify-content: center;
          margin-top: 8px;
        }

        .or-suggestion-chip {
          padding: 8px 16px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 99px;
          color: #a5b4fc;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .or-suggestion-chip:hover {
          background: rgba(99,102,241,0.2);
          border-color: rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }

        /* Message rows */
        .or-msg-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          animation: or-msg-in 0.25s ease;
        }

        @keyframes or-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .or-msg-row.user { flex-direction: row; }
        .or-msg-row.assistant { flex-direction: row-reverse; }

        .or-avatar {
          width: 34px; height: 34px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        .or-avatar.user { background: rgba(99,102,241,0.15); color: #818cf8; }
        .or-avatar.assistant { background: rgba(16,185,129,0.15); color: #34d399; }

        .or-bubble-wrap {
          display: flex; flex-direction: column; max-width: 80%; gap: 4px;
        }

        .or-msg-row.user .or-bubble-wrap { align-items: flex-start; }
        .or-msg-row.assistant .or-bubble-wrap { align-items: flex-end; }

        .or-bubble {
          padding: 14px 20px;
          border-radius: 20px;
          font-size: 14px;
          line-height: 1.7;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .or-bubble.user {
          background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95));
          border: 1px solid rgba(255,255,255,0.08);
          color: #f8fafc;
          border-bottom-right-radius: 6px;
        }

        .or-bubble.assistant {
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.1));
          border: 1px solid rgba(99,102,241,0.2);
          color: #f1f5f9;
          border-bottom-left-radius: 6px;
          backdrop-filter: blur(10px);
        }

        .or-markdown { color: #cbd5e1; }
        .or-markdown p { margin: 0 0 8px; }
        .or-markdown p:last-child { margin-bottom: 0; }
        .or-markdown pre { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; overflow-x: auto; font-size: 12px; }
        .or-markdown code { background: rgba(99,102,241,0.15); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
        .or-markdown pre code { background: none; padding: 0; }
        .or-markdown h1, .or-markdown h2, .or-markdown h3 { color: #e2e8f0; margin-top: 12px; }
        .or-markdown ul, .or-markdown ol { padding-right: 20px; }
        .or-markdown li { margin-bottom: 4px; }
        .or-markdown table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .or-markdown th, .or-markdown td { border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; }
        .or-markdown blockquote { border-right: 3px solid #6366f1; padding-right: 12px; color: #94a3b8; margin: 8px 0; }

        .or-text-part { font-size: 14px; line-height: 1.7; margin: 0; }
        .or-img-preview { border-radius: 12px; max-height: 220px; width: auto; border: 1px solid rgba(255,255,255,0.08); margin-top: 8px; }

        .or-timestamp {
          font-size: 10px;
          color: #475569;
          font-weight: 500;
          direction: ltr;
        }

        /* Typing dots */
        .or-typing {
          display: flex; gap: 5px; align-items: center; padding: 16px 20px;
          min-width: 70px;
        }

        .or-typing span {
          width: 7px; height: 7px;
          background: #6366f1;
          border-radius: 50%;
          animation: or-bounce 1.2s infinite;
        }
        .or-typing span:nth-child(2) { animation-delay: 0.2s; background: #8b5cf6; }
        .or-typing span:nth-child(3) { animation-delay: 0.4s; background: #a78bfa; }

        @keyframes or-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        /* Input area */
        .or-input-area {
          padding: 16px 20px;
          background: rgba(15,23,42,0.85);
          border-top: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          flex-shrink: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .or-img-attach {
          display: inline-flex;
          position: relative;
          align-self: flex-start;
        }

        .or-img-attach img {
          height: 72px; width: auto;
          border-radius: 12px;
          border: 1px solid rgba(99,102,241,0.3);
          object-fit: cover;
        }

        .or-img-remove {
          position: absolute; top: -6px; right: -6px;
          width: 20px; height: 20px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          border: none;
          transition: transform 0.2s;
        }

        .or-img-remove:hover { transform: scale(1.1); }

        .or-error-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 13px;
        }

        .or-error-bar span { flex: 1; }
        .or-error-bar button { background: none; border: none; color: #f87171; cursor: pointer; display: flex; }

        .or-input-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }

        .or-textarea-wrap {
          flex: 1;
          position: relative;
        }

        .or-textarea {
          width: 100%;
          box-sizing: border-box;
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          color: #f8fafc;
          font-size: 15px;
          padding: 16px 86px 16px 20px;
          outline: none;
          resize: none;
          line-height: 1.6;
          min-height: 56px;
          max-height: 160px;
          overflow-y: auto;
          transition: all 0.3s ease;
          font-family: inherit;
          direction: rtl;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .or-textarea.has-ds {
          padding-top: 36px;
        }

        .or-ds-badge {
          position: absolute;
          top: 10px;
          right: 20px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(16,185,129,0.15);
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 6px;
          color: #34d399;
          font-size: 11px;
          font-weight: 600;
          z-index: 1;
        }

        .or-ds-badge span {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .or-textarea::placeholder { color: #64748b; }
        .or-textarea:focus { border-color: rgba(99,102,241,0.6); background: rgba(15,23,42,0.8); box-shadow: 0 0 0 4px rgba(99,102,241,0.1), inset 0 2px 4px rgba(0,0,0,0.1); }
        .or-textarea::-webkit-scrollbar { width: 3px; }
        .or-textarea::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 99px; }

        .or-attach-actions {
          position: absolute;
          right: 12px; bottom: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .or-img-btn {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; cursor: pointer;
          color: #64748b;
          border-radius: 10px;
          transition: all 0.2s;
        }

        .or-img-btn:hover:not(:disabled) { color: #818cf8; background: rgba(99,102,241,0.15); transform: scale(1.05); }
        .or-img-btn.doc-btn:hover { color: #10b981; background: rgba(16,185,129,0.15); }
        .or-img-btn.active { color: #818cf8; background: rgba(99,102,241,0.1); }
        .or-img-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .or-send-btn {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899);
          background-size: 200% 200%;
          border: none;
          border-radius: 18px;
          color: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 8px 25px rgba(99,102,241,0.4);
          flex-shrink: 0;
          animation: or-gradient-shift 3s ease infinite;
        }

        @keyframes or-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .or-send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.5);
        }

        .or-send-btn:active:not(:disabled) { transform: translateY(0) scale(0.96); }
        .or-send-btn:disabled { background: rgba(30,41,59,0.8); box-shadow: none; opacity: 0.5; cursor: not-allowed; }

        .send-icon { transform: rotate(0); }
        .spin { animation: or-spin 0.8s linear infinite; }

        @keyframes or-spin { to { transform: rotate(360deg); } }

        .or-footer-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 2px;
        }

        .or-hint { font-size: 10px; color: #334155; margin: 0; font-weight: 500; }
        .or-clear-btn {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; color: #ef4444; opacity: 0.5;
          background: none; border: none; cursor: pointer;
          transition: opacity 0.2s;
          font-family: inherit;
        }
        .or-clear-btn:hover { opacity: 1; }

        .hidden { display: none; }

        @media (max-width: 640px) {
          .or-header { padding: 10px 14px; flex-wrap: wrap; gap: 8px; }
          .or-header-actions { gap: 6px; }
          .or-user-info { display: none; }
          .or-user-profile { padding: 4px; gap: 4px; }
          .or-model-name-short { max-width: 80px; }
          .or-brand-title { font-size: 13px; }
          .or-brand-sub { font-size: 10px; }
        }
      `}</style>
    </div>
  );
};
