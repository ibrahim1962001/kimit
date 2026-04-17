import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', height: '100vh' }}>
          <h2>💥 Application Crashed</h2>
          <pre>{(this.state.error as any)?.message}</pre>
          <pre style={{ fontSize: 11, marginTop: 10 }}>{(this.state.error as any)?.stack}</pre>
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
