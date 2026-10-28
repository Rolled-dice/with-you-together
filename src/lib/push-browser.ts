import { disablePush } from "./push.functions";
export async function removeCurrentPushDevice(bestEffort = false) {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    await disablePush({ data: { endpoint: subscription.endpoint } }).catch((error) => {
      if (!bestEffort) throw error;
    });
    if (!(await subscription.unsubscribe()))
      throw new Error("Notifications could not be turned off. Please try again.");
    for (const notification of await registration!.getNotifications()) notification.close();
  } catch (error) {
    if (!bestEffort) throw error;
    // Logout must remain possible when a browser notification service is unavailable.
  }
}
