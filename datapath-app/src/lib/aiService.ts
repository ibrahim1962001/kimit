import type { DatasetInfo, Lang } from '../types';

// Set this via environment or UI rather than hardcoding a real key.
const DEFAULT_GROQ_API_KEY = '';

export interface ChatParams {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  apiKey?: string;
  dataset: DatasetInfo | null;
  lang: Lang;
}

export async function askAI(params: ChatParams): Promise<string> {
  const { question, history, apiKey, dataset, lang } = params;
  const activeApiKey = apiKey || DEFAULT_GROQ_API_KEY;

  const systemPrompt = `
You are DataPath AI, a premium world-class Data Analyst and General AI Assistant.
User's Language: ${lang === 'ar' ? 'Arabic' : 'English'}.

${dataset ? `CURRENT DATASET CONTEXT:
- Filename: ${dataset.filename}
- Rows: ${dataset.rows} | Columns: ${dataset.columns.length}
- Duplicates: ${dataset.duplicates} | Total Missing: ${dataset.totalNulls}
- Columns List: ${dataset.columns.map(c => `${c.name} (${c.type})`).join(', ')}` : 'No dataset uploaded.'}

RULES:
1. GENERAL KNOWLEDGE: You are NOT restricted to the dataset. Answer any general question (history, science, coding, life advice) with high quality.
2. DATA ANALYSIS: When asked about the data, be precise.
3. DATA ACTIONS: If the user asks to "remove duplicates" or "clean data" or "fix nulls", explain what you found AND state clearly that you can perform this action.
4. TONE: Professional, helpful, and concise. Use Markdown.
5. LANGUAGE: Always respond in the user's language (${lang === 'ar' ? 'Arabic' : 'English'}).
  `.trim();

  const messages = [
    ...history.slice(-10),
    { role: 'user' as const, content: question },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API Error ${response.status}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

export async function generateExecutiveSummary(dataset: DatasetInfo, apiKey: string | undefined, lang: Lang): Promise<string> {
  const prompt = `
    Analyze this dataset and provide a brief executive summary (max 3-4 bullet points) in ${lang === 'ar' ? 'Arabic' : 'English'}.
    Focus on:
    1. Overall data health and quality.
    2. One interesting pattern or insight from correlations/anomalies.
    3. A clear recommendation for the user.
    Dataset: ${dataset.filename}, Rows: ${dataset.rows}, Total Nulls: ${dataset.totalNulls}, Anomalies: ${dataset.anomalies.length}.
    Use bold headers for each point. Keep it professional.
  `;

  return askAI({
    question: prompt,
    history: [],
    apiKey,
    dataset,
    lang
  });
}

export function speakText(text: string, lang: Lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[#*]/g, ''));
  utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
