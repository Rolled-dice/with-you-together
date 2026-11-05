import { useEffect, useState } from "react";
import { playSingingBowl } from "@/lib/interaction-feedback";

const rhythms = {
  settle: {
    title: "Settle",
    label: "In 4 · Out 6",
    steps: [
      { label: "Breathe in slowly…", seconds: 4 },
      { label: "Breathe out gently…", seconds: 6 },
    ],
  },
  box: {
    title: "Box",
    label: "4 · 4 · 4 · 4",
    steps: [
      { label: "Breathe in slowly…", seconds: 4 },
      { label: "Hold softly…", seconds: 4 },
      { label: "Breathe out gently…", seconds: 4 },
      { label: "Rest quietly…", seconds: 4 },
    ],
  },
  sleepy: {
    title: "Sleepy",
    label: "4 · 7 · 8",
    steps: [
      { label: "Breathe in slowly…", seconds: 4 },
      { label: "Hold gently…", seconds: 7 },
      { label: "Long, slow exhale…", seconds: 8 },
    ],
  },
};
type Rhythm = keyof typeof rhythms;
export function CompanionCalm({ visible = true }: { visible?: boolean }) {
  const [mode, setMode] = useState("breathe");
  const [rhythm, setRhythm] = useState<Rhythm>("settle");
  const [active, setActive] = useState(false);
  const [rhythmVersion, setRhythmVersion] = useState(0);
  const [cycle, setCycle] = useState({ phase: 0, remaining: 4 });
  const [worry, setWorry] = useState("");
  const [floating, setFloating] = useState<{ id: string; text: string }[]>([]);
  const steps = rhythms[rhythm].steps;
  useEffect(() => {
    if (!active || mode !== "breathe" || !visible) return;
    const timer = setInterval(
      () =>
        setCycle((previous) =>
          previous.remaining > 1
            ? { ...previous, remaining: previous.remaining - 1 }
            : {
                phase: (previous.phase + 1) % steps.length,
                remaining: steps[(previous.phase + 1) % steps.length].seconds,
              },
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [active, mode, steps, visible]);
  function selectRhythm(value: Rhythm) {
    setRhythmVersion((previous) => previous + 1);
    setRhythm(value);
    setCycle({ phase: 0, remaining: 4 });
    setActive(false);
  }
  return (
    <section className="sn-midnight-panel sn-companion-calm">
      <div className="sn-worker-panel-title">
        <div>
          <span className="sn-worker-status">🫧 A calm minute</span>
          <h2>Breathe and let it go</h2>
          <p>Go at your own pace. These moments stay on this page.</p>
        </div>
        <div className="sn-worker-game-tabs" role="tablist" aria-label="Calm Space mode">
          <button
            role="tab"
            type="button"
            aria-selected={mode === "breathe"}
            onClick={() => {
              if (mode === "breathe") return;
              setMode("breathe");
              setCycle({ phase: 0, remaining: 4 });
              setActive(false);
            }}
          >
            🌬️ Breathe
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={mode === "float"}
            onClick={() => {
              setMode("float");
              setActive(false);
            }}
          >
            🎈 Let it float
          </button>
        </div>
      </div>
      {mode === "breathe" ? (
        <div className="sn-breath-layout">
          <div className="sn-breath-stage">
            <div
              key={`${rhythm}-${rhythmVersion}`}
              className={`sn-breath-orb sn-breath-${rhythm}`}
              style={{ animationPlayState: active && visible ? "running" : "paused" }}
              aria-hidden="true"
            >
              <span>🌙</span>
            </div>
            <div className="sn-breath-caption" role="status">
              <h3>{active ? steps[cycle.phase].label : "A little space to breathe"}</h3>
              <p>
                {active
                  ? `${cycle.remaining}s · ${rhythms[rhythm].label}`
                  : "Press Start whenever you’re ready."}
              </p>
            </div>
            <button type="button" className="sn-worker-button" onClick={() => setActive(!active)}>
              {active ? "Pause breathing" : "Start breathing"}
            </button>
          </div>
          <div className="sn-breath-rhythms" role="group" aria-label="Breathing rhythm">
            {(Object.entries(rhythms) as [Rhythm, (typeof rhythms)[Rhythm]][]).map(
              ([id, value]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={rhythm === id}
                  onClick={() => selectRhythm(id)}
                >
                  <strong>{value.title}</strong>
                  <span>{value.label}</span>
                  <p>
                    {id === "settle"
                      ? "A gentle everyday rhythm."
                      : id === "box"
                        ? "A steady four-count rhythm."
                        : "An unhurried late-night rhythm."}
                  </p>
                </button>
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="sn-worry-stage">
          <h3>Name a worry and watch it float away</h3>
          <p>Not saved, scored or sent to anyone. Tap a floating thought to dissolve it.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!worry.trim()) return;
              setFloating((previous) =>
                [{ id: crypto.randomUUID(), text: worry.trim() }, ...previous].slice(0, 4),
              );
              setWorry("");
              playSingingBowl();
            }}
          >
            <input
              aria-label="A worry to release"
              value={worry}
              maxLength={280}
              onChange={(event) => setWorry(event.target.value)}
              placeholder="Name a thought you’d like to put down…"
            />
            <button
              type="submit"
              data-click-sound="off"
              className="sn-worker-button"
              disabled={!worry.trim()}
            >
              🎈 Let It Float Away
            </button>
          </form>
          <div className="sn-floating-worries" aria-live="polite">
            {floating.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-label={`Dissolve worry: ${item.text}`}
                onClick={() =>
                  setFloating((previous) => previous.filter((value) => value.id !== item.id))
                }
              >
                <span>“{item.text}”</span>
                <small>Floating away… · Tap to dissolve</small>
                <span aria-hidden="true">🎈</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
