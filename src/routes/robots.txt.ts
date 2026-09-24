import { createAPIFileRoute } from '@tanstack/start/api'

export const Route = createAPIFileRoute('/robots.txt')({
  GET: () => {
    const robots = `User-agent: *
Allow: /
Sitemap: https://someonenear.com/sitemap.xml`

    return new Response(robots, {
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  },
})
