import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Image as ImageIcon, X, Trash2, ChevronDown, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Interface Definitions
 */
interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

interface ModelConfig {
  id: string;
  name: string;
  vision: boolean;
}

const MODELS: ModelConfig[] = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free + Vision)', vision: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', vision: false },
  { id: 'google/gemma-3-27b:free', name: 'Gemma 3 27B (Free + Vision)', vision: true },
  { id: 'qwen/qwen-3-coder-480b:free', name: 'Qwen 3 Coder 480B (Free Coding)', vision: false },
  { id: 'openrouter/auto', name: 'Auto Selection', vision: true },
];

export const OpenRouterChat: React.FC = () => {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Key from Environment
  const API_KEY = import.meta.env.VITE_OPENROUTER_KEY || '';

  /**
   * Auto-scroll to bottom
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  /**
   * Convert Image to Base64
   */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage(event.target?.result as string);
      setError(null);
    };
    reader.onerror = () => setError('Failed to read image file.');
    reader.readAsDataURL(file);
  };

  /**
   * Send Message to OpenRouter
   */
  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || loading) return;
    if (!API_KEY) {
      setError('OpenRouter API Key is missing. Please check your .env file.');
      return;
    }

    setLoading(true);
    setError(null);

    // Build Payload Content
    let userContent: string | MessageContent[];
    if (attachedImage && selectedModel.vision) {
      userContent = [
        { type: 'text', text: input.trim() || 'Analyze this image.' },
        { type: 'image_url', image_url: { url: attachedImage } }
      ];
    } else {
      userContent = input.trim();
    }

    const newUserMsg: ChatMessage = { role: 'user', content: userContent };
    const updatedMessages = [...messages, newUserMsg];
    
    setMessages(updatedMessages);
    setInput('');
    setAttachedImage(null);

    try {
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
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch response from OpenRouter');
      }

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: data.choices[0].message.content,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      // Remove the last user message if failed? 
      // Or keep it and let user retry.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b1120] text-slate-200 font-sans border border-white/10 rounded-2xl overflow-hidden shadow-2xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#1e293b]/50 border-bottom border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white">شات الذكاء الاصطناعي الاحترافي</h3>
            <p className="text-[10px] text-slate-400 font-medium">مدعوم بواسطة OpenRouter</p>
          </div>
        </div>

        {/* Model Selector */}
        <div className="relative group">
          <select 
            value={selectedModel.id}
            onChange={(e) => setSelectedModel(MODELS.find(m => m.id === e.target.value) || MODELS[0])}
            className="appearance-none bg-[#0f172a] border border-white/10 text-xs py-2 px-4 pr-8 rounded-lg outline-none cursor-pointer hover:border-indigo-500/50 transition-all focus:ring-2 focus:ring-indigo-500/20"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <Sparkles size={40} className="text-indigo-400 animate-pulse" />
            <p className="text-sm font-medium">ابدأ الآن.. اسأل أي شيء أو ارفع صورة لتحليلها</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`p-2 rounded-xl flex-shrink-0 h-fit ${msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-start' : 'items-end'}`}>
              <div className={`p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-[#1e293b] border border-white/5 text-slate-100' 
                  : 'bg-[#16213e] border border-indigo-500/10 text-slate-200'
              }`}>
                {/* Content Rendering */}
                {typeof msg.content === 'string' ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5 rtl text-right">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {msg.content.map((c, j) => (
                      <div key={j}>
                        {c.type === 'text' && <p className="text-sm leading-relaxed">{c.text}</p>}
                        {c.type === 'image_url' && (
                          <img src={c.image_url?.url} alt="Uploaded" className="rounded-lg max-h-60 w-auto border border-white/10" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] mt-1 text-slate-500 font-mono tracking-tighter">
                {msg.role === 'user' ? 'أنت' : 'الروبوت'}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4 flex-row-reverse">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 h-fit animate-pulse">
              <Bot size={18} />
            </div>
            <div className="p-4 bg-[#16213e] rounded-2xl border border-indigo-500/10">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Input Area */}
      <div className="p-4 bg-[#1e293b]/30 border-t border-white/5 backdrop-blur-md">
        {/* Attachment Preview */}
        {attachedImage && (
          <div className="relative inline-block mb-3 p-1 bg-white/5 rounded-xl border border-white/10 group">
            <img src={attachedImage} alt="Preview" className="h-20 w-auto rounded-lg object-cover" />
            <button 
              onClick={() => setAttachedImage(null)}
              className="absolute -top-2 -left-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="اكتب رسالتك هنا..."
              className="w-full bg-[#0f172a] border border-white/10 text-slate-100 text-sm py-4 px-5 pr-12 rounded-2xl outline-none resize-none focus:border-indigo-500/50 transition-all placeholder:text-slate-500 scrollbar-none"
              style={{ minHeight: '52px', maxHeight: '150px' }}
            />
            
            {/* Image Upload Trigger */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`absolute left-3 bottom-2.5 p-2 rounded-lg transition-colors ${attachedImage ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <button 
            onClick={handleSend}
            disabled={loading || (!input.trim() && !attachedImage)}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:opacity-50 text-white p-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="rotate-180" />}
          </button>
        </div>
        
        <div className="mt-3 flex justify-between items-center px-1">
          <p className="text-[9px] text-slate-500 font-medium">Enter للإرسال • Shift+Enter للسطر الجديد</p>
          <button onClick={() => setMessages([])} className="text-[9px] text-rose-500/60 hover:text-rose-500 transition-colors flex items-center gap-1">
            <Trash2 size={10} /> مسح المحادثة
          </button>
        </div>
      </div>
    </div>
  );
};
