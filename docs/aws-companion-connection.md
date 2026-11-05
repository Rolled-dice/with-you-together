# Companion and storage connection — 5 November 2026

This document supersedes the earlier Nova Lite/S3 proposal. The user's confirmed architecture is Gemini generation, Bedrock Guardrails safety, DynamoDB continuity/audits, and Supabase authentication, chat history and private uploads. Nova Lite is not selected, and no S3 bucket or S3 permissions are required. The earlier Nova environment assignment and provider dependency have been removed.

## Local implementation

- Gemini `gemini-3-flash-preview` generates replies. The server applies guardrail `p1livtmst6bw`, version `1`, in `us-east-1` to input and completed output. Replies are buffered until approved; unchecked tokens are never streamed. This increases first-response latency. Provider/safety failures return a temporary-unavailable response.
- DynamoDB `someonenear-ai-user-summaries` uses `subjectId` (String), without a sort key. Records contain summary, updatedAt and schemaVersion. The subject is derived from authenticated Supabase identity, never accepted from a browser parameter. Summary updates occur only after the chat turns are saved and use optimistic conditions against stale overwrites.
- DynamoDB `someonenear-ai-safety-audits` uses `subjectId` (String) and `eventId` (String). Events record timestamps, source, purpose, action and policy category names. They do not store prompts, model replies or raw assessments. Retention and account-erasure handling for these audit records still require a defined policy.
- The Companion memory panel reads and clears continuity summaries. Clearing writes an empty marker, retaining only identity/timestamp/schema metadata to prevent an in-flight first write from restoring cleared text. Deleting an owned saved note or conversation clears continuity first. A future chat can generate a fresh summary from remaining conversation context; clearing continuity does not erase chat history or explicit notes.
- Send Later media now uses private Supabase bucket `send-later`, under the owner's UUID. Signed playback links expire after five minutes and are issued only after database ownership/recipient authorization; recipients can play only delivered messages. New messages require a family-circle recipient and validated media.
- Prescription uploads remain in private Supabase bucket `prescriptions`. PhotoMed now uses the same Gemini server credential for structured transcription, with an authenticated owner-path check, file validation and review before saving.

Server-only `.env.aws.example` lists required configuration without credentials. Uppercase and existing lowercase AWS names are supported. No Bedrock model ID, S3 bucket or Lovable key is required for Companion/Send Later. Local secrets do not automatically configure a deployed Worker.

## Verified with current credentials

| Service operation | Result |
| --- | --- |
| Gemini tiny synthetic generation, minimal thinking | HTTP 200; visible response generated |
| Bedrock ApplyGuardrail, benign synthetic input | Allowed; action NONE |
| DynamoDB memory GetItem and safety Query, synthetic subject | Successful |
| DynamoDB disposable PutItem/GetItem/DeleteItem on both tables | Successful; test records removed |
| Supabase upload/sign/fetch/delete on both private buckets | Successful; disposable objects removed |

Initial storage diagnostics used the server key. The later deployed authenticated multi-user upload/playback journey now passes. No customer data was changed during diagnostics. The existing key already supports the tested runtime operations. Denied listing/metadata operations do not block them, and administrator access is unnecessary. No IAM or bucket policy was changed. The connected app has since been deployed to test_front with required server secrets, at the user’s explicit request.

The review-only IAM artifact at `../outputs/aws-companion-policy-review.json` has been corrected to ApplyGuardrail and item operations on the two exact tables. It is a scope reference, not a request to attach another policy. DescribeTable is optional diagnostics; model invocation and S3 permissions are not part of this implementation.

## Validation and remaining deployment work

Twenty-one focused configuration, safety, continuity, OCR, scheduler and storage tests pass, including blocked-output handling and clear markers. TypeScript, targeted ESLint and the repository contract guard pass. The Cloudflare production build also passes; the public build scan found zero AWS credential leaks. Diagnostics are in `../outputs/aws-hybrid-connectivity.json`, `aws-dynamodb-diagnostics.json`, `gemini-reply-diagnostic.json` and `hybrid-provider-diagnostics.json`; these contain outcomes, not credentials.

The required server secrets and authenticated chat/PhotoMed/family playback checks are now complete on the deployed Worker. See [deployment results and remaining release checks](connected-worker-deployment-2026-11-05.md), including scheduler-origin verification, billing fulfillment and safety-audit retention/account deletion. Service-level connectivity alone is not a complete production-readiness claim.
