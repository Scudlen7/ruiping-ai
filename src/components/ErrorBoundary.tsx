import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * ErrorBoundary - Catches render errors in child components and displays
 * a friendly error page instead of crashing the entire application.
 *
 * Usage: Wrap any component tree that might throw during render.
 * Note: Error boundaries only catch errors during rendering, lifecycle methods,
 * and constructors of child components. They do NOT catch:
 *   - Event handlers (use try/catch in the handler)
 *   - Asynchronous code (setTimeout, promises)
 *   - Server-side rendering errors
 *   - Errors thrown in the error boundary itself
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI to show instead of the default error page */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Call optional error callback
    this.props.onError?.(error, info);

    // In production, you'd send this to an error reporting service
    // e.g. Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
          <div className="card p-10 max-w-lg w-full text-center animate-fade-in">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">页面出了点问题</h2>
            <p className="text-gray-600 mb-2">
              很抱歉，页面遇到了一个意外错误。
            </p>
            {this.state.error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3 mb-6 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="btn-primary group"
              >
                <RotateCcw className="w-4 h-4 mr-2 group-hover:-rotate-180 transition-transform duration-500" />
                返回首页
              </button>
              <button
                onClick={this.handleReload}
                className="btn-secondary"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
