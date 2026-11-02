import { useSyncExternalStore } from "react";

type Identity = { initialized: boolean; userId: string | null; generation: number };
const initial: Identity = { initialized: false, userId: null, generation: 0 };
let identity = initial;
const listeners = new Set<() => void>();
export function getIdentity() {
  return identity;
}
export function setIdentity(userId: string | null) {
  const changed = identity.userId !== userId;
  if (identity.initialized && !changed) return false;
  identity = { initialized: true, userId, generation: identity.generation + (changed ? 1 : 0) };
  listeners.forEach((fn) => fn());
  return changed;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function useIdentity() {
  return useSyncExternalStore(subscribe, getIdentity, () => initial);
}
export function assertIdentity(generation: number) {
  if (identity.generation !== generation || !identity.userId)
    throw new DOMException("Session changed", "AbortError");
}
