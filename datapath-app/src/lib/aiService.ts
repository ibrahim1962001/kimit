import type { DatasetInfo, Lang } from '../types';

// Set this via environment or UI rather than hardcoding a real key.
const LLAMA_API_KEY = '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';

export interface ChatParams {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  apiKey?: string;
  dataset: DatasetInfo | null;
  lang: Lang;
  aiModel?: 'llama' | 'nemotron'; // Added to allow choosing the model
}

export async function askAI(params: ChatParams): Promise<string> {
  const { question, history, apiKey, dataset, lang } = params;
  
  // Exclusively using Gemini 2.0 Flash via OpenRouter
  const activeApiKey = apiKey || LLAMA_API_KEY; // Reusing LLAMA_API_KEY as the default OpenRouter key
  const targetModelStr = 'google/gemini-2.0-flash-001';

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

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Kimit AI Studio',
    },
    body: JSON.stringify({
      model: targetModelStr,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(lang === 'ar' ? 'مفتاح API غير صحيح أو مفقود. يرجى التحقق من الإعدادات.' : 'Invalid or missing API Key. Please check settings.');
    } else if (response.status === 429) {
      throw new Error(lang === 'ar' ? 'تم تجاوز الحد المسموح للطلبات. يرجى المحاولة لاحقاً.' : 'Rate limit exceeded. Please try again later.');
    } else if (response.status >= 500) {
      throw new Error(lang === 'ar' ? 'مشكلة في خوادم الذكاء الاصطناعي. يرجى المحاولة لاحقاً.' : 'AI server issue. Please try again later.');
    } else {
      throw new Error(lang === 'ar' ? 'حدث خطأ غير متوقع في معالجة طلبك.' : 'An unexpected error occurred while processing your request.');
    }
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

export async function generateExecutiveSummary(dataset: DatasetInfo, apiKey: string | undefined, lang: Lang): Promise<import('../types').SummaryReport> {
  const numCols = dataset.columns.filter(c => c.type === 'numeric').map(c => c.name).join(', ');
  const txtCols = dataset.columns.filter(c => c.type === 'text').map(c => c.name).join(', ');
  
  const colStats = dataset.columns.map(c => 
    `${c.name}: Nulls=${c.nullCount}, Unique=${c.uniqueCount}` + 
    (c.type === 'numeric' && c.mean ? `, Mean=${c.mean?.toFixed(2)}` : '')
  ).join(' | ');

  const sample = JSON.stringify(dataset.workData.slice(0, 3));

  const prompt = `You are an expert data analyst and economic specialist in operational and commercial data analysis.

You have the following data:
- Number of rows: ${dataset.rows}
- Numeric columns: ${numCols}
- Text columns: ${txtCols}
- Column statistics: ${colStats}
- Data sample: ${sample}

Analyze this data and produce a structured report containing:

1. Executive Summary — Two sentences about the nature of the data and what it represents
2. Top 5 Insights — Notable numbers and patterns with their economic interpretation
3. Warnings & Anomalies — Outliers, unusual concentrations, suspicious data points
4. Data Quality Issues — Missing values, duplicates, columns that need cleaning
5. Actionable Recommendations — 3 specific actions the user can take right now to improve the data or boost performance
6. Suggested Analysis Opportunities — Additional analyses that could deliver high value from this data

Write in ${lang === 'ar' ? 'Arabic' : 'English'}. Be precise and actionable. Do not write generic statements — every point must be based on actual numbers from the data.
You MUST respond with ONLY valid JSON in the following exact format:
{
  "executiveSummary": "...",
  "insights": ["...", "..."],
  "warnings": ["...", "..."],
  "qualityIssues": ["...", "..."],
  "recommendations": ["...", "..."],
  "opportunities": ["...", "..."]
}`;

  try {
    const activeApiKey = apiKey || import.meta.env.VITE_OPENROUTER_KEY || import.meta.env.VITE_GROQ_API_KEY;
    if (!activeApiKey) throw new Error("No API Key");

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Kimit AI Studio',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error('API Error');

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    // Remove markdown code blocks if present
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    return {
      isLocal: false,
      executiveSummary: parsed.executiveSummary || 'No summary generated.',
      insights: parsed.insights || [],
      warnings: parsed.warnings || [],
      qualityIssues: parsed.qualityIssues || [],
      recommendations: parsed.recommendations || [],
      opportunities: parsed.opportunities || []
    };
  } catch (err) {
    console.warn('AI Summary failed, falling back to local JS analysis:', err);
    return generateLocalSummary(dataset, lang);
  }
}

function generateLocalSummary(dataset: DatasetInfo, lang: Lang): import('../types').SummaryReport {
  const isAr = lang === 'ar';
  
  // 1. Executive Summary
  const executiveSummary = isAr 
    ? `تم تحليل مجموعة بيانات تحتوي على ${dataset.rows} سجل و${dataset.columns.length} عمود. البيانات تحتوي على مزيج من المتغيرات الرقمية والنصية.` 
    : `Analyzed a dataset with ${dataset.rows} records and ${dataset.columns.length} columns. The data contains a mix of numeric and text variables.`;

  // 2. Insights
  const insights: string[] = [];
  const numericCols = dataset.columns.filter(c => c.type === 'numeric');
  numericCols.forEach(c => {
    if (c.mean !== undefined && c.max !== undefined) {
      insights.push(isAr 
        ? `العمود "${c.name}" له متوسط ${c.mean.toFixed(2)} وأعلى قيمة تصل إلى ${c.max.toFixed(2)}.` 
        : `Column "${c.name}" has an average of ${c.mean.toFixed(2)} with a maximum value of ${c.max.toFixed(2)}.`);
    }
  });
  if (insights.length === 0) insights.push(isAr ? 'لا توجد بيانات رقمية كافية لاستخراج رؤى.' : 'Not enough numeric data to extract insights.');

  // 3. Warnings (Outliers > 3 std dev)
  const warnings: string[] = [];
  if (dataset.anomalies && dataset.anomalies.length > 0) {
    dataset.anomalies.forEach(a => {
      warnings.push(`${a.column}: ${a.description}`);
    });
  } else {
    warnings.push(isAr ? 'لم يتم اكتشاف قيم شاذة بشكل واضح.' : 'No clear anomalies detected.');
  }

  // 4. Quality Issues
  const qualityIssues: string[] = [];
  if (dataset.duplicates > 0) {
    qualityIssues.push(isAr ? `يوجد ${dataset.duplicates} سجل مكرر.` : `Found ${dataset.duplicates} duplicate records.`);
  }
  dataset.columns.forEach(c => {
    if (c.nullCount > 0) {
      const pct = ((c.nullCount / dataset.rows) * 100).toFixed(1);
      qualityIssues.push(isAr ? `العمود "${c.name}" يفقد ${c.nullCount} قيمة (${pct}%).` : `Column "${c.name}" is missing ${c.nullCount} values (${pct}%).`);
    }
  });
  if (qualityIssues.length === 0) qualityIssues.push(isAr ? 'البيانات تبدو نظيفة وخالية من المشاكل الواضحة.' : 'Data appears clean with no obvious issues.');

  // 5. Recommendations
  const recommendations: string[] = [];
  if (dataset.duplicates > 0) recommendations.push(isAr ? 'إزالة السجلات المكررة لتحسين دقة التحليل.' : 'Remove duplicate records to improve analysis accuracy.');
  if (dataset.totalNulls > 0) recommendations.push(isAr ? 'معالجة القيم المفقودة (إما بالحذف أو التعويض بالمتوسط).' : 'Handle missing values (either delete or impute with mean).');
  recommendations.push(isAr ? 'استكشاف العلاقات (Correlations) بين المتغيرات الرقمية.' : 'Explore correlations between numeric variables.');

  // 6. Opportunities
  const opportunities = isAr 
    ? ['تحليل السلاسل الزمنية إذا كان هناك عمود للتاريخ.', 'تجميع البيانات (Clustering) لاكتشاف أنماط مخفية.']
    : ['Time series analysis if a date column exists.', 'Data clustering to discover hidden patterns.'];

  return {
    isLocal: true,
    executiveSummary,
    insights: insights.slice(0, 5),
    warnings: warnings.slice(0, 5),
    qualityIssues: qualityIssues.slice(0, 5),
    recommendations,
    opportunities
  };
}

export function speakText(text: string, lang: Lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[#*]/g, ''));
  utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
