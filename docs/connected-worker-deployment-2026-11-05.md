# Connected test Worker — 5 November 2026

The user approved replacing the reference prototype at https://test_front.mdutt855.workers.dev with the connected app. The final deployed version is `5b0a6890-5013-417d-8984-58a0e1137f48`. No custom domain or existing production scheduler was changed.

## What is connected

- Supabase project `jflufaxdwzrohslviqeb`: authentication, chat history, family authorization, prescriptions and Send Later uploads.
- Gemini `gemini-3-flash-preview`: Companion replies and structured prescription extraction. PhotoMed no longer requires Lovable gateway credentials. It downloads the authenticated owner's photo, validates type/size, transcribes visible details and shows a draft for review. It does not automatically create medication records.
- Bedrock guardrail `p1livtmst6bw`, version 1, `us-east-1`: independent Companion input/output checks.
- DynamoDB continuity and structured safety tables: authenticated subject IDs, conditional summary writes, clear controls and no raw chat content in audit events.
- Twenty required server bindings, including a new dedicated scheduler secret. Dodo is explicitly in test mode; no live Dodo credentials were uploaded. No S3 permissions or administrator access were needed.

The Send Later database guard requires its historical logical `send-later/<owner>/<file>` key. The app preserves that record format while accessing `<owner>/<file>` inside Supabase's private `send-later` bucket. The existing database ownership guard and RLS were preserved; no schema/policy migration was applied for this fix.

## Verification

The deployed browser test passed in 36.8 seconds with disposable reserved-domain accounts:

1. Password login and authenticated navigation.
2. Real Gemini Companion reply, checked through Bedrock, saved chat turns and a DynamoDB continuity summary.
3. A different account cannot use another person's conversation; summary clearing works.
4. Synthetic prescription image upload, extraction into the review form and confirmation that no medication was automatically saved.
5. Audio upload and message persistence through the real UI. Unrelated accounts and recipients cannot download the private object directly.
6. Owner playback and family recipient playback after a controlled delivery transition, using expiring signed links.
7. Cleanup of the test's own users, family, uploads, chat rows and DynamoDB summary/audit records.

Twenty-one focused provider/OCR/scheduler tests pass. TypeScript, targeted lint, repository contracts and the production build pass. The deployment scan checked 408 files and found no embedded provider/server credentials. The final package is approximately 1.86 MB compressed; an unused diagram/code renderer was removed without changing the active chat renderer. Worker startup was reported as 1 ms.

Public landing/auth pages return 200. Unauthenticated chat and scheduler calls return 401. The scheduler hooks now require `CRON_SECRET`; a public Supabase key cannot authorize them. Observability logs and traces are enabled with 10% sampling.

## Rollback and remaining release work

The original prototype version `fcea0dc6-b130-4bdc-9e15-11a11ed2c1f6`, deployment metadata and a content backup are retained under `../outputs/test-front-before-*`. Wrangler can roll back to the original version if needed. The deployment logs and successful browser run are in `../work/test-front-deploy.log` and `../work/hybrid-final-deployed-e2e.log`; these do not contain secret values.

The audio test advanced only its disposable message to delivered; it did not wait for or reconfigure the real scheduler. Existing jobs still target www.someonenear.com. Confirm the intended scheduler origin and dedicated credential before relying on automatic timed delivery from this Worker. Production billing fulfillment, provider webhooks/renewals/refunds, Calendar OAuth and outbound voice journeys remain separate checks in the readiness report. Define retention and account-erasure handling for safety audit records before a production release. No extra credentials are needed for the Companion, PhotoMed or storage flows verified here.

## Main integration validation

The deployed application was prepared for integration with main on 5 November 2026. All 153 unit tests across 34 files and the frontend contract guard pass. The full repository lint command was run and remains failing on previously documented formatting/CRLF and legacy findings; it is not reported as a clean gate. The deployed production build, TypeScript check and real-service browser journey above passed. Local credentials and Playwright run artifacts are excluded from the commit.
