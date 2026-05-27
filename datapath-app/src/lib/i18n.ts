export type AppLang = 'en' | 'ar';

export function getAppLang(): AppLang {
  if (typeof localStorage === 'undefined') return 'en';
  return localStorage.getItem('kimit_lang') === 'ar' ? 'ar' : 'en';
}

export function setAppLang(lang: AppLang): void {
  localStorage.setItem('kimit_lang', lang);
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent('kimit:lang-change', { detail: lang }));
}

export function isArabic(): boolean {
  return getAppLang() === 'ar';
}
