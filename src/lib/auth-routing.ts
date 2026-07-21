const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function safeAuthRedirect(value?: string | null): string {
  if (!value) return DEFAULT_AUTH_DESTINATION;

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return DEFAULT_AUTH_DESTINATION;
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/auth")) {
      return DEFAULT_AUTH_DESTINATION;
    }
    return path;
  } catch {
    if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/auth")) {
      return value;
    }
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function authRedirectSearch(destination?: string | null) {
  const target = safeAuthRedirect(destination);
  return target === DEFAULT_AUTH_DESTINATION ? undefined : { redirect: target };
}