import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  HouseIcon,
  FlowerLotusIcon,
  ChatCircleIcon,
  HeadphonesIcon,
  PillIcon,
  EnvelopeSimpleIcon,
  ChartLineIcon,
  UsersIcon,
  ShieldCheckIcon,
  GearIcon,
  SignOutIcon,
  DotsThreeIcon,
  HandWavingIcon,
} from "@phosphor-icons/react";
import { Wordmark } from "@/components/landing/brand-mark";
import { NotificationBell } from "@/components/notification-bell";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";
import { useIdentity } from "@/features/session/session-store";
import { getMyFamily } from "@/lib/family.functions";
import { MemberAppearanceProvider } from "./member-avatar";
import "./member.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SoundToggle } from "@/components/website-feedback";
import { useSiteTheme } from "@/lib/frontend/use-site-theme";

const navigation = [
  ["/dashboard", "Dashboard", HouseIcon],
  ["/calm", "Calm", FlowerLotusIcon],
  ["/companion", "Companion", ChatCircleIcon],
  ["/listeners", "Listeners", HeadphonesIcon],
  ["/reminders", "Medication", PillIcon],
  ["/send-later", "Send Later", EnvelopeSimpleIcon],
  ["/insights", "Insights", ChartLineIcon],
  ["/family", "Family", UsersIcon],
  ["/safety", "Safety", ShieldCheckIcon],
  ["/settings", "Settings", GearIcon],
] as const;
const mobilePrimary = ["/dashboard", "/listeners", "/family", "/reminders"];

export function MemberShell({ children, signOut }: { children: ReactNode; signOut: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { userId } = useIdentity();
  const familyFn = useServerFn(getMyFamily);
  const family = useQuery({
    queryKey: ["family", userId],
    queryFn: () => familyFn(),
    enabled: !!userId,
  });
  const [theme, setTheme] = useSiteTheme();
  const [simple, setSimple] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    try {
      setSimple(localStorage.getItem("sn_member_simple") === "true");
    } catch {
      /* Use warm defaults. */
    }
  }, []);
  useEffect(() => {
    setMoreOpen(false);
    setAssistOpen(false);
  }, [pathname]);
  useEffect(() => {
    const edit = () => setAvatarOpen(true);
    window.addEventListener("sn:edit-member-avatars", edit);
    return () => window.removeEventListener("sn:edit-member-avatars", edit);
  }, []);
  function preference(nextSimple: boolean) {
    setSimple(nextSimple);
    try {
      localStorage.setItem("sn_member_simple", String(nextSimple));
    } catch {
      /* Session-only preference. */
    }
  }
  function navItem(item: (typeof navigation)[number]) {
    const [to, label, Icon] = item;
    return (
      <Link
        key={to}
        to={to}
        onClick={() => setMoreOpen(false)}
        aria-current={
          pathname === to || (to === "/companion" && pathname.startsWith("/companion/"))
            ? "page"
            : undefined
        }
      >
        <Icon size={19} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <MemberAppearanceProvider
      members={family.data?.members ?? []}
      open={avatarOpen}
      onOpenChange={setAvatarOpen}
    >
      <div
        className={`sn-worker-app ${simple ? "sn-worker-simple" : ""}`}
        data-navigation-theme={theme}
        data-page={pathname.slice(1)}
      >
        <a href="#app-content" className="sn-skip-link">
          Skip to content
        </a>
        <aside className="sn-worker-sidebar">
          <Link to="/" aria-label="SomeoneNear home">
            <Wordmark />
          </Link>
          <nav aria-label="Member navigation">{navigation.map(navItem)}</nav>
          <button type="button" className="sn-worker-signout" onClick={signOut}>
            <SignOutIcon size={18} /> Sign out
          </button>
        </aside>
        <div className="sn-worker-body">
          <header className="sn-worker-toolbar">
            <Link className="sn-worker-mobile-brand" to="/" aria-label="SomeoneNear home">
              <Wordmark />
            </Link>
            <div className="sn-worker-toolbar-controls">
              <SoundToggle />
              <div className="sn-worker-theme" role="group" aria-label="Navigation theme">
                <button
                  type="button"
                  aria-pressed={theme === "cream"}
                  onClick={() => setTheme("cream")}
                >
                  ☀ Warm cream
                </button>
                <button
                  type="button"
                  aria-pressed={theme === "navy"}
                  onClick={() => setTheme("navy")}
                >
                  ☾ Deep navy
                </button>
              </div>
              <button
                type="button"
                className="sn-worker-parent"
                aria-pressed={simple}
                onClick={() => preference(!simple)}
              >
                Parent simple mode
              </button>
              <button
                className="sn-worker-customize"
                type="button"
                onClick={() => setAvatarOpen(true)}
              >
                Customize avatars
              </button>
              <NotificationBell label="Family updates" className="sn-worker-updates" />
            </div>
          </header>
          <nav className="sn-worker-care-tabs" aria-label="Care shortcuts">
            {[
              ["/dashboard", "Today"],
              ["/family", "Family"],
              ["/send-later", "My sharing"],
              ["/reminders", "Health"],
              ["/listeners", "Calls"],
            ].map(([to, label]) => (
              <Link key={to} to={to} aria-current={pathname === to ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <main key={pathname} id="app-content" className="sn-worker-main" tabIndex={-1}>
            {children}
          </main>
          <footer className="sn-worker-footer">
            <span>SomeoneNear · Warm family presence</span>
            <PrivacyChoicesButton />
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </footer>
        </div>
        <nav className="sn-worker-dock" aria-label="Mobile navigation">
          {navigation
            .filter(([to]) => mobilePrimary.includes(to))
            .sort((a, b) => mobilePrimary.indexOf(a[0]) - mobilePrimary.indexOf(b[0]))
            .map(navItem)}
          <button
            type="button"
            aria-label="More pages"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <DotsThreeIcon size={22} />
            <span>More</span>
          </button>
          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogContent className="sn-worker-dialog sn-worker-more">
              <DialogTitle>Your space</DialogTitle>
              <DialogDescription>All your care services, in one place.</DialogDescription>
              <nav aria-label="All member pages">{navigation.map(navItem)}</nav>
              <button type="button" onClick={signOut}>
                <SignOutIcon size={18} /> Sign out
              </button>
            </DialogContent>
          </Dialog>
        </nav>
        <Popover open={assistOpen} onOpenChange={setAssistOpen}>
          <PopoverTrigger asChild>
            <button className="sn-worker-assist" type="button" aria-label="Open Quick Care actions">
              <HandWavingIcon size={25} weight="fill" />
              <span>CARE</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={14}
            className="sn-quick-care"
            aria-label="Quick Care actions"
          >
            <div>
              <h2>✨ Quick Care</h2>
              <button
                type="button"
                aria-label="Close Quick Care"
                onClick={() => setAssistOpen(false)}
              >
                ×
              </button>
            </div>
            <p>A little care is just a tap away.</p>
            <nav aria-label="Quick Care">
              <Link to="/listeners" onClick={() => setAssistOpen(false)}>
                📞 Book a Human Listener Call
              </Link>
              <Link
                to="/reminders"
                search={{ action: "new-reminder" }}
                onClick={() => setAssistOpen(false)}
              >
                🔔 Set a Parent or Self Reminder
              </Link>
              <Link
                to="/send-later"
                search={{ section: "studio" }}
                onClick={() => setAssistOpen(false)}
              >
                🎙️ Record a Voice Blessing
              </Link>
              <Link
                to="/reminders"
                search={{ action: "add-medication" }}
                onClick={() => setAssistOpen(false)}
              >
                💊 Add a Pill Strip · PhotoMed
              </Link>
            </nav>
            <section className="sn-quick-care-help" aria-label="Help and enquiries">
              <Link to="/docs/faq" onClick={() => setAssistOpen(false)}>
                ❓ FAQs &amp; help →
              </Link>
              <p>For more information or any enquiry, email us:</p>
              <a href="mailto:care@someonenear.com">care@someonenear.com</a>
            </section>
          </PopoverContent>
        </Popover>
      </div>
    </MemberAppearanceProvider>
  );
}
