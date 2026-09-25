const dodoMode = import.meta.env.VITE_DODO_MODE === "live" ? "live" : "test";

export function PaymentTestModeBanner() {
  if (dodoMode === "live") return null;

  return (
    <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-sm text-orange-800">
      Payments are in Dodo sandbox mode. No real charges will be collected.
    </div>
  );
}
