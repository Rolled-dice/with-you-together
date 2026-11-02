import { defineNitroConfig } from "nitro/config";

// Frontend response policy only. Business handlers and provider contracts are unchanged.
// Promote CSP to enforcement only after the real OAuth/media/payment staging checks.
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy-Report-Only": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://*.amazonaws.com",
    "media-src 'self' blob: https://*.amazonaws.com https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://consent.cookiebot.com https://consentcdn.cookiebot.com",
    "frame-src https://consentcdn.cookiebot.com https://checkout.dodopayments.com",
    "form-action 'self'",
  ].join("; "),
};
const privatePaths = [
  "/",
  "/auth",
  "/dashboard",
  "/family",
  "/settings",
  "/reminders",
  "/send-later",
  "/insights",
  "/onboarding",
  "/invite",
  "/checkout",
  "/checkout/**",
  "/companion",
  "/companion/**",
  "/admin/**",
  "/agent/**",
  "/api/**",
  "/_serverFn/**",
];
export default defineNitroConfig({
  routeRules: {
    "/**": { headers: securityHeaders },
    ...Object.fromEntries(
      privatePaths.map((path) => [path, { headers: { "Cache-Control": "private, no-store" } }]),
    ),
    // Nitro supplies immutable caching for its hashed assets. Do not also apply
    // a wildcard no-store header in Cloudflare's generated static _headers file.
    "/fonts/**": { headers: { "Cache-Control": "public, max-age=86400" } },
  },
});
