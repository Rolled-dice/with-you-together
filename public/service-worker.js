self.addEventListener("push", (event) => {
  let destination = "/reminders";
  try {
    const received = event.data?.json();
    if (
      typeof received?.destination === "string" &&
      received.destination.startsWith("/") &&
      !received.destination.startsWith("//")
    ) {
      destination = received.destination;
    }
  } catch {
    // A malformed payload should never stop a generic notification.
  }
  const notification = {
    body: "You have an update waiting in SomeoneNear.",
    icon: "/favicon-64.png",
    badge: "/favicon-64.png",
    tag: "someonenear-update",
    data: { path: destination },
  };

  event.waitUntil(self.registration.showNotification("SomeoneNear", notification));
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
