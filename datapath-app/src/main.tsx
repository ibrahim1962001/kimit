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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
