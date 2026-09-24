# Plan: Gemini Companion integration

## Changes
- Keep the Gemini key only in secure backend storage.
- Switch Companion chat from Lovable AI to Google Gemini while preserving authentication, quotas, conversation history, and streaming.
- Show provider errors clearly and never expose the key to the browser.
- Test a real Companion response and confirm the app remains healthy.

## Technical details
- Use the existing `/api/chat` server endpoint and the Gemini streaming protocol.
- Keep all model calls server-side and retain the current safety prompt and message persistence.
