import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const storageKey = "sn_privacy_choice_v1";
const maxAge = 180 * 24 * 60 * 60 * 1000;
type Choices = { preferences: boolean; statistics: boolean; marketing: boolean };
type SavedChoices = Choices & { savedAt: number };
const essentialOnly: Choices = { preferences: false, statistics: false, marketing: false };

function readChoice(): SavedChoices | null {
  try {
    const choice = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      choice &&
      typeof choice.savedAt === "number" &&
      choice.savedAt <= Date.now() &&
      Date.now() - choice.savedAt < maxAge &&
      [choice.preferences, choice.statistics, choice.marketing].every(
        (value) => typeof value === "boolean",
      )
    )
      return choice;
  } catch {
    /* Browser storage may be unavailable. */
  }
  return null;
}

export function PrivacyPreferences() {
  const [banner, setBanner] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Choices>(essentialOnly);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let applying = false;
    const sync = () => {
      const provider = window.Cookiebot;
      if (provider?.hasResponse) {
        const choice = {
          preferences: provider.consent.preferences,
          statistics: provider.consent.statistics,
          marketing: provider.consent.marketing,
        };
        setDraft(choice);
        setBanner(false);
        try {
          const saved = readChoice();
          if (
            !saved ||
            saved.preferences !== choice.preferences ||
            saved.statistics !== choice.statistics ||
            saved.marketing !== choice.marketing
          )
            localStorage.setItem(storageKey, JSON.stringify({ ...choice, savedAt: Date.now() }));
        } catch {
          /* Keep the current-page choice. */
        }
      } else {
        const saved = readChoice();
        if (saved) {
          setDraft(saved);
          setBanner(false);
          if (provider?.submitCustomConsent && !applying) {
            applying = true;
            try {
              provider.submitCustomConsent(saved.preferences, saved.statistics, saved.marketing);
            } catch {
              setBanner(true);
            } finally {
              applying = false;
            }
          }
        } else setBanner(true);
      }
    };
    const show = () => {
      window.Cookiebot?.hide?.();
      setDraft(readChoice() ?? essentialOnly);
      setOpen(true);
      setMessage("");
    };
    const replaceBanner = () => {
      window.Cookiebot?.hide?.();
      sync();
    };
    sync();
    window.addEventListener("sn:open-privacy", show);
    window.addEventListener("CookiebotOnConsentReady", sync);
    window.addEventListener("CookiebotOnAccept", sync);
    window.addEventListener("CookiebotOnDecline", sync);
    window.addEventListener("CookiebotOnDialogDisplay", replaceBanner);
    return () => {
      window.removeEventListener("sn:open-privacy", show);
      window.removeEventListener("CookiebotOnConsentReady", sync);
      window.removeEventListener("CookiebotOnAccept", sync);
      window.removeEventListener("CookiebotOnDecline", sync);
      window.removeEventListener("CookiebotOnDialogDisplay", replaceBanner);
    };
  }, []);

  const save = (choice: Choices) => {
    let persisted = true;
    try {
      window.Cookiebot?.submitCustomConsent?.(
        choice.preferences,
        choice.statistics,
        choice.marketing,
      );
      window.Cookiebot?.hide?.();
    } catch {
      setMessage("The consent service could not update your choice. Please try again.");
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...choice, savedAt: Date.now() }));
    } catch {
      persisted = false;
    }
    setDraft(choice);
    setBanner(false);
    setOpen(false);
    setMessage(
      persisted
        ? "Privacy choices saved. You can change them in the footer."
        : "Privacy choices applied for this visit. Your browser could not remember them.",
    );
  };

  return (
    <>
      {banner && !open && (
        <section className="sn-privacy-banner" aria-label="Privacy and cookie choices">
          <div>
            <strong>🍪 Your privacy, your choice</strong>
            <p>
              We use essential storage for secure sign-in and your privacy choices. Choose whether
              to allow optional preferences, statistics and marketing.
            </p>
            <div className="sn-privacy-links">
              <Link to="/privacy">Privacy policy</Link>
              <Link to="/cookies">Cookie policy</Link>
            </div>
            {message && <p role="alert">{message}</p>}
          </div>
          <div className="sn-privacy-banner-actions">
            <button onClick={() => save(essentialOnly)}>Essential only</button>
            <button
              onClick={() => {
                setOpen(true);
                setMessage("");
              }}
            >
              Customize
            </button>
            <button onClick={() => save({ preferences: true, statistics: true, marketing: true })}>
              Accept all
            </button>
          </div>
        </section>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setDraft(readChoice() ?? essentialOnly);
          setOpen(next);
        }}
      >
        <DialogContent className="sn-privacy-dialog">
          <DialogTitle>Privacy &amp; cookie preferences</DialogTitle>
          <DialogDescription>
            Choose what this browser may remember. Essential storage stays on so sign-in and your
            privacy choices work.
          </DialogDescription>
          <div className="sn-privacy-category">
            <div>
              <strong>Essential storage</strong>
              <p>Account security, sign-in sessions and consent choices.</p>
            </div>
            <span>Always active</span>
          </div>
          {(
            [
              [
                "preferences",
                "Preferences",
                "Allow optional storage that remembers interface and display choices.",
              ],
              [
                "statistics",
                "Statistics",
                "Allow usage measurement if it is added. No analytics scripts are currently installed.",
              ],
              [
                "marketing",
                "Marketing",
                "Allow advertising measurement if it is added. No advertising scripts are currently installed.",
              ],
            ] as const
          ).map(([key, label, detail]) => (
            <label className="sn-privacy-category" key={key}>
              <div>
                <strong>{label}</strong>
                <p>{detail}</p>
              </div>
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                aria-label={`Allow ${label.toLowerCase()}`}
              />
            </label>
          ))}
          <p className="sn-privacy-detail">
            Globe customizations currently stay in page memory and reset when you reload. These
            controls do not delete your account or family data.
          </p>
          {message && <p role="alert">{message}</p>}
          <div className="sn-privacy-links">
            <Link to="/privacy" onClick={() => setOpen(false)}>
              Read privacy policy
            </Link>
            <Link to="/cookies" onClick={() => setOpen(false)}>
              Read cookie policy
            </Link>
          </div>
          <div className="sn-privacy-dialog-actions">
            <button onClick={() => save(essentialOnly)}>Essential only</button>
            <button onClick={() => save(draft)}>Save preferences</button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="sr-only" role="status">
        {message}
      </div>
    </>
  );
}
