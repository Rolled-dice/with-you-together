import { Component, type ReactNode } from "react";
import { BrandMark } from "@/components/landing/brand-mark";

export function BootstrapLoader({ message = "Getting your space ready…" }: { message?: string }) {
  return (
    <main className="sn-bootstrap" role="status" aria-live="polite" aria-busy="true">
      <div className="sn-bootstrap-mark">
        <BrandMark className="h-16 w-16" />
      </div>
      <p className="font-serif text-3xl font-bold">
        Someone<span className="text-brand-accent italic">Near</span>
      </p>
      <p>{message}</p>
      <div className="sn-loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="sn-bootstrap-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
export function DataSkeleton({ label = "Loading your information…" }: { label?: string }) {
  return (
    <div
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {["w-1/3", "w-full", "w-2/3"].map((w) => (
        <div key={w} className={`h-5 rounded bg-muted motion-safe:animate-pulse ${w}`} />
      ))}
    </div>
  );
}
export function DataError({
  retry,
  message = "We couldn’t load this information. Please try again.",
}: {
  retry: () => void;
  message?: string;
}) {
  return (
    <div role="alert" className="rounded-2xl border border-border bg-surface p-6">
      <p>{message}</p>
      <button
        className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-semibold"
        onClick={retry}
      >
        Try again
      </button>
    </div>
  );
}
export class FeatureBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <DataError retry={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}
