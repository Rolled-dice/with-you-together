import { useEffect, useState } from "react";

type Permission = NotificationPermission | "unsupported" | "checking";
export function NotificationPermissionStatus() {
  const [permission, setPermission] = useState<Permission>("checking");
  useEffect(() => {
    const update = () =>
      setPermission(
        !window.isSecureContext || !("Notification" in window)
          ? "unsupported"
          : Notification.permission,
      );
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const copy: Record<Permission, string> = {
    checking: "Checking this browser’s notification settings…",
    default: "This browser hasn’t been given notification permission.",
    granted: "Notifications are allowed in this browser. Device settings may still silence alerts.",
    denied:
      "Notifications are blocked in this browser. You can change this in your browser’s site settings.",
    unsupported: "This browser or connection doesn’t support device notifications.",
  };
  return (
    <section
      className="my-6 rounded-2xl border border-border bg-surface p-5"
      aria-label="Notification settings"
    >
      <h2 className="font-semibold">Your notifications</h2>
      <p className="mt-2 text-sm" role="status">
        {copy[permission]}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Updates are available in your notification inbox while you use SomeoneNear. Background push
        delivery is not available yet.
      </p>
    </section>
  );
}
