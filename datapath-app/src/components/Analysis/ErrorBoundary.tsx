import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in ${this.props.moduleName || 'a component'}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <AlertTriangle size={32} style={{ marginBottom: '10px' }} />
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Module Failed to Load</h3>
          <p style={{ margin: 0, fontSize: '13px', textAlign: 'center', opacity: 0.8 }}>
            The {this.props.moduleName || 'visual component'} encountered an unexpected error.
            <br />
            {this.state.error?.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
