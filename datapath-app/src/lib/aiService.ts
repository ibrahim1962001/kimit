import type { DatasetInfo } from '../types';

// Set this via environment or UI rather than hardcoding a real key.
const LLAMA_API_KEY = import.meta.env.VITE_OPENROUTER_KEY || '';

export interface ChatParams {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  apiKey?: string;
  dataset: DatasetInfo | null;
  
  aiModel?: 'llama' | 'nemotron'; // Added to allow choosing the model
}

export async function askAI(params: ChatParams): Promise<string> {
  const { question, history, apiKey, dataset, } = params;
  
  // Exclusively using Gemini 2.0 Flash via OpenRouter
  const activeApiKey = apiKey || LLAMA_API_KEY; // Reusing LLAMA_API_KEY as the default OpenRouter key
  const targetModelStr = 'google/gemini-2.0-flash-001';

  const systemPrompt = `
You are DataPath AI, the Ultimate Master Architect. You possess over 100+ professional proficiencies across five core domains:

1. FULL-STACK & SYSTEM ARCHITECTURE: Expert in System Design, APIs (REST/GraphQL), Frontend (React/Next.js), Backend (Node.js/Python), and Cloud DevOps (GCP/Firebase).
2. PROFESSIONAL DATA ANALYSIS & SCIENCE: Master of EDA, Data Cleaning, Statistical Modeling, Machine Learning Integration, and Time-Series Forecasting.
3. UI/UX DESIGN & VISUAL STRATEGY: Specialist in Design Systems, Typography, Color Theory, and High-Performance Micro-interactions (Framer Motion).
4. STRATEGIC PLANNING & PRODUCT MANAGEMENT: Expert in Agile/Scrum, Roadmapping, Tech Debt Management, and MVP Strategy.
5. EXPERT PROBLEM SOLVING & REASONING: Practitioner of First Principles Thinking, Root Cause Analysis, and Lateral Thinking.

User's Language: English.

${dataset ? `CURRENT DATASET CONTEXT:
- Filename: ${dataset.filename}
- Rows: ${dataset.rows} | Columns: ${dataset.columns.length}
- Duplicates: ${dataset.duplicates} | Total Missing: ${dataset.totalNulls}
- Columns List: ${dataset.columns.map(c => `${c.name} (${c.type})`).join(', ')}` : 'No dataset uploaded.'}

RULES:
1. MASTER REASONING: Use First Principles Thinking and Systemic Thinking to solve complex user requests.
2. PROFESSIONAL DATA ANALYST: When analyzing data, provide deep insights, identify correlations, and suggest actionable business recommendations.
3. ARCHITECT TONE: Be professional, authoritative yet helpful, and concise. Use clean Markdown formatting.
4. CROSS-SKILL APPLICATION: If the user asks about design, coding, or strategy, apply your 100+ skills to provide the best possible solution.
5. LANGUAGE: Always respond in English.
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
      throw new Error('Invalid or missing API Key. Please check settings.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (response.status >= 500) {
      throw new Error('AI server issue. Please try again later.');
    } else {
      throw new Error('An unexpected error occurred while processing your request.');
    }
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

export async function generateExecutiveSummary(
  dataset: DatasetInfo,
  apiKey: string | undefined,
  lang: 'en' | 'ar' = 'en',
): Promise<import('../types').SummaryReport> {
  const colStats = dataset.columns.map(c => 
    `${c.name}: Nulls=${c.nullCount}, Unique=${c.uniqueCount}` + 
    (c.type === 'numeric' && c.mean ? `, Mean=${c.mean?.toFixed(2)}` : '')
  ).join(' | ');

  const sample = JSON.stringify(dataset.workData.slice(0, 3));

  const colLabels = dataset.columns
    .map((c, i) => `Column ${i + 1}${/[\u0600-\u06FF]/.test(c.name) ? '' : ` (${c.name})`}: type=${c.type}`)
    .join('\n');

  const prompt = `You are an expert data analyst and economic specialist in operational and commercial data analysis.

You have the following data:
- Number of rows: ${dataset.rows}
- Column index map (use these labels in your report — do NOT paste raw non-Latin column names):
${colLabels}
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

function fmtN(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function generateLocalSummary(
  dataset: DatasetInfo,
  lang: 'en' | 'ar' = 'en',
): import('../types').SummaryReport {
  const totalCells = dataset.rows * dataset.columns.length;
  const completeness =
    totalCells > 0 ? (100 - (dataset.totalNulls / totalCells) * 100).toFixed(1) : '100';
  const numericCols = dataset.columns.filter(c => c.type === 'numeric');
  const textCols = dataset.columns.filter(c => c.type !== 'numeric');
  const dupPct = dataset.rows > 0 ? ((dataset.duplicates / dataset.rows) * 100).toFixed(1) : '0';

  const executiveSummary =
    lang === 'ar'
      ? `يحتوي ملف "${dataset.filename}" على ${fmtN(dataset.rows)} سجلاً موزّعة على ${dataset.columns.length} بُعداً (${numericCols.length} رقمية، ${textCols.length} نصية/فئوية). اكتمال البيانات ${completeness}% مع ${fmtN(dataset.duplicates)} تكراراً (${dupPct}%). هذا التقرير يقدّم تقييماً تنفيذياً لجودة البيانات والمخاطر والفرص التحليلية الفورية.`
      : `Dataset "${dataset.filename}" contains ${fmtN(dataset.rows)} records across ${dataset.columns.length} dimensions (${numericCols.length} numeric, ${textCols.length} categorical/text). Data completeness is ${completeness}% with ${fmtN(dataset.duplicates)} duplicate rows (${dupPct}%). This report delivers an executive view of quality, risk exposure, and immediate analytical opportunities.`;

  const insights: string[] = [];
  numericCols.slice(0, 4).forEach((c, idx) => {
    const colLabel = /[\u0600-\u06FF]/.test(c.name)
      ? (lang === 'ar' ? `العمود ${idx + 1}` : `Column ${dataset.columns.indexOf(c) + 1}`)
      : c.name;
    if (c.mean !== undefined && c.max !== undefined) {
      const spread = c.max - (c.min ?? 0);
      insights.push(
        lang === 'ar'
          ? `المؤشر "${colLabel}": المتوسط ${fmtN(c.mean)}، الأقصى ${fmtN(c.max)}، مدى ${fmtN(spread)} — يشير إلى تباين ${spread > (c.mean || 1) * 2 ? 'مرتفع' : 'معتدل'}.`
          : `Metric "${colLabel}": mean ${fmtN(c.mean)}, peak ${fmtN(c.max)}, range ${fmtN(spread)} — indicates ${spread > (c.mean || 1) * 2 ? 'high' : 'moderate'} variance.`,
      );
    }
  });

  const topCat = textCols[0];
  if (topCat) {
    const catLabel = /[\u0600-\u06FF]/.test(topCat.name)
      ? (lang === 'ar' ? `العمود ${dataset.columns.indexOf(topCat) + 1}` : `Column ${dataset.columns.indexOf(topCat) + 1}`)
      : topCat.name;
    insights.push(
      lang === 'ar'
        ? `البُعد "${catLabel}" يحتوي ${fmtN(topCat.uniqueCount ?? 0)} قيمة مميزة — مناسب للتقسيم والمقارنة بين الشرائح.`
        : `Dimension "${catLabel}" has ${fmtN(topCat.uniqueCount ?? 0)} distinct values — suitable for segmentation and comparative analysis.`,
    );
  }
  if (insights.length === 0) {
    insights.push(
      lang === 'ar'
        ? 'لا توجد أعمدة رقمية كافية؛ يُنصح بتحويل الحقول أو إضافة مقاييس كمية.'
        : 'Insufficient numeric fields; consider type conversion or adding quantitative KPIs.',
    );
  }

  const warnings: string[] = [];
  if (dataset.anomalies?.length) {
    dataset.anomalies.slice(0, 4).forEach(a => {
      warnings.push(
        lang === 'ar'
          ? `${a.column}: ${a.description} (${a.count} قيمة شاذة)`
          : `${a.column}: ${a.description} (${a.count} outlier values)`,
      );
    });
  }
  if (dataset.duplicates > 0) {
    warnings.push(
      lang === 'ar'
        ? `${fmtN(dataset.duplicates)} صف مكرر قد يشوّه المجاميع والمتوسطات.`
        : `${fmtN(dataset.duplicates)} duplicate rows may inflate aggregates and averages.`,
    );
  }
  if (warnings.length === 0) {
    warnings.push(
      lang === 'ar' ? 'لم تُرصد مخاطر هيكلية حرجة في العينة الحالية.' : 'No critical structural risks detected in the current sample.',
    );
  }

  const qualityIssues: string[] = [];
  const colsWithNulls = dataset.columns
    .filter(c => (c.nullCount ?? 0) > 0)
    .sort((a, b) => (b.nullCount ?? 0) - (a.nullCount ?? 0))
    .slice(0, 5);
  colsWithNulls.forEach(c => {
    const pct = dataset.rows > 0 ? (((c.nullCount ?? 0) / dataset.rows) * 100).toFixed(1) : '0';
    qualityIssues.push(
      lang === 'ar'
        ? `"${c.name}": ${c.nullCount} قيمة مفقودة (${pct}% من الصفوف).`
        : `"${c.name}": ${c.nullCount} missing values (${pct}% of rows).`,
    );
  });
  if (qualityIssues.length === 0) {
    qualityIssues.push(
      lang === 'ar' ? 'لا توجد قيم مفقودة — جودة إدخال ممتازة.' : 'No missing values detected — excellent input quality.',
    );
  }

  const recommendations: string[] = [];
  if (dataset.duplicates > 0) {
    recommendations.push(
      lang === 'ar'
        ? 'تشغيل تنقية التكرارات قبل أي تقرير رسمي أو لوحة مؤشرات.'
        : 'Run deduplication before any official reporting or dashboard refresh.',
    );
  }
  if (dataset.totalNulls > 0) {
    recommendations.push(
      lang === 'ar'
        ? 'معالجة القيم المفقودة (وسيط للأرقام، الأكثر تكراراً للنصوص) عبر أداة التنظيف.'
        : 'Impute missing values (median for numbers, mode for text) using the Cleaning module.',
    );
  }
  recommendations.push(
    lang === 'ar'
      ? 'مراجعة أقوى 3 شرائح في الأبعاد الفئوية ومقارنتها بمؤشر الأداء الرئيسي.'
      : 'Review top 3 categorical segments against the primary performance metric.',
  );
  recommendations.push(
    lang === 'ar'
      ? 'تصدير نسخة Excel منقّاة وأرشفتها كمصدر موثّق للقرارات.'
      : 'Export a cleaned Excel snapshot as the documented source of truth for decisions.',
  );

  const opportunities = [
    lang === 'ar'
      ? 'بناء لوحة Smart Dashboard لمتابعة الاتجاهات والشذوذ لحظياً.'
      : 'Deploy Smart Dashboard for real-time trend and anomaly monitoring.',
    lang === 'ar'
      ? 'تحليل ارتباطات بين المؤشرات الرقمية لاكتشاف محركات الأداء.'
      : 'Correlation analysis across numeric KPIs to identify performance drivers.',
    lang === 'ar'
      ? 'تقسيم العملاء/المنتجات حسب البُعد الفئوي الأعلى تنوعاً.'
      : 'Segment entities by the highest-cardinality categorical dimension.',
  ];

  if (dataset.correlations?.length) {
    const strong = dataset.correlations.filter(c => Math.abs(c.value) > 0.7).slice(0, 2);
    strong.forEach(c => {
      opportunities.push(
        lang === 'ar'
          ? `استغلال الارتباط بين "${c.col1}" و"${c.col2}" (${c.value.toFixed(2)}) في نماذج تنبؤية.`
          : `Leverage correlation between "${c.col1}" and "${c.col2}" (r=${c.value.toFixed(2)}) in predictive models.`,
      );
    });
  }

  return {
    isLocal: true,
    executiveSummary,
    insights: insights.slice(0, 5),
    warnings: warnings.slice(0, 5),
    qualityIssues: qualityIssues.slice(0, 5),
    recommendations,
    opportunities,
  };
}

export function speakText(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[#*]/g, ''));
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
