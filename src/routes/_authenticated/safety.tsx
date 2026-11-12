import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useIdentity } from "@/features/session/session-store";
import { cn } from "@/lib/utils";
import { PhoneNumberField } from "@/components/phone-number-field";
import {
  LifebuoyIcon,
  PhoneIcon,
  ChatIcon,
  GlobeIcon,
  ShieldCheckIcon,
  HeartbeatIcon,
  CopyIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  PauseIcon,
  ArrowClockwiseIcon,
  WhatsappLogoIcon,
  FirstAidKitIcon,
  PrinterIcon,
  HeadphonesIcon,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/safety")({
  component: SafetyPage,
  head: () => ({
    meta: [
      { title: "Safety, Crisis Support & Emergency Care · SomeoneNear" },
      {
        name: "description",
        content:
          "Immediate emergency helplines, live listener callbacks, interactive box breathing, SOS messaging, and personal emergency care details.",
      },
    ],
  }),
});

type ResourceCategory = "all" | "crisis" | "seniors" | "text" | "youth" | "domestic";

type Resource = {
  region: string;
  name: string;
  detail: string;
  category: ResourceCategory;
  phone?: string;
  sms?: string;
  smsBody?: string;
  url?: string;
  hours?: string;
};

const EMERGENCY: { region: string; number: string; note: string }[] = [
  { region: "India", number: "112", note: "Police, Medical & Fire" },
  { region: "US & Canada", number: "911", note: "Emergency Services" },
  { region: "UK & Ireland", number: "999", note: "Emergency Services" },
  { region: "European Union", number: "112", note: "Universal Emergency" },
  { region: "Australia", number: "000", note: "Emergency Services" },
];

const HOTLINES: Resource[] = [
  // India
  {
    region: "India",
    name: "112 National Emergency",
    detail: "Single emergency response number across India for police, ambulance, and disaster assistance.",
    category: "crisis",
    phone: "112",
    hours: "24/7 Free",
  },
  {
    region: "India",
    name: "Elderline (National Senior Helpline)",
    detail: "Free national helpline for senior citizens setup by the Ministry of Social Justice & Empowerment for emotional support, rescue, and guidance.",
    category: "seniors",
    phone: "14567",
    hours: "Daily 8:00 AM – 8:00 PM",
    url: "https://socialjustice.gov.in",
  },
  {
    region: "India",
    name: "iCall Psychosocial Helpline (TISS)",
    detail: "Free, confidential professional psychosocial counseling by Tata Institute of Social Sciences.",
    category: "crisis",
    phone: "9152987821",
    hours: "Mon – Sat, 8:00 AM – 10:00 PM",
    url: "https://icallhelpline.org",
  },
  {
    region: "India",
    name: "Vandrevala Foundation",
    detail: "24/7 mental health counseling and crisis support in multiple Indian languages.",
    category: "crisis",
    phone: "9999666555",
    hours: "24/7 Free",
    url: "https://www.vandrevalafoundation.com",
  },
  {
    region: "India",
    name: "Women in Distress Helpline",
    detail: "Government emergency safety and counseling helpline for women.",
    category: "domestic",
    phone: "1091",
    hours: "24/7 Free",
  },

  // United States
  {
    region: "United States",
    name: "988 Suicide & Crisis Lifeline",
    detail: "Free, confidential support for anyone in distress or crisis. Call or text 988 anytime.",
    category: "crisis",
    phone: "988",
    sms: "988",
    hours: "24/7 Free (English & Spanish)",
    url: "https://988lifeline.org",
  },
  {
    region: "United States",
    name: "Crisis Text Line",
    detail: "Free text support with a trained crisis counselor.",
    category: "text",
    sms: "741741",
    smsBody: "HOME",
    hours: "24/7 Free",
    url: "https://www.crisistextline.org",
  },
  {
    region: "United States",
    name: "Eldercare Locator",
    detail: "Public service of the US Administration on Aging connecting older Americans and caregivers with local support services.",
    category: "seniors",
    phone: "1-800-677-1116",
    hours: "Mon – Fri, 9:00 AM – 8:00 PM ET",
    url: "https://eldercare.acl.gov",
  },
  {
    region: "United States",
    name: "Veterans Crisis Line",
    detail: "Caring, qualified VA responders for veterans, service members, and their families.",
    category: "crisis",
    phone: "988",
    sms: "838255",
    hours: "24/7 Free (Dial 988, press 1)",
    url: "https://www.veteranscrisisline.net",
  },
  {
    region: "United States",
    name: "The Trevor Project",
    detail: "Crisis intervention and suicide prevention services for LGBTQ+ young people.",
    category: "youth",
    phone: "1-866-488-7386",
    sms: "678678",
    smsBody: "START",
    hours: "24/7 Free",
    url: "https://www.thetrevorproject.org",
  },
  {
    region: "United States",
    name: "National Domestic Violence Hotline",
    detail: "Confidential support, crisis intervention, safety planning, and referral resources.",
    category: "domestic",
    phone: "1-800-799-7233",
    sms: "88788",
    smsBody: "START",
    hours: "24/7 Free",
    url: "https://www.thehotline.org",
  },

  // United Kingdom & Ireland
  {
    region: "United Kingdom & ROI",
    name: "Samaritans",
    detail: "Whatever you're going through, a Samaritan will face it with you 24 hours a day.",
    category: "crisis",
    phone: "116 123",
    hours: "24/7 Free",
    url: "https://www.samaritans.org",
  },
  {
    region: "United Kingdom & ROI",
    name: "The Silver Line (Age UK)",
    detail: "Free, confidential telephone service providing friendship and conversation for older people.",
    category: "seniors",
    phone: "0800 4 70 80 90",
    hours: "24/7 Free",
    url: "https://www.thesilverline.org.uk",
  },
  {
    region: "United Kingdom & ROI",
    name: "Shout Crisis Text Line",
    detail: "Free, confidential, 24/7 text service for anyone in the UK who is struggling to cope.",
    category: "text",
    sms: "85258",
    smsBody: "SHOUT",
    hours: "24/7 Free",
    url: "https://giveusashout.org",
  },

  // Canada
  {
    region: "Canada",
    name: "Talk Suicide Canada",
    detail: "Confidential, 24/7 suicide prevention support across Canada.",
    category: "crisis",
    phone: "1-833-456-4566",
    sms: "45645",
    hours: "Phone 24/7; Text 4pm – Midnight ET",
    url: "https://talksuicide.ca",
  },
  {
    region: "Canada",
    name: "Kids Help Phone",
    detail: "24/7 e-mental health service offering free, confidential support to young people.",
    category: "youth",
    phone: "1-800-668-6868",
    sms: "686868",
    smsBody: "CONNECT",
    hours: "24/7 Free",
    url: "https://kidshelpphone.ca",
  },

  // Australia
  {
    region: "Australia",
    name: "Lifeline Australia",
    detail: "24/7 crisis support and suicide prevention services for all Australians.",
    category: "crisis",
    phone: "13 11 14",
    sms: "0477 13 11 14",
    hours: "24/7 Free",
    url: "https://www.lifeline.org.au",
  },
  {
    region: "Australia",
    name: "Beyond Blue",
    detail: "Mental health support for depression, anxiety, and everyday well-being.",
    category: "crisis",
    phone: "1300 22 4636",
    hours: "24/7 Free",
    url: "https://www.beyondblue.org.au",
  },

  // Global
  {
    region: "Global",
    name: "Find A Helpline (Befrienders & Free Worldwide)",
    detail: "Free, confidential support from a local crisis centre in over 130 countries worldwide.",
    category: "crisis",
    url: "https://findahelpline.com",
    hours: "Global directory, verified daily",
  },
  {
    region: "Global",
    name: "Befrienders Worldwide",
    detail: "Global network of volunteer emotional support centers offering non-judgmental listening.",
    category: "crisis",
    url: "https://www.befrienders.org",
    hours: "Global directory",
  },
];

const GROUNDING_STEPS = [
  { count: "5", sense: "SEE", prompt: "Name 5 things you can see right now (e.g. lamp, window, floor)." },
  { count: "4", sense: "FEEL", prompt: "Touch 4 textures around you (e.g. blanket, wooden table, cotton sleeve)." },
  { count: "3", sense: "HEAR", prompt: "Listen for 3 distinct sounds (e.g. clock ticking, distant traffic, your breath)." },
  { count: "2", sense: "SMELL", prompt: "Notice 2 scents nearby (e.g. fresh air, coffee, soap, or clean clothes)." },
  { count: "1", sense: "TASTE", prompt: "Notice 1 taste in your mouth, or sip a cool glass of water." },
];

const SOS_TEMPLATES = [
  {
    title: "Gentle Check-in",
    message: "Hey, I'm going through a bit of an overwhelming moment right now and could really use a calm phone call or check-in when you're free. No rush, just wanted to reach out.",
  },
  {
    title: "Need a Listening Ear",
    message: "Hi, I'm feeling quite anxious and down today. You don't have to give advice or fix anything, but could we talk or message for a few minutes?",
  },
  {
    title: "Medical / Immediate Check",
    message: "Urgent: I'm not feeling well physically right now and need some assistance. Please call me back or check in as soon as you see this.",
  },
];

interface IceCardData {
  fullName: string;
  emergencyContact: string;
  emergencyPhone: string;
  doctorName: string;
  doctorPhone: string;
  bloodType: string;
  allergiesConditions: string;
}

const DEFAULT_ICE: IceCardData = {
  fullName: "",
  emergencyContact: "",
  emergencyPhone: "",
  doctorName: "",
  doctorPhone: "",
  bloodType: "Unknown",
  allergiesConditions: "",
};

function SafetyPage() {
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory>("all");
  const [search, setSearch] = useState("");

  // Interactive Box Breathing state
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhaseIndex, setBreathPhaseIndex] = useState(0);
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(4);
  const [cycleCount, setCycleCount] = useState(1);

  // User identity scoping for private health & emergency data
  const { userId } = useIdentity();
  const iceStorageKey = `sn_ice_card_v1_${userId || "anon"}`;

  // 5-4-3-2-1 Interactive checklist
  const [checkedSenses, setCheckedSenses] = useState<Record<string, boolean>>({});

  // ICE Card state (scoped per authenticated account to prevent cross-account leakage)
  const [iceCard, setIceCard] = useState<IceCardData>(DEFAULT_ICE);
  const [iceEditing, setIceEditing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(iceStorageKey);
      if (saved) {
        setIceCard(JSON.parse(saved));
      } else {
        setIceCard(DEFAULT_ICE);
      }
    } catch {
      setIceCard(DEFAULT_ICE);
    }
  }, [iceStorageKey]);

  const saveIceCard = (data: IceCardData) => {
    setIceCard(data);
    setIceEditing(false);
    try {
      localStorage.setItem(iceStorageKey, JSON.stringify(data));
      toast.success("Emergency Care Card saved to your account");
    } catch {
      toast.error("Could not save to local storage");
    }
  };

  // Resilient dial & SMS intent dispatchers
  const getSmsHref = (number: string, body?: string) => {
    const sanitized = number.replace(/[\s-]/g, "");
    if (!body) return `sms:${sanitized}`;
    const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const delimiter = isIOS ? "&" : "?";
    return `sms:${sanitized}${delimiter}body=${encodeURIComponent(body)}`;
  };

  const triggerDialIntent = (phone: string, label?: string) => {
    const sanitized = phone.replace(/[\s-]/g, "");
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(sanitized).catch(() => {});
    }
    toast.success(`Dialing ${label || sanitized}... (Number copied to clipboard)`);
    try {
      window.location.href = `tel:${sanitized}`;
    } catch {
      window.open(`tel:${sanitized}`, "_self");
    }
  };

  const triggerSmsIntent = (number: string, body?: string, label?: string) => {
    const href = getSmsHref(number, body);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(number).catch(() => {});
    }
    toast.success(`Opening SMS for ${label || number}...`);
    try {
      window.location.href = href;
    } catch {
      window.open(href, "_self");
    }
  };

  // Box breathing timer
  useEffect(() => {
    if (!breathingActive) return;

    const phases = [
      { name: "Inhale gently through nose", action: "Inhale", duration: 4 },
      { name: "Hold your breath gently", action: "Hold", duration: 4 },
      { name: "Exhale slowly through mouth", action: "Exhale", duration: 4 },
      { name: "Rest and hold", action: "Hold", duration: 4 },
    ];

    const interval = setInterval(() => {
      setBreathSecondsLeft((prev) => {
        if (prev <= 1) {
          setBreathPhaseIndex((currPhase) => {
            const next = (currPhase + 1) % 4;
            if (next === 0) setCycleCount((c) => c + 1);
            return next;
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathingActive]);

  const resetBreathing = () => {
    setBreathingActive(false);
    setBreathPhaseIndex(0);
    setBreathSecondsLeft(4);
    setCycleCount(1);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Copied ${label} to clipboard`),
      () => toast.error("Could not copy"),
    );
  };

  // Regions list for filtering
  const regions = useMemo(() => {
    const list = Array.from(new Set(HOTLINES.map((h) => h.region)));
    return ["All", ...list];
  }, []);

  // Filtered hotlines
  const filteredHotlines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return HOTLINES.filter((h) => {
      const matchRegion = selectedRegion === "All" || h.region === selectedRegion;
      const matchCategory = selectedCategory === "all" || h.category === selectedCategory;
      const matchQuery =
        !query ||
        h.name.toLowerCase().includes(query) ||
        h.detail.toLowerCase().includes(query) ||
        h.region.toLowerCase().includes(query) ||
        (h.phone && h.phone.includes(query)) ||
        (h.sms && h.sms.includes(query));
      return matchRegion && matchCategory && matchQuery;
    });
  }, [selectedRegion, selectedCategory, search]);

  const currentPhase = [
    { name: "Inhale deeply", prompt: "Fill your lungs through your nose..." },
    { name: "Hold gently", prompt: "Keep still and relax your shoulders..." },
    { name: "Exhale fully", prompt: "Release all tension through your mouth..." },
    { name: "Hold gently", prompt: "Rest quietly before the next breath..." },
  ][breathPhaseIndex];

  return (
    <AppShell>
      <PageHeader
        eyebrow="🛡️ Safety, Crisis Support & Emergency Care"
        slogan="You are never alone."
        title="Safety & crisis support"
        description="Immediate crisis hotlines, rapid in-house listener callbacks, interactive grounding tools, and personal emergency care details."
      />

      {/* 1. IMMEDIATE LOCAL EMERGENCY DIALERS */}
      <section
        data-page-reveal
        className="rounded-brand border-2 border-destructive/40 bg-destructive/5 p-5 mb-8 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="rounded-full bg-destructive/15 p-2.5 text-destructive mt-0.5">
              <LifebuoyIcon className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                In Immediate Danger or Medical Emergency?
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Tap your country&apos;s direct emergency line below. One tap dials immediately from your phone.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start md:self-auto rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive animate-ping" /> Real-time Dispatch
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {EMERGENCY.map((e, idx) => (
            <a
              key={e.region}
              href={`tel:${e.number}`}
              onClick={(ev) => {
                ev.preventDefault();
                triggerDialIntent(e.number, `${e.region} Emergency (${e.number})`);
              }}
              aria-label={`Call ${e.region} emergency line ${e.number}`}
              className={cn(
                "flex flex-col items-center justify-center rounded-brand bg-destructive px-3 py-3 text-destructive-foreground font-semibold shadow hover:opacity-95 active:scale-[0.98] transition-all card-lift text-center cursor-pointer",
                idx === EMERGENCY.length - 1 && "col-span-2 sm:col-span-1"
              )}
            >
              <span className="flex items-center gap-1.5 text-xl font-bold">
                <PhoneIcon className="h-5 w-5" /> {e.number}
              </span>
              <span className="text-xs font-medium opacity-90 mt-0.5">{e.region}</span>
              <span className="text-[10px] opacity-75 font-normal">{e.note}</span>
            </a>
          ))}
        </div>
      </section>

      {/* 2. RAPID IN-HOUSE LISTENER CALLBACK CALLOUT */}
      <section
        data-page-reveal
        className="rounded-brand border border-brand-accent/30 bg-gradient-to-r from-brand-accent/10 via-card to-background p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3.5">
          <div className="rounded-full bg-brand-accent/20 p-2.5 text-brand-accent shrink-0">
            <HeadphonesIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">
              Feeling Overwhelmed or Need Someone to Just Listen?
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              SomeoneNear listeners are in-house, trained companions who listen without judgment. Request a rapid callback or schedule a peaceful session.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <Link
            to="/listeners"
            className="flex-1 md:flex-none text-center rounded-brand bg-brand-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-primary/90 transition shadow-sm"
          >
            📞 Request Listener Callback
          </Link>
          <Link
            to="/companion"
            className="flex-1 md:flex-none text-center rounded-brand border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition"
          >
            💬 Talk to Companion
          </Link>
        </div>
      </section>

      {/* 3. INTERACTIVE GROUNDING & CALMING HUB */}
      <div className="grid gap-6 lg:grid-cols-2 mb-10">
        {/* Box Breathing Visualizer */}
        <section
          data-page-reveal
          className="rounded-brand border border-border bg-card p-5 flex flex-col justify-between shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <HeartbeatIcon className="h-5 w-5 text-brand-accent" />
                Interactive Box Breathing (4-4-4-4)
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                Cycle {cycleCount} of 4
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Calms the vagus nerve and lowers acute heart rate during panic or distress.
            </p>

            <div className="flex flex-col items-center justify-center py-6 bg-surface/50 rounded-brand border border-border/50">
              <div
                className={`relative flex items-center justify-center rounded-full transition-all duration-1000 ${
                  breathingActive
                    ? breathPhaseIndex === 0
                      ? "h-36 w-36 bg-brand-accent/30 scale-110"
                      : breathPhaseIndex === 1
                        ? "h-36 w-36 bg-brand-accent/40 scale-110"
                        : breathPhaseIndex === 2
                          ? "h-28 w-28 bg-brand-primary/20 scale-90"
                          : "h-28 w-28 bg-brand-primary/10 scale-90"
                    : "h-32 w-32 bg-muted/40"
                }`}
              >
                <div className="text-center">
                  <span className="text-3xl font-extrabold font-mono text-brand-primary">
                    {breathingActive ? breathSecondsLeft : "4s"}
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {breathingActive ? currentPhase.name : "Ready"}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground mt-4 text-center">
                {breathingActive ? currentPhase.prompt : "Press Start below to begin 4 gentle rounds."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
            <button
              onClick={() => setBreathingActive(!breathingActive)}
              className="flex items-center gap-2 rounded-brand bg-brand-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-primary/90 transition shadow-sm"
            >
              {breathingActive ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              {breathingActive ? "Pause Rhythm" : "Start Guided Breathing"}
            </button>
            <button
              onClick={resetBreathing}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <ArrowClockwiseIcon className="h-3.5 w-3.5" /> Reset
            </button>
            <Link to="/calm" className="text-xs text-brand-accent hover:underline font-medium">
              Open Full Calm Sanctuary →
            </Link>
          </div>
        </section>

        {/* 5-4-3-2-1 Sensory Grounding Checklist */}
        <section
          data-page-reveal
          className="rounded-brand border border-border bg-card p-5 flex flex-col justify-between shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-brand-accent" />
                5-4-3-2-1 Sensory Grounding
              </h3>
              <span className="text-xs text-muted-foreground">
                Tap each step as you notice it
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Reconnects your senses to the immediate physical room around you.
            </p>

            <div className="space-y-2">
              {GROUNDING_STEPS.map((s) => {
                const isChecked = !!checkedSenses[s.count];
                return (
                  <button
                    key={s.count}
                    type="button"
                    onClick={() =>
                      setCheckedSenses((prev) => ({ ...prev, [s.count]: !prev[s.count] }))
                    }
                    className={`w-full flex items-start gap-3 p-2.5 rounded-brand border text-left transition ${
                      isChecked
                        ? "bg-brand-accent/10 border-brand-accent/40 text-foreground"
                        : "bg-surface border-border hover:bg-muted/30"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isChecked
                          ? "bg-brand-accent text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isChecked ? "✓" : s.count}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-accent mr-1.5">
                        {s.sense}
                      </span>
                      <span className={`text-xs ${isChecked ? "line-through opacity-70" : "text-foreground"}`}>
                        {s.prompt}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
            <button
              onClick={() => setCheckedSenses({})}
              className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            >
              <ArrowClockwiseIcon className="h-3 w-3" /> Clear checklist
            </button>
            <span className="text-xs text-brand-accent font-medium">
              {Object.values(checkedSenses).filter(Boolean).length} of 5 grounded
            </span>
          </div>
        </section>
      </div>

      {/* 4. EMERGENCY HOTLINES & TEXT LINES WITH SEARCH & REGION FILTERS */}
      <section data-page-reveal className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PhoneIcon className="h-5 w-5 text-brand-accent" /> Verified Crisis Helplines &amp; Text Lines
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Confidential, trained human support. Free to call or text 24/7.
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by country or topic..."
              className="w-full pl-9 pr-3 py-1.5 rounded-brand border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
        </div>

        {/* Region Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-muted-foreground font-medium mr-1">Region:</span>
          {regions.map((reg) => (
            <button
              key={reg}
              onClick={() => setSelectedRegion(reg)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedRegion === reg
                  ? "bg-brand-primary text-primary-foreground shadow-sm"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {reg === "India"
                ? "🇮🇳 India"
                : reg === "United States"
                  ? "🇺🇸 United States"
                  : reg === "United Kingdom & ROI"
                    ? "🇬🇧 UK & ROI"
                    : reg === "Canada"
                      ? "🇨🇦 Canada"
                      : reg === "Australia"
                        ? "🇦🇺 Australia"
                        : reg === "Global"
                          ? "🌐 Global"
                          : "🌍 All Regions"}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-muted-foreground font-medium mr-1">Focus:</span>
          {(
            [
              ["all", "All Resources"],
              ["crisis", "Crisis & Suicide"],
              ["seniors", "Seniors & Elder Care"],
              ["text", "Text Only"],
              ["youth", "Youth & Teens"],
              ["domestic", "Domestic Safety"],
            ] as const
          ).map(([cat, label]) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium transition ${
                selectedCategory === cat
                  ? "bg-brand-accent text-white"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cards Grid */}
        {filteredHotlines.length === 0 ? (
          <div className="p-8 text-center rounded-brand border border-dashed border-border bg-card">
            <p className="text-sm text-muted-foreground">No resources matched your search query.</p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedRegion("All");
                setSelectedCategory("all");
              }}
              className="mt-2 text-xs text-brand-accent underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHotlines.map((r, i) => (
              <div
                key={r.name}
                style={{ animationDelay: `${i * 40}ms` }}
                className="rounded-brand border border-border bg-card p-4 flex flex-col justify-between shadow-sm card-lift"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-brand-accent">
                      {r.region}
                    </span>
                    {r.hours && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {r.hours}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">{r.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {r.detail}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-1.5">
                  {r.phone && (
                    <a
                      href={`tel:${r.phone.replace(/[\s-]/g, "")}`}
                      onClick={(ev) => {
                        ev.preventDefault();
                        triggerDialIntent(r.phone!, r.name);
                      }}
                      aria-label={`Call ${r.name} at ${r.phone}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-brand bg-brand-primary px-3 py-1.5 text-primary-foreground font-semibold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
                    >
                      <PhoneIcon className="h-3.5 w-3.5" /> Call {r.phone}
                    </a>
                  )}
                  {r.sms && (
                    <a
                      href={getSmsHref(r.sms, r.smsBody)}
                      onClick={(ev) => {
                        ev.preventDefault();
                        triggerSmsIntent(r.sms!, r.smsBody, r.name);
                      }}
                      aria-label={`Text ${r.name} at ${r.sms}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-brand bg-brand-accent px-3 py-1.5 text-white font-semibold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
                    >
                      <ChatIcon className="h-3.5 w-3.5" /> Text {r.sms}
                    </a>
                  )}
                  {r.phone && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(r.phone!, r.name)}
                      title="Copy phone number"
                      aria-label={`Copy phone number for ${r.name}`}
                      className="rounded-brand border border-border p-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-brand-accent pt-1 transition"
                    >
                      <GlobeIcon className="h-3 w-3" /> Visit official website ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. QUICK SOS & TRUSTED FAMILY CHECK-IN GENERATOR */}
      <section data-page-reveal className="mb-10 rounded-brand border border-border bg-card p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <ChatIcon className="h-5 w-5 text-brand-accent" />
            Quick SOS &amp; Trusted Contact Message
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            When speaking is difficult, send one of these pre-formatted messages directly to a family member or trusted friend.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {SOS_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.title}
              className="rounded-brand border border-border bg-surface p-3.5 flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-bold text-brand-primary">{tmpl.title}</span>
                <p className="text-xs text-muted-foreground mt-1.5 italic leading-relaxed">
                  &ldquo;{tmpl.message}&rdquo;
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(tmpl.message, tmpl.title)}
                  className="flex-1 text-[11px] font-medium py-1.5 rounded-brand border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center gap-1 transition"
                >
                  <CopyIcon className="h-3 w-3" /> Copy
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(tmpl.message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-[11px] font-medium py-1.5 rounded-brand bg-[#25D366] text-white hover:opacity-90 flex items-center justify-center gap-1 transition"
                >
                  <WhatsappLogoIcon className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a
                  href={`sms:?body=${encodeURIComponent(tmpl.message)}`}
                  className="flex-1 text-[11px] font-medium py-1.5 rounded-brand bg-brand-accent text-white hover:opacity-90 flex items-center justify-center gap-1 transition"
                >
                  <ChatIcon className="h-3.5 w-3.5" /> SMS
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. PERSONAL EMERGENCY (ICE) CARE CARD */}
      <section data-page-reveal className="mb-10 rounded-brand border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <FirstAidKitIcon className="h-5 w-5 text-destructive" />
              In Case of Emergency (ICE) Care Card
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep critical contacts, physician info, and medical conditions stored locally on this device for first responders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!iceEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIceEditing(true)}
                  className="rounded-brand border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-brand bg-brand-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-brand-primary/90 transition flex items-center gap-1.5"
                >
                  <PrinterIcon className="h-3.5 w-3.5" /> Print Card
                </button>
              </>
            ) : null}
          </div>
        </div>

        {iceEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveIceCard(iceCard);
            }}
            className="grid gap-3 sm:grid-cols-2 bg-surface p-4 rounded-brand border border-border text-xs"
          >
            <div>
              <label className="block text-muted-foreground font-medium mb-1">Your Full Name</label>
              <input
                type="text"
                value={iceCard.fullName}
                onChange={(e) => setIceCard({ ...iceCard, fullName: e.target.value })}
                placeholder="e.g. Maria Gonzalez"
                className="w-full p-2 rounded-brand border border-border bg-card"
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1">Blood Group</label>
              <select
                value={iceCard.bloodType}
                onChange={(e) => setIceCard({ ...iceCard, bloodType: e.target.value })}
                className="w-full p-2 rounded-brand border border-border bg-card"
              >
                {["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1">Emergency Contact Person</label>
              <input
                type="text"
                value={iceCard.emergencyContact}
                onChange={(e) => setIceCard({ ...iceCard, emergencyContact: e.target.value })}
                placeholder="Name (e.g. Daughter - Priya)"
                className="w-full p-2 rounded-brand border border-border bg-card"
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1">Emergency Contact Phone</label>
              <PhoneNumberField
                value={iceCard.emergencyPhone}
                onChange={(phone) => setIceCard({ ...iceCard, emergencyPhone: phone })}
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1">Primary Doctor / Clinic</label>
              <input
                type="text"
                value={iceCard.doctorName}
                onChange={(e) => setIceCard({ ...iceCard, doctorName: e.target.value })}
                placeholder="Dr. Mehta · City Health"
                className="w-full p-2 rounded-brand border border-border bg-card"
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1">Doctor&apos;s Phone</label>
              <PhoneNumberField
                value={iceCard.doctorPhone}
                onChange={(phone) => setIceCard({ ...iceCard, doctorPhone: phone })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-muted-foreground font-medium mb-1">
                Critical Allergies, Conditions &amp; Medications
              </label>
              <textarea
                rows={2}
                value={iceCard.allergiesConditions}
                onChange={(e) => setIceCard({ ...iceCard, allergiesConditions: e.target.value })}
                placeholder="e.g. Penicillin allergy, Type 2 Diabetes, Pacemaker"
                className="w-full p-2 rounded-brand border border-border bg-card"
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIceEditing(false)}
                className="px-3 py-1.5 rounded-brand border border-border text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-brand bg-brand-primary text-primary-foreground font-medium hover:bg-brand-primary/90"
              >
                Save Care Card
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 bg-surface p-4 rounded-brand border border-border text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Primary Contact
              </span>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {iceCard.emergencyContact || "Not set yet"}
              </p>
              {iceCard.emergencyPhone && (
                <a
                  href={`tel:${iceCard.emergencyPhone}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    triggerDialIntent(iceCard.emergencyPhone, `Emergency Contact (${iceCard.emergencyContact})`);
                  }}
                  className="text-brand-accent underline block mt-0.5 cursor-pointer"
                >
                  📞 {iceCard.emergencyPhone}
                </a>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Primary Physician
              </span>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {iceCard.doctorName || "Not set yet"}
              </p>
              {iceCard.doctorPhone && (
                <a
                  href={`tel:${iceCard.doctorPhone}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    triggerDialIntent(iceCard.doctorPhone, `Physician (${iceCard.doctorName})`);
                  }}
                  className="text-brand-accent underline block mt-0.5 cursor-pointer"
                >
                  📞 {iceCard.doctorPhone}
                </a>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Blood Group &amp; Critical Notes
              </span>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                Blood: <span className="text-destructive font-bold">{iceCard.bloodType}</span>
              </p>
              <p className="text-muted-foreground mt-0.5">
                {iceCard.allergiesConditions || "No critical allergies noted"}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 7. SOMEONENEAR TRUST & PRIVACY GUARANTEES */}
      <section data-page-reveal className="rounded-brand border border-border bg-surface p-5 shadow-sm mb-6">
        <div className="flex items-start gap-3.5">
          <div className="rounded-full bg-brand-primary/10 p-2 text-brand-primary shrink-0">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">
              SomeoneNear Safety &amp; Trust Architecture
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              When our AI Companion detects language indicating acute danger, self-harm, or distress, it pauses normal chat and surfaces immediate human crisis helplines. No personal reflections or Companion chats are ever shared with family members without explicit consent, and private health notes remain isolated under end-to-end data encryption.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link
                to="/companion"
                className="rounded-brand bg-brand-primary px-3 py-1.5 text-primary-foreground font-medium hover:bg-brand-primary/90"
              >
                Talk to Companion
              </Link>
              <Link
                to="/listeners"
                className="rounded-brand border border-border bg-card px-3 py-1.5 text-foreground hover:bg-muted"
              >
                Book a Listener Call
              </Link>
              <Link
                to="/privacy"
                className="rounded-brand border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground"
              >
                Privacy &amp; HIPAA Shield
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
