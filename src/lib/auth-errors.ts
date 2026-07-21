// Small helper to turn raw auth/network errors into friendly copy.
// Used by the auth page (Google/Apple OAuth and email sign-in).

export type AuthErrorKind =
  | "network"
  | "popup_blocked"
  | "popup_closed"
  | "invalid_credentials"
  | "rate_limited"
  | "provider_disabled"
  | "email_not_confirmed"
  | "unknown";

export interface AuthErrorInfo {
  kind: AuthErrorKind;
  title: string;
  description: string;
  retryable: boolean;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export function classifyAuthError(err: unknown): AuthErrorInfo {
  const raw =
    (typeof err === "object" && err && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : String(err ?? "")) || "";
  const msg = raw.toLowerCase();

  if (!isOnline() || msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed")) {
    return {
      kind: "network",
      title: "You appear to be offline",
      description: "Check your connection and try again.",
      retryable: true,
    };
  }
  if (msg.includes("popup") && (msg.includes("block") || msg.includes("denied"))) {
    return {
      kind: "popup_blocked",
      title: "Popup was blocked",
      description: "Allow popups for this site, then try again.",
      retryable: true,
    };
  }
  if (msg.includes("popup") && msg.includes("clos")) {
    return {
      kind: "popup_closed",
      title: "Sign-in window closed",
      description: "You closed the sign-in window before finishing.",
      retryable: true,
    };
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("invalid_grant")) {
    return {
      kind: "invalid_credentials",
      title: "Wrong email or password",
      description: "Double-check your details and try again.",
      retryable: true,
    };
  }
  if (msg.includes("rate") && msg.includes("limit")) {
    return {
      kind: "rate_limited",
      title: "Too many attempts",
      description: "Please wait a minute before trying again.",
      retryable: true,
    };
  }
  if (msg.includes("provider") && (msg.includes("not enabled") || msg.includes("not supported") || msg.includes("disabled"))) {
    return {
      kind: "provider_disabled",
      title: "This sign-in method isn't available",
      description: "Try email sign-in or another provider.",
      retryable: false,
    };
  }
  if (msg.includes("email not confirmed") || msg.includes("confirm your email")) {
    return {
      kind: "email_not_confirmed",
      title: "Confirm your email",
      description: "Check your inbox for the confirmation link.",
      retryable: false,
    };
  }
  return {
    kind: "unknown",
    title: "Sign-in didn't work",
    description: raw || "Something went wrong. Please try again.",
    retryable: true,
  };
}
