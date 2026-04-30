import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const errMsg = (e: unknown) => e instanceof Error ? e.message : String(e ?? '');
const errStack = (e: unknown) => e instanceof Error ? (e.stack ?? '') : '';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: unknown}> {
  state: {hasError: boolean, error: unknown} = { hasError: false, error: undefined }
  static getDerivedStateFromError(error: unknown) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', height: '100vh' }}>
          <h2>💥 Application Crashed</h2>
          <pre>{errMsg(this.state.error)}</pre>
          <pre style={{ fontSize: 11, marginTop: 10 }}>{errStack(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

import infoContent from '../info.md?raw';
import { migrateMarkdownToFirestore } from './lib/markdownParser';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { UserProvider } from './contexts/UserContext';
import { DataProvider } from './contexts/DataContext';

// Auto-Migration logic on startup
if (!localStorage.getItem('markdown_migrated_v1')) {
  migrateMarkdownToFirestore(infoContent).then(() => {
    localStorage.setItem('markdown_migrated_v1', 'true');
  }).catch(console.error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </UserProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
