import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { marketForCountry } from "./launch-catalog";

// Display suggestion only; checkout must independently validate billing country.
export const getLaunchMarket = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest() as Request & { cf?: { country?: string } };
  return { market: marketForCountry(request.cf?.country ?? request.headers.get("cf-ipcountry") ?? undefined) };
});
