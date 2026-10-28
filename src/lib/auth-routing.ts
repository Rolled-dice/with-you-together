const DEFAULT_AUTH_DESTINATION = "/dashboard";

function isSafeRelativePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/auth") && !/[\\\u0000-\u001f]/.test(value);
}

export function safeAuthRedirect(value?: string | null): string {
  if (!value) return DEFAULT_AUTH_DESTINATION;

  if (isSafeRelativePath(value)) return value;
  if (typeof window === "undefined") return DEFAULT_AUTH_DESTINATION;

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return DEFAULT_AUTH_DESTINATION;
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!isSafeRelativePath(path)) return DEFAULT_AUTH_DESTINATION;
    return path;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function authRedirectSearch(destination?: string | null) {
  const target = safeAuthRedirect(destination);
  return target === DEFAULT_AUTH_DESTINATION ? undefined : { redirect: target };
}
