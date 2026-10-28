import { useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function ChatakArcade() {
  const [popped, setPopped] = useState<Set<number>>(() => new Set());
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [pattern, setPattern] = useState<"pop" | "bowl">("pop");
  useEffect(() => {
    const close = () => {
      if (document.hidden) void audio.current?.suspend();
    };
    document.addEventListener("visibilitychange", close);
    return () => {
      document.removeEventListener("visibilitychange", close);
      void audio.current?.close();
    };
  }, []);
  const play = async (index: number) => {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        pattern === "pop" ? 220 + index * 14 : 432 + (index % 5) * 54,
        start,
      );
      oscillator.frequency.exponentialRampToValueAtTime(pattern === "pop" ? 60 : 400, start + 0.12);
      gain.gain.setValueAtTime(0.065, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (pattern === "pop" ? 0.15 : 0.7));
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(start + (pattern === "pop" ? 0.16 : 0.72));
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      setSound(false);
      setAudioError(true);
    }
  };
  return (
    <section aria-labelledby="chatak-title" className="space-y-6 border-y border-border py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="chatak-title" className="text-xl font-bold">
            Chatak-Patak
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A tiny break. No timer, no score to beat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={sound ? "Mute sounds" : "Enable sounds"}
            title={sound ? "Mute sounds" : "Enable sounds"}
            onClick={() => {
              setSound(!sound);
              if (sound) void audio.current?.suspend();
            }}
          >
            {sound ? <SpeakerHighIcon /> : <SpeakerSlashIcon />}
          </Button>
          <Button variant="outline" onClick={() => setPopped(new Set())}>
            <ArrowCounterClockwiseIcon /> Start fresh
          </Button>
        </div>
      </div>
      <div role="group" aria-label="Sound style" className="flex gap-2">
        <Button
          variant={pattern === "pop" ? "default" : "outline"}
          aria-pressed={pattern === "pop"}
          onClick={() => setPattern("pop")}
        >
          Soft pops
        </Button>
        <Button
          variant={pattern === "bowl" ? "default" : "outline"}
          aria-pressed={pattern === "bowl"}
          onClick={() => setPattern("bowl")}
        >
          Gentle tones
        </Button>
      </div>
      <div className="care-arcade-grid" role="group" aria-label="Bubble wrap">
        {Array.from({ length: 48 }, (_, index) => (
          <button
            key={index}
            aria-label={`Bubble ${index + 1}`}
            aria-pressed={popped.has(index)}
            onClick={() => {
              if (popped.has(index)) return;
              setPopped((previous) => new Set([...previous, index]));
              void play(index);
            }}
          />
        ))}
      </div>
      <p role="status" className="text-center text-sm text-muted-foreground">
        {popped.size === 48
          ? "A fresh sheet is here whenever you want it."
          : `${48 - popped.size} little moments left`}
      </p>
      {audioError && (
        <p role="alert">Sound is unavailable in this browser. You can keep playing without it.</p>
      )}
    </section>
  );
}
