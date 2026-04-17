import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Mic, MicOff, Plus, X } from 'lucide-react';
import { askAI } from '../lib/aiService';
import type { ChatMessage, DatasetInfo, Lang } from '../types';

const T = {
  ar: {
    placeholder: 'اسأل عن أي شيء في بياناتك...',
    send: 'إرسال',
    thinking: 'جاري التفكير...',
    apply: 'تنفيذ اقتراح الـ AI',
    applied: 'تم تنفيذ التعديل بنجاح!',
    noKey: 'يرجى إدخال مفتاح Groq API للبدء في المحادثة.',
    newChat: 'محادثة',
    blankChat: 'محادثة فارغة'
  },
  en: {
    placeholder: 'Ask anything about your data...',
    send: 'Send',
    thinking: 'Thinking...',
    apply: 'Apply AI Suggestion',
    applied: 'Adjustment applied successfully!',
    noKey: 'Please enter Groq API key to start chatting.',
    newChat: 'Chat',
    blankChat: 'Blank Chat'
  }
};

interface Props {
  lang: Lang;
  dataset: DatasetInfo | null;
  apiKey: string;
  onApplyAction: (action: string) => void;
}

interface ChatSession {
  id: string;
  title: string;
  filename: string;
  messages: ChatMessage[];
}

export const ChatPanel: React.FC<Props> = ({ lang, dataset, apiKey, onApplyAction }) => {
  const t = T[lang];

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const savedSessions = localStorage.getItem('datapath_chat_sessions');
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      return parsed.map((s: Record<string, unknown>) => ({
        ...s,
        messages: (s.messages as Record<string, unknown>[]).map((m) => ({ ...m, timestamp: new Date(m.timestamp as string) }))
      }));
    }
    // Migrate old history
    const oldSaved = localStorage.getItem('datapath_chat_history');
    if (oldSaved) {
       const oldMsg = JSON.parse(oldSaved).map((m: Record<string, unknown>) => ({ ...m, timestamp: new Date(m.timestamp as string) }));
       if (oldMsg.length > 0) return [{ id: Date.now().toString(), title: 'محادثة سابقة', filename: '', messages: oldMsg as ChatMessage[] }];
    }
    return [];
  });

  const [activeId, setActiveId] = useState<string>('');
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Safely Auto-Create Session when a brand new file is uploaded
  useEffect(() => {
    if (dataset) {
       setSessions(prev => {
          if (prev.length === 0) {
             const id = Date.now().toString();
             setTimeout(() => setActiveId(id), 0);
             return [{ id, title: dataset.filename.slice(0, 10) + '...', filename: dataset.filename, messages: [] }];
          }
          const exists = prev.some(s => s.filename === dataset.filename);
          if (!exists) {
             const id = Date.now().toString();
             setTimeout(() => setActiveId(id), 0);
             return [{ id, title: dataset.filename.slice(0, 10) + '...', filename: dataset.filename, messages: [] }, ...prev];
          }
          return prev;
       });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.filename]);

  // Default fallback for activeId
  useEffect(() => {
    if (!activeId && sessions.length > 0) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId]);

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem('datapath_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Auto Scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeId, loading]);

  const activeSession = sessions.find(s => s.id === activeId);
  const messages = activeSession?.messages || [];

  const setMessages = (setter: (prev: ChatMessage[]) => ChatMessage[]) => {
     setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: setter(s.messages) } : s));
  };


  const startListening = () => {
    // @ts-expect-error window globals
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'ar' ? 'عذراً، متصفحك لا يدعم خاصية الصوت' : 'Speech recognition not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: { results: { transcript: string }[][] }) => {
      setInput(prev => prev + ' ' + e.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const handleSend = async (q?: string) => {
    const text = (q || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askAI({
        question: text,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        apiKey,
        dataset,
        lang
      });

      let action: string | undefined;
      if (text.toLowerCase().includes('duplicate') || text.includes('تكرار')) action = 'clean';
      
      setMessages(prev => [...prev, { role: 'assistant', content: res, timestamp: new Date(), action }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (action: string) => {
    onApplyAction(action);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: lang === 'ar' ? '✅ اكتمل! قمت بتنفيذ طلبك وتحديث البيانات بنجاح.' : '✅ Done! I have applied your request and updated the data successfully.',
      timestamp: new Date()
    }]);
  };

  return (
    <div className="chat-panel">
      {/* SESSIONS TABS */}
      <div className="chat-sessions-bar" style={{ display: 'flex', gap: 8, padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <button className="btn-primary" onClick={() => {
            const newId = Date.now().toString();
            setSessions(prev => [{ id: newId, title: `${t.newChat} ${prev.length + 1}`, filename: dataset?.filename || '', messages: [] }, ...prev]);
            setActiveId(newId);
        }} style={{ padding: '6px 12px', fontSize: 13, background: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Plus size={14} /> {lang === 'ar' ? 'جديدة' : 'New'}
        </button>
        {sessions.map(s => (
          <div key={s.id} onClick={() => setActiveId(s.id)} 
               style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: activeId === s.id ? '#10b981' : 'var(--card)', color: '#fff', borderRadius: 20, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', opacity: activeId === s.id ? 1 : 0.7, flexShrink: 0 }}>
             {s.title}
             <X size={14} onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); }} style={{ cursor: 'pointer', opacity: 0.5 }} />
          </div>
        ))}
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.role}`}>
            <div className={`msg-avatar ${m.role}`}>
              {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className={`msg-bubble ${m.role}`}>
              <div className="msg-text">{m.content}</div>
              {m.action && (
                <button className="btn-primary" style={{ marginTop: 10, fontSize: 12, padding: '6px 12px' }} onClick={() => handleApply(m.action!)}>
                  <Sparkles size={14} style={{ marginLeft: 6 }} />
                  {t.apply}
                </button>
              )}
              <span className="msg-time">{m.timestamp.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-row assistant">
            <div className="msg-avatar ai"><Bot size={18} /></div>
            <div className="msg-bubble assistant thinking">
              <div className="thinking-dots"><span></span><span></span><span></span></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-form">
        <button className={`chat-mic-btn ${isListening ? 'listening' : ''}`} onClick={startListening} title="التحدث بالصوت">
          {isListening ? <MicOff size={20} color="#ef4444" /> : <Mic size={20} />}
        </button>
        <input 
          className="chat-input" placeholder={isListening ? 'جاري الاستماع...' : t.placeholder} value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="chat-send-btn" onClick={() => handleSend()} disabled={loading}>
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
