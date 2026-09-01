import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "TransConet Administration runtime error:",
      error,
      errorInfo,
    );
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f6f8fb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 620,
            padding: 28,
            background: "#fff",
            border: "1px solid #e3e7ee",
            borderRadius: 14,
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ marginBottom: 12, fontSize: 28 }}>⚠️</div>

          <h1 style={{ margin: "0 0 10px" }}>
            Administration screen error
          </h1>

          <p style={{ margin: "0 0 18px", color: "#5f6875" }}>
            This screen encountered an unexpected error. The
            administration platform is still running.
          </p>

          {this.state.error?.message && (
            <pre
              style={{
                overflowX: "auto",
                padding: 14,
                borderRadius: 8,
                background: "#f6f8fb",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {this.state.error.message}
            </pre>
          )}

          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              marginTop: 18,
              padding: "10px 16px",
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }
}
