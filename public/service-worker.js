self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let destination = "/reminders";
  let title = "SomeoneNear";
  let body = "You have an update waiting in SomeoneNear.";
  let tag = "someonenear-reminder";

  if (event.data) {
    try {
      const data = event.data.json();
      const payload = data?.data || data || {};

      if (typeof payload.title === "string" && payload.title.trim()) {
        title = payload.title.trim();
      } else if (typeof data.title === "string" && data.title.trim()) {
        title = data.title.trim();
      }

      if (typeof payload.body === "string" && payload.body.trim()) {
        body = payload.body.trim();
      } else if (typeof data.body === "string" && data.body.trim()) {
        body = data.body.trim();
      } else if (typeof payload.message === "string" && payload.message.trim()) {
        body = payload.message.trim();
      }

      const candidateDest = payload.destination || payload.url || data?.destination;
      if (
        typeof candidateDest === "string" &&
        candidateDest.startsWith("/") &&
        !candidateDest.startsWith("//")
      ) {
        destination = candidateDest;
      }
      if (payload.tag) {
        tag = String(payload.tag);
      }
    } catch {
      // If it's plain text rather than JSON
      try {
        const text = event.data.text();
        if (text && text.trim()) {
          body = text.trim();
        }
      } catch {
        // Fall back to default
      }
    }
  }

  const notification = {
    body,
    icon: "/icon-192.png?v=16",
    badge: "/favicon-64.png?v=16",
    tag,
    data: { path: destination },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, notification));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const path = event.notification.data?.path || "/reminders";
      const target = new URL(path, self.location.origin).href;
      const openClient = clients.find((client) => client.url.startsWith(self.location.origin));

      if (openClient) {
        return openClient.navigate(target).then(() => openClient.focus());
      }

      return self.clients.openWindow(target);
    }),
  );
});
