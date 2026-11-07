# AGENT.md — SomeoneNear (`someonenear.com`) Zero-Trust Engineering & Dodo Payments Specification

## 1. System Overview & Zero-Trust Philosophy

- **Platform:** SomeoneNear (`https://www.someonenear.com`) — Family connection, daily check-ins, photo-verified medication reminders, push notifications, and confidential companion sessions.
- **Security Posture (Zero-Trust):**
  1. **Never Trust Client Input:** The browser is strictly an untrusted presentation layer. Client requests may ONLY submit `internal_plan_id` (`'care'` | `'care_plus'`). The client MUST NEVER submit raw prices, currencies, discount codes, trial days, or `dodo_product_id` values.
  2. **Server-Authoritative Identity & Entitlements:** Every checkout, subscription mutation, or refund check requires a verified server-side session JWT (`auth.uid()`). Entitlements are granted or revoked ONLY via cryptographically verified Dodo Payments webhooks—never via browser return URLs (`?checkout=success`).
  3. **Fail-Closed Billing Guards:** If country resolution, discount cycle verification (`subscription_cycles === 1`), or webhook signature verification fails, abort immediately (`HTTP 400/403`) and log a security event.

---

## 2. Brand & UI Guardrails (Strict Enforcement)

- **Theme:** Warm Alabaster (`#FAF7F2`, `#F3EDE2`), Deep Slate Navy (`#1E3A52`, `#0F2537`), Warm Terracotta (`#C85A32`), Soft Ice-Blue (`#EBF1F6` for `Calm space` lotus pill).
- **Hero Underline:** Pink-to-Magenta dual brush-stroke wave (`#E11D74` → `#EC4899` → `#F43F5E`) spanning full desktop width beneath _"even when you're miles away."_ with generous vertical spacing (`margin-top: 22px`, `margin-bottom: 26px`).
- **Prohibited UI Changes:** Do NOT add dark-mode toggles, green botanical themes, or flashy mini-games. Do NOT alter original platform avatars. Keep alerts focused on Push Notifications rather than automated outbound calling trees.

---

## 3. Location-Based Pricing Matrix (13 Verified Markets)

The browser market selector is **preview-only**. On checkout creation, the server MUST resolve the user's market from trusted server-side account residency / Cloudflare edge headers (`cf-ipcountry`) + billing address verification, and map `(market_code, internal_plan_id)` to the exact locked `dodo_product_id`:

| Market             | ISO Country Codes                                                                | Currency | `care` (Standard) | `care` (Cycle 1 @ 30% Off) | `care_plus` (Standard) | `care_plus` (Cycle 1 @ 30% Off) |
| :----------------- | :------------------------------------------------------------------------------- | :------: | :---------------: | :------------------------: | :--------------------: | :-----------------------------: |
| **India**          | `IN`                                                                             |  `INR`   |      ₹3,000       |           ₹2,100           |         ₹5,000         |             ₹3,500              |
| **United States**  | `US`                                                                             |  `USD`   |        $49        |           $34.30           |          $79           |             $55.30              |
| **United Kingdom** | `GB`                                                                             |  `GBP`   |        £39        |           £27.30           |          £62           |             £43.40              |
| **Eurozone**       | `AT, BE, CY, DE, EE, ES, FI, FR, GR, HR, IE, IT, LT, LU, LV, MT, NL, PT, SI, SK` |  `EUR`   |        €45        |           €31.50           |          €72           |             €50.40              |
| **Canada**         | `CA`                                                                             |  `CAD`   |       C$65        |          C$45.50           |         C$105          |             C$73.50             |
| **Australia**      | `AU`                                                                             |  `AUD`   |       A$75        |          A$52.50           |         A$119          |             A$83.30             |
| **Poland**         | `PL`                                                                             |  `PLN`   |       zł179       |          zł125.30          |         zł289          |            zł202.30             |
| **Mexico**         | `MX`                                                                             |  `MXN`   |      MX$499       |         MX$349.30          |         MX$799         |            MX$559.30            |
| **Singapore**      | `SG`                                                                             |  `SGD`   |       S$65        |          S$45.50           |         S$105          |             S$73.50             |
| **Japan**          | `JP`                                                                             |  `JPY`   |      ¥5,900       |           ¥4,130           |         ¥9,500         |             ¥6,650              |
| **South Korea**    | `KR`                                                                             |  `KRW`   |      ₩59,000      |          ₩41,300           |        ₩95,000         |             ₩66,500             |
| **Thailand**       | `TH`                                                                             |  `THB`   |      ฿1,290       |          ฿903.00           |         ฿2,090         |            ฿1,463.00            |
| **Cambodia**       | `KH`                                                                             |  `USD`   |       US$25       |          US$17.50          |         US$39          |            US$27.30             |

_Fallback Rule:_ Any unmapped country defaults to the **`US` (`USD` $49 / $79)** product tier unless explicitly added to the server registry. Cambodia (`KH`) MUST map to its own dedicated Dodo Product IDs (`DODO_PDT_CARE_KH`, `DODO_PDT_CARE_PLUS_KH`) and never allow non-KH users to claim KH USD pricing.

---

## 4. First-Time Customer Offer vs. Existing Subscribers

### 4.1 First-Time Customer Rules (`is_first_time_subscriber === true`)

1. **7-Day Free Trial:** Pass `subscription_data: { trial_period_days: 7 }`.
2. **Mandatory Payment Mandate:** Require a valid payment method/mandate (UPI AutoPay / e-Mandate in India, Card/ Mandate globally) during checkout (`trial_payment_method_optional: false`).
3. **Auto-Debit After Trial with 30% Off Cycle 1:**
   - Code: **`SNLAUNCH30FIRST2026`**
   - Discount: **30% (`amount: 3000` basis points)**
   - Cycle Limit: **`subscription_cycles: 1`** (CRITICAL: Never omit `subscription_cycles: 1`, or the discount will recur forever).
   - User Coupon Entry: **Disabled** (`feature_flags: { allow_discount_code: false }`).
   - **Pre-Flight Server Verification:** Before creating the checkout session, the server MUST verify `SNLAUNCH30FIRST2026` via `dodo.discounts.retrieveByCode('SNLAUNCH30FIRST2026')` (cached with 5-min TTL) and assert `discount.subscription_cycles === 1` and `discount.amount === 3000`.
4. **Cycle 2+ Standard Renewal:** Automatically charges the full localized price from the second paid billing cycle onward.

### 4.2 Existing / Returning Subscribers (`is_first_time_subscriber === false`)

Eligibility MUST be checked against the **authenticated `user_id`** (and cross-checked against `dodo_customer_id`), NEVER by email alone:

- Query `subscriptions` and `billing_history` for any record where `user_id = auth.uid()` and `status IN ('active', 'trialing', 'cancelled', 'on_hold', 'expired')` OR `has_ever_subscribed = true`.
- **If a prior or existing subscription is found:**
  - Block `SNLAUNCH30FIRST2026` and set `trial_period_days: 0`.
  - If the user has an `active` or `trialing` subscription, block new checkout creation and route them to the plan change / management flow (`dodo.subscriptions.changePlan()`) so they cannot create duplicate subscriptions across multiple browser tabs.
  - Preserve legacy user product pricing and terms if they are managing or reactivating a grandfathered plan.
- **Single-Use Checkout Sessions & Concurrency Lock:**
  - Dodo checkout URLs are single-use. Always generate a fresh checkout session per attempt.
  - Use a short-lived database lock or unique constraint on active checkout attempts per `user_id` to prevent multi-tab race conditions.

---

## 5. Restricted 100% Live Testing Coupon (`SN_INTERNAL_100_TEST`)

- **DO NOT create `SN_INTERNAL_100_TEST` in Live Dodo** until the live API key, live product IDs, and Dodo compliance approval are confirmed.
- When created for controlled live smoke testing, enforce these exact constraints:
  - **Code:** `SN_INTERNAL_100_TEST`
  - **Discount:** `100%` (`10000` bps)
  - **Subscription Cycles:** `1`
  - **Usage Limit:** `1` total redemption (`usage_limit: 1`)
  - **Per-Customer Limit:** `1` (`per_customer_usage_limit: 1`)
  - **Eligibility:** Specific customer / internal founder allowlist only
  - **Product Restriction:** Restricted to designated test product IDs only
  - **Expiry:** Short 24–48 hour expiration window
  - **Visibility:** Zero public display; server rejects injection unless `user.id` is in `INTERNAL_TESTER_UID_ALLOWLIST`.

---

## 6. Refund Policy & Event-Driven Entitlement Workflow

### Policy Rules (Must match Terms, `/refund-policy`, Checkout Copy & Support SOP)

1. **Refund Window:** **7 calendar days** after the **first successful paid charge** (Cycle 1 auto-debit).
2. **Free Trial Non-Refundable:** The 7-day free trial (`₹0 / $0` mandate setup) is not a refundable charge.
3. **First Paid Cycle Eligible:** The first discounted paid cycle (30% off) is eligible for a refund within the 7-day window.
4. **Renewals (Cycle 2+):** Handled strictly case-by-case by support unless mandated by local consumer law.
5. **Cancellation vs. Refund:** Cancelling a subscription stops the next renewal (`cancel_at_period_end = true`) but does NOT automatically refund the active period.
6. **Support Approval & Idempotent Webhook Fulfillment:**
   - Manual refunds require **Support / Admin Approval** in the internal admin tool before calling `dodo.refunds.create()`.
   - Paid entitlements are revoked or suspended **strictly when the verified Dodo refund webhook (`refund.succeeded`) is received**, never on a client return URL.
   - Every refund request and webhook event is logged idempotently in `billing_audit_log`.

---

## 7. Zero-Trust Database Schema (Supabase PostgreSQL)

```sql
-- 1. Product Registry: Decouples internal plan IDs from Dodo Product IDs
CREATE TABLE IF NOT EXISTS public.plan_product_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT NOT NULL,           -- 'IN', 'US', 'GB', 'EU', 'CA', 'AU', 'PL', 'MX', 'SG', 'JP', 'KR', 'TH', 'KH'
  internal_plan_id TEXT NOT NULL,      -- 'care' | 'care_plus'
  currency TEXT NOT NULL,              -- 'INR', 'USD', 'GBP', 'EUR', etc.
  dodo_product_id TEXT UNIQUE NOT NULL,-- 'pdt_...'
  standard_amount_minor BIGINT NOT NULL,
  first_cycle_amount_minor BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (market_code, internal_plan_id)
);

-- 2. Subscriptions: Enforces 1 active/trialing subscription per user_id
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  internal_plan_id TEXT NOT NULL,      -- 'care' | 'care_plus'
  dodo_product_id TEXT NOT NULL,       -- Stored separately from internal_plan_id
  dodo_subscription_id TEXT UNIQUE NOT NULL,
  dodo_customer_id TEXT NOT NULL,
  market_code TEXT NOT NULL,
  currency TEXT NOT NULL,
  locked_price_minor BIGINT NOT NULL,  -- Preserves user's existing product price/terms
  status TEXT NOT NULL,                -- 'trialing', 'active', 'on_hold', 'cancelled', 'refunded', 'expired'
  applied_discount_code TEXT,
  first_paid_charge_at TIMESTAMPTZ,    -- Anchors the 7-day refund eligibility window
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate active/trialing subscriptions from multi-tab retries
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_sub_per_user
  ON public.subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'on_hold');

-- 3. Immutable Billing & Webhook Idempotency Ledger
CREATE TABLE IF NOT EXISTS public.webhook_events_ledger (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  dodo_object_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```
