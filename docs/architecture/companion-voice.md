# Companion voice input

Voice dictation adds words to the same draft as typing. It never sends a chat
message automatically or executes app actions. The normal chat authorization,
quota, safety checks, and persistence still run when the user presses Send.

## Capture and transcription

- A tap starts listening after an audio-processing notice and microphone permission.
- Web Speech API recognition supplies live interim and final words where supported.
  Browser speech services may process audio remotely; this is not an offline guarantee.
- Voice input uses the previously saved language preference, or defaults to English
  for India, English for the US, or Hindi based on browser language and timezone.
  The composer does not show a language selector. Audio is not persisted.
- Listening continues across browser-imposed pauses, up to two minutes. Stop finishes
  the current words. Cancel discards pending partial words but preserves text already
  added to the draft. Hiding or leaving the page cancels microphone capture.
- Browsers without working live recognition use MediaRecorder. Microphone constraints
  request echo cancellation, noise suppression, automatic gain control, and mono audio.
  Devices may ignore constraints they do not support.
- Recorded audio is submitted only after Stop to `/api/companion-transcription`.
  The microphone closes before the upload. Failed transcription can be retried from
  temporary browser memory without recording again.

## Backend and deployment

The transcription endpoint verifies the Supabase bearer token. It limits upload
size to 3 MiB, restricts audio formats and language values, bounds provider output,
and times out provider requests after 25 seconds. It never writes audio to the
database, file storage, or application logs. Provider retention follows provider
terms; the application makes no claim that providers retain nothing.

The existing private `GEMINI_API_KEY` is reused. `GEMINI_TRANSCRIPTION_MODEL` can
override the default `gemini-3.5-flash-lite`, independently of the chat model. This
recording fallback is batch transcription after Stop, not streaming transcription.

Deploy the generated Worker configuration, including the `COMPANION_VOICE_LIMITER`
rate-limit binding from `wrangler.json`. It permits four recorded transcription
requests per verified user per minute per Cloudflare location. Cloudflare's
limiter is eventually consistent and is not a global spending cap. The endpoint
fails closed if the binding is absent in production. Local development allows
transcription without the binding. No database migration is required.

## Verification

Unit tests cover recognized-word deduplication, pause recovery, timeout cleanup,
late microphone grants, cancelling recordings, retrying failures, typed draft
preservation, authentication, payload bounds, and provider-response validation.
The local Playwright fixture checks desktop and narrow phone layouts with simulated
speech. Before release, test real microphones and supported browsers with consenting
older users, including soft speech, long pauses, Indian English, Hindi, and background
noise. Neither accuracy nor a fixed end-to-end latency is guaranteed by these tests.
