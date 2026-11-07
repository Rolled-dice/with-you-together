import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google-calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const appError = url.searchParams.get("error");

        const redirect = (status: "connected" | "error") =>
          new Response(null, { status: 302, headers: { Location: `/reminders?calendar=${status}` } });

        if (appError || !code || !state) return redirect("error");

        try {
          const encKey = process.env["CALENDAR_TOKEN_ENC_KEY"];
          const clientId =
            process.env["GOOGLE_CALENDAR_CLIENT_ID"] ?? process.env["GOOGLE_OAUTH_CLIENT_ID"];
          const clientSecret =
            process.env["GOOGLE_CALENDAR_CLIENT_SECRET"] ?? process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
          const redirectUri = process.env["GOOGLE_CALENDAR_REDIRECT_URI"];
          if (!encKey || !clientId || !clientSecret || !redirectUri) return redirect("error");

          const { verifyState, encryptSecret } = await import("@/lib/calendar/crypto.server");
          const { exchangeCode, fetchUserEmail } = await import("@/lib/calendar/google-api.server");
          const supabaseMod = await import("@/integrations/supabase/client.server");
          // New table not yet in generated Supabase types; untyped access (repo convention).
          const supabaseAdmin = supabaseMod.supabaseAdmin as any;

          const claims = await verifyState(state, encKey);
          const userId = claims?.userId;
          if (!userId || typeof userId !== "string") return redirect("error");

          const tokens = await exchangeCode({ code, clientId, clientSecret, redirectUri });
          if (!tokens.refresh_token) return redirect("error"); // no offline grant -> cannot sync later

          const email = await fetchUserEmail(tokens.access_token);
          const encrypted = await encryptSecret(tokens.refresh_token, encKey);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error } = await supabaseAdmin
            .from("google_calendar_credentials")
            .upsert(
              {
                user_id: userId,
                google_email: email,
                encrypted_refresh_token: encrypted,
                access_token: tokens.access_token,
                access_token_expires_at: expiresAt,
                scope: tokens.scope ?? null,
                calendar_id: "primary",
                sync_enabled: true,
              },
              { onConflict: "user_id" },
            );
          if (error) return redirect("error");

          return redirect("connected");
        } catch (e) {
          console.error("[google-calendar callback] failed", e);
          return redirect("error");
        }
      },
    },
  },
});
