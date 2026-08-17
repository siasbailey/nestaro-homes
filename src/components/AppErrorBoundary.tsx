import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Application-level error boundary. A crashing component must never take the
 * whole app down to a white screen — show a recoverable, branded error state.
 * The real exception is still logged (and re-thrown to the console in dev),
 * so nothing is hidden during development.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Keep the real error visible in the console / devtools.
    console.error("[AppErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c47a45] mb-2">Something went wrong</p>
          <h1 className="text-2xl font-bold font-serif text-[#26342b] mb-3">This page hit an unexpected error</h1>
          <p className="text-sm text-gray-500 mb-6 break-words">
            {this.state.error.message || "An unknown error occurred while rendering this page."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              className="bg-[#26342b] text-white"
              onClick={() => {
                this.setState({ error: null });
                // Soft reload of the current route — not a full browser reload loop.
                window.location.reload();
              }}
            >
              Try Again
            </Button>
            <Link to="/">
              <Button variant="outline" className="border-[#26342b] text-[#26342b] w-full">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
