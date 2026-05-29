export type AppTab =
  | 'home'
  | 'dashboard'
  | 'cleaning'
  | 'chat'
  | 'export'
  | 'files'
  | 'about'
  | 'privacy'
  | 'faq'
  | 'guide'
  | 'compare'
  | 'tools'
  | 'smart-dashboard'
  | 'dashboard-preview'
  | 'shared';

const TAB_TO_PATH: Record<AppTab, string> = {
  home: '/',
  dashboard: '/dashboard',
  cleaning: '/cleaning',
  chat: '/chat',
  export: '/export',
  files: '/files',
  about: '/about',
  privacy: '/privacy',
  faq: '/faq',
  guide: '/guide',
  compare: '/compare',
  tools: '/tools',
  'smart-dashboard': '/smart-dashboard',
  'dashboard-preview': '/dashboard-preview',
  shared: '/shared',
};

const PATH_TO_TAB: Record<string, AppTab> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab as AppTab]),
) as Record<string, AppTab>;

export function tabFromPathname(pathname: string): AppTab {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/dashboard-preview') return 'smart-dashboard';
  return PATH_TO_TAB[normalized] ?? 'home';
}

export function pathForTab(tab: AppTab): string {
  return TAB_TO_PATH[tab] ?? '/';
}

export function navigateToTab(tab: AppTab, replace = false): void {
  const path = pathForTab(tab);
  if (replace) {
    window.history.replaceState({ tab }, '', path);
  } else {
    window.history.pushState({ tab }, '', path);
  }
}

export function readInitialTab(): AppTab {
  return tabFromPathname(window.location.pathname);
}
