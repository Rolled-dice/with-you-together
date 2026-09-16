export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export function buildConsentUrl(args: { clientId: string; redirectUri: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: `${CALENDAR_SCOPE} ${USERINFO_SCOPE}`,
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google token error ${res.status}: ${t.slice(0, 240)}`);
  }
  return (await res.json()) as GoogleTokens;
}

export function exchangeCode(args: {
  code: string; clientId: string; clientSecret: string; redirectUri: string;
}): Promise<GoogleTokens> {
  return tokenRequest(
    new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

export function refreshAccessToken(args: {
  refreshToken: string; clientId: string; clientSecret: string;
}): Promise<GoogleTokens> {
  return tokenRequest(
    new URLSearchParams({
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string };
  return j.email ?? null;
}

function eventBody(event: { summary: string; description: string; start: string; end: string }) {
  return {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
    reminders: { useDefault: true },
  };
}

function calUrl(calendarId: string, suffix = ""): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${suffix}`;
}

export async function insertEvent(args: {
  accessToken: string; calendarId: string;
  event: { summary: string; description: string; start: string; end: string };
}): Promise<{ id: string }> {
  const res = await fetch(calUrl(args.calendarId), {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(args.event)),
  });
  if (!res.ok) throw new Error(`Calendar insert ${res.status}: ${(await res.text()).slice(0, 240)}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function patchEvent(args: {
  accessToken: string; calendarId: string; eventId: string;
  event: { summary: string; description: string; start: string; end: string };
}): Promise<void> {
  const res = await fetch(`${calUrl(args.calendarId, "/")}${encodeURIComponent(args.eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(args.event)),
  });
  if (!res.ok) throw new Error(`Calendar patch ${res.status}: ${(await res.text()).slice(0, 240)}`);
}

export async function deleteEvent(args: {
  accessToken: string; calendarId: string; eventId: string;
}): Promise<void> {
  const res = await fetch(`${calUrl(args.calendarId, "/")}${encodeURIComponent(args.eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  // 404/410 mean the event is already gone — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar delete ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
}
