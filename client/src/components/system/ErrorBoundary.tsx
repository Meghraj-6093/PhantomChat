import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error:", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 overflow-y-auto bg-background px-6 py-8 text-center">
          <div className="text-6xl">👻</div>
          <h1 className="text-2xl font-bold text-slate-100">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted">
            An unexpected error crashed this view. Reloading usually fixes it.
          </p>
          <pre className="max-w-lg overflow-x-auto rounded-xl border border-line bg-card p-3 text-left text-xs text-danger">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-medium text-white shadow-glow"
          >
            Reload PhantomChat
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
