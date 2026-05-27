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
import './openrouter-chat.css';

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
    description: 'Fast & free + image vision',
    vision: true,
    icon: <Zap size={14} />,
    badge: 'Free'
  },
];

const SUGGESTED_PROMPTS = [
  'Explain the concept of AI to me',
  'Help me analyze my data',
  'Write me a Python script',
  'Summarize this topic for me',
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

  const DEFAULT_KEY = import.meta.env.VITE_OPENROUTER_KEY || '';
  const NEMOTRON_KEY = import.meta.env.VITE_OPENROUTER_KEY || '';
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
    try { await signOut(auth); setMessages([]); } catch { setError('Failed to sign out.'); }
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
        { type: 'text', text: input.trim() || 'Analyze this image.' },
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
      let systemPrompt = `You are Kimit AI, the Ultimate Master Architect. You possess over 100 professional skills across 5 core domains:

1. System Architecture: Expert in designing systems, APIs, and cloud technologies.
2. Data Science: Professional in data analysis, cleaning, statistical modeling, and forecasting.
3. UI/UX Strategy: Specialist in professional user interfaces and premium user experiences.
4. Strategic Planning: Expert in product management and technical debt using Agile methodology.
5. Problem Solving: Practitioner of First Principles thinking and root cause analysis.

You always communicate in a professional, authoritative, and friendly manner.

Your technical capabilities for direct data edits:
When the user requests data modifications (delete column, rename, fill missing values, add calculated column, filter, sort, replace values), respond with ONLY a JSON object in the following format and no additional text:
{
  "action": "edit",
  "type": "delete_column" | "rename_column" | "fill_nulls" | "apply_formula" | "add_column" | "filter_rows" | "sort" | "replace_value",
  "target": "<column name or row condition>",
  "value": "<new value, formula, or operation>",
  "description": "<one sentence describing what was done>"
}

If the user's request is a question or analysis (not an edit), respond naturally in text using your full skill set.
If the request requires complex JavaScript code, place the code inside \`\`\`javascript ... \`\`\` and make sure it returns (return) the modified array.`;

      if (dataset) {
        const sampleData = dataset.workData.slice(0, 3);
        systemPrompt += `\n\nCurrent Data Context:\n` +
          `File name: ${dataset.filename}\n` +
          `Rows: ${dataset.rows} | Columns: ${dataset.columns.length}\n` +
          `Column list: ${dataset.columns.map(c => `${c.name} (${c.type})`).join(', ')}\n` +
          `Data sample:\n` +
          `${JSON.stringify(sampleData, null, 2)}\n\n` +
          `⚠️ Important Note: If the user requests a very complex modification, or column names are distorted (e.g. __EMPTY) but the user refers to a real name visible in the sample, **do NOT use the quick JSON format**. Instead, write JavaScript code inside \`\`\`javascript ... \`\`\` that receives the \`data\` array, analyzes the problem, accurately applies the modification, and \`return\`s the new array.`;
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
      if (!response.ok) throw new Error(data.error?.message || 'Failed to connect to OpenRouter');

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
            aiContent = editAction.description + "\n\n*(Dataset updated successfully based on your request ✨)*";
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
              aiContent += "\n\n*(Dataset updated successfully based on your request ✨)*";
            } catch (err) {
              console.error("AI Error:", err);
              aiContent += "\n\n*(An error occurred while applying the edit)*";
            }
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent, timestamp: new Date() }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const clearChat = () => {
    if (window.confirm('Clear chat history?')) {
      setMessages([]);
    }
  };

  if (!authChecked) {
    return (
      <div className="or-chat-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: '#818cf8' }} />
      </div>
    );
  }

  return (
    <div className="or-chat-root" dir="ltr">
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
                <span className="or-user-status">Online</span>
              </div>
              <button className="or-signout-btn" onClick={handleSignOut}><LogOut size={14} /></button>
            </div>
          ) : (
            <button className="or-signin-btn" onClick={() => setShowAuthModal(true)}><User size={14} /> Sign In</button>
          )}
        </div>
      </div>

      <div className="or-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="or-empty-state">
            <div className="or-empty-icon"><Bot size={36} /></div>
            <h2 className="or-empty-title">How can I help you?</h2>
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
              <div className="ms-3 text-xs text-emerald-400 font-bold">Working...</div>
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
                placeholder="Ask for analysis or data editing..." 
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
    </div>
  );
};
