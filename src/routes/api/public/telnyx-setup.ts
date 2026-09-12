import { createFileRoute } from '@tanstack/react-router'

// TEMPORARY setup route — creates a Telnyx Telephony Credential for the WebRTC
// softphone using the saved API key. Deleted after setup completes.
export const Route = createFileRoute('/api/public/telnyx-setup')({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = (process.env['TELNYX_API_KEY'] ?? '').trim()
        const connectionId = '3047162965275968687'
        if (!apiKey) {
          return Response.json({ error: 'TELNYX_API_KEY missing' }, { status: 500 })
        }
        // List existing credentials first
        const listRes = await fetch(
          `https://api.telnyx.com/v2/telephony_credentials?filter[connection_id]=${connectionId}`,
          { headers: { Authorization: `Bearer ${apiKey}` } },
        )
        const listBody = await listRes.json()
        const existing = Array.isArray(listBody?.data) ? listBody.data : []
        if (existing.length > 0) {
          return Response.json({ action: 'found_existing', credential_id: existing[0].id, status: existing[0].status })
        }
        // Create a new telephony credential bound to the connection
        const createRes = await fetch('https://api.telnyx.com/v2/telephony_credentials', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection_id: connectionId,
            name: 'SomeoneNear WebRTC Softphone',
            tag: 'someonenear-softphone',
          }),
        })
        const createBody = await createRes.json()
        if (!createRes.ok) {
          return Response.json({ error: 'create_failed', status: createRes.status, detail: createBody?.errors }, { status: 502 })
        }
        return Response.json({ action: 'created', credential_id: createBody?.data?.id })
      },
    },
  },
})
