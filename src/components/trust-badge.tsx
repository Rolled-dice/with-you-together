import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A locally-owned trust mark. Replaces the third-party hotlinked footer
 * badge. States a verifiable practice, not a compliance certification
 * (there is no universal "HIPAA compliant" seal to display honestly).
 */
export function TrustBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <ShieldCheck className="h-4 w-4 text-primary" />
      Private by design · audio-only calls · nothing shared without your say
    </div>
  );
}
