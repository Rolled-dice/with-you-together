/**
 * Shared pointer tracker for orb eye-tracking.
 *
 * One `pointermove` listener and one rAF for the whole page, no matter how many
 * orbs subscribe. Each orb then works out its own gaze offset from the shared
 * coordinates. The naive alternative — a listener per orb — would fire dozens of
 * handlers per mouse move and force a layout read in each.
 *
 * The listener is only attached while at least one orb is subscribed, and is
 * torn down when the last one unsubscribes.
 */

type GazeListener = (pointerX: number, pointerY: number) => void;

const listeners = new Set<GazeListener>();

let attached = false;
let frame = 0;
let lastX = 0;
let lastY = 0;

function flush() {
  frame = 0;
  for (const fn of listeners) fn(lastX, lastY);
}

function onPointerMove(event: PointerEvent) {
  lastX = event.clientX;
  lastY = event.clientY;
  // Coalesce to one notification per frame; pointermove can fire far more
  // often than the display refreshes.
  if (!frame) frame = requestAnimationFrame(flush);
}

function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener("pointermove", onPointerMove, { passive: true });
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener("pointermove", onPointerMove);
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

/**
 * True only where eye-tracking makes sense: a real pointing device, and no
 * reduced-motion request. Touch screens have no hover cursor to follow, so the
 * eyes would simply never move.
 */
export function gazeSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia("(pointer: fine)").matches) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

export function subscribeGaze(fn: GazeListener): () => void {
  listeners.add(fn);
  attach();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) detach();
  };
}

/**
 * How far the pupils travel, in the orb's own 48-unit viewBox. Kept small on
 * purpose: past roughly 2 units the pupils start to clip the eye whites and the
 * face reads as cross-eyed rather than attentive.
 */
export const GAZE_MAX = 1.9;

/** Distance in px at which the orb is looking as far as it can. */
const GAZE_FALLOFF = 520;

/** Converts a pointer position into a clamped pupil offset for one orb. */
export function gazeOffset(
  rect: { left: number; top: number; width: number; height: number },
  pointerX: number,
  pointerY: number,
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = pointerX - cx;
  const dy = pointerY - cy;

  const distance = Math.hypot(dx, dy) || 1;
  // Ease the magnitude so nearby movement is expressive and far-away movement
  // doesn't peg the eyes to the edge permanently.
  const reach = Math.min(1, distance / GAZE_FALLOFF);

  return {
    x: (dx / distance) * reach * GAZE_MAX,
    y: (dy / distance) * reach * GAZE_MAX,
  };
}
