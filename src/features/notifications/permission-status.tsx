import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  removeMyPushSubscription,
  saveMyPushSubscription,
  sendTestPushNotification,
} from "@/lib/notifications.functions";

type Permission = NotificationPermission | "unsupported" | "checking";

const vapidPublicKey =
  (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined) ||
  "BPa0mpq1msEHQGNIUhxE9S5qIKdL90ynoJ2mEFMlDpNQDZQ8nIo5HfFjKLOWXbj7dWDA0BuLB_CopzMMQUdhokM";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function registerPushDevice() {
  if (!navigator.serviceWorker || !window.PushManager || !vapidPublicKey) {
    throw new Error("Device notifications are not configured for this site yet.");
  }
  await navigator.serviceWorker.register("/service-worker.js");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(vapidPublicKey),
  });
  await saveMyPushSubscription({
    data: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))),
      },
    },
  });
}
export function NotificationPermissionStatus() {
  const [permission, setPermission] = useState<Permission>("checking");
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const testPushFn = useServerFn(sendTestPushNotification);
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
  const canUsePush =
    permission === "granted" &&
    !!vapidPublicKey &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await registerPushDevice();
      setDeviceEnabled(true);
      setMessage("This device is ready for private reminder alerts.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable device notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removeMyPushSubscription({ data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setDeviceEnabled(false);
      setMessage("Device reminder alerts are off.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not disable device notifications.",
      );
    } finally {
      setBusy(false);
    }
  };
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
        Updates are always available in your notification inbox. Device alerts are private and can
        be turned off at any time.
      </p>
      {permission === "default" && (
        <button
          type="button"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          onClick={async () => {
            const result = await Notification.requestPermission();
            setPermission(result);
          }}
          disabled={busy}
        >
          Allow device notifications
        </button>
      )}
      {permission === "granted" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            onClick={deviceEnabled ? disable : enable}
            disabled={busy || !canUsePush}
          >
            {busy ? "Updating…" : deviceEnabled ? "Turn off on this device" : "Enable on this device"}
          </button>
          {deviceEnabled && (
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                try {
                  const res = await testPushFn();
                  setMessage(`Test alert sent! (${res.sent} active device notified with vibration)`);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Failed to send test push.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              🔔 Send Test Phone Alert
            </button>
          )}
        </div>
      )}
      {!canUsePush && permission === "granted" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Background alerts will become available after the site’s push service is configured.
        </p>
      )}
      {typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone)) && (
          <p className="mt-3 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
            💡 <strong>iPhone / iPad tip:</strong> To receive lock-screen reminder notifications, tap the Safari Share button (box with arrow up) and choose <strong>"Add to Home Screen"</strong>.
          </p>
        )}
      {message && (
        <p className="mt-2 text-sm font-medium text-primary" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
