import { useEffect, useSyncExternalStore } from "react";
import {
  getSoundEnabled,
  loadSoundPreference,
  playSoftChime,
  setSoundEnabled,
  subscribeToSound,
} from "@/lib/interaction-feedback";

export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribeToSound, getSoundEnabled, () => true);
  return (
    <button
      type="button"
      aria-label={enabled ? "Mute interaction sounds" : "Enable interaction sounds"}
      aria-pressed={enabled}
      onClick={() => setSoundEnabled(!enabled)}
    >
      {enabled ? "♪ Sound on" : "♪ Sound off"}
    </button>
  );
}
export function WebsiteFeedback() {
  useEffect(() => {
    loadSoundPreference();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("button,a[href],[role=tab],[role=button]");
      if (
        !target ||
        target.closest('[data-click-sound="off"]') ||
        target.matches(':disabled,[aria-disabled="true"]')
      )
        return;
      playSoftChime(target.matches("[role=tab]") ? 1.08 : 1);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        target.classList.remove("sn-feedback-tap");
        void target.offsetWidth;
        target.classList.add("sn-feedback-tap");
        const timer = setTimeout(() => {
          target.classList.remove("sn-feedback-tap");
          timers.delete(timer);
        }, 320);
        timers.add(timer);
      }
    };
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      timers.forEach(clearTimeout);
    };
  }, []);
  return null;
}
