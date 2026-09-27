# Move `someonenear.com` DNS to Cloudflare — keep apex on Lovable (dev), put `www` on the Cloudflare Worker (prod)

Goal:
- `someonenear.com` (apex) = **dev**, stays served by Lovable (185.158.133.1).
- `www.someonenear.com` = **prod**, served by the Cloudflare Worker `rolled-dice-with-you-together`.
- DNS authority moves from GoDaddy (`ns77/ns78.domaincontrol.com`) to Cloudflare, but delegation only — Lovable keeps serving the apex.

Telnyx / Dodo / cron stay pointed at `https://www.someonenear.com/...` (the correct
final target). They will NOT work until steps below complete — that is expected.

---

## Existing DNS records to PRESERVE (captured before migration)

When Cloudflare scans the zone it should import most of these, but VERIFY each one
is present in Cloudflare before you switch nameservers. Missing email/verification
records = broken email + failed domain verifications.

| Type | Name | Value | Notes |
|------|------|-------|-------|
| A | `someonenear.com` (apex) | `185.158.133.1` | Lovable dev. Set **DNS only (grey cloud)**. |
| A | `www` | `185.158.133.1` | **Will be REPLACED** by the Worker custom domain (see step 4). |
| MX | `someonenear.com` | `0 smtp.secureserver.net` | GoDaddy email |
| MX | `someonenear.com` | `10 mailstore1.secureserver.net` | GoDaddy email |
| TXT | `someonenear.com` | `v=spf1 include:secureserver.net -all` | SPF |
| TXT | `someonenear.com` | `google-site-verification=vUX8NuoIaAmKz6xSODVDm-r4zec8PwN2Qi5HBRgpS84` | Google verification |
| TXT | `someonenear.com` | `brevo-code:4faebdd5612ea25970d0588e14dcb776` | Brevo verification |

(There may be additional subdomains/records in GoDaddy's panel not visible via
public DNS — open the GoDaddy DNS page and copy EVERYTHING before migrating.)

---

## Steps

### 1. Add the zone to Cloudflare
- Cloudflare dashboard → **Add a site** → `someonenear.com` → Free plan is fine.
- Let it scan. When the imported records appear, **check the table above is all present.**
- Ensure the apex `A → 185.158.133.1` is **DNS only (grey cloud)** so Lovable keeps
  serving dev unchanged. (Grey cloud = Cloudflare does DNS only, no proxy.)
- Cloudflare shows you **two nameservers**, e.g. `xxx.ns.cloudflare.com` /
  `yyy.ns.cloudflare.com`. Copy them.

### 2. Switch nameservers at GoDaddy
- GoDaddy → **My Products → Domains → someonenear.com → Nameservers → Change**.
- Switch from `ns77.domaincontrol.com` / `ns78.domaincontrol.com` to the two
  Cloudflare nameservers from step 1.
- Save. Propagation is usually minutes but can take up to a few hours.

### 3. Wait for the zone to go Active
- Cloudflare emails you / the dashboard shows **Active** once it sees the delegation.
- Verify apex still works (dev must be unaffected):
  - `https://someonenear.com` should still load the Lovable site.

### 4. Attach `www` to the Cloudflare Worker (prod)
- Cloudflare dashboard → **Workers & Pages → `rolled-dice-with-you-together`**
  → **Settings → Domains & Routes → Add → Custom Domain** → enter
  `www.someonenear.com`.
- Cloudflare creates the DNS record for `www` and issues the TLS cert automatically
  (this REPLACES the old `www A → 185.158.133.1`). Do not manually add a conflicting
  `www` record.
- Wait for the cert to say **Active** (usually a minute or two).

### 5. Verify prod
- `https://www.someonenear.com` should now serve the Worker (not Lovable).
- The webhook routes should answer 401 to an unsigned request (route exists + auth):
  - `POST https://www.someonenear.com/api/public/hooks/telnyx`
  - `POST https://www.someonenear.com/api/public/hooks/send-later`

---

## After DNS is live — finish prod wiring

These are already pointed at `www.someonenear.com`, so once step 5 passes they
start working. Just confirm:

- **Telnyx** Call Control webhook = `https://www.someonenear.com/api/public/hooks/telnyx` (already set).
- **Dodo** webhook = `https://www.someonenear.com/api/public/payments/dodo-webhook?env=test` (you set this).
- **pg_cron** = re-run `supabase/cron-production.sql` (already targets www).
- **Google OAuth**: `GOOGLE_CALENDAR_REDIRECT_URI` = `https://www.someonenear.com/api/public/google-calendar/callback`
  is uploaded as a Worker secret — also add that exact URI to the Google Cloud
  OAuth client's Authorized redirect URIs.
- **Supabase Auth → URL Configuration**: Site URL / redirect allow-list should
  include `https://www.someonenear.com` so prod auth links resolve.

## Gotchas
- Keep the apex **grey-clouded (DNS only)** so Lovable dev is untouched.
- Don't create a manual `www` DNS record — the Worker custom domain owns it.
- Zone-level SSL mode: **Full (strict)** is correct; the Worker custom domain has a real cert.
- Email keeps working only if the MX + SPF/TXT rows above are present in Cloudflare.
