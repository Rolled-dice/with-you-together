// Browser-side Razorpay helper: loads the Razorpay Checkout script on demand
// and opens the subscription checkout widget. Mirrors the shape of stripe.ts.
//
// The public Key ID is safe to expose to the browser (it is not the secret).
// It is provided via VITE_RAZORPAY_KEY_ID. Test keys start with `rzp_test_`,
// live with `rzp_live_`.

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpayEnv = "sandbox" | "live";

export function getRazorpayKeyId(): string {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
  if (!key) {
    throw new Error(
      "Razorpay is not configured for this build. Set VITE_RAZORPAY_KEY_ID.",
    );
  }
  return key;
}

export function getRazorpayEnvironment(): RazorpayEnv {
  const key = getRazorpayKeyId();
  if (key.startsWith("rzp_live_")) return "live";
  return "sandbox";
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay can only load in the browser"));
  }
  if ((window as any).Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay checkout")),
      );
      if ((window as any).Razorpay) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export interface RazorpayCheckoutOptions {
  subscriptionId: string;
  name?: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  onSuccess?: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
}

/**
 * Opens the Razorpay subscription checkout modal for a previously created
 * subscription. The actual activation is confirmed server-side via webhook;
 * onSuccess is only a UX signal (do not grant access from it alone).
 */
export async function openRazorpaySubscriptionCheckout(
  options: RazorpayCheckoutOptions,
): Promise<void> {
  await loadRazorpayScript();
  const RazorpayCtor = (window as any).Razorpay;
  if (!RazorpayCtor) throw new Error("Razorpay checkout unavailable");

  const rzp = new RazorpayCtor({
    key: getRazorpayKeyId(),
    subscription_id: options.subscriptionId,
    name: options.name ?? "SomeoneNear",
    description: options.description ?? "Care Membership",
    ...(options.prefill && { prefill: options.prefill }),
    handler: options.onSuccess,
    modal: {
      ondismiss: options.onDismiss,
    },
  });
  rzp.open();
}
