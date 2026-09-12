import { createFileRoute } from '@tanstack/react-router'

// TEMPORARY diagnostic route — verifies Telnyx config and WebRTC token minting.
// Deleted after verification. Never places calls.
export const Route = createFileRoute('/api/public/telnyx-check')({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = (process.env['TELNYX_API_KEY'] ?? '').trim()
        const appId = (process.env['TELNYX_CALL_CONTROL_APP_ID'] ?? '').trim()
        const phone = (process.env['TELNYX_PHONE_NUMBER'] ?? '').trim()
        const credId = (process.env['TELNYX_SIP_CREDENTIAL_ID'] ?? '').trim()
        const pubKey = (process.env['TELNYX_PUBLIC_KEY'] ?? '').trim()
        const config = {
          apiKey: !!apiKey,
          appId: !!appId,
          phone: !!phone,
          credId: !!credId,
          pubKey: !!pubKey,
        }
        if (!apiKey || !credId) {
          return Response.json({ config, error: 'missing values' }, { status: 500 })
        }
        // Mint a WebRTC token against the telephony credential (no call placed)
        const res = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${credId}/token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const body = await res.json()
        if (!res.ok) {
          return Response.json({ config, token: 'FAILED', status: res.status, detail: body?.errors }, { status: 502 })
        }
        return Response.json({ config, token: 'OK (minted, redacted)' })
      },
    },
  },
})
