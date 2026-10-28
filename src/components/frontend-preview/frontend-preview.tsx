import {
  lazy,
  Suspense,
  useEffect,
  useState,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import "./preview.css";

const Prototype = lazy(() => import("./prototype.jsx"));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("FrontendPreview crashed:", error, errorInfo);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="preview-loading">
          <h1>This preview couldn't load</h1>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function FrontendPreview() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const loading = (
    <div className="preview-loading" role="status">
      Opening SomeoneNear...
    </div>
  );
  return ready ? (
    <ErrorBoundary>
      <Suspense fallback={loading}>
        <Prototype />
      </Suspense>
    </ErrorBoundary>
  ) : (
    loading
  );
}
