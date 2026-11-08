import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LeafIcon, ListIcon, XIcon } from "@phosphor-icons/react";
import { Wordmark } from "@/components/landing/brand-mark";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";
import { SoundToggle } from "@/components/website-feedback";
import { useIdentity } from "@/features/session/session-store";
import { useSiteTheme } from "@/lib/frontend/use-site-theme";

const links = [
  ["/", "Home & Globe"],
  ["/dashboard", "Dashboard"],
  ["/family", "Family Circle"],
  ["/reminders", "Reminders"],
  ["/send-later", "Memories"],
  ["/companion", "Companion"],
  ["/insights", "Insights"],
  ["/safety", "Safety"],
  ["/settings", "Settings"],
  ["/docs", "Docs"],
] as const;

const landingLinks = [
  {
    id: "for-families",
    label: "For families",
    title: "Stay close, across any distance",
    detail:
      "A shared family circle for everyday updates, little memories, and the people you love.",
    note: "Care for your own circle",
    action: "Meet SomeoneNear",
  },
  {
    id: "service-demos",
    label: "What’s included",
    title: "Find your kind of everyday care",
    detail:
      "Explore listener calls, gentle reminders, family updates, your Companion, memories, and quiet moments.",
    note: "Six ways to feel closer",
    action: "Explore the services",
  },
  {
    id: "how-it-works",
    label: "How it works",
    title: "Closer, in three small steps",
    detail:
      "Make your family space, choose the care that fits, and build connection into your everyday rhythm.",
    note: "Start at your own pace",
    action: "See how it works",
  },
  {
    id: "plans",
    label: "Plans",
    title: "One family. A little more care.",
    detail:
      "Care includes 15 shared calls for 2 people. Care Plus includes 30 shared calls for 5 people. Both include all features.",
    note: "Seven-day trial · Local market prices",
    action: "Compare the plans",
  },
  {
    id: "calm-space",
    label: "Calm space",
    title: "A small pause, just for you",
    detail:
      "Try a quiet moment and a gentle breathing prompt. There’s no hurry, and nothing you need to finish.",
    note: "A moment to slow down",
    action: "Take a quiet moment",
  },
] as const;

export function SiteHeader({
  controls,
  staff = false,
  privateNavigation = false,
}: {
  controls?: ReactNode;
  staff?: boolean;
  privateNavigation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("for-families");
  const [preview, setPreview] = useState<string | null>(null);
  const identity = useIdentity();
  const signedIn = identity.initialized && Boolean(identity.userId);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => setReady(true), []);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setOpen(false);
    setPreview(null);
  }, [path]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (privateNavigation || path !== "/") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    for (const id of ["for-families", "service-demos", "how-it-works", "plans"]) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [path, privateNavigation]);
  useEffect(() => {
    if (!open && !preview) return;
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setPreview(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (preview) previewTriggerRef.current?.focus();
        else toggleRef.current?.focus();
        setOpen(false);
        setPreview(null);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, preview]);
  const previewContent = landingLinks.find((link) => link.id === preview);
  function showPreview(id: string, trigger: HTMLAnchorElement) {
    if (!window.matchMedia("(min-width: 1151px)").matches) return;
    previewTriggerRef.current = trigger;
    setPreview(id);
  }
  function navigateSection(id: string) {
    setOpen(false);
    setPreview(null);
    setActiveSection(id);
    if (id === "calm-space" && path === "/") window.dispatchEvent(new Event("sn:calm-space"));
  }
  const navigation = !staff && (
    <nav
      id="site-navigation"
      className={`sn-site-navigation ${privateNavigation ? "" : "sn-public-navigation"} ${open ? "is-open" : ""}`}
      aria-label="Main navigation"
    >
      {privateNavigation ? (
        links.map(([to, label]) => (
          <Link key={to} to={to} aria-current={path === to ? "page" : undefined}>
            {label}
          </Link>
        ))
      ) : (
        <>
          {landingLinks.map(({ id, label }, index) => (
            <a
              key={id}
              className={id === "calm-space" ? "sn-calm-link" : undefined}
              href={`/#${id}`}
              style={{ animationDelay: `${index * 40}ms` }}
              aria-current={path === "/" && activeSection === id ? "location" : undefined}
              aria-controls="sn-navigation-preview"
              aria-expanded={preview === id}
              onMouseEnter={(event) => showPreview(id, event.currentTarget)}
              onFocus={(event) => showPreview(id, event.currentTarget)}
              onClick={() => navigateSection(id)}
            >
              {id === "calm-space" && <LeafIcon size={17} aria-hidden="true" />}
              {label}
            </a>
          ))}
          <Link className="sn-mobile-auth-link" to={signedIn ? "/dashboard" : "/auth"} onClick={() => setOpen(false)}>
            {signedIn ? "Your space" : "Log in"}
          </Link>
        </>
      )}
    </nav>
  );
  return (
    <>
      <div className="sn-announcement">
        A little care, wherever your family calls home.{" "}
        <Link to="/" hash="how-it-works">
          See how
        </Link>
      </div>
      <header
        ref={headerRef}
        onMouseLeave={() => setPreview(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            setPreview(null);
          }
        }}
        className={`sn-site-header ${privateNavigation ? "" : "sn-marketing-header"} ${scrolled ? "is-scrolled" : ""}`}
      >
        <div className="sn-header-row">
          <Link to="/" aria-label="SomeoneNear home">
            <Wordmark />
          </Link>
          {!privateNavigation && navigation}
          <div className="sn-header-actions">
            {controls ??
              (!privateNavigation &&
                (signedIn ? (
                  <Link className="sn-button sn-nav-cta" to="/dashboard">
                    Your space
                  </Link>
                ) : (
                  <>
                    <Link className="sn-login-link" to="/auth">
                      Log in
                    </Link>
                    <Link className="sn-button sn-nav-cta" to="/auth" search={{ mode: "signup" }}>
                      Try for free
                    </Link>
                  </>
                )))}
            {!staff && (
              <button
                ref={toggleRef}
                type="button"
                disabled={!ready}
                className="sn-menu-toggle"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="site-navigation"
                aria-label={open ? "Close navigation" : "Open navigation"}
              >
                {open ? <XIcon size={22} /> : <ListIcon size={22} />}{" "}
                <span className="sn-menu-label">Menu</span>
              </button>
            )}
          </div>
        </div>
        {privateNavigation && navigation}
        {!privateNavigation && !staff && (
          <div
            id="sn-navigation-preview"
            className={`sn-navigation-preview ${previewContent ? "is-open" : ""}`}
            inert={!previewContent}
          >
            {previewContent && (
              <div className="sn-preview-inner">
                <div>
                  <span className="sn-preview-label">{previewContent.label}</span>
                  <h2>{previewContent.title}</h2>
                  <p>{previewContent.detail}</p>
                </div>
                <p className="sn-preview-note">
                  <LeafIcon size={25} aria-hidden="true" />
                  {previewContent.note}
                </p>
                <div className="sn-preview-actions">
                  <a
                    className="sn-button"
                    href={`/#${previewContent.id}`}
                    onClick={() => navigateSection(previewContent.id)}
                  >
                    {previewContent.action}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      previewTriggerRef.current?.focus();
                      setPreview(null);
                    }}
                  >
                    Close preview
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}

export function SiteFooter() {
  const [theme] = useSiteTheme();
  return (
    <footer className="sn-site-footer" data-footer-theme={theme}>
      <div>
        <Link to="/" aria-label="SomeoneNear home">
          <Wordmark />
        </Link>
        <p>
          Warm family presence. A space for everyday care, connection, and the people who matter.
        </p>
      </div>
      <div>
        <h2>Your space</h2>
        <Link to="/dashboard">Family care hub</Link>
        <Link to="/family">Family circle</Link>
        <Link to="/reminders">Gentle reminders</Link>
        <Link to="/send-later">Memories to keep</Link>
      </div>
      <div>
        <h2>Wellness & guides</h2>
        <Link to="/companion">Room to talk</Link>
        <Link to="/insights">Your reflections</Link>
        <Link to="/safety">Safety & support</Link>
        <Link to="/docs">SomeoneNear guides</Link>
      </div>
      <div>
        <h2>Privacy & choices</h2>
        <Link to="/privacy">Privacy policy</Link>
        <Link to="/terms">Terms of service</Link>
        <Link to="/cookies">Cookie policy</Link>
        <PrivacyChoicesButton />
        <SoundToggle />
      </div>
      <small>© {new Date().getFullYear()} SomeoneNear. With you together.</small>
    </footer>
  );
}
