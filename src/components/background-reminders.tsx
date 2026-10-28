import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPushConfig, getPushStatus, subscribePush } from "@/lib/push.functions";
import { removeCurrentPushDevice } from "@/lib/push-browser";
import { Button } from "@/components/ui/button";
import { BellIcon, BellSlashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

export function BackgroundReminders() {
  const configFn = useServerFn(getPushConfig);
  const statusFn = useServerFn(getPushStatus);
  const subscribe = useServerFn(subscribePush);
  const [config, setConfig] = useState<{ enabled: boolean; publicKey: string }>();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const [installFirst, setInstallFirst] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    setSupported(
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    );
    setInstallFirst(
      (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
        !window.matchMedia("(display-mode: standalone)").matches,
    );
    setDenied("Notification" in window && Notification.permission === "denied");
    let active = true;
    void configFn()
      .then(async (value) => {
        if (active) setConfig(value);
        if (!("serviceWorker" in navigator)) return;
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
          const status = await statusFn({ data: { endpoint: subscription.endpoint } });
          if (active) setEnabled(status.enabled);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [configFn, statusFn]);
  async function toggle() {
    setBusy(true);
    try {
      if (enabled) {
        await removeCurrentPushDevice();
        setEnabled(false);
        return;
      }
      if (!config?.enabled) throw new Error("Background reminders are not available yet.");
      const permission = await Notification.requestPermission();
      setDenied(permission === "denied");
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const normalized = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const key = Uint8Array.from(
        atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      const json = subscription.toJSON();
      try {
        await subscribe({
          data: {
            endpoint: subscription.endpoint,
            p256dh: json.keys!.p256dh,
            auth: json.keys!.auth,
          },
        });
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setEnabled(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notifications could not be enabled.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 border-t border-border py-5"
      aria-labelledby="background-reminders-title"
    >
      <h2 id="background-reminders-title" className="text-lg font-semibold">
        Reminder notifications
      </h2>
      <p className="text-sm text-muted-foreground">
        Notifications on this device show a private message. Reminder details stay inside your
        account.
      </p>
      {installFirst ? (
        <p>
          On iPhone or iPad, use Share, then Add to Home Screen. Open SomeoneNear from that icon to
          enable notifications.
        </p>
      ) : (
        <Button
          variant="outline"
          onClick={toggle}
          disabled={busy || !supported || (!enabled && (!config?.enabled || denied))}
        >
          {enabled ? <BellSlashIcon /> : <BellIcon />}
          {busy ? "Updating..." : enabled ? "Turn off on this device" : "Enable on this device"}
        </Button>
      )}
      {config && !config.enabled && !enabled && (
        <p className="text-sm">Background notifications are not available yet.</p>
      )}
      {denied && (
        <p className="text-sm">
          Notifications are blocked. You can allow them in your browser or device settings.
        </p>
      )}
      {!installFirst && !supported && (
        <p className="text-sm">This browser does not support background notifications.</p>
      )}
      <p className="text-sm text-muted-foreground">Your reminders remain available in the app.</p>
    </section>
  );
}
