import { deliveryRpc } from "./family-delivery.server";

export async function deliverDueMessages() {
  const delivered = await deliveryRpc("deliver_family_messages");
  return { delivered: Number(delivered) };
}
