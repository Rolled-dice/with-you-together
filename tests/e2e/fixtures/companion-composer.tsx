import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CompanionComposer } from "../../../src/components/companion-composer";
import { supabase } from "../../../src/integrations/supabase/client";
import "../../../src/styles.css";

// The isolated recording fixture cannot authenticate against a hosted account.
if (new URLSearchParams(location.search).has("recording")) {
  supabase.auth.getSession = async () => ({
    data: {
      session: {
        access_token: "fixture-token",
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      },
    },
    error: null,
  });
}

function Fixture() {
  const [sent, setSent] = useState("");
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6 text-foreground">
      <h1 className="mb-4 text-xl font-semibold">Companion</h1>
      <p data-testid="sent-message" className="flex-1 break-words">
        {sent}
      </p>
      <CompanionComposer status="ready" disabled={false} onSend={setSent} />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<Fixture />);
