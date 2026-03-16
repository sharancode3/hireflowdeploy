import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught an error:", error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded-xl border border-danger/40 bg-danger/10 p-5 text-sm text-danger">
          <p className="text-base font-semibold text-text">{this.props.title ?? "Something went wrong"}</p>
          <p className="mt-1 text-text-secondary">
            {this.props.description ?? "An unexpected error occurred while rendering this section."}
          </p>
          <p className="mt-3 text-xs text-text-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
