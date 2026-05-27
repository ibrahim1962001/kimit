import React from 'react';
import { getAppLang, setAppLang } from '../lib/i18n';

interface Props {
  className?: string;
}

export const LangSwitch: React.FC<Props> = ({ className = '' }) => {
  const lang = getAppLang();

  const switchLang = () => {
    setAppLang(lang === 'ar' ? 'en' : 'ar');
    window.location.reload();
  };

  return (
    <button type="button" className={`lang-switch ${className}`.trim()} onClick={switchLang}>
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
};
