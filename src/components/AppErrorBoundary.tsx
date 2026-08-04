import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ alignItems: 'center', display: 'flex', minHeight: '100vh', justifyContent: 'center', padding: 24 }}>
        <section style={{ maxWidth: 440, textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>Your saved data is safe. Reload the application to reconnect.</p>
          <button onClick={() => window.location.reload()} type="button">Reload application</button>
        </section>
      </main>
    );
  }
}
