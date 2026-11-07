import { useEffect, useRef, useState } from "react";
import { playVoices } from "@/lib/interaction-feedback";
const icons = ["☕", "🌼", "🥭", "🧣", "📻", "🎨"];
const spices = ["Cardamom", "Saffron", "Ginger Chai", "Marigold", "Cinnamon", "Star Anise"];
const tabs = [
  ["bubbles", "🫧 Chatak-Patak Spice Pop"],
  ["memory", "🃏 Keepsake Memory Match"],
  ["bowl", "🥣 432Hz Singing Bowl"],
  ["barnaby", "🐱 Barnaby the Cat"],
];
type Card = { icon: string; flipped: boolean; matched: boolean };
function deck() {
  return [...icons, ...icons].map((icon) => ({ icon, flipped: false, matched: false }));
}
export function CalmSanctuary() {
  const [active, setActive] = useState("bubbles");
  const [popped, setPopped] = useState<number[]>([]);
  const [cards, setCards] = useState<Card[]>(deck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [purrs, setPurrs] = useState(0);
  const [muted, setMuted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  function sound(frequency: number, duration = 0.3) {
    if (muted) return;
    playVoices([{ frequency, duration, volume: 0.045 }]);
  }
  function shuffle() {
    timers.current.forEach(clearTimeout);
    setFlipped([]);
    const next = deck();
    for (let index = next.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [next[index], next[other]] = [next[other], next[index]];
    }
    setCards(next);
  }
  function flip(index: number) {
    if (flipped.length === 2 || cards[index].flipped || cards[index].matched) return;
    sound(600);
    const next = cards.map((card, i) => (i === index ? { ...card, flipped: true } : card));
    setCards(next);
    const selected = [...flipped, index];
    setFlipped(selected);
    if (selected.length === 2) {
      const [first, second] = selected,
        matched = next[first].icon === next[second].icon;
      timers.current.push(
        setTimeout(
          () => {
            setCards((previous) =>
              previous.map((card, i) =>
                i === first || i === second ? { ...card, flipped: matched, matched } : card,
              ),
            );
            setFlipped([]);
          },
          matched ? 350 : 700,
        ),
      );
    }
  }
  return (
    <section className="sn-sanctuary" data-click-sound="off">
      <div className="sn-sanctuary-intro">
        <div>
          <span className="sn-sanctuary-badge">🎮 Cozy Solo-Living Game &amp; ASMR Sanctuary</span>
          <h1>Tactile calm for quiet afternoons &amp; 2am moments</h1>
          <p>Gentle games and harmonic soundscapes, at your own pace.</p>
        </div>
        <button
          type="button"
          className="sn-worker-secondary"
          aria-pressed={muted}
          onClick={() => {
            setMuted(!muted);
          }}
        >
          Sound {muted ? "off" : "on"}
        </button>
      </div>
      <div className="sn-worker-game-tabs" role="tablist" aria-label="Calm activities">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={active === id}
            aria-controls="calm-game-panel"
            id={`game-${id}`}
            onClick={() => {
              setActive(id);
              sound(554);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="calm-game-panel"
        role="tabpanel"
        aria-labelledby={`game-${active}`}
        className="sn-sanctuary-panel"
      >
        {active === "bubbles" && (
          <>
            <div className="sn-worker-panel-title">
              <p aria-live="polite">
                Tap the warm spice bubbles for instant ASMR pops ({popped.length}/18 popped)
              </p>
              <button type="button" className="sn-worker-secondary" onClick={() => setPopped([])}>
                Reset Sheet
              </button>
            </div>
            <div className="sn-spice-grid">
              {Array.from({ length: 18 }, (_, index) => (
                <button
                  type="button"
                  key={index}
                  aria-pressed={popped.includes(index)}
                  className={`sn-spice sn-spice-${index % 4}`}
                  onClick={() => {
                    sound(340 + index * 24, 0.1);
                    setPopped((previous) =>
                      previous.includes(index)
                        ? previous.filter((item) => item !== index)
                        : [...previous, index],
                    );
                  }}
                >
                  <strong>{popped.includes(index) ? "✓ Pop!" : "🫧"}</strong>
                  <span>{spices[index % 6]}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {active === "memory" && (
          <>
            <div className="sn-worker-panel-title">
              <p aria-live="polite">
                Match the warm family keepsake pairs (
                {cards.filter((card) => card.matched).length / 2}/6 matched)
              </p>
              <button type="button" className="sn-worker-secondary" onClick={shuffle}>
                Shuffle Deck
              </button>
            </div>
            <div className="sn-memory-grid">
              {cards.map((card, index) => (
                <button
                  type="button"
                  key={index}
                  aria-label={
                    card.flipped || card.matched
                      ? `${card.icon}${card.matched ? " matched" : ""}`
                      : `Reveal card ${index + 1}`
                  }
                  disabled={card.matched}
                  aria-pressed={card.flipped || card.matched}
                  onClick={() => flip(index)}
                >
                  {card.flipped || card.matched ? card.icon : "💛"}
                </button>
              ))}
            </div>
          </>
        )}
        {active === "bowl" && (
          <div className="sn-bowl-panel">
            <button
              className="sn-singing-bowl"
              type="button"
              onClick={() => {
                sound(432, 2.2);
                sound(648, 2.2);
                sound(864, 2.2);
                setStrikes((previous) => previous + 1);
              }}
            >
              <span>🥣</span>Strike Bowl
            </button>
            <p aria-live="polite">
              Tap the brass singing bowl to release a 432Hz harmonic chord. Struck {strikes} times
              this session.
            </p>
          </div>
        )}
        {active === "barnaby" && (
          <div className="sn-worker-panel-title">
            <div>
              <span className="sn-worker-status">🐾 Virtual Window-Sill Companion</span>
              <h2>Barnaby is napping by the warm teacup</h2>
              <p>Pet Barnaby for a gentle harmonic chime. {purrs} purrs this session.</p>
            </div>
            <button
              type="button"
              className="sn-worker-button"
              onClick={() => {
                sound(448, 0.6);
                setPurrs((previous) => previous + 1);
              }}
            >
              🐱 Pet Barnaby ({purrs} ♥)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
