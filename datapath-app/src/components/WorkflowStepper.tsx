import React from 'react';
import type { AppTab } from '../lib/appNavigation';
import { isArabic } from '../lib/i18n';

type WorkflowTab = 'cleaning' | 'dashboard' | 'smart-dashboard' | 'chat' | 'export';

interface Props {
  current: AppTab;
  onStep: (tab: AppTab) => void;
}

const STEPS: { id: WorkflowTab; tab: AppTab; en: string; ar: string }[] = [
  { id: 'cleaning', tab: 'cleaning', en: 'Clean', ar: 'تنظيف' },
  { id: 'dashboard', tab: 'smart-dashboard', en: 'Dashboard', ar: 'داشبورد' },
  { id: 'chat', tab: 'chat', en: 'Ask AI', ar: 'اسأل AI' },
  { id: 'export', tab: 'export', en: 'Export', ar: 'تصدير' },
];

function stepIndex(tab: AppTab): number {
  if (tab === 'cleaning') return 0;
  if (tab === 'dashboard' || tab === 'smart-dashboard') return 1;
  if (tab === 'chat') return 2;
  if (tab === 'export') return 3;
  return -1;
}

export const WorkflowStepper: React.FC<Props> = ({ current, onStep }) => {
  const isAr = isArabic();
  const active = stepIndex(current);
  if (active < 0) return null;

  return (
    <div className="workflow-stepper" role="navigation" aria-label={isAr ? 'مسار التحليل' : 'Analysis workflow'}>
      <p className="workflow-stepper-label">
        {isAr ? 'الخطوات التالية لتحليل ملفك' : 'Your analysis workflow'}
      </p>
      <ol className="workflow-stepper-list">
        {STEPS.map((step, i) => {
          const done = i < active;
          const currentStep = i === active;
          return (
            <li key={step.id}>
              <button
                type="button"
                className={`workflow-stepper-btn${currentStep ? ' is-current' : ''}${done ? ' is-done' : ''}`}
                onClick={() => onStep(step.tab)}
              >
                <span className="workflow-stepper-num">{done ? '✓' : i + 1}</span>
                <span>{isAr ? step.ar : step.en}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
