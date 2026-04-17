import type { QuickQuestion } from '../types';

export const QUICK_QUESTIONS: QuickQuestion[] = [
  // Data analysis
  { id: 'q1', icon: '📊', label: 'ملخص البيانات', labelEn: 'Data Summary', prompt: 'اعطني ملخصاً كاملاً عن البيانات المرفوعة', promptEn: 'Give me a full summary of the uploaded data', category: 'data' },
  { id: 'q2', icon: '⚠️', label: 'القيم المفقودة', labelEn: 'Missing Values', prompt: 'ما هي الأعمدة التي تحتوي على قيم مفقودة وما نسبتها؟', promptEn: 'Which columns have missing values and what is the percentage?', category: 'data' },
  { id: 'q3', icon: '🔍', label: 'القيم الشاذة', labelEn: 'Anomalies', prompt: 'هل توجد قيم شاذة في البيانات؟ وضح لي', promptEn: 'Are there any anomalies in the data? Explain them.', category: 'data' },
  { id: 'q4', icon: '🔗', label: 'العلاقات بين الأعمدة', labelEn: 'Correlations', prompt: 'ما هي أقوى العلاقات بين متغيرات البيانات؟', promptEn: 'What are the strongest correlations between data variables?', category: 'data' },
  { id: 'q5', icon: '📈', label: 'أعلى القيم', labelEn: 'Top Values', prompt: 'ما هي أعلى وأدنى القيم في كل عمود رقمي؟', promptEn: 'What are the highest and lowest values in each numeric column?', category: 'analysis' },
  { id: 'q6', icon: '🎯', label: 'توصيات التحسين', labelEn: 'Recommendations', prompt: 'بناءً على البيانات، ما هي توصياتك لتحسين الجودة؟', promptEn: 'Based on the data, what are your recommendations for improvement?', category: 'analysis' },
  // General AI
  { id: 'q7', icon: '🧮', label: 'احسب لي', labelEn: 'Calculate', prompt: 'احسب لي متوسط وانحراف معياري للأعمدة الرقمية', promptEn: 'Calculate mean and standard deviation for numeric columns', category: 'analysis' },
  { id: 'q8', icon: '💡', label: 'رؤى ذكية', labelEn: 'Smart Insights', prompt: 'ما هي أهم 5 رؤى مفيدة يمكن استخلاصها من هذه البيانات؟', promptEn: 'What are the top 5 useful insights from this dataset?', category: 'analysis' },
  { id: 'q9', icon: '📝', label: 'شرح البيانات', labelEn: 'Explain Data', prompt: 'اشرح لي محتوى هذا الملف بأسلوب مبسط', promptEn: 'Explain the content of this file in simple terms', category: 'data' },
  { id: 'q10', icon: '🤖', label: 'نموذج تنبؤ', labelEn: 'Predict', prompt: 'هل يمكن استخدام هذه البيانات لبناء نموذج تنبؤي؟', promptEn: 'Can this data be used for a predictive model?', category: 'analysis' },
  { id: 'q11', icon: '🌍', label: 'سؤال عام', labelEn: 'General Question', prompt: 'ما هو الفرق بين الذكاء الاصطناعي والتعلم الآلي؟', promptEn: 'What is the difference between AI and Machine Learning?', category: 'general' },
  { id: 'q12', icon: '✨', label: 'قوة الداتا', labelEn: 'Data Power', prompt: 'كيف يمكنني الاستفادة من هذه البيانات في صنع قرارات أفضل؟', promptEn: 'How can I use this data to make better decisions?', category: 'general' },
];
