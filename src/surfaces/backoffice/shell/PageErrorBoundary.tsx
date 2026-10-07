import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../ui';
import s from './PageErrorBoundary.module.css';

interface Props {
  /** The page id; a new page starts with a clean boundary. */
  resetKey: string;
  pageLabel: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps one broken page from taking down the side nav and the rest of the back office. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Back office page "${this.props.resetKey}" crashed`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.box} role="alert">
        <AlertTriangle size={28} color="var(--danger)" aria-hidden />
        <h1 className={s.title}>{this.props.pageLabel} hit a problem</h1>
        <p className={s.body}>Nothing you saved is lost. Try the page again, or pick another page from the side.</p>
        <Button variant="primary" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    );
  }
}
