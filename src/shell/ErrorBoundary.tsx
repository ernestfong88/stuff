import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui';

interface Props {
  /** Change to reset the boundary (e.g. the current mode). */
  resetKey?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps one broken screen from taking down the whole device. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Surface crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'var(--paper)' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={36} color="var(--danger)" />
          <h1 className="serif" style={{ fontSize: 22 }}>
            Something went wrong on this screen
          </h1>
          <p style={{ color: 'var(--s500)', fontSize: 14 }}>Your orders are safe. Reload to carry on; if it keeps happening, tell your manager.</p>
          <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
