self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    /* Ignore malformed provider payloads. */
  }
  event.waitUntil(
    self.registration.showNotification("SomeoneNear", {
      body: "A reminder is ready. Open the app to review it.",
      icon: "/apple-touch-icon.png",
      badge: "/favicon-64.png",
      tag: typeof data.tag === "string" ? data.tag : "someonenear-reminder",
      data: { url: data.url === "/family" ? "/family" : "/reminders?view=everyday" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const path =
        event.notification.data?.url === "/family" ? "/family" : "/reminders?view=everyday";
      const url = new URL(path, self.location.origin).href;
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = clients.find((item) => new URL(item.url).origin === self.location.origin);
      if (client) {
        await client.navigate(url);
        await client.focus();
      } else await self.clients.openWindow(url);
    })(),
  );
});
