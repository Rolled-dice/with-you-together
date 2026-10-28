import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PreviewWorkspace } from "./workspace";
import { PreviewBrandMark } from "./preview-brand";
import { PLAN_DISPLAY } from "@/lib/currency";
import { usePreviewLifecycle, usePreviewTimeouts } from "./use-preview-lifecycle";

// ============================================================================
// 0. NATIVE INLINE SVG ICON SYSTEM (Prevents React 18 / CDN React 19 $$typeof mismatch)
// ============================================================================
import {
  SquaresFourIcon as LayoutGrid,
  CompassIcon as Compass,
  ChatCircleIcon as MessageCircle,
  UsersIcon as Users,
  PillIcon as Pill,
  CalendarDotsIcon as CalendarClock,
  TrendUpIcon as TrendingUp,
  HandshakeIcon as HeartHandshake,
  ShieldCheckIcon as ShieldCheck,
  GearIcon as Settings,
  CalendarIcon as Calendar,
  ShareNetworkIcon as Share2,
  HeartbeatIcon as HeartPulse,
  PhoneIcon as Phone,
  UserPlusIcon as UserPlus,
  SparkleIcon as Sparkles,
  CaretRightIcon as ChevronRight,
  FigmaLogoIcon as Figma,
  PaperPlaneTiltIcon as Send,
  XIcon as X,
  LightningIcon as Zap,
  SunIcon as Sun,
  MoonIcon as Moon,
  PaletteIcon as Palette,
  MicrophoneIcon as Mic,
  HeadphonesIcon as Headphones,
  RadioIcon as Radio,
  DownloadSimpleIcon as Download,
  PlusIcon as Plus,
  MinusIcon as Minus,
  ArrowCounterClockwiseIcon as RotateCcw,
  PlayIcon as Play,
  PauseIcon as Pause,
  CheckCircleIcon as CheckCircle2,
  UploadSimpleIcon as Upload,
  PersonArmsSpreadIcon as Accessibility,
  ArrowRightIcon as ArrowRight,
  CheckIcon as Check,
  FeatherIcon as Feather,
  GameControllerIcon as Gamepad2,
  SpeakerHighIcon as Volume2,
  SpeakerSlashIcon as VolumeX,
  GlobeIcon as Globe,
  CreditCardIcon as CreditCard,
  CopyIcon as Copy,
  SignInIcon as LogIn,
  BookOpenIcon as BookOpen,
  QuestionIcon as Question,
  LifebuoyIcon as Lifebuoy,
  ArrowUpRightIcon as ArrowUpRight,
  CaretDownIcon as CaretDown,
} from "@phosphor-icons/react";

// ============================================================================
// 0B. WEB AUDIO API PROCEDURAL ASMR & "CHATAK-PATAK" SOUND SYNTHESIZER
// (Zero external audio files needed — instant tactile pops, chimes, singing bowls)
// ============================================================================
class AsmrSoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.rainNode = null;
    this.rainGain = null;
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Sharp, juicy "Chatak!" or deep "Patak!" silicone bubble pop
  playChatakPop(pitchMultiplier = 1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Pop oscillator sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      const baseFreq = 260 * pitchMultiplier;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.9, now + 0.045);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore audio errors on restricted devices
    }
  }

  // Crackle firework burst ("Chatak-Patak" multi-sparkle)
  playPatakFirework() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      [1, 1.25, 1.5, 1.8, 2.2].forEach((mult, idx) => {
        setTimeout(() => this.playChatakPop(mult), idx * 38);
      });
    } catch {
      // Ignore
    }
  }

  // Warm Tibetan / Himalayan Singing Bowl harmonic resonance
  playSingingBowl(freq = 432) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [1, 2.01, 2.98].forEach((harmonic, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * harmonic, now);

        const peak = 0.22 / (idx + 1);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 3.5);
      });
    } catch {
      // Ignore
    }
  }

  // Gentle Harp / Kalimbia pluck for Rangoli & Silk Strings
  playSilkPluck(noteIndex = 0) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
      const freq = scale[noteIndex % scale.length];
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {
      // Ignore
    }
  }

  // Toggle Pink-Noise Monsoon Rain ASMR
  toggleMonsoonRain(enable) {
    if (this.muted && enable) return false;
    try {
      if (!enable) {
        if (this.rainNode) {
          this.rainNode.stop();
          this.rainNode.disconnect();
          this.rainNode = null;
        }
        return false;
      }
      this.init();
      if (!this.ctx) return false;
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.015;
        b6 = white * 0.115926;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 950;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.35;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
      this.rainNode = noise;
      this.rainGain = gain;
      return true;
    } catch {
      return false;
    }
  }
}

const asmrAudio = new AsmrSoundEngine();

// ============================================================================
// 0C. COUNTRY CURRENCY & PAYMENT GATEWAY CONFIG (Notebook Step #3, #4, #5)
// ============================================================================
const PROTOTYPE_COUNTRIES = {
  IN: {
    code: "IN",
    flag: "🇮🇳",
    name: "India",
    currency: "INR",
    symbol: "₹",
    plan18Price: "1,499",
    plan30Price: "2,499",
    gateways: ["Razorpay", "UPI (GPay / PhonePe)", "Paytm", "RuPay / Cards"],
    primaryGateway: "Razorpay • Instant UPI & Cards",
  },
  US: {
    code: "US",
    flag: "🇺🇸",
    name: "United States",
    currency: "USD",
    symbol: "$",
    plan18Price: "29",
    plan30Price: "49",
    gateways: ["Stripe", "Apple Pay", "Google Pay", "ACH / Cards"],
    primaryGateway: "Stripe • Apple Pay & Cards",
  },
  GB: {
    code: "GB",
    flag: "🇬🇧",
    name: "United Kingdom",
    currency: "GBP",
    symbol: "£",
    plan18Price: "24",
    plan30Price: "39",
    gateways: ["Stripe UK", "Apple Pay", "Bacs Direct Debit", "Revolut"],
    primaryGateway: "Stripe UK • Bacs & Apple Pay",
  },
  AE: {
    code: "AE",
    flag: "🇦🇪",
    name: "UAE",
    currency: "AED",
    symbol: "AED ",
    plan18Price: "109",
    plan30Price: "179",
    gateways: ["PayTabs", "Stripe UAE", "Apple Pay", "Tabby"],
    primaryGateway: "PayTabs & Apple Pay UAE",
  },
  CA: {
    code: "CA",
    flag: "🇨🇦",
    name: "Canada",
    currency: "CAD",
    symbol: "C$",
    plan18Price: "39",
    plan30Price: "65",
    gateways: ["Stripe Canada", "Interac", "Apple Pay", "Cards"],
    primaryGateway: "Stripe • Interac & Apple Pay",
  },
  AU: {
    code: "AU",
    flag: "🇦🇺",
    name: "Australia",
    currency: "AUD",
    symbol: "A$",
    plan18Price: "45",
    plan30Price: "75",
    gateways: ["Stripe AU", "PayID", "Apple Pay", "Cards"],
    primaryGateway: "Stripe AU & PayID",
  },
};

// ============================================================================
// 1. BRAND COLOR PALETTE (Warm Cream, Deep Navy, Bubblegum Coral, Burnt Orange)
// ============================================================================
const COUNTRY_PAYMENT_CONFIG = Object.fromEntries(
  ["IN", "US"].map((code) => [
    code,
    {
      ...PROTOTYPE_COUNTRIES[code],
      plan18Price: (code === "IN"
        ? PLAN_DISPLAY.care.inrLabel
        : PLAN_DISPLAY.care.usdLabel
      ).replace(/^[^\d]+/, ""),
      plan30Price: (code === "IN"
        ? PLAN_DISPLAY.care_plus.inrLabel
        : PLAN_DISPLAY.care_plus.usdLabel
      ).replace(/^[^\d]+/, ""),
      gateways: ["Checkout not connected"],
      primaryGateway: "Payment setup pending",
    },
  ]),
);
const BRAND_PALETTE = {
  warmCream: "#F7F0E5",
  deepNavy: "#102F50",
  bubblegumCoral: "#F36D89",
  burntOrange: "#D95732",
  mustardGold: "#EAB84B",
  slateTeal: "#5C8EA6",
};

// ============================================================================
// 2. BESPOKE EDITORIAL ILLUSTRATED AVATAR SYSTEM (Inspired by Reference Sheet)
// ============================================================================
// Renders custom flat-vector editorial illustrations with Mustard Gold (#EAB84B)
// backdrops, white botanical fern leaves, organic wave stripes, rosy cheeks,
// statement earrings, eyeglasses, beards, and patterned outfits (hearts, polka dots).
const EditorialAvatar = ({
  member,
  size = "md",
  isDark = false,
  forceSquare = false,
  showBadge = false,
}) => {
  const sizeClasses = {
    xs: "w-9 h-9",
    sm: "w-12 h-12",
    md: "w-14 h-14 sm:w-16 sm:h-16",
    lg: "w-20 h-20 sm:w-24 sm:h-24",
    xl: "w-28 h-28",
  };

  const bg = member.avatarBg || BRAND_PALETTE.mustardGold;
  const motif = member.backdropMotif || "leaves"; // 'leaves' | 'waves' | 'stripes' | 'clouds'
  const outfitColor = member.outfitColor || BRAND_PALETTE.burntOrange;
  const outfitPattern = member.outfitPattern || "solid"; // 'hearts' | 'polka' | 'shawl' | 'collar' | 'solid'
  const earrings = member.earrings || "none"; // 'tassels' | 'hoops' | 'pink-hoops' | 'stud' | 'none'
  const hasGlasses = member.glasses ?? false;
  const shapeClass = forceSquare || member.frameShape === "square" ? "rounded-2xl" : "rounded-full";

  return (
    <div className="relative inline-flex items-center justify-center select-none">
      <div
        style={{ backgroundColor: bg }}
        className={`${sizeClasses[size] || sizeClasses.md} ${shapeClass} overflow-hidden relative flex items-center justify-center transition-transform duration-300 ${
          isDark
            ? "ring-[3px] ring-[var(--preview-cream)] shadow-[0_10px_28px_rgba(0,0,0,0.65)]"
            : "ring-[3.5px] ring-[var(--preview-cream)] shadow-[0_10px_24px_rgba(16,47,80,0.24)]"
        }`}
      >
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full block pointer-events-none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* BACKGROUND ARTISTIC MOTIFS */}
          {motif === "leaves" && (
            <g opacity="0.95">
              {/* Left Botanical White Fern Sprig */}
              <path d="M18 115 C14 85 16 55 24 28 C12 42 8 68 12 95 Z" fill="#FFFFFF" />
              <path d="M28 110 C22 82 26 52 36 30 C26 48 24 75 28 110 Z" fill="#FFFFFF" />
              <path
                d="M20 112 Q20 68 28 32"
                stroke="#102F50"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {/* Right Botanical White Fern Sprig */}
              <path d="M102 115 C106 85 104 55 96 28 C108 42 112 68 108 95 Z" fill="#FFFFFF" />
              <path d="M92 110 C98 82 94 52 84 30 C94 48 96 75 92 110 Z" fill="#FFFFFF" />
              <path
                d="M100 112 Q100 68 92 32"
                stroke="#102F50"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          )}

          {motif === "waves" && (
            <g opacity="0.85">
              <path d="M0 95 C25 65 18 25 32 0 L0 0 Z" fill="#D49B27" />
              <path d="M120 95 C95 65 102 25 88 0 L120 0 Z" fill="#D49B27" />
              <path
                d="M15 120 C28 85 12 45 28 12"
                stroke="#D95732"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.45"
              />
              <path
                d="M105 120 C92 85 108 45 92 12"
                stroke="#D95732"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.45"
              />
            </g>
          )}

          {motif === "stripes" && (
            <g stroke="#D49B27" strokeWidth="4.5" opacity="0.85">
              <line x1="0" y1="22" x2="120" y2="22" />
              <line x1="0" y1="42" x2="120" y2="42" />
              <line x1="0" y1="62" x2="120" y2="62" />
              <line x1="0" y1="82" x2="120" y2="82" />
              <line x1="0" y1="102" x2="120" y2="102" />
            </g>
          )}

          {motif === "clouds" && (
            <g fill="#FFFFFF" opacity="0.95">
              <circle cx="20" cy="92" r="24" />
              <circle cx="100" cy="92" r="24" />
              <rect x="0" y="92" width="120" height="30" />
            </g>
          )}

          {/* BACK HAIR LAYER */}
          {member.archetype === "adult-woman" && (
            <path
              d="M32 42 C26 70 28 96 30 110 L90 110 C92 96 94 70 88 42 C82 18 38 18 32 42 Z"
              fill="#651A32"
            />
          )}
          {member.archetype === "aged-woman" && (
            <>
              <circle cx="60" cy="18" r="14" fill="#4A4E69" />
              <path
                d="M34 45 C30 68 34 95 38 108 L82 108 C86 95 90 68 86 45 C82 22 38 22 34 45 Z"
                fill="#5C6274"
              />
            </>
          )}
          {member.archetype === "child" && (
            <>
              <path d="M34 32 C16 28 14 58 20 86 C26 86 34 65 36 44 Z" fill="#9E582F" />
              <path d="M86 32 C104 28 106 58 100 86 C94 86 86 65 84 44 Z" fill="#9E582F" />
              <ellipse
                cx="36"
                cy="30"
                rx="5"
                ry="3.5"
                fill="#EAB84B"
                stroke="#102F50"
                strokeWidth="1"
              />
              <ellipse
                cx="84"
                cy="30"
                rx="5"
                ry="3.5"
                fill="#EAB84B"
                stroke="#102F50"
                strokeWidth="1"
              />
            </>
          )}

          {/* SHOULDERS & PATTERNED OUTFIT */}
          <g>
            <path d="M16 122 C18 94 34 86 60 86 C86 86 102 94 104 122 Z" fill={outfitColor} />
            {outfitPattern === "hearts" && (
              <g fill="#FFFFFF" opacity="0.92">
                <path d="M38 104 C36 101 32 102 33 106 C34 109 38 111 38 111 C38 111 42 109 43 106 C44 102 40 101 38 104 Z" />
                <path d="M78 102 C76 99 72 100 73 104 C74 107 78 109 78 109 C78 109 82 107 83 104 C84 100 80 99 78 102 Z" />
                <path d="M58 113 C56 110 52 111 53 115 C54 118 58 120 58 120 C58 120 62 118 63 115 C64 111 60 110 58 113 Z" />
                <rect
                  x="48"
                  y="95"
                  width="5"
                  height="2"
                  rx="1"
                  transform="rotate(-20 48 95)"
                  fill="#EAB84B"
                />
                <rect
                  x="68"
                  y="112"
                  width="5"
                  height="2"
                  rx="1"
                  transform="rotate(25 68 112)"
                  fill="#EAB84B"
                />
              </g>
            )}
            {outfitPattern === "polka" && (
              <g fill="#FFFFFF" opacity="0.92">
                <ellipse cx="36" cy="102" rx="5.5" ry="3.2" transform="rotate(-15 36 102)" />
                <ellipse cx="60" cy="98" rx="5" ry="3" />
                <ellipse cx="83" cy="104" rx="5.5" ry="3.2" transform="rotate(18 83 104)" />
                <ellipse cx="48" cy="114" rx="5.5" ry="3.2" transform="rotate(10 48 114)" />
                <ellipse cx="74" cy="115" rx="5" ry="3" transform="rotate(-12 74 115)" />
              </g>
            )}
            {outfitPattern === "shawl" && (
              <>
                <path d="M34 88 L60 116 L86 88 L76 86 L60 104 L44 86 Z" fill="#D95732" />
                <path d="M46 86 L60 102 L74 86 Z" fill="#F7F0E5" />
              </>
            )}
            {outfitPattern === "collar" && (
              <>
                <path d="M45 87 L75 87 L78 122 L42 122 Z" fill="#FFFFFF" />
                <path d="M42 87 L51 122 L34 122 Z" fill="#D95732" opacity="0.4" />
                <path d="M78 87 L69 122 L86 122 Z" fill="#D95732" opacity="0.4" />
              </>
            )}
          </g>

          {/* NECK & SHADOW */}
          <rect x="52" y="68" width="16" height="22" rx="7" fill={member.skinTone || "#DDA384"} />
          <path d="M52 72 Q60 80 68 72 L68 79 Q60 84 52 79 Z" fill="#102F50" opacity="0.28" />

          {/* EARS */}
          <ellipse cx="37" cy="56" rx="5.5" ry="8" fill={member.skinTone || "#DDA384"} />
          <ellipse cx="83" cy="56" rx="5.5" ry="8" fill={member.skinTone || "#DDA384"} />

          {/* STATEMENT EARRINGS */}
          {earrings === "tassels" && (
            <g>
              <circle cx="36" cy="63" r="3" fill="#D95732" />
              <rect x="33.5" y="66" width="5" height="5" fill="#F36D89" />
              <path d="M34 71 L38 71 L39.5 85 L32.5 85 Z" fill="#FFFFFF" />
              <circle cx="84" cy="63" r="3" fill="#D95732" />
              <rect x="81.5" y="66" width="5" height="5" fill="#F36D89" />
              <path d="M82 71 L86 71 L87.5 85 L80.5 85 Z" fill="#FFFFFF" />
            </g>
          )}
          {earrings === "hoops" && (
            <g>
              <circle cx="35" cy="68" r="8" fill="#EAB84B" stroke="#D95732" strokeWidth="1.5" />
              <circle cx="85" cy="68" r="8" fill="#EAB84B" stroke="#D95732" strokeWidth="1.5" />
            </g>
          )}
          {earrings === "pink-hoops" && (
            <g>
              <circle cx="35" cy="67" r="7.5" stroke="#F36D89" strokeWidth="2" fill="none" />
              <circle cx="85" cy="67" r="7.5" stroke="#F36D89" strokeWidth="2" fill="none" />
            </g>
          )}
          {earrings === "stud" && <circle cx="36" cy="62" r="3.5" fill="#102F50" />}

          {/* HEAD SHAPE */}
          <rect x="39" y="28" width="42" height="48" rx="20" fill={member.skinTone || "#DDA384"} />

          {/* ROSY TERRACOTTA CHEEK BLUSHES */}
          <circle cx="46" cy="58" r="5.5" fill="#D95732" opacity="0.45" />
          <circle cx="74" cy="58" r="5.5" fill="#D95732" opacity="0.45" />

          {/* FACIAL HAIR / BEARD */}
          {member.archetype === "adult-man" && (
            <path
              d="M39 54 C39 72 48 79 60 79 C72 79 81 72 81 54 L76 54 C75 63 69 65 60 65 C51 65 45 63 44 54 Z"
              fill="#5D192B"
            />
          )}
          {member.archetype === "aged-man" && (
            <path
              d="M40 56 C40 71 48 77 60 77 C72 77 80 71 80 56 L75 56 C74 63 68 65 60 65 C52 65 46 63 45 56 Z"
              fill="#9CA3AF"
            />
          )}

          {/* EYEBROWS, BINDI, EYES & GLASSES */}
          <path d="M44 45 Q49 42 54 45" stroke="#102F50" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M66 45 Q71 42 76 45" stroke="#102F50" strokeWidth="2.2" strokeLinecap="round" />
          {(member.archetype === "aged-woman" || member.archetype === "adult-woman") && (
            <circle cx="60" cy="41.5" r="2.2" fill="#D95732" />
          )}
          <ellipse cx="49" cy="50" rx="3.8" ry="2.6" fill="#FFFFFF" />
          <circle cx="49.5" cy="50" r="2" fill="#102F50" />
          <ellipse cx="71" cy="50" rx="3.8" ry="2.6" fill="#FFFFFF" />
          <circle cx="70.5" cy="50" r="2" fill="#102F50" />

          {hasGlasses && (
            <g stroke="#102F50" strokeWidth="1.8" fill="none">
              <circle cx="49" cy="50" r="6.5" />
              <circle cx="71" cy="50" r="6.5" />
              <path d="M55.5 50 L64.5 50" />
              <path d="M39 49 L42.5 50" />
              <path d="M77.5 50 L81 49" />
            </g>
          )}

          <path
            d="M60 46 L58 56 L62 57"
            stroke="#9C5740"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {member.archetype === "adult-man" || member.archetype === "aged-man" ? (
            <path d="M56 68 Q60 72 64 68" stroke="#F7F0E5" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path
              d="M55 64 Q60 68 65 64"
              stroke="#A33B46"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* FRONT HAIR / CROWN */}
          {member.archetype === "adult-man" && (
            <g fill="#5D192B">
              <circle cx="45" cy="30" r="9" />
              <circle cx="56" cy="26" r="10" />
              <circle cx="68" cy="27" r="9.5" />
              <circle cx="77" cy="33" r="8" />
              <circle cx="40" cy="37" r="7" />
            </g>
          )}
          {member.archetype === "aged-man" && (
            <g fill="#CBD5E1">
              <path d="M38 42 C36 25 50 20 62 21 C74 20 84 26 82 42 C78 33 70 31 60 31 C50 31 42 33 38 42 Z" />
              <circle cx="48" cy="27" r="6" />
              <circle cx="62" cy="25" r="7" />
              <circle cx="74" cy="28" r="6" />
            </g>
          )}
          {member.archetype === "adult-woman" && (
            <path
              d="M38 46 C38 26 52 22 60 22 C68 22 82 26 82 46 C76 36 66 32 60 28 C54 32 44 36 38 46 Z"
              fill="#651A32"
            />
          )}
          {member.archetype === "aged-woman" && (
            <g>
              <path
                d="M38 46 C38 26 52 22 60 22 C68 22 82 26 82 46 C76 36 66 32 60 29 C54 32 44 36 38 46 Z"
                fill="#5C6274"
              />
              <path
                d="M44 34 Q52 27 59 29"
                stroke="#E2E8F0"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M76 34 Q68 27 61 29"
                stroke="#E2E8F0"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          )}
          {member.archetype === "teenager" && (
            <path
              d="M38 43 C38 24 52 21 62 21 C74 21 82 27 82 42 C75 33 64 31 50 33 C44 34 40 38 38 43 Z"
              fill="#1E1B24"
            />
          )}
          {member.archetype === "child" && (
            <path
              d="M38 44 C38 25 50 22 60 22 C70 22 82 25 82 44 L73 41 L71 34 L69 41 L51 41 L49 34 L47 41 Z"
              fill="#9E582F"
            />
          )}
        </svg>

        <div
          className={`absolute inset-0 ${shapeClass} border border-[var(--preview-navy)]/15 pointer-events-none`}
        />
      </div>

      {showBadge && (
        <span className="absolute -bottom-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-cream)] shadow">
          {member.shortRole || member.name}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 3. INITIAL 6 FAMILY MEMBERS WITH 3D SPHERICAL COORDINATES FOR THREE.JS GLOBE
// ============================================================================
const INITIAL_FAMILY_MEMBERS = [
  {
    id: "dad",
    name: "Dad",
    shortRole: "Parent",
    role: "Aged Man • Father (Delhi)",
    archetype: "aged-man",
    skinTone: "#D99B7E",
    avatarBg: "#EAB84B",
    backdropMotif: "leaves",
    outfitColor: "#102F50",
    outfitPattern: "shawl",
    earrings: "none",
    glasses: true,
    frameShape: "circle",
    hasNotification: true,
    notificationCount: 1,
    statusText: "I visited the doctor. Feeling much better & took my morning BP tablet.",
    stickerBadge: "🩺 Post-Call Update · 2m ago",
    checkInType: "Health & Meds Check-in",
    expiryLabel: "Expires in 7d",
    hasAudioNote: true,
    hasMedPhoto: true,
    timeAgo: "2m ago",
    // Spherical angles (phi, theta) on the Three.js Globe
    phi: 1.15,
    theta: 0,
  },
  {
    id: "mum",
    name: "Mum",
    shortRole: "Parent",
    role: "Aged Woman • Mother (Jaipur)",
    archetype: "aged-woman",
    skinTone: "#C68463",
    avatarBg: "#EAB84B",
    backdropMotif: "waves",
    outfitColor: "#F36D89",
    outfitPattern: "hearts",
    earrings: "hoops",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    statusText: "Had masala chai in the garden. Spoke with Priya for 15 mins.",
    stickerBadge: "☕ 15m Call with Priya",
    checkInType: "Warm Listener Call",
    expiryLabel: "Expires in 5d",
    hasAudioNote: true,
    timeAgo: "18m ago",
    phi: 1.85,
    theta: 1.047,
  },
  {
    id: "aarav",
    name: "Aarav",
    displayName: "Aarav (you)",
    shortRole: "You",
    role: "Adult Man • You (London / Bangalore)",
    archetype: "adult-man",
    skinTone: "#E0A487",
    avatarBg: "#EAB84B",
    backdropMotif: "clouds",
    outfitColor: "#7F1D3A",
    outfitPattern: "solid",
    earrings: "none",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    statusText: "Received Dad’s 3-line post-call update while between meetings.",
    stickerBadge: "📝 3-Line Digest Ready",
    checkInType: "Family Circle Lead",
    expiryLabel: "Expires in 24h",
    timeAgo: "Just now",
    phi: 1.32,
    theta: 2.094,
  },
  {
    id: "priya",
    name: "Priya",
    displayName: "Priya · Listener",
    shortRole: "Sister / Care",
    role: "Adult Woman • Sister",
    archetype: "adult-woman",
    skinTone: "#D89A7C",
    avatarBg: "#EAB84B",
    backdropMotif: "waves",
    outfitColor: "#D95732",
    outfitPattern: "solid",
    earrings: "tassels",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    statusText: "Shared weekend brunch photos & checked on Mum’s evening walk.",
    stickerBadge: "💛 Warm Check-in",
    checkInType: "Family Share",
    expiryLabel: "Expires in 5d",
    timeAgo: "1h ago",
    phi: 2.05,
    theta: 3.141,
  },
  {
    id: "rohan",
    name: "Rohan",
    shortRole: "Teen",
    role: "Teenager • Brother",
    archetype: "teenager",
    skinTone: "#BA7A57",
    avatarBg: "#EAB84B",
    backdropMotif: "stripes",
    outfitColor: "#F36D89",
    outfitPattern: "polka",
    earrings: "stud",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    statusText: "Just aced my physics mock test! Sent Dada a voice note 🎉",
    stickerBadge: "🚀 Aced Physics!",
    checkInType: "Study Milestone",
    expiryLabel: "Expires in 6d",
    timeAgo: "2h ago",
    phi: 0.78,
    theta: 4.188,
  },
  {
    id: "mia",
    name: "Mia",
    shortRole: "Child",
    role: "Child • Niece",
    archetype: "child",
    skinTone: "#E5AA8D",
    avatarBg: "#EAB84B",
    backdropMotif: "leaves",
    outfitColor: "#F36D89",
    outfitPattern: "collar",
    earrings: "pink-hoops",
    glasses: false,
    frameShape: "circle",
    hasNotification: false,
    notificationCount: 0,
    statusText: "Painted a giant yellow sunshine for Nani & Dada! 🎨",
    stickerBadge: "🎨 Painted a Sun!",
    checkInType: "Art Share",
    expiryLabel: "Expires in 30d",
    timeAgo: "3h ago",
    phi: 1.65,
    theta: 5.235,
  },
];

// ============================================================================
// 4. AUTHENTIC SOMEONENEAR.COM "WHAT ARE YOU WORRIED ABOUT?" PILLS
// ============================================================================
const WORRY_PILLS = [
  {
    id: "distance",
    emoji: "🌍",
    label: "They live far away",
    PromiseText: "We call on their ordinary phone, so the distance feels smaller.",
    targetMemberId: "dad",
    notifBadge: "🌍 Distance Bridged · Live Call",
    notifUpdate:
      "Called Dad on his landline in Delhi. He laughed about the cricket match & feels close to you.",
  },
  {
    id: "medication",
    emoji: "💊",
    label: "They forget medication",
    PromiseText: "Gentle photo & phone reminders, every dose logged.",
    targetMemberId: "dad",
    notifBadge: "💊 Morning Tablet Taken · 8:30 AM",
    notifUpdate:
      "Dad confirmed taking Telmisartan 40mg (Orange-White Strip). Photo & time logged for family.",
  },
  {
    id: "lonely",
    emoji: "💛",
    label: "They seem lonely",
    PromiseText: "A warm 15-min conversation on their own phone.",
    targetMemberId: "mum",
    notifBadge: "💛 15m Empathetic Call Completed",
    notifUpdate:
      "Mum spoke with Meera (Listener) for 18 mins about her garden & old family recipes. Mood: Bright 🌸",
  },
  {
    id: "busy",
    emoji: "📞",
    label: "I can't call every day",
    PromiseText: "We keep the routine when life gets busy.",
    targetMemberId: "aarav",
    notifBadge: "📞 Routine Kept Automatically",
    notifUpdate:
      "While you were in your 4 PM meeting, we completed Dad & Mum’s afternoon check-in call.",
  },
  {
    id: "updates",
    emoji: "📝",
    label: "Nobody tells me how they are",
    PromiseText: "A short 3-line update after every single call.",
    targetMemberId: "priya",
    notifBadge: "📝 3-Line Family Digest Shared",
    notifUpdate:
      "1. Slept 7.5 hrs  2. Visited Dr. Sharma (BP normal)  3. Looking forward to Sunday call!",
  },
  {
    id: "noapp",
    emoji: "📵",
    label: "They won't use an app",
    PromiseText: "They never have to. It's just an ordinary phone call.",
    targetMemberId: "mum",
    notifBadge: "📵 Zero App Needed for Parents",
    notifUpdate:
      "Mum answered on her regular home phone—no smartphone links, passwords, or apps required.",
  },
];

// ============================================================================
// 5. INITIAL BOUNDED SHARED MEDIA, MEDICATIONS, REMINDERS & LISTENERS
// ============================================================================
const INITIAL_SHARED_FEED = [
  {
    id: "share-1",
    authorId: "dad",
    authorName: "Dad",
    mediaType: "photo-audio",
    title: "I visited the doctor. Feeling better.",
    caption:
      "BP was 122/78 today. Attached Dr. Sharma’s prescription note & morning tablet strip so Aarav has a copy.",
    fileInfo: "BP_Prescription_Oct2026.jpg • 1.8 MB (Verified JPG < 10MB)",
    expiryChoice: "7 Days",
    expiresCountdown: "6d 22h left",
    createdAt: "Today, 11:40 AM",
    savedCount: 3,
  },
  {
    id: "share-2",
    authorId: "mum",
    authorName: "Mum",
    mediaType: "audio",
    title: "Morning Balcony Voice Blessing ☕",
    caption: "Recorded a 32-second voice note for everyone before breakfast.",
    fileInfo: "Mum_Blessing_Audio.mp4 • 0:32s (Within 5m limit)",
    expiryChoice: "30 Days",
    expiresCountdown: "29d left",
    createdAt: "Today, 8:15 AM",
    savedCount: 5,
  },
];

const INITIAL_MEDICATIONS = [
  {
    id: "med-1",
    forMemberId: "dad",
    forMemberName: "Dad",
    addedBy: "Aarav (you)",
    medName: "Telmisartan 40mg (Morning BP Tablet)",
    visualDesc: "Oval White & Burnt-Orange Blister Strip • 1 Tablet after breakfast",
    doseTime: "08:30 AM",
    pillColor: "#D95732",
    stripColor: "#F36D89",
    takenToday: true,
    lastTakenAt: "08:34 AM",
  },
  {
    id: "med-2",
    forMemberId: "mum",
    forMemberName: "Mum",
    addedBy: "Mum (Self)",
    medName: "Calcium + Vitamin D3 Supplement",
    visualDesc: "Sunshine Yellow Capsule • 1 Capsule with warm milk",
    doseTime: "09:00 PM",
    pillColor: "#EAB84B",
    stripColor: "#5C8EA6",
    takenToday: false,
    lastTakenAt: "Scheduled 9:00 PM",
  },
];

const INITIAL_REMINDERS = [
  {
    id: "rem-1",
    title: "Evening 20-minute park walk before sunset",
    forMemberId: "dad",
    forMemberName: "Dad",
    createdBy: "Aarav (On behalf of Dad)",
    time: "05:30 PM",
    done: false,
  },
  {
    id: "rem-2",
    title: "Happy birthday, Ma — Send It Later voice & flower note",
    forMemberId: "mum",
    forMemberName: "Mum",
    createdBy: "Aarav (Scheduled Time-Capsule)",
    time: "08:00 AM",
    done: true,
  },
];

const VERIFIED_LISTENERS = [
  {
    id: "lis-1",
    name: "Dr. Kavita Nair",
    specialty: "Senior Care, Empty-Nest & Health Calm",
    languages: "English, Hindi, Malayalam",
    nextSlot: "Today, 5:30 PM",
    rating: "4.98 ★ (310 calls)",
    archetype: "adult-woman",
    avatarBg: "#EAB84B",
    outfitColor: "#102F50",
  },
  {
    id: "lis-2",
    name: "Siddharth Verma",
    specialty: "Family Harmony, Work Burnout & Mindful Listening",
    languages: "English, Hindi, Punjabi",
    nextSlot: "Today, 6:00 PM",
    rating: "4.96 ★ (240 calls)",
    archetype: "adult-man",
    avatarBg: "#5C8EA6",
    outfitColor: "#D95732",
  },
  {
    id: "lis-3",
    name: "Meera Joshi",
    specialty: "Elder Companionship & Gentle Evening Phone Check-ins",
    languages: "Hindi, Gujarati, English",
    nextSlot: "Today, 7:15 PM",
    rating: "4.99 ★ (420 calls)",
    archetype: "aged-woman",
    avatarBg: "#F36D89",
    outfitColor: "#102F50",
  },
];

// ============================================================================
// 5B. STEP #9 FOCUS: "CHATAK-PATAK" & ASMR STRESS-RELIEF ENGAGEMENT ARCADE
// Features 4 tactile, sound-reactive mini-games to deeply engage & relax users:
// 1. "Chatak-Patak" 3D Silicone Bubble Pop-It Grid (Combo multiplier + Mega Wave)
// 2. "Patak!" Worry-Bubble Splat & Firework Burst Game (Pop floating worries)
// 3. Himalayan Singing Bowls & Monsoon Clay Kulhad ASMR Soundboard
// 4. Interactive 8-Fold Marigold & Coral Rangoli Mandala Zen Spinner
// ============================================================================
const ChatakPatakAsmrArcade = ({
  isDark,
  onSendCareSparkToGlobe,
  onTriggerToast,
  compact = false,
}) => {
  const [activeGameTab, setActiveGameTab] = useState("popit"); // 'popit' | 'worrysplat' | 'bowls' | 'rangoli'
  const setTimeout = usePreviewTimeouts();
  const [soundMuted, setSoundMuted] = useState(true);
  const [reliefScore, setReliefScore] = useState(0);
  const [comboStreak, setComboStreak] = useState(1);
  const [chatakFloaters, setChatakFloaters] = useState([]);

  // Game 1: 36-Bubble Tactile Silicone Pop-It State
  const POP_COLORS = ["#F36D89", "#D95732", "#EAB84B", "#5C8EA6", "#102F50", "#F36D89"];
  const [popGrid, setPopGrid] = useState(() =>
    Array.from({ length: 36 }, (_, idx) => ({
      id: idx,
      row: Math.floor(idx / 6),
      col: idx % 6,
      popped: false,
      color: POP_COLORS[Math.floor(idx / 6)],
    })),
  );
  const isPointerDownPopRef = useRef(false);

  // Game 2: "Patak!" Worry-Bubble Splat State
  const WORRY_BUBBLE_LABELS = [
    "Missed Call Guilt 📞",
    "Did Dad take BP pill? 💊",
    "Work Burnout ⚡",
    "2AM Overthinking 🌙",
    "Distance Ache 🌍",
    "Traffic & Rush 🚕",
    "Mum’s Knee Pain 🩺",
    "Sunday Loneliness ☕",
  ];
  const [worryBubbles, setWorryBubbles] = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: `wb-${i}`,
      text: WORRY_BUBBLE_LABELS[i % WORRY_BUBBLE_LABELS.length],
      x: 15 + ((i * 14) % 70),
      y: 22 + ((i * 19) % 58),
      color: ["#F36D89", "#D95732", "#EAB84B", "#5C8EA6"][i % 4],
      scale: 1,
    })),
  );
  const [splatBursts, setSplatBursts] = useState([]);

  // Game 3: Singing Bowls & ASMR Rain State
  const [rainPlaying, setRainPlaying] = useState(false);
  const [activeBowlRipple, setActiveBowlRipple] = useState(null);
  const [breathPhase, setBreathPhase] = useState("Inhale (4s)");

  // Game 4: Zen Rangoli Mandala Canvas Ref
  const rangoliCanvasRef = useRef(null);
  const rangoliDrawingRef = useRef(false);
  const [rangoliHueIndex, setRangoliHueIndex] = useState(0);

  useEffect(() => {
    const phases = ["Inhale Calm (4s)", "Hold Warmth (4s)", "Exhale Worry (6s)"];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % phases.length;
      setBreathPhase(phases[i]);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      asmrAudio.toggleMonsoonRain(false);
    };
  }, []);

  const spawnFloatingWord = (x, y, word, color = "#F36D89") => {
    const id = `fl-${Date.now()}-${Math.random()}`;
    setChatakFloaters((prev) => [...prev.slice(-10), { id, x, y, word, color }]);
    setTimeout(() => {
      setChatakFloaters((prev) => prev.filter((item) => item.id !== id));
    }, 900);
  };

  // Pop a single bubble on the Chatak-Patak board
  const handlePopBubble = (idx, clientX, clientY) => {
    if (popGrid[idx]?.popped) return;
    setPopGrid((prev) => {
      const target = prev[idx];
      if (!target || target.popped) return prev;

      const pitch = 0.8 + target.row * 0.12 + target.col * 0.06;
      asmrAudio.playChatakPop(pitch);

      const words = ["CHATAK! ⚡", "PATAK! 💥", "POP! ✨", "SUKOON! 🌸", "WAH! 🎉"];
      const word = words[(idx + comboStreak) % words.length];
      spawnFloatingWord((target.col / 6) * 80 + 10, (target.row / 6) * 75 + 12, word, target.color);

      const next = prev.map((b, i) => (i === idx ? { ...b, popped: true } : b));
      const allDone = next.every((b) => b.popped);
      if (allDone) {
        asmrAudio.playPatakFirework();
        setTimeout(() => {
          setPopGrid((curr) => curr.map((b) => ({ ...b, popped: false })));
          if (onSendCareSparkToGlobe) onSendCareSparkToGlobe();
        }, 650);
      }
      return next;
    });

    setReliefScore((s) => s + 10 * comboStreak);
    setComboStreak((c) => Math.min(12, c + 1));
  };

  // Trigger a cascading Chatak-Patak Domino Wave across all 36 bubbles
  const triggerMegaChatakWave = () => {
    popGrid.forEach((b, i) => {
      setTimeout(() => {
        asmrAudio.playChatakPop(0.75 + (i % 12) * 0.11);
        setPopGrid((prev) =>
          prev.map((cell, idx) => (idx === i ? { ...cell, popped: !cell.popped } : cell)),
        );
      }, i * 28);
    });
    setReliefScore((s) => s + 250);
    if (onTriggerToast) {
      onTriggerToast(
        "Chatak-Patak Mega Wave! +250 Relief Points & Care Pulse Sent ✨",
        "ASMR Relief",
      );
    }
  };

  // Splat a floating worry bubble in Game 2
  const handleSplatWorryBubble = (wb) => {
    asmrAudio.playPatakFirework();
    const burstId = `bst-${Date.now()}`;
    setSplatBursts((prev) => [
      ...prev,
      { id: burstId, x: wb.x, y: wb.y, color: wb.color, label: "PATAK! Released ✨" },
    ]);
    setTimeout(() => {
      setSplatBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 850);

    setReliefScore((s) => s + 35);
    setComboStreak((c) => Math.min(15, c + 1));

    // Respawn a fresh worry bubble after a moment
    setWorryBubbles((prev) =>
      prev.map((item) =>
        item.id === wb.id
          ? {
              ...item,
              text: WORRY_BUBBLE_LABELS[Math.floor(Math.random() * WORRY_BUBBLE_LABELS.length)],
              x: 12 + Math.floor(Math.random() * 72),
              y: 18 + Math.floor(Math.random() * 62),
              color: ["#F36D89", "#D95732", "#EAB84B", "#5C8EA6"][Math.floor(Math.random() * 4)],
            }
          : item,
      ),
    );
  };

  // Draw 8-fold symmetrical Rangoli Mandala in Game 4
  const handleRangoliDraw = (e) => {
    if (!rangoliDrawingRef.current || !rangoliCanvasRef.current) return;
    const canvas = rangoliCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    const baseAngle = Math.atan2(dy, dx);

    const ctx = canvas.getContext("2d");
    const palette = ["#F36D89", "#EAB84B", "#D95732", "#F7F0E5", "#5C8EA6"];
    const strokeColor = palette[rangoliHueIndex % palette.length];

    for (let k = 0; k < 8; k++) {
      const angle = baseAngle + (k * Math.PI) / 4;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    if (Math.random() < 0.16) {
      asmrAudio.playSilkPluck(Math.floor(dist / 22));
      setReliefScore((s) => s + 5);
    }
  };

  const clearRangoliCanvas = () => {
    if (!rangoliCanvasRef.current) return;
    const canvas = rangoliCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    asmrAudio.playSingingBowl(528);
  };

  return (
    <div
      className={`rounded-[32px] border-2 p-5 sm:p-6 transition-all relative overflow-hidden ${
        isDark
          ? "bg-[radial-gradient(circle_at_top_right,#183B61_0%,#0B1D33_75%)] border-[var(--preview-coral)]"
          : "bg-[radial-gradient(circle_at_top_right,#FFFDF9_0%,#F7F0E5_70%,#EFE6D5_100%)] border-[var(--preview-navy)] shadow-[0_20px_50px_rgba(16,47,80,0.12)]"
      }`}
    >
      {/* Top Arcade Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--preview-coral)] text-[var(--preview-navy)] text-[10px] font-black uppercase tracking-wider shadow-sm">
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Chatak-Patak &amp; ASMR</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black mt-1.5">
            Pop a Worry, Hear the ASMR &amp; Feel Instant Relief ✨
          </h3>
        </div>

        {/* Live Relief Score, Combo Streak & Sound Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-gold)] flex items-center gap-2 text-xs font-extrabold">
            <span className="text-[var(--preview-gold)]">⚡ Relief Score:</span>
            <span className="text-sm font-black text-[var(--preview-coral)]">{reliefScore}</span>
            <span className="px-2 py-0.5 rounded-lg bg-[var(--preview-orange)] text-[var(--preview-white)] text-[10px]">
              {comboStreak}x Combo
            </span>
          </div>

          <button
            onClick={() => {
              const nextMuted = !soundMuted;
              setSoundMuted(nextMuted);
              asmrAudio.muted = nextMuted;
              if (nextMuted) {
                asmrAudio.toggleMonsoonRain(false);
                setRainPlaying(false);
              }
            }}
            className={`px-3 py-2 rounded-2xl border text-xs font-extrabold flex items-center gap-1.5 ${
              soundMuted
                ? "bg-[var(--preview-orange)] text-[var(--preview-white)] border-[var(--preview-orange)]"
                : "bg-[var(--preview-gold)] text-[var(--preview-navy)] border-[var(--preview-navy)]"
            }`}
            title="Toggle Web Audio ASMR Synth"
          >
            {soundMuted ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>ASMR Sound ON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Mini-Game Mode Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          {
            id: "popit",
            label: "🫧 Chatak-Patak Pop-It",
            sub: "Swipe or tap 36 bubbles",
          },
          {
            id: "worrysplat",
            label: "💥 Patak! Worry Splat",
            sub: "Burst floating anxieties",
          },
          {
            id: "bowls",
            label: "🥣 Singing Bowls & Rain",
            sub: "Himalayan chime + monsoon",
          },
          {
            id: "rangoli",
            label: "🌸 Zen Rangoli Spinner",
            sub: "8-fold musical mandala",
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveGameTab(tab.id);
              asmrAudio.playChatakPop(1.2);
            }}
            className={`p-3 rounded-2xl border-2 text-left transition-all ${
              activeGameTab === tab.id
                ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[var(--preview-coral)] shadow-lg scale-[1.02]"
                : isDark
                  ? "bg-[var(--preview-darkest)]/80 text-[var(--preview-cream)]/80 border-[var(--preview-dark-line)] hover:border-[var(--preview-gold)]"
                  : "bg-[var(--preview-white)]/90 text-[var(--preview-navy)] border-[var(--preview-line)] hover:border-[var(--preview-navy)]"
            }`}
          >
            <p className="text-xs font-extrabold">{tab.label}</p>
            <p
              className={`text-[10px] mt-0.5 ${
                activeGameTab === tab.id ? "text-[var(--preview-gold)]" : "opacity-70"
              }`}
            >
              {tab.sub}
            </p>
          </button>
        ))}
      </div>

      {/* ====================================================================
          MINI-GAME 1: CHATAK-PATAK 3D SILICONE BUBBLE POP-IT BOARD
      ==================================================================== */}
      {activeGameTab === "popit" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 flex flex-col items-center">
            <div
              onPointerDown={() => {
                isPointerDownPopRef.current = true;
              }}
              onPointerUp={() => {
                isPointerDownPopRef.current = false;
              }}
              onPointerLeave={() => {
                isPointerDownPopRef.current = false;
              }}
              className="relative p-4 sm:p-5 rounded-[32px] bg-[var(--preview-navy)] border-4 border-[var(--preview-gold)] shadow-[0_18px_40px_rgba(16,47,80,0.45)] w-full max-w-[380px]"
            >
              {/* Floating "CHATAK!" / "PATAK!" Onomatopoeia Bursts */}
              {chatakFloaters.map((fl) => (
                <span
                  key={fl.id}
                  style={{
                    left: `${fl.x}%`,
                    top: `${fl.y}%`,
                    backgroundColor: fl.color,
                  }}
                  className="pointer-events-none absolute z-30 px-2.5 py-0.5 rounded-full text-[11px] font-black text-[var(--preview-navy)] border-2 border-[var(--preview-cream)] shadow-lg animate-bounce"
                >
                  {fl.word}
                </span>
              ))}

              <div className="grid grid-cols-6 gap-2.5 sm:gap-3">
                {popGrid.map((cell, idx) => (
                  <button
                    key={cell.id}
                    type="button"
                    aria-label={`Pop bubble ${idx + 1}`}
                    aria-pressed={cell.popped}
                    onClick={(event) => {
                      if (event.detail === 0) handlePopBubble(idx, 0, 0);
                    }}
                    onPointerDown={(e) => handlePopBubble(idx, e.clientX, e.clientY)}
                    onPointerEnter={(e) => {
                      if (isPointerDownPopRef.current) {
                        handlePopBubble(idx, e.clientX, e.clientY);
                      }
                    }}
                    style={{
                      backgroundColor: cell.color,
                      boxShadow: cell.popped
                        ? "inset 0 6px 10px rgba(0,0,0,0.55)"
                        : "0 6px 0 rgba(0,0,0,0.35), inset 0 3px 6px rgba(255,255,255,0.55)",
                    }}
                    className={`aspect-square rounded-full transition-all duration-100 flex items-center justify-center border-2 border-[var(--preview-white)]/30 ${
                      cell.popped
                        ? "scale-90 opacity-60 translate-y-1"
                        : "hover:scale-105 -translate-y-0.5"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full ${
                        cell.popped ? "bg-black/25" : "bg-[var(--preview-white)]/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3.5">
            <div className="p-4 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-coral)]/40">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--preview-gold)]">
                Why Chatak-Patak Works
              </span>
              <h4 className="text-base font-extrabold mt-1">A little room to play</h4>
              <p className="text-xs text-[var(--preview-cream)]/80 mt-1 leading-relaxed">
                Drag your finger or mouse across the bubbles to rapid-pop an entire row! Every pop
                plays a harmonic pitch sweep and sends warm care energy to your family circle.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={triggerMegaChatakWave}
                className="py-3 px-4 rounded-2xl bg-[var(--preview-orange)] hover:bg-[var(--preview-coral)] text-[var(--preview-cream)] hover:text-[var(--preview-navy)] text-xs font-extrabold shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                <span>Mega Chatak Wave</span>
              </button>

              <button
                onClick={() => {
                  asmrAudio.playSingingBowl(432);
                  setPopGrid((prev) => prev.map((b) => ({ ...b, popped: false })));
                }}
                className="py-3 px-4 rounded-2xl bg-[var(--preview-gold)] text-[var(--preview-navy)] text-xs font-extrabold shadow-md hover:scale-[1.02] transition-transform flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Flip Board Fresh</span>
              </button>
            </div>

            <button
              onClick={() => {
                asmrAudio.playPatakFirework();
                if (onSendCareSparkToGlobe) onSendCareSparkToGlobe();
              }}
              className="w-full py-3 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] text-xs font-black border-2 border-[var(--preview-navy)] shadow-md hover:bg-[var(--preview-gold)] transition-colors"
            >
              ✨ Convert Relief Points into Family Care Spark on 3D Globe →
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          MINI-GAME 2: "PATAK!" WORRY-BUBBLE SPLAT & FIREWORK ARENA
      ==================================================================== */}
      {activeGameTab === "worrysplat" && (
        <div className="space-y-4">
          <div className="relative h-72 sm:h-80 rounded-3xl bg-[var(--preview-darkest)] border-2 border-[var(--preview-gold)] overflow-hidden select-none">
            <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-xs font-bold text-[var(--preview-cream)]/80 pointer-events-none z-20">
              <span>
                🎯 Tap any floating worry bubble to burst it with a Chatak-Patak firework!
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--preview-coral)] text-[var(--preview-navy)] font-black">
                +35 pts / pop
              </span>
            </div>

            {worryBubbles.map((wb) => (
              <button
                key={wb.id}
                onClick={() => handleSplatWorryBubble(wb)}
                style={{
                  left: `${wb.x}%`,
                  top: `${wb.y}%`,
                  backgroundColor: wb.color,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-4 py-2.5 rounded-full text-xs font-black text-[var(--preview-navy)] border-2 border-[var(--preview-cream)] shadow-[0_10px_25px_rgba(243,109,137,0.45)] hover:scale-110 active:scale-75 transition-all animate-float-above cursor-pointer"
              >
                {wb.text}
              </button>
            ))}

            {splatBursts.map((bst) => (
              <div
                key={bst.id}
                style={{ left: `${bst.x}%`, top: `${bst.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
              >
                <span className="px-3 py-1 rounded-full bg-[var(--preview-gold)] text-[var(--preview-navy)] text-xs font-black shadow-xl animate-ping block">
                  {bst.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          MINI-GAME 3: HIMALAYAN SINGING BOWLS & MONSOON CLAY RAIN ASMR
      ==================================================================== */}
      {activeGameTab === "bowls" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 grid grid-cols-3 gap-3">
            {[
              {
                id: "bowl-1",
                name: "Root Calm Bowl",
                freq: 396,
                note: "Low, mellow tone",
                color: "#D95732",
              },
              {
                id: "bowl-2",
                name: "Heart Care Bowl",
                freq: 528,
                note: "Warm, rounded tone",
                color: "#EAB84B",
              },
              {
                id: "bowl-3",
                name: "2AM Sleep Bowl",
                freq: 432,
                note: "Soft, resonant tone",
                color: "#F36D89",
              },
            ].map((bowl) => (
              <button
                key={bowl.id}
                onClick={() => {
                  asmrAudio.playSingingBowl(bowl.freq);
                  setActiveBowlRipple(bowl.id);
                  setReliefScore((s) => s + 25);
                  setTimeout(() => setActiveBowlRipple(null), 1500);
                }}
                className="p-4 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-gold)] flex flex-col items-center justify-center text-center relative overflow-hidden group hover:scale-105 transition-transform"
              >
                {activeBowlRipple === bowl.id && (
                  <span className="absolute inset-2 rounded-full border-4 border-[var(--preview-coral)] animate-coral-ring pointer-events-none" />
                )}
                <div
                  style={{ backgroundColor: bowl.color }}
                  className="w-16 h-16 rounded-full border-4 border-[var(--preview-cream)] shadow-inner flex items-center justify-center mb-2 group-active:scale-90 transition-transform"
                >
                  <span className="text-xl">🥣</span>
                </div>
                <p className="text-xs font-extrabold">{bowl.name}</p>
                <p className="text-[10px] text-[var(--preview-gold)] mt-0.5">{bowl.note}</p>
              </button>
            ))}
          </div>

          <div className="md:col-span-5 space-y-3">
            <div className="p-4 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-gold)]/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-[var(--preview-gold)]">
                  🌧️ Monsoon Rain on Terracotta Roof
                </p>
                <p className="text-[11px] opacity-80">Soft, steady rain</p>
              </div>
              <button
                onClick={() => {
                  const next = !rainPlaying;
                  const ok = asmrAudio.toggleMonsoonRain(next);
                  setRainPlaying(ok);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold ${
                  rainPlaying
                    ? "bg-[var(--preview-coral)] text-[var(--preview-navy)]"
                    : "bg-[var(--preview-white)]/15 text-[var(--preview-cream)]"
                }`}
              >
                {rainPlaying ? "Stop Rain" : "Play Rain ASMR"}
              </button>
            </div>

            <div className="p-4 rounded-3xl bg-[var(--preview-sand)] text-[var(--preview-navy)] border border-[var(--preview-line)] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-[var(--preview-orange)]">
                  Guided Breathing Pace
                </p>
                <p className="text-sm font-black">{breathPhase}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[var(--preview-navy)] text-[var(--preview-gold)] flex items-center justify-center animate-pulse font-black text-xs">
                Breathe
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MINI-GAME 4: 8-FOLD MARIGOLD & CORAL RANGOLI MANDALA SPINNER
      ==================================================================== */}
      {activeGameTab === "rangoli" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 flex justify-center">
            <canvas
              ref={rangoliCanvasRef}
              width={320}
              height={260}
              onPointerDown={(e) => {
                rangoliDrawingRef.current = true;
                handleRangoliDraw(e);
              }}
              onPointerMove={handleRangoliDraw}
              onPointerUp={() => {
                rangoliDrawingRef.current = false;
                setRangoliHueIndex((h) => h + 1);
              }}
              onPointerLeave={() => {
                rangoliDrawingRef.current = false;
              }}
              className="rounded-3xl bg-[var(--preview-darkest)] border-2 border-[var(--preview-gold)] cursor-crosshair shadow-xl touch-none"
            />
          </div>
          <div className="md:col-span-5 space-y-3">
            <h4 className="text-base font-extrabold">
              Draw Glowing 8-Fold Musical Rangoli Patterns
            </h4>
            <p className="text-xs opacity-80 leading-relaxed">
              Swipe across the dark navy canvas to paint symmetrical marigold, coral, and cream
              mandala trails accompanied by soft kalimba &amp; harp plucks.
            </p>
            <div className="flex gap-2">
              <button
                onClick={clearRangoliCanvas}
                className="px-4 py-2.5 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] text-xs font-extrabold"
              >
                Clear Canvas
              </button>
              <button
                onClick={() => setRangoliHueIndex((h) => h + 1)}
                className="px-4 py-2.5 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] text-xs font-extrabold"
              >
                Switch Brush Color
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 6. REAL THREE.JS WEBGL 3D INTERACTIVE FAMILY GLOBE & ABOVE-AVATAR NOTIFICATIONS
// ============================================================================
const ThreeJsFamilyStage = ({
  members,
  sceneMode,
  setSceneMode,
  isDark,
  zoom,
  setZoom,
  autoRotate,
  setAutoRotate,
  expandedNotifId,
  setExpandedNotifId,
  notifStyle,
  onSimulateMember,
  onTriggerConfetti,
  onDownloadToPhone,
  confettiBursts,
  playingAudioId,
  setPlayingAudioId,
  targetRotationYaw,
}) => {
  const mountRef = useRef(null);
  const [projectedNodes, setProjectedNodes] = useState([]);
  const [stageWidth, setStageWidth] = useState(540);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [globeConfig, setGlobeConfig] = useState({ theme: "navy", rotationSpeed: 0.192, showPulseRings: true });
  const globeConfigRef = useRef(globeConfig);
  const expandedNotifRef = useRef(expandedNotifId);
  const rotationRef = useRef({ yaw: 0.35, pitch: 0.12 });
  const dragRef = useRef({ isDragging: false, lastX: 0, lastY: 0 });
  const membersRef = useRef(members);
  const zoomRef = useRef(zoom);
  const autoRotateRef = useRef(autoRotate);
  const sceneModeRef = useRef(sceneMode);

  useEffect(() => { globeConfigRef.current = globeConfig; }, [globeConfig]);
  useEffect(() => { expandedNotifRef.current = expandedNotifId; }, [expandedNotifId]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    sceneModeRef.current = sceneMode;
  }, [sceneMode]);

  useEffect(() => {
    if (typeof targetRotationYaw === "number") {
      rotationRef.current.yaw = targetRotationYaw;
    }
  }, [targetRotationYaw]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.innerHTML = "";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = container.clientWidth || 540;
    let height = container.clientHeight || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const syncCanvasSize = () => {
      width = container.clientWidth || 540;
      height = container.clientHeight || 480;
      setStageWidth(width);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      camera.aspect = width / height;
      camera.position.z = (5.2 * height) / Math.min(width, height);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
    };

    // Real Three.js 3D Camera & Matrix Hierarchy (No WebGL2 dependency)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.3);
    camera.updateMatrixWorld(true);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    syncCanvasSize();

    // Fibonacci surface and palettes adapted from the supplied globe prototype.
    const palettes = {
      navy: { coreInner: "#1E4A7A", coreMid: "#102F50", coreOuter: "#091D34", landPrimary: "#F36D89", landSecondary: "#EAB84B", oceanDot: "rgba(217,87,50,0.42)" },
      terracotta: { coreInner: "#8B1E3F", coreMid: "#5A1228", coreOuter: "#2F0814", landPrimary: "#EAB84B", landSecondary: "#FFFDF9", oceanDot: "rgba(243,109,137,0.4)" },
      emerald: { coreInner: "#245E4E", coreMid: "#133C31", coreOuter: "#09221B", landPrimary: "#EAB84B", landSecondary: "#F36D89", oceanDot: "rgba(255,253,249,0.35)" },
    };
    const dotCount = 2000;
    const dotItems = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < dotCount; i++) {
      const y = 1 - (i / (dotCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = (2 * Math.PI * i) / goldenRatio;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Procedural landmass clustering so continents pop visually
      const mask = Math.sin(x * 4.2 + 0.5) * Math.cos(y * 3.8) + Math.sin(z * 4.5 - 0.3) * 0.6;
      const isLand = mask > -0.12;
      const r = isLand ? 1.245 : 1.22;

      dotItems.push({
        localPos: new THREE.Vector3(x * r, y * r, z * r),
        mask,
        isLand,
        size: isLand ? 2.3 : 1.3,
      });
    }

    const sphericalToVec3 = (phi, theta, radius = 1.25) => {
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.cos(theta);
      return new THREE.Vector3(x, y, z);
    };

    // Build Elevated 3D Geodesic Care Arcs using THREE.QuadraticBezierCurve3
    const buildArcCurves = (memberList) => {
      const curves = [];
      for (let i = 0; i < memberList.length; i++) {
        const m1 = memberList[i];
        const m2 = memberList[(i + 1) % memberList.length];
        const v1 = sphericalToVec3(m1.phi, m1.theta, 1.25);
        const v2 = sphericalToVec3(m2.phi, m2.theta, 1.25);
        const mid = v1.clone().add(v2).multiplyScalar(0.5).normalize().multiplyScalar(1.58);

        const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
        curves.push({
          pts: curve.getPoints(36),
          color: i % 2 === 0 ? "#F36D89" : "#EAB84B",
          speedOffset: i * 0.19,
        });
      }
      return curves;
    };

    const arcCurves = buildArcCurves(membersRef.current);

    const project3DToScreen = (localVec) => {
      const worldPos = localVec.clone().applyMatrix4(globeGroup.matrixWorld);
      const ndc = worldPos.clone().project(camera);
      return {
        x: (ndc.x * 0.5 + 0.5) * width,
        y: (-ndc.y * 0.5 + 0.5) * height,
        z: worldPos.z,
      };
    };

    let frameId;
    let clock = 0;
    let previousFrame = 0;
    let isVisible = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    visibility.observe(container);

    const animate = (time = 0) => {
      frameId = requestAnimationFrame(animate);
      if (document.hidden || !isVisible || time - previousFrame < 32) return;
      const delta = Math.min((time - previousFrame) / 1000, 0.05);
      previousFrame = time;
      if (!reducedMotion.matches && !expandedNotifRef.current) clock += delta;
      const cfg = globeConfigRef.current;
      const palette = palettes[cfg.theme] || palettes.navy;

      if (autoRotateRef.current && !reducedMotion.matches && !dragRef.current.isDragging && !expandedNotifRef.current) {
        rotationRef.current.yaw += delta * cfg.rotationSpeed;
      }

      const modeScale =
        sceneModeRef.current === "calm"
          ? zoomRef.current * (1 + Math.sin(clock * 1.4) * 0.06)
          : zoomRef.current;

      globeGroup.scale.setScalar(modeScale);
      globeGroup.rotation.y = rotationRef.current.yaw;
      globeGroup.rotation.x = rotationRef.current.pitch;
      globeGroup.updateMatrixWorld(true);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      // A sphere's perspective silhouette is independent of its rotation.
      const radius = 1.245 * modeScale;
      const focalLength = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      const pixelRadius = focalLength * radius / Math.sqrt(camera.position.z ** 2 - radius ** 2);
      canvas.dataset.radius = pixelRadius.toFixed(2);
      canvas.dataset.yaw = rotationRef.current.yaw.toFixed(4);

      // 1. Concentric COBE / Care Aura Rings
      for (let rIdx = 1; cfg.showPulseRings && rIdx <= 2; rIdx++) {
        const pulseR = pixelRadius + rIdx * 16 + Math.sin(clock * 2 + rIdx) * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = rIdx % 2 === 0 ? "rgba(243, 109, 137, 0.16)" : "rgba(234, 184, 75, 0.18)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 2. Core Shaded 3D Sphere Body
      const gradX0 = Number.isFinite(cx - pixelRadius * 0.3) ? cx - pixelRadius * 0.3 : cx;
      const gradY0 = Number.isFinite(cy - pixelRadius * 0.3) ? cy - pixelRadius * 0.3 : cy;
      const gradR0 =
        Number.isFinite(pixelRadius * 0.1) && pixelRadius * 0.1 >= 0 ? pixelRadius * 0.1 : 10;
      const gradR1 = Number.isFinite(pixelRadius) && pixelRadius > 0 ? pixelRadius : 120;
      const sphereGrad = ctx.createRadialGradient(gradX0, gradY0, gradR0, cx, cy, gradR1);
      sphereGrad.addColorStop(0, palette.coreInner);
      sphereGrad.addColorStop(0.65, palette.coreMid);
      sphereGrad.addColorStop(1, palette.coreOuter);

      ctx.beginPath();
      ctx.arc(cx, cy, pixelRadius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      if (sceneModeRef.current !== "constellation") ctx.fill();

      // Rim Highlight
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "rgba(234, 184, 75, 0.45)";
      ctx.stroke();

      // Cull the far surface at the perspective horizon, not the sphere's equator.
      for (let i = 0; i < dotItems.length; i++) {
        const item = dotItems[i];
        const pt = project3DToScreen(item.localPos);
        if (pt.z < radius ** 2 / camera.position.z || (sceneModeRef.current === "constellation" && i % 18 !== 0)) continue;

        const depthAlpha = Math.min(1, Math.max(0.15, (pt.z + 0.2) / 1.3));
        ctx.globalAlpha = depthAlpha;
        ctx.fillStyle = item.mask > 0.35 ? palette.landPrimary : item.mask > -0.08 ? palette.landSecondary : palette.oceanDot;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, item.size * modeScale * (0.75 + depthAlpha * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 4. Render Elevated Three.js Geodesic Care Arcs & Traveling Care Comets
      (sceneModeRef.current === "constellation" ? arcCurves : []).forEach((arc) => {
        ctx.beginPath();
        let started = false;
        const screenPts = [];

        for (let i = 0; i < arc.pts.length; i++) {
          const sp = project3DToScreen(arc.pts[i]);
          screenPts.push(sp);
          if (sp.z > -0.25) {
            if (!started) {
              ctx.moveTo(sp.x, sp.y);
              started = true;
            } else {
              ctx.lineTo(sp.x, sp.y);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.75;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Animated Traveling Care Pulse Comet along the 3D Bezier Curve
        const cometFloat = ((clock * 0.45 + arc.speedOffset) % 1) * (screenPts.length - 1);
        const cometIdx = Math.floor(cometFloat);
        const cometPt = screenPts[cometIdx];
        if (cometPt && cometPt.z > -0.15) {
          ctx.beginPath();
          ctx.arc(cometPt.x, cometPt.y, 4.2, 0, Math.PI * 2);
          ctx.fillStyle = "#F7F0E5";
          ctx.shadowColor = arc.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      ctx.restore();

      // 5. Project 3D Member Positions to 2D Overlay Coordinates
      const nextProjected = membersRef.current.map((m) => {
        const localPos = sphericalToVec3(m.phi, m.theta, 1.28);
        const pt = project3DToScreen(localPos);
        const isFront = pt.z > radius ** 2 / camera.position.z;
        return {
          ...m,
          screenX: Math.max(42, Math.min(width - 42, pt.x)),
          screenY: Math.max(95, Math.min(height - 48, pt.y)),
          zDepth: pt.z,
          isFront,
        };
      }).filter((node) => node.isFront || node.id === expandedNotifRef.current);

      const selected = nextProjected.find((node) => node.id === expandedNotifRef.current);
      if (selected) {
        selected.screenX = width / 2;
        selected.screenY = height - 75;
      }

      // Separate projected labels so nearby members remain individually selectable.
      for (let pass = 0; pass < 12; pass++) {
        for (let i = 0; i < nextProjected.length; i++) {
          for (let j = i + 1; j < nextProjected.length; j++) {
            const a = nextProjected[i],
              b = nextProjected[j];
            const dx = b.screenX - a.screenX,
              dy = b.screenY - a.screenY;
            const overlapX = 94 - Math.abs(dx),
              overlapY = 122 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (overlapX < overlapY) {
              const push = (overlapX / 2 + 1) * (dx >= 0 ? 1 : -1);
              a.screenX = Math.max(42, Math.min(width - 42, a.screenX - push));
              b.screenX = Math.max(42, Math.min(width - 42, b.screenX + push));
            } else {
              const push = (overlapY / 2 + 1) * (dy >= 0 ? 1 : -1);
              a.screenY = Math.max(95, Math.min(height - 48, a.screenY - push));
              b.screenY = Math.max(95, Math.min(height - 48, b.screenY + push));
            }
          }
        }
      }
      setProjectedNodes(nextProjected);
    };

    animate();

    const resize = new ResizeObserver(syncCanvasSize);
    resize.observe(container);
    return () => {
      cancelAnimationFrame(frameId);
      visibility.disconnect();
      resize.disconnect();
      canvas.remove();
    };
  }, [isDark, members.length]);

  return (
    <div
      className={`preview-globe relative select-none transition-all ${
        isDark
          ? "bg-[radial-gradient(circle_at_center,#143357_0%,#081526_80%)] border-[var(--preview-dark-line)]"
          : "bg-[radial-gradient(circle_at_center,#FFFDF9_0%,#EFE6D5_85%)] border-[var(--preview-navy)] shadow-[0_22px_55px_rgba(16,47,80,0.16)]"
      }`}
    >
      {/* Top Stage Mode Switcher */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div
          data-globe-modes
          className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-gold)]/40"
        >
          {[
            { id: "globe", label: "🌍 3D Family Globe" },
            { id: "constellation", label: "✨ Care Orbit" },
            { id: "calm", label: "🌬️ Breath Sphere" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSceneMode(m.id)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all ${
                sceneMode === m.id
                  ? "bg-[var(--preview-gold)] text-[var(--preview-navy)]"
                  : "text-[var(--preview-cream)]/80 hover:text-[var(--preview-white)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onSimulateMember()}
          className="px-3 py-1.5 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] border-2 border-[var(--preview-navy)] text-[11px] font-black shadow hover:bg-[var(--preview-gold)] transition-colors flex items-center gap-1"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Simulate Update</span>
        </button>
      </div>

      {/* Three.js Canvas Mount + Projected 3D Family Avatar Pins */}
      <div
        data-stage
        tabIndex={0}
        role="region"
        aria-label="Family globe. Use arrow keys to rotate."
        className="relative w-full h-[430px] sm:h-[470px] cursor-grab active:cursor-grabbing touch-pan-y"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          setAutoRotate(false);
          if (e.key === "ArrowLeft") rotationRef.current.yaw -= 0.2;
          if (e.key === "ArrowRight") rotationRef.current.yaw += 0.2;
          if (e.key === "ArrowUp") rotationRef.current.pitch = Math.max(-0.65, rotationRef.current.pitch - 0.1);
          if (e.key === "ArrowDown") rotationRef.current.pitch = Math.min(0.65, rotationRef.current.pitch + 0.1);
        }}
        onPointerDown={(e) => {
          if (e.target.closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            isDragging: true,
            lastX: e.clientX,
            lastY: e.clientY,
          };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.isDragging) return;
          const dx = e.clientX - dragRef.current.lastX;
          const dy = e.clientY - dragRef.current.lastY;
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;
          rotationRef.current.yaw += dx * 0.007;
          rotationRef.current.pitch = Math.max(
            -0.65,
            Math.min(0.65, rotationRef.current.pitch + dy * 0.007),
          );
        }}
        onPointerUp={() => {
          dragRef.current.isDragging = false;
        }}
        onPointerCancel={() => { dragRef.current.isDragging = false; }}
        onPointerLeave={() => {
          dragRef.current.isDragging = false;
        }}
      >
        <div ref={mountRef} className="absolute inset-0" />

        {/* Projected Family Member Avatars + Strictly Above-Avatar Notification */}
        {projectedNodes.map((node) => {
          const isNotifExpanded = expandedNotifId === node.id;
          const showAboveNotif = isNotifExpanded || node.hasNotification;
          const burstParticles = confettiBursts?.[node.id];

          return (
            <div
              key={node.id}
              data-pin={node.id}
              style={{
                left: `${node.screenX}px`,
                top: `${node.screenY}px`,
                zIndex: isNotifExpanded ? 40 : Math.round((node.zDepth + 2) * 10),
                opacity: node.isFront || isNotifExpanded ? 1 : 0.32,
                transform: `translate(-50%, -50%) scale(${
                  node.isFront || isNotifExpanded ? 1 : 0.78
                })`,
              }}
              className="absolute transition-opacity duration-200"
            >
              {/* Confetti Burst Particles */}
              {burstParticles &&
                burstParticles.map((p) => (
                  <span
                    key={p.id}
                    style={{
                      backgroundColor: p.color,
                      transform: `translate(${p.tx}px, ${p.ty}px) rotate(${p.rot}deg)`,
                    }}
                    className="pointer-events-none absolute left-1/2 top-0 w-2.5 h-2.5 rounded-full transition-all duration-700"
                  />
                ))}

              {/* ============================================================
                  ANIMATED NOTIFICATION STRICTLY ABOVE THE USER AVATAR
              ============================================================ */}
              {showAboveNotif && (
                <div
                  data-update
                  style={{
                    bottom: "calc(100% + 14px)",
                    transform: `translateX(${isNotifExpanded ? Math.max(138 - node.screenX, Math.min(stageWidth - 138 - node.screenX, 0)) : 0}px)`,
                  }}
                  className="absolute left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
                >
                  {isNotifExpanded ? (
                    <div
                      className={`w-60 sm:w-64 p-3 rounded-2xl border-2 shadow-2xl ${
                        notifStyle === "funky-sticker"
                          ? "bg-[var(--preview-gold)] text-[var(--preview-navy)] border-[var(--preview-navy)] -rotate-1"
                          : notifStyle === "dynamic-island"
                            ? "bg-[var(--preview-darkest)] text-[var(--preview-cream)] border-[var(--preview-coral)]"
                            : "bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[var(--preview-gold)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[var(--preview-coral)] text-[var(--preview-navy)]">
                          {node.stickerBadge || "✨ Live Check-in"}
                        </span>
                        <button
                          type="button"
                          aria-label="Close member update"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedNotifId(null);
                          }}
                          className="p-0.5 rounded-full hover:bg-black/20"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-[11px] font-bold leading-snug mb-2">
                        &ldquo;{node.statusText}&rdquo;
                      </p>

                      {/* Audio / Reaction / Save Bar */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-current/15">
                        <div className="flex items-center gap-1">
                          {["❤️", "🙏", "🌟"].map((emo) => (
                            <button
                              key={emo}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                asmrAudio.playChatakPop(1.3);
                                onTriggerConfetti(node.id, emo);
                              }}
                              className="px-1.5 py-0.5 rounded-lg bg-[var(--preview-white)]/15 hover:bg-[var(--preview-white)]/30 text-[11px]"
                            >
                              {emo}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          {node.hasAudioNote && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlayingAudioId(playingAudioId === node.id ? null : node.id);
                                asmrAudio.playSilkPluck(2);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[var(--preview-orange)] text-[var(--preview-white)] text-[9px] font-extrabold flex items-center gap-1"
                            >
                              {playingAudioId === node.id ? (
                                <Pause className="w-2.5 h-2.5" />
                              ) : (
                                <Play className="w-2.5 h-2.5" />
                              )}
                              <span>Voice</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadToPhone(`${node.name}_Update`, node.statusText);
                            }}
                            className="p-1 rounded-lg bg-[var(--preview-white)]/15 hover:bg-[var(--preview-white)]/30"
                            title="Save update to phone"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Downward Speech Pointer strictly pointing at Avatar Crown */}
                      <div className="w-3 h-3 rotate-45 bg-[var(--preview-navy)] border-r-2 border-b-2 border-[var(--preview-gold)] mx-auto -mb-4 mt-1" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedNotifId(node.id);
                        asmrAudio.playChatakPop(1.2);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-coral)] text-[10px] font-black shadow-lg whitespace-nowrap animate-bounce flex items-center gap-1"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--preview-coral)]" />
                      <span>{node.notificationCount || 1} Update</span>
                    </button>
                  )}
                </div>
              )}

              {/* Avatar Node Button */}
              <button
                type="button"
                aria-label={`View ${node.name}'s update`}
                aria-expanded={isNotifExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNotifId(expandedNotifId === node.id ? null : node.id);
                  asmrAudio.playChatakPop(1.1);
                }}
                className="relative flex flex-col items-center cursor-pointer group"
              >
                {node.hasNotification && (
                  <span className="absolute -inset-1.5 rounded-full border-2 border-[var(--preview-coral)] animate-coral-ring pointer-events-none" />
                )}
                <EditorialAvatar member={node} size="sm" isDark={isDark} />
                <span className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--preview-cream)] text-[var(--preview-navy)] border border-[var(--preview-navy)]/20 shadow-sm whitespace-nowrap">
                  {node.name}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Globe Controls (-, +, Rotate, View All) matching screenshot */}
      <div className="relative z-20 flex items-center justify-center gap-2 pb-4 pt-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.12).toFixed(2)))}
          className="w-9 h-9 rounded-full bg-[var(--preview-white)] text-[var(--preview-navy)] border border-[var(--preview-line)] shadow-sm flex items-center justify-center hover:bg-[var(--preview-gold)]"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(1.35, +(z + 0.12).toFixed(2)))}
          className="w-9 h-9 rounded-full bg-[var(--preview-white)] text-[var(--preview-navy)] border border-[var(--preview-line)] shadow-sm flex items-center justify-center hover:bg-[var(--preview-gold)]"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setAutoRotate((r) => !r)}
          className={`w-9 h-9 rounded-full border shadow-sm flex items-center justify-center ${
            autoRotate
              ? "bg-[var(--preview-navy)] text-[var(--preview-gold)] border-[var(--preview-navy)]"
              : "bg-[var(--preview-white)] text-[var(--preview-navy)] border-[var(--preview-line)]"
          }`}
          title="Toggle Auto-Rotation"
          aria-pressed={autoRotate}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setShowAllMembers((shown) => !shown);
          }}
          aria-expanded={showAllMembers}
          className="px-3.5 py-2 rounded-full bg-[var(--preview-white)] text-[var(--preview-navy)] border border-[var(--preview-line)] shadow-sm text-xs font-extrabold flex items-center gap-1.5 hover:bg-[var(--preview-sand)]"
        >
          <Users className="w-3.5 h-3.5" />
          <span>View all ({members.length})</span>
        </button>
      </div>
      {showAllMembers && (
        <div className="preview-globe-member-list" aria-label="All family members">
          {members.map((member) => (
            <button key={member.id} type="button" onClick={() => {
              rotationRef.current = { yaw: -member.theta, pitch: 0.12 };
              setExpandedNotifId(member.id);
              setAutoRotate(false);
            }}>
              <EditorialAvatar member={member} size="sm" isDark={isDark} />
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      )}
      <details className="preview-globe-settings">
        <summary>Globe appearance</summary>
        <div>
          <label>Colour palette
            <select value={globeConfig.theme} onChange={(e) => setGlobeConfig((cfg) => ({ ...cfg, theme: e.target.value }))}>
              <option value="navy">Navy &amp; gold</option>
              <option value="terracotta">Terracotta</option>
              <option value="emerald">Garden green</option>
            </select>
          </label>
          <label>Rotation speed
            <input type="range" min="0" max="0.6" step="0.012" value={globeConfig.rotationSpeed} onChange={(e) => setGlobeConfig((cfg) => ({ ...cfg, rotationSpeed: Number(e.target.value) }))} />
          </label>
          <label className="preview-globe-rings">
            <input type="checkbox" checked={globeConfig.showPulseRings} onChange={(e) => setGlobeConfig((cfg) => ({ ...cfg, showPulseRings: e.target.checked }))} />
            Pulse rings
          </label>
        </div>
      </details>
    </div>
  );
};

// ============================================================================
// 7. MAIN APPLICATION COMPONENT (SOMEONENEAR.COM THREE.JS HERO + FAMILY PLATFORM)
// ============================================================================
export default function App() {
  const setTimeout = usePreviewTimeouts();
  const rootRef = useRef(null);
  usePreviewLifecycle(rootRef);
  // Primary Top-Level Experience Mode:
  // 'hero-home' -> www.someonenear.com Three.js Hero & Landing Experience
  // 'family-app' -> Full "Our family" Sidebar + 5 Top Tabs Dashboard
  // 'chatak-arcade' -> Dedicated Step #9 Chatak-Patak & ASMR Relief Game Center
  // 'calm-space' -> Dedicated Three.js Breathing & Release a Worry Space
  const [experienceView, setExperienceView] = useState("hero-home");
  const [themeMode, setThemeMode] = useState("light"); // 'light' (#F7F0E5) | 'dark' (#0B1D33)
  const isDark = themeMode === "dark";
  const [parentSimpleMode, setParentSimpleMode] = useState(false);

  // Step #5: Country-Based Currency & Payment Gateway State
  const [selectedCountry, setSelectedCountry] = useState("IN");
  const [showCheckoutModal, setShowCheckoutModal] = useState(null); // null | { planName, callsCount, price }

  // Step #6: Sign-In / Create Account / Google / Apple ID Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("signin"); // 'signin' | 'signup'
  const [currentUser, setCurrentUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setCurrentUser({
          email: data.session.user.email,
          name: data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "My Account",
        });
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "My Account",
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Step #7: Enhanced Invite Modal (Mobile No. OR Shareable Invite ID + Call Opt-In / Ignore)
  const [inviteMethod, setInviteMethod] = useState("mobile"); // 'mobile' | 'inviteId'
  const [inviteMobile, setInviteMobile] = useState("+91 98201 54321");
  const [generatedInviteId, setGeneratedInviteId] = useState("SN-CARE-7492");
  const [pendingInvites, setPendingInvites] = useState([
    {
      id: "inv-1",
      name: "Nani Ji (Pune)",
      mobile: "+91 98230 11223",
      inviteCode: "SN-CARE-7492",
      callConsentStatus: "Awaiting Call Opt-In", // 'Awaiting Call Opt-In' | 'Accepted on Call' | 'Ignored by Invitee'
    },
  ]);

  // Step #10: Follow-up & Instant Memory Send-Later State in Assistive Gesture Button
  const [followUpCategory, setFollowUpCategory] = useState("appointment"); // 'appointment' | 'birthday' | 'howsyourday'
  const [instantMemoryNote, setInstantMemoryNote] = useState("");
  const [instantMemorySendTime, setInstantMemorySendTime] = useState("Tomorrow, 8:00 AM");

  // Dashboard Sidebar & Top Tab State
  const [activeNav, setActiveNav] = useState("Family");
  const [activeTab, setActiveTab] = useState("Family");

  // Three.js Stage State
  const [familyMembers, setFamilyMembers] = useState(INITIAL_FAMILY_MEMBERS);
  const [threeSceneMode, setThreeSceneMode] = useState("globe"); // 'globe' | 'constellation' | 'calm'
  const [notifStyle, setNotifStyle] = useState("editorial-speech"); // 'editorial-speech' | 'funky-sticker' | 'dynamic-island'
  const [expandedNotifId, setExpandedNotifId] = useState(null);
  const [globeZoom, setGlobeZoom] = useState(1);
  const [autoRotateGlobe, setAutoRotateGlobe] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [targetRotationYaw, setTargetRotationYaw] = useState(null);
  const [selectedWorryId, setSelectedWorryId] = useState("medication");

  // Interactive "How a Check-In Works" Step State
  const [activeHowStep, setActiveHowStep] = useState(1);

  // Calm Space "Name a Worry and Watch It Float Away" State
  const [worryInput, setWorryInput] = useState("");
  const [floatingWorries, setFloatingWorries] = useState([
    { id: "w-1", text: "Did Dad take his morning BP tablet?" },
  ]);

  // Shared Bounded Media, Medications, Reminders & Listeners
  const [sharedFeed, setSharedFeed] = useState(INITIAL_SHARED_FEED);
  const sharedFeedRef = useRef(sharedFeed);
  useEffect(() => {
    sharedFeedRef.current = sharedFeed;
  }, [sharedFeed]);
  useEffect(() => {
    const suspend = () => {
      if (document.hidden && asmrAudio.ctx) void asmrAudio.ctx.suspend();
    };
    document.addEventListener("visibilitychange", suspend);
    return () => {
      document.removeEventListener("visibilitychange", suspend);
      asmrAudio.toggleMonsoonRain(false);
      asmrAudio.muted = true;
      if (asmrAudio.ctx) void asmrAudio.ctx.close();
      asmrAudio.ctx = null;
      sharedFeedRef.current.forEach((post) => {
        if (post.url) URL.revokeObjectURL(post.url);
      });
    };
  }, []);
  const [medications, setMedications] = useState(INITIAL_MEDICATIONS);
  const [reminders, setReminders] = useState(INITIAL_REMINDERS);
  const [bookedSessions, setBookedSessions] = useState([
    {
      id: "bk-1",
      listenerName: "Dr. Kavita Nair",
      forWho: "Dad (Ordinary Phone)",
      slot: "Tomorrow, 11:00 AM",
    },
  ]);

  // Bounded Media Upload Composer State
  const [shareType, setShareType] = useState("photo");
  const [shareTitle, setShareTitle] = useState("");
  const [shareCaption, setShareCaption] = useState("");
  const [shareExpiry, setShareExpiry] = useState("7 Days");
  const [shareFileMeta, setShareFileMeta] = useState(null);
  const [shareError, setShareError] = useState("");

  // Modals & Avatar Customizer Studio
  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);
  const [customizingMemberId, setCustomizingMemberId] = useState("dad");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteArchetype, setInviteArchetype] = useState("aged-woman");
  const [inviteStatus, setInviteStatus] = useState("Finished my evening walk in the garden 🌿");
  const [figmaMode, setFigmaMode] = useState(false);

  // Toast & Confetti Burst State
  const [globalToast, setGlobalToast] = useState(null);
  const [confettiBursts, setConfettiBursts] = useState({});
  const [playingAudioId, setPlayingAudioId] = useState(null);

  // ============================================================================
  // GLOBAL DRAGGABLE ASSISTIVE GESTURE BUTTON STATE ("ALL OVER THE SITE")
  // ============================================================================
  const [assistiveOpen, setAssistiveOpen] = useState(false);
  const [assistiveTask, setAssistiveTask] = useState(null); // null | 'voice' | 'audioShare' | 'reminder' | 'medPhoto' | 'listener'
  const [orbPos, setOrbPos] = useState({ x: 0, y: 0 });
  const orbDragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  // Assistive Task Form States
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [assistTargetMember, setAssistTargetMember] = useState("dad");
  const [assistReminderText, setAssistReminderText] = useState("");
  const [assistReminderTime, setAssistReminderTime] = useState("06:00 PM");
  const [assistMedName, setAssistMedName] = useState("Evening BP Tablet (5mg)");
  const [assistMedTime, setAssistMedTime] = useState("08:00 PM");
  const [assistMedColor, setAssistMedColor] = useState("#F36D89");

  const triggerToast = (message, badge = "Preview only") => {
    setGlobalToast({ message, badge });
    setTimeout(() => setGlobalToast(null), 4000);
  };

  const triggerConfetti = (memberId, reactionEmoji = "❤️") => {
    const particles = Array.from({ length: 14 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      tx: (Math.random() - 0.5) * 135,
      ty: -25 - Math.random() * 75,
      rot: (Math.random() - 0.5) * 320,
      color: [
        BRAND_PALETTE.bubblegumCoral,
        BRAND_PALETTE.burntOrange,
        BRAND_PALETTE.mustardGold,
        BRAND_PALETTE.deepNavy,
        BRAND_PALETTE.slateTeal,
      ][i % 5],
    }));
    setConfettiBursts((prev) => ({ ...prev, [memberId]: particles }));
    triggerToast(`Sent ${reactionEmoji} warm reaction to ${memberId.toUpperCase()}!`);
    setTimeout(() => {
      setConfettiBursts((prev) => ({ ...prev, [memberId]: null }));
    }, 1200);
  };

  // Audio recording timer
  useEffect(() => {
    let interval;
    if (isRecordingAudio) {
      interval = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingAudio]);

  // Simulate a live family update strictly above a member's avatar on the 3D Globe
  const simulateMemberNotification = (targetId, customBadge, customText) => {
    const sampleUpdates = {
      dad: {
        text: "I visited the doctor. Feeling much better & took my morning BP tablet.",
        sticker: "🩺 Post-Call Update · 2m ago",
      },
      mum: {
        text: "Had masala chai in the garden. Spoke with Priya for 15 mins ☕",
        sticker: "☕ 15m Call Completed",
      },
      rohan: {
        text: "Just aced my physics mock test! Sent Dada a voice note 🎉",
        sticker: "🚀 Aced Physics!",
      },
      aarav: {
        text: "Received Dad’s 3-line post-call digest while between meetings.",
        sticker: "📝 3-Line Digest Ready",
      },
      priya: {
        text: "Brought fresh Alphonso mangoes for Sunday family lunch 🥭",
        sticker: "🥭 Sunday Family Share",
      },
      mia: {
        text: "Painted a giant yellow sunshine for Nani & Dada! 🎨",
        sticker: "🎨 New Painting!",
      },
    };

    const chosenId = targetId || familyMembers[Math.floor(Math.random() * familyMembers.length)].id;
    const tpl = sampleUpdates[chosenId] || sampleUpdates.dad;

    setFamilyMembers((prev) =>
      prev.map((m) => {
        if (m.id === chosenId) {
          return {
            ...m,
            hasNotification: true,
            notificationCount: m.notificationCount + 1,
            statusText: customText || tpl.text,
            stickerBadge: customBadge || tpl.sticker,
            timeAgo: "Just now",
          };
        }
        return m;
      }),
    );

    const targetMember = familyMembers.find((m) => m.id === chosenId);
    if (targetMember && typeof targetMember.theta === "number") {
      setTargetRotationYaw(-targetMember.theta);
    }

    setExpandedNotifId(chosenId);
    triggerConfetti(chosenId, "✨");
  };

  // Click handler for "What are you worried about?" Hero Filter Pills
  const handleSelectWorryPill = (worry) => {
    setSelectedWorryId(worry.id);
    setThreeSceneMode("globe");
    simulateMemberNotification(worry.targetMemberId, worry.notifBadge, worry.notifUpdate);
  };

  // Notebook Requirement #4: Save or Download on User's Phone
  const handleDownloadToPhone = (title, fileDesc) => {
    const blobContent = `SomeoneNear preview text update\nTitle: ${title}\nDetails: ${fileDesc}\nSaved on: ${new Date().toLocaleString()}\nSample content only. This is not a media attachment.`;
    const blob = new Blob([blobContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_someonenear.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast(`Downloaded the text update for "${title}".`, "Preview text export");
  };

  // Notebook Requirements #1, #2, #3: Bounded File Upload + Type/Size Limit + Expiry
  const handleBoundedFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShareError("");

    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const isVideo = ["video/mp4", "video/webm"].includes(file.type);
    const isAudio = ["audio/mpeg", "audio/mp4", "audio/webm", "audio/wav"].includes(file.type);

    const sizeMB = file.size / (1024 * 1024);

    if (shareType === "photo" && !isImage) {
      setShareError("Choose another file: Only JPG, PNG, or WEBP photos are permitted.");
      return;
    }
    if (shareType === "photo" && sizeMB > 10) {
      setShareError("Choose another file: Photo exceeds the 10 MB safety limit.");
      return;
    }
    if (shareType === "video" && (!isVideo || sizeMB > 50)) {
      setShareError("Choose another file: Video must be MP4/WEBM and under 50 MB.");
      return;
    }
    if (shareType === "audio" && (!isAudio || sizeMB > 15)) {
      setShareError("Choose another file: Audio note must be under 5 minutes (15 MB).");
      return;
    }

    setShareFileMeta({
      name: file.name,
      sizeMB: sizeMB.toFixed(2),
      type: file.type,
    });
  };

  const handlePublishBoundedShare = (e) => {
    e.preventDefault();
    if (!shareTitle.trim()) return;

    const expiryMap = {
      "24 Hours": "23h 59m left",
      "7 Days": "6d 23h left",
      "30 Days": "29d 23h left",
      "Keep Forever": "Permanent Family Vault",
    };

    const newPost = {
      id: `share-${Date.now()}`,
      authorId: "aarav",
      authorName: "Aarav (you)",
      mediaType: shareType,
      title: shareTitle.trim(),
      caption: shareCaption.trim() || "Shared with bounded privacy & expiry protection.",
      fileInfo: shareFileMeta
        ? `${shareFileMeta.name} • ${shareFileMeta.sizeMB} MB (Local preview)`
        : `Editorial ${shareType.toUpperCase()} Note • Local draft`,
      expiryChoice: shareExpiry,
      expiresCountdown: expiryMap[shareExpiry] || "6d 23h left",
      createdAt: "Just now",
      savedCount: 1,
    };

    setSharedFeed((prev) => [newPost, ...prev]);
    simulateMemberNotification("aarav", `⏳ ${shareExpiry} Share`, shareTitle.trim());
    setShareTitle("");
    setShareCaption("");
    setShareFileMeta(null);
  };

  const handleToggleMedicationTaken = (medId) => {
    const updatedMed = medications.find((med) => med.id === medId);
    if (!updatedMed) return;
    setMedications((prev) =>
      prev.map((med) =>
        med.id === medId
          ? {
              ...med,
              takenToday: !med.takenToday,
              lastTakenAt: med.takenToday ? "No update yet" : "Just now",
            }
          : med,
      ),
    );
    if (!updatedMed.takenToday) {
      simulateMemberNotification(
        updatedMed.forMemberId,
        "💊 Medicine Taken!",
        `Took ${updatedMed.medName} on time ✅`,
      );
    }
  };

  // ============================================================================
  // ASSISTIVE GESTURE BUTTON HANDLERS (4 Handwritten Notebook Tasks)
  // ============================================================================
  const startAssistiveVoiceCommand = () => {
    setAssistiveTask("voice");
    setVoiceTranscript(
      "Voice preview. Choose a task below; microphone and transcription will be connected later.",
    );
  };

  const completeOneClickAudioShare = () => {
    setIsRecordingAudio(false);
    const durationStr = `0:0${Math.max(3, recordingSeconds)}s`;
    const newVoiceShare = {
      id: `share-audio-${Date.now()}`,
      authorId: "aarav",
      authorName: "Aarav (you)",
      mediaType: "audio",
      title: `1-Click Family Voice Check-in (${durationStr})`,
      caption: "Recorded & shared via the Assistive Care Button.",
      fileInfo: `Voice_Note_${Date.now()}.mp4 • ${durationStr} (Preview only)`,
      expiryChoice: "7 Days",
      expiresCountdown: "6d 23h left",
      createdAt: "Just now",
      savedCount: 1,
    };
    setSharedFeed((prev) => [newVoiceShare, ...prev]);
    simulateMemberNotification(
      "aarav",
      "🎙️ 1-Click Voice Note",
      `Shared a ${durationStr} voice note with the family circle 🎙️`,
    );
    setAssistiveTask(null);
    setAssistiveOpen(false);
  };

  const handleAssistiveAddReminder = (e) => {
    e.preventDefault();
    if (!assistReminderText.trim()) return;
    const memberObj = familyMembers.find((m) => m.id === assistTargetMember) || familyMembers[0];

    const newRem = {
      id: `rem-${Date.now()}`,
      title: assistReminderText.trim(),
      forMemberId: memberObj.id,
      forMemberName: memberObj.name,
      createdBy:
        memberObj.id === "aarav"
          ? "Aarav (Self Reminder)"
          : `Aarav (On behalf of ${memberObj.name})`,
      time: assistReminderTime,
      done: false,
    };
    setReminders((prev) => [newRem, ...prev]);
    simulateMemberNotification(
      memberObj.id,
      `⏰ Reminder · ${assistReminderTime}`,
      `${assistReminderText.trim()} (Scheduled for ${memberObj.name})`,
    );
    setAssistReminderText("");
    setAssistiveTask(null);
    setAssistiveOpen(false);
  };

  const handleAssistiveAddMedicine = (e) => {
    e.preventDefault();
    const memberObj = familyMembers.find((m) => m.id === assistTargetMember) || familyMembers[0];

    const newMed = {
      id: `med-${Date.now()}`,
      forMemberId: memberObj.id,
      forMemberName: memberObj.name,
      addedBy: `Aarav (for ${memberObj.name})`,
      medName: assistMedName.trim() || "Daily Care Tablet",
      visualDesc: "Medication draft · Review before saving",
      doseTime: assistMedTime,
      pillColor: assistMedColor,
      stripColor: BRAND_PALETTE.deepNavy,
      takenToday: false,
      lastTakenAt: `Scheduled ${assistMedTime}`,
    };

    setMedications((prev) => [newMed, ...prev]);
    simulateMemberNotification(
      memberObj.id,
      `💊 Pill Photo · ${assistMedTime}`,
      `Medicine Reminder (${assistMedTime}): ${newMed.medName}`,
    );
    setAssistiveTask(null);
    setAssistiveOpen(false);
  };

  const handleAddFamilyInvite = (e) => {
    e.preventDefault();
    if (!inviteName.trim()) return;
    const newId = `fam-${Date.now()}`;
    const newCode = `SN-CARE-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedInviteId(newCode);

    // Track in Step #7 Pending Call Opt-In / Ignore queue
    setPendingInvites((prev) => [
      {
        id: `inv-${Date.now()}`,
        name: inviteName.trim(),
        mobile: inviteMobile,
        inviteCode: newCode,
        callConsentStatus: "Awaiting Call Opt-In",
      },
      ...prev,
    ]);

    const newMember = {
      id: newId,
      name: inviteName.trim(),
      shortRole: "Invited",
      role: `Invited via ${inviteMethod === "mobile" ? inviteMobile : newCode}`,
      archetype: inviteArchetype,
      skinTone: "#D99B7E",
      avatarBg: BRAND_PALETTE.mustardGold,
      backdropMotif: "leaves",
      outfitColor: BRAND_PALETTE.bubblegumCoral,
      outfitPattern: "hearts",
      earrings: "hoops",
      glasses: inviteArchetype === "aged-man",
      frameShape: "circle",
      hasNotification: true,
      notificationCount: 1,
      statusText: inviteStatus.trim() || "Invited! Can confirm on call whether to join or ignore.",
      stickerBadge: "📲 Invite Sent · Call Opt-In",
      checkInType: "Warm Welcome",
      expiryLabel: "Expires in 7d",
      timeAgo: "Just now",
      phi: 1.0 + Math.random() * 1.1,
      theta: (Math.random() - 0.5) * 2.4,
    };
    setShowInviteModal(false);
    setInviteName("");
    triggerToast(
      "Invitation added to the preview queue. Nothing was sent and the person is not active.",
    );
  };

  // Step #7: Simulate Invitee Responding on the Call (Accept vs. Ignore)
  const handlePendingInviteDecision = (invId, decision) => {
    setPendingInvites((prev) =>
      prev.map((item) => (item.id === invId ? { ...item, callConsentStatus: decision } : item)),
    );
    if (decision === "Accepted on Call") {
      asmrAudio.playPatakFirework();
      triggerToast(
        'Invitee confirmed "YES" during their phone call! Added to active schedule.',
        "Call Consent",
      );
    } else {
      triggerToast(
        "Invitee chose to ignore the invite. Respectfully paused with zero spam.",
        "Invite Ignored",
      );
    }
  };

  // Step #10: Save Follow-Up (Appointment / Birthday Wishes / How's Your Day) + Instant Memory Send Later
  const handleSaveFollowUpAndMemory = (e) => {
    e.preventDefault();
    const memberObj = familyMembers.find((m) => m.id === assistTargetMember) || familyMembers[0];

    const categoryLabels = {
      appointment: "🩺 Doctor Appointment Follow-up",
      birthday: "🎂 Birthday Wishes Reminder",
      howsyourday: '☀️ "How’s Your Day?" Warm Follow-up',
    };

    const titleText =
      instantMemoryNote.trim() || `${categoryLabels[followUpCategory]} for ${memberObj.name}`;

    const newRem = {
      id: `rem-${Date.now()}`,
      title: `${titleText} (Send Later: ${instantMemorySendTime})`,
      forMemberId: memberObj.id,
      forMemberName: memberObj.name,
      createdBy: `Aarav • ${categoryLabels[followUpCategory]}`,
      time: instantMemorySendTime,
      done: false,
    };

    setReminders((prev) => [newRem, ...prev]);
    simulateMemberNotification(
      memberObj.id,
      `⏳ Send Later · ${followUpCategory.toUpperCase()}`,
      titleText,
    );
    asmrAudio.playSingingBowl(528);
    setInstantMemoryNote("");
    setAssistiveTask(null);
    setAssistiveOpen(false);
  };

  const activeCountryConfig = COUNTRY_PAYMENT_CONFIG[selectedCountry] || COUNTRY_PAYMENT_CONFIG.IN;

  const activeWorryObj = WORRY_PILLS.find((w) => w.id === selectedWorryId) || WORRY_PILLS[0];

  const customizingMember =
    familyMembers.find((m) => m.id === customizingMemberId) || familyMembers[0];

  return (
    <div
      ref={rootRef}
      data-theme={themeMode}
      className={`sn-preview min-h-screen flex flex-col transition-colors duration-300 ${
        isDark
          ? "bg-[var(--preview-night)] text-[var(--preview-cream)]"
          : "bg-[var(--preview-cream)] text-[var(--preview-navy)]"
      } ${parentSimpleMode ? "text-lg" : ""}`}
    >
      <div className="preview-notice" role="note">
        Frontend preview · Sample people and local changes. Nothing is sent or charged.
        <a href="/connected-home">Connected site</a>
      </div>
      <style>{`
        @keyframes floatAbove {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes coralRing {
          0% { transform: scale(0.95); opacity: 0.85; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        @keyframes springPop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes eqCoralBounce {
          0%, 100% { height: 10px; }
          50% { height: 34px; }
        }
        .animate-float-above {
          animation: floatAbove 3s ease-in-out infinite;
        }
        .animate-coral-ring {
          animation: coralRing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-spring-pop {
          animation: springPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ============================================================================
          GLOBAL TOAST BANNER
      ============================================================================ */}
      {globalToast && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-coral)] shadow-2xl animate-bounce">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--preview-coral)] text-[var(--preview-navy)]">
            {globalToast.badge}
          </span>
          <span className="text-xs sm:text-sm font-semibold">{globalToast.message}</span>
        </div>
      )}

      {/* ============================================================================
          1. TOP ANNOUNCEMENT BAR (Authentic www.someonenear.com)
      ============================================================================ */}
      <div className="bg-[var(--preview-navy)] text-[var(--preview-cream)] px-4 py-2 text-center text-xs font-bold border-b border-[var(--preview-gold)]/25 flex flex-wrap items-center justify-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-coral)] text-[var(--preview-navy)]">
          New on SomeoneNear
        </span>
        <span>
          💊 Medication reminders now land straight on their phone — with pill photos &amp; voice
          check-ins.
        </span>
        <button
          onClick={() => {
            setExperienceView("family-app");
            setActiveNav("Family");
            setActiveTab("Health");
          }}
          className="underline text-[var(--preview-gold)] hover:text-[var(--preview-coral)] font-extrabold inline-flex items-center gap-1"
        >
          <span>See how</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* ============================================================================
          2. STICKY GLOBAL NAVBAR (www.someonenear.com + Prototype Logo + Country + Auth)
      ============================================================================ */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-md border-b px-4 sm:px-8 py-3.5 transition-colors ${
          isDark
            ? "bg-[var(--preview-night)]/90 border-[var(--preview-dark-line)]"
            : "bg-[var(--preview-cream)]/90 border-[var(--preview-line)]"
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <button className="preview-brand" aria-label="SomeoneNear home" onClick={() => setExperienceView("hero-home")}>
            <PreviewBrandMark />
            <span className="preview-brand-copy">
              <span className="preview-brand-name">Someone<span>Near</span></span>
            </span>
          </button>

          {/* Center View Navigation Pills (Includes Step #9 Chatak-Patak Arcade) */}
          <div
            className={`inline-flex flex-wrap items-center p-1 rounded-2xl border ${
              isDark
                ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                : "bg-[var(--preview-sand)] border-[var(--preview-line)]"
            }`}
          >
            {[
              { id: "hero-home", label: "Home" },
              { id: "chatak-arcade", label: "Chatak-Patak" },
              { id: "family-app", label: "Our family" },
              { id: "calm-space", label: "Calm space" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setExperienceView(tab.id);
                  asmrAudio.playChatakPop(1.1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  experienceView === tab.id
                    ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] shadow-sm"
                    : isDark
                      ? "text-[var(--preview-cream)]/75 hover:text-[var(--preview-cream)]"
                      : "text-[var(--preview-navy)]/75 hover:text-[var(--preview-navy)]"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <Link
              to="/listeners"
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                isDark
                  ? "text-[var(--preview-cream)]/75 hover:text-[var(--preview-cream)]"
                  : "text-[var(--preview-navy)]/75 hover:text-[var(--preview-navy)]"
              }`}
            >
              Listeners
            </Link>

            <Link
              to="/companion"
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                isDark
                  ? "text-[var(--preview-cream)]/75 hover:text-[var(--preview-cream)]"
                  : "text-[var(--preview-navy)]/75 hover:text-[var(--preview-navy)]"
              }`}
            >
              Companion
            </Link>

            <Link
              to="/docs/getting-started"
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-[var(--preview-orange)] hover:underline flex items-center gap-1"
            >
              <span>Docs</span>
            </Link>
          </div>

          {/* Right Controls: Country Currency (#5), Google/Apple Sign In (#6), Theme, Avatars */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Step #5: Country Currency Selector */}
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                asmrAudio.playChatakPop(1.15);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                isDark
                  ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)] text-[var(--preview-gold)]"
                  : "bg-[var(--preview-sand)] border-[var(--preview-line)] text-[var(--preview-navy)]"
              }`}
              title="Choose currency"
            >
              {Object.values(COUNTRY_PAYMENT_CONFIG).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} ({c.symbol})
                </option>
              ))}
            </select>

            <button
              onClick={() => setThemeMode(isDark ? "light" : "dark")}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1 transition-all ${
                isDark
                  ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)] text-[var(--preview-gold)]"
                  : "bg-[var(--preview-sand)] border-[var(--preview-line)] text-[var(--preview-navy)]"
              }`}
              title="Switch Warm Cream / Deep Navy Theme"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-[var(--preview-gold)]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[var(--preview-navy)]" />
              )}
            </button>

            <button
              onClick={() => setShowAvatarCustomizer(true)}
              aria-label="Avatars"
              className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-[var(--preview-gold)] text-[var(--preview-navy)] hover:scale-[1.02] transition-all flex items-center gap-1 shadow-sm"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Avatars</span>
            </button>

            {/* Step #6: Sign In / Dashboard button */}
            {currentUser ? (
              <Link
                to="/dashboard"
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-coral)] hover:bg-[var(--preview-orange)] transition-all flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-[var(--preview-coral)]" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-coral)] hover:bg-[var(--preview-orange)] transition-all flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-[var(--preview-coral)]" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================================
          EXPERIENCE 1: WWW.SOMEONENEAR.COM THREE.JS HERO & LANDING PAGE
      ============================================================================ */}
      {experienceView === "hero-home" && (
        <main className="flex-1">
          {/* HERO SECTION */}
          <section className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* LEFT COLUMN (6 Cols): Authentic www.someonenear.com Hero Copy & Split Path */}
              <div className="lg:col-span-6 space-y-6">
                {/* Eyebrow Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--preview-navy)] text-[var(--preview-cream)] text-[11px] font-extrabold tracking-wider uppercase shadow-sm border border-[var(--preview-gold)]/40">
                  <span className="w-2 h-2 rounded-full bg-[var(--preview-coral)] animate-ping" />
                  <span>EVERYDAY HUMAN PRESENCE &amp; CARE · NO APP NEEDED FOR PARENTS</span>
                </div>

                {/* Main Editorial Headline with Hand-Painted Brushstroke Underline */}
                <div className="space-y-2">
                  <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight leading-[1.08]">
                    You can&apos;t always be there.
                    <span className="block text-[var(--preview-orange)] relative mt-1">
                      But what if someone could?
                      <svg viewBox="0 0 360 18" className="w-64 sm:w-80 h-4 mt-1" fill="none">
                        <path
                          d="M4 12 C90 3 230 16 356 6"
                          stroke="#F36D89"
                          strokeWidth="6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </h1>
                  <p
                    className={`text-base sm:text-lg font-medium leading-relaxed pt-2 ${
                      isDark ? "text-[var(--preview-cream)]/80" : "text-[var(--preview-navy)]/80"
                    }`}
                  >
                    Talk when you want. Get a friendly check-in when you need one.{" "}
                    <strong>SomeoneNear</strong> connects your parents or loved ones with real,
                    compassionate listeners on their{" "}
                    <span className="underline decoration-[var(--preview-orange)] decoration-2 font-bold">
                      ordinary phone
                    </span>{" "}
                    — and keeps your whole family circle gently updated on the 3D globe.
                  </p>
                </div>

                {/* Dual Hero Split-Path Action Cards (Signature someonenear.com layout) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card A: For a Parent or Loved One */}
                  <div
                    className={`p-5 rounded-3xl border-2 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
                      isDark
                        ? "bg-[var(--preview-deep)] border-[var(--preview-orange)]"
                        : "bg-[var(--preview-white)] border-[var(--preview-navy)] shadow-[0_14px_30px_rgba(16,47,80,0.08)]"
                    }`}
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-orange)]/20 text-[var(--preview-orange)]">
                        For Parents &amp; Loved Ones
                      </span>
                      <h3 className="text-base font-extrabold mt-2">
                        Check-in calls for a parent or loved one
                      </h3>
                      <p className="text-xs opacity-75 mt-1 mb-4 leading-relaxed">
                        A trained human rings their ordinary landline or mobile. You get a 3-line
                        update right after.
                      </p>
                    </div>
                    <div>
                      <Link
                        to="/auth"
                        className="w-full py-2.5 px-4 rounded-2xl bg-[var(--preview-orange)] hover:bg-[var(--preview-coral)] text-[var(--preview-cream)] hover:text-[var(--preview-navy)] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                      >
                        <span>Start a Care Plan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <p className="text-[10px] text-center font-bold opacity-65 mt-1.5">
                        No card needed · Ordinary phone call
                      </p>
                    </div>
                  </div>

                  {/* Card B: For Yourself */}
                  <div
                    className={`p-5 rounded-3xl border-2 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
                      isDark
                        ? "bg-[var(--preview-navy)] border-[var(--preview-coral)]"
                        : "bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[var(--preview-navy)] shadow-xl"
                    }`}
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-coral)] text-[var(--preview-navy)]">
                        For Yourself · 24/7
                      </span>
                      <h3 className="text-base font-extrabold mt-2 text-[var(--preview-cream)]">
                        A real listener to talk to, whenever you need one
                      </h3>
                      <p className="text-xs text-[var(--preview-cream)]/80 mt-1 mb-4 leading-relaxed">
                        Private by default. Book a verified listener or talk to our warm 2am AI
                        Companion in seconds.
                      </p>
                    </div>
                    <div>
                      <Link
                        to="/listeners"
                        className="w-full py-2.5 px-4 rounded-2xl bg-[var(--preview-gold)] hover:bg-[var(--preview-coral)] text-[var(--preview-navy)] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Book a Listener Call →</span>
                      </Link>
                      <p className="text-[10px] text-center font-bold text-[var(--preview-gold)] mt-1.5">
                        100% Private · Empathetic Human Listeners
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interactive "What are you worried about?" Pills -> Rotates Three.js Globe! */}
                <div
                  className={`p-4 rounded-3xl border-2 ${
                    isDark
                      ? "bg-[var(--preview-deep)]/90 border-[var(--preview-dark-line)]"
                      : "bg-[var(--preview-sand)]/85 border-[var(--preview-line)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--preview-orange)]">
                      What are you worried about?
                    </span>
                    <span className="text-[11px] font-bold opacity-70"></span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {WORRY_PILLS.map((w) => {
                      const active = selectedWorryId === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() => handleSelectWorryPill(w)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 border ${
                            active
                              ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[var(--preview-coral)] shadow-sm scale-[1.02]"
                              : isDark
                                ? "bg-[var(--preview-darkest)] text-[var(--preview-cream)]/80 border-[var(--preview-dark-line)] hover:border-[var(--preview-gold)]"
                                : "bg-[var(--preview-white)] text-[var(--preview-navy)] border-[var(--preview-line)] hover:border-[var(--preview-navy)]"
                          }`}
                        >
                          <span>{w.emoji}</span>
                          <span>{w.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] flex items-center justify-between gap-2 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--preview-coral)] flex-shrink-0" />
                      <span>{activeWorryObj.PromiseText}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExperienceView("family-app")}
                        className="text-[var(--preview-cream)]/75 hover:text-[var(--preview-cream)] underline whitespace-nowrap text-[11px]"
                      >
                        Interactive Hub
                      </button>
                      <Link
                        to="/family"
                        className="text-[var(--preview-gold)] underline whitespace-nowrap font-extrabold"
                      >
                        Open Family Hub →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN (6 Cols): Real Three.js 3D Interactive Family Globe & Above-Avatar Notifications */}
              <div className="lg:col-span-6">
                {/* Notification Style Quick Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold">
                    <Sparkles className="w-4 h-4 text-[var(--preview-orange)]" />
                    <span>Update appearance</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[
                      { id: "editorial-speech", label: "Editorial Card" },
                      { id: "funky-sticker", label: "3D Sticker" },
                      { id: "dynamic-island", label: "Audio Island" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setNotifStyle(st.id)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all ${
                          notifStyle === st.id
                            ? "bg-[var(--preview-orange)] text-[var(--preview-cream)]"
                            : isDark
                              ? "bg-[var(--preview-white)]/10 text-[var(--preview-cream)]/75"
                              : "bg-[var(--preview-sand)] text-[var(--preview-navy)]"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* REAL THREE.JS WEBGL 3D FAMILY GLOBE STAGE */}
                <ThreeJsFamilyStage
                  members={familyMembers}
                  sceneMode={threeSceneMode}
                  setSceneMode={setThreeSceneMode}
                  isDark={isDark}
                  zoom={globeZoom}
                  setZoom={setGlobeZoom}
                  autoRotate={autoRotateGlobe}
                  setAutoRotate={setAutoRotateGlobe}
                  expandedNotifId={expandedNotifId}
                  setExpandedNotifId={setExpandedNotifId}
                  notifStyle={notifStyle}
                  onSimulateMember={(id) => simulateMemberNotification(id)}
                  onTriggerConfetti={triggerConfetti}
                  onDownloadToPhone={handleDownloadToPhone}
                  confettiBursts={confettiBursts}
                  playingAudioId={playingAudioId}
                  setPlayingAudioId={setPlayingAudioId}
                  targetRotationYaw={targetRotationYaw}
                />
              </div>
            </div>

            {/* ========================================================================
                EMBEDDED STEP #9 CHATAK-PATAK & ASMR RELIEF GAME SECTION RIGHT ON HERO
            ======================================================================== */}
            <div className="mt-14">
              <ChatakPatakAsmrArcade
                isDark={isDark}
                onSendCareSparkToGlobe={() =>
                  simulateMemberNotification(
                    "dad",
                    "✨ Chatak-Patak Care Wave!",
                    "Received your warm relief spark & smiled during his afternoon tea!",
                  )
                }
                onTriggerToast={triggerToast}
              />
            </div>
          </section>

          {/* ==========================================================================
              SECTION 3: "EVERYTHING THAT COMES WITH IT" BENTO GRID
              (Includes Bounded/Expiring Share, Medication Photo, Send Later, Mood Shape)
          ========================================================================== */}
          <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
            <div className="mb-8">
              <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--preview-orange)]">
                Everything that comes with it
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mt-1">
                Built for real families, across time zones.
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Bento 1 (7 Cols): Medication Reminders with Pill Photo */}
              <div
                className={`lg:col-span-7 p-6 rounded-3xl border-2 flex flex-col justify-between ${
                  isDark
                    ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                    : "bg-[var(--preview-white)] border-[var(--preview-line)] shadow-sm"
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--preview-coral)]/25 text-[var(--preview-orange)]">
                      💊 Medication Photo + Phone Reminders
                    </span>
                    <button
                      onClick={() => {
                        setAssistiveOpen(true);
                        setAssistiveTask("medPhoto");
                      }}
                      className="text-xs font-extrabold underline text-[var(--preview-orange)]"
                    >
                      + Add Pill Photo
                    </button>
                  </div>
                  <h3 className="text-xl font-extrabold mb-1">
                    Parents recognize the tablet strip photo immediately
                  </h3>
                  <p className="text-xs sm:text-sm opacity-75 mb-4">
                    Attach a photo of the actual medicine strip and set the dose time. When they
                    confirm on the phone or tap Taken, your Family Globe updates instantly.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                        isDark
                          ? "bg-[var(--preview-darkest)] border-[var(--preview-dark-line)]"
                          : "bg-[var(--preview-cream)] border-[var(--preview-line)]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                          <span>For {med.forMemberName}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-[var(--preview-gold)] text-[var(--preview-navy)]">
                            ⏰ {med.doseTime}
                          </span>
                        </div>
                        <p className="text-xs font-bold mb-1">{med.medName}</p>
                        <p className="text-[11px] opacity-70 mb-3">{med.visualDesc}</p>
                      </div>
                      <button
                        onClick={() => handleToggleMedicationTaken(med.id)}
                        className={`w-full py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                          med.takenToday
                            ? "bg-emerald-600 text-[var(--preview-white)]"
                            : "bg-[var(--preview-navy)] text-[var(--preview-cream)] hover:bg-[var(--preview-orange)]"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {med.takenToday
                            ? `Taken (${med.lastTakenAt})`
                            : "Mark Taken & Notify Globe"}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bento 2 (5 Cols): Send It Later Time-Capsule & Mood Rhythm */}
              <div className="lg:col-span-5 space-y-6">
                <div className="p-6 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-gold)] shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-gold)] text-[var(--preview-navy)]">
                      Send It Later · Time Capsule
                    </span>
                    <span className="text-xs font-bold text-[var(--preview-coral)]">
                      Arrives 8:00 AM IST
                    </span>
                  </div>
                  <p className="text-sm font-bold italic text-[var(--preview-cream)] leading-relaxed my-3">
                    &ldquo;Happy birthday, Ma. I&apos;m sorry I can&apos;t be there this year — but
                    I&apos;m thinking of you all day.&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--preview-white)]/15 text-xs">
                    <span className="text-[var(--preview-gold)] font-bold">
                      Recorded by Aarav · Voice + Photo
                    </span>
                    <button
                      onClick={() => {
                        setAssistiveOpen(true);
                        setAssistiveTask("audioShare");
                        setIsRecordingAudio(true);
                      }}
                      className="px-3 py-1 rounded-xl bg-[var(--preview-coral)] text-[var(--preview-navy)] font-extrabold"
                    >
                      + Record Yours
                    </button>
                  </div>
                </div>

                {/* Bounded & Expiring Family Vault Card */}
                <div
                  className={`p-5 rounded-3xl border-2 ${
                    isDark
                      ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                      : "bg-[var(--preview-white)] border-[var(--preview-line)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-[var(--preview-orange)]">
                      ⏳ Bounded &amp; Expiring Family Media
                    </span>
                    <button
                      onClick={() => {
                        setExperienceView("family-app");
                        setActiveNav("Family");
                        setActiveTab("My sharing");
                      }}
                      className="text-xs font-extrabold underline"
                    >
                      Open Vault →
                    </button>
                  </div>
                  <p className="text-xs opacity-75 mb-3">
                    Share prescriptions, voice blessings, and photos with strict size limits
                    (≤10MB), auto-expiry (24h/7d/30d), and 1-tap phone downloads.
                  </p>
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--preview-cream)] dark:bg-[var(--preview-darkest)] border border-[var(--preview-line)] dark:border-[var(--preview-dark-line)] text-xs font-bold">
                    <span>BP_Prescription_Oct2026.jpg (Expires 6d)</span>
                    <button
                      onClick={() =>
                        handleDownloadToPhone("Dad_BP_Prescription", "BP 122/78 Verified Report")
                      }
                      className="px-2.5 py-1 rounded-lg bg-[var(--preview-navy)] text-[var(--preview-cream)] text-[11px] flex items-center gap-1"
                    >
                      <Download className="w-3 h-3 text-[var(--preview-coral)]" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              SECTION 4: TRANSPARENT CARE PLANS (Steps #3, #4, #5: 18 & 30 Calls,
              * 7 Days Free Asterisk, Country Currency & Local Payment Gateway)
          ========================================================================== */}
          <section
            className={`py-14 border-t ${
              isDark
                ? "bg-[var(--preview-darkest)] border-[var(--preview-dark-line)]"
                : "bg-[var(--preview-sand)]/55 border-[var(--preview-line)]"
            }`}
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--preview-orange)]">
                    Choose your care plan
                  </span>
                  <h2 className="text-3xl font-black mt-1">Care for you. Care for your family.</h2>
                  <p className="text-xs font-bold opacity-75 mt-1">
                    Preview the plans. Checkout will be connected later.
                  </p>
                </div>

                {/* Country & Gateway Switcher Pill Bar */}
                <div className="flex flex-wrap items-center gap-1.5 bg-[var(--preview-navy)] p-1.5 rounded-2xl border border-[var(--preview-gold)]/40">
                  {Object.values(COUNTRY_PAYMENT_CONFIG).map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setSelectedCountry(c.code);
                        asmrAudio.playChatakPop(1.2);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        selectedCountry === c.code
                          ? "bg-[var(--preview-gold)] text-[var(--preview-navy)] shadow"
                          : "text-[var(--preview-cream)]/80 hover:text-[var(--preview-white)]"
                      }`}
                    >
                      {c.flag} {c.currency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Country Payment Gateway Banner */}
              <div
                className={`mb-6 p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs font-bold ${
                  isDark
                    ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                    : "bg-[var(--preview-white)] border-[var(--preview-line)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[var(--preview-orange)]" />
                  <span>
                    Showing localized pricing for{" "}
                    <strong>
                      {activeCountryConfig.flag} {activeCountryConfig.name} (
                      {activeCountryConfig.currency})
                    </strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="opacity-70">Supported Gateways:</span>
                  {activeCountryConfig.gateways.map((gw) => (
                    <span
                      key={gw}
                      className="px-2.5 py-0.5 rounded-lg bg-[var(--preview-navy)] text-[var(--preview-gold)] text-[10px] font-extrabold"
                    >
                      {gw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plan 1: 18 Calls */}
                <div
                  className={`p-6 rounded-3xl border-2 flex flex-col justify-between ${
                    isDark
                      ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                      : "bg-[var(--preview-white)] border-[var(--preview-line)] shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--preview-sand)] text-[var(--preview-navy)]">
                        SomeoneNear Care · 18 Calls
                      </span>
                      <span className="text-xs font-black text-[var(--preview-orange)]">
                        Monthly membership
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-black">
                        {activeCountryConfig.symbol}
                        {activeCountryConfig.plan18Price}
                      </span>
                      <span className="text-xs font-bold opacity-70">/ month</span>
                    </div>
                    <p className="text-xs font-extrabold text-[var(--preview-orange)] mt-1 mb-4">
                      18 fifteen-minute calls for you each month
                    </p>
                    <ul className="space-y-2 text-xs font-bold mb-6">
                      {PLAN_DISPLAY.care.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[var(--preview-orange)]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        setShowCheckoutModal({
                          planName: "SomeoneNear Care (18 Calls)",
                          callsCount: 18,
                          price: `${activeCountryConfig.symbol}${activeCountryConfig.plan18Price}`,
                        })
                      }
                      className="w-full py-3 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] text-xs font-extrabold hover:bg-[var(--preview-orange)] transition-colors"
                    >
                      Preview Care
                    </button>
                    <p className="text-[10px] font-bold opacity-75 mt-2 text-center">
                      Checkout is not connected. {activeCountryConfig.primaryGateway}.
                    </p>
                  </div>
                </div>

                {/* Plan 2: 30 Calls */}
                <div className="p-6 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-coral)] shadow-xl flex flex-col justify-between relative">
                  <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-gold)] text-[var(--preview-navy)]">
                    Most Popular · Daily Calls
                  </span>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--preview-coral)] text-[var(--preview-navy)]">
                        SomeoneNear Care Plus · 30 Calls
                      </span>
                      <span className="text-xs font-black text-[var(--preview-gold)]">
                        Monthly membership
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[var(--preview-gold)]">
                        {activeCountryConfig.symbol}
                        {activeCountryConfig.plan30Price}
                      </span>
                      <span className="text-xs font-bold text-[var(--preview-cream)]/75">
                        / month
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-[var(--preview-coral)] mt-1 mb-4">
                      30 shared fifteen-minute calls each month
                    </p>
                    <ul className="space-y-2 text-xs font-bold mb-6">
                      {PLAN_DISPLAY.care_plus.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[var(--preview-gold)]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        setShowCheckoutModal({
                          planName: "SomeoneNear Care Plus (30 Calls)",
                          callsCount: 30,
                          price: `${activeCountryConfig.symbol}${activeCountryConfig.plan30Price}`,
                        })
                      }
                      className="w-full py-3 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] text-xs font-extrabold hover:bg-[var(--preview-gold)] transition-colors"
                    >
                      Preview Care Plus
                    </button>
                    <p className="text-[10px] font-bold text-[var(--preview-gold)] mt-2 text-center">
                      Checkout is not connected. {activeCountryConfig.primaryGateway}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              SECTION 5: GET STARTED DOCUMENTATION & ONBOARDING GUIDE
          ========================================================================== */}
          <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--preview-orange)]/15 text-[var(--preview-orange)] text-[11px] font-black uppercase tracking-wider mb-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Onboarding &amp; Setup Docs</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black">
                  How SomeoneNear works in four simple steps.
                </h2>
                <p
                  className={`text-sm font-medium mt-2 max-w-2xl ${
                    isDark ? "text-[var(--preview-cream)]/75" : "text-[var(--preview-navy)]/75"
                  }`}
                >
                  Everything you need to set up your family, configure check-in calls, and view live
                  status on the 3D globe. No app downloads required for parents.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/docs/getting-started"
                  className="px-4 py-2.5 rounded-2xl bg-[var(--preview-orange)] hover:bg-[var(--preview-coral)] text-[var(--preview-cream)] hover:text-[var(--preview-navy)] text-xs font-black transition-colors flex items-center gap-2 shadow-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Read Full Docs</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to="/docs"
                  className={`px-4 py-2.5 rounded-2xl border-2 text-xs font-black transition-colors ${
                    isDark
                      ? "border-[var(--preview-cream)]/30 text-[var(--preview-cream)] hover:bg-white/10"
                      : "border-[var(--preview-navy)] text-[var(--preview-navy)] hover:bg-[var(--preview-sand)]"
                  }`}
                >
                  All Topic Guides
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: "01",
                  title: "Create Family Circle",
                  desc: "Sign up in 60 seconds with email or phone. No credit card required to start.",
                  tag: "Sign Up",
                  route: "/auth",
                  routeLabel: "Create Account →",
                  docRoute: "/docs/getting-started",
                },
                {
                  step: "02",
                  title: "Add Loved Ones",
                  desc: "Add parent phone numbers. Standard landline or mobile — no smartphone or apps needed.",
                  tag: "Family",
                  route: "/family",
                  routeLabel: "Family Setup →",
                  docRoute: "/docs/family",
                },
                {
                  step: "03",
                  title: "Book Listener Calls",
                  desc: "Vetted, empathetic humans call at scheduled or flexible times for reassuring conversation.",
                  tag: "Listeners",
                  route: "/listeners",
                  routeLabel: "Meet Listeners →",
                  docRoute: "/docs/listeners",
                },
                {
                  step: "04",
                  title: "Live Globe & Calm Space",
                  desc: "See daily updates on the 3D globe, track medicine strips, and relax in Calm Space.",
                  tag: "Peace of Mind",
                  route: "/calm",
                  routeLabel: "Open Calm Space →",
                  docRoute: "/docs/calm",
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-6 rounded-3xl border-2 flex flex-col justify-between transition-all hover:-translate-y-1 ${
                    isDark
                      ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)] hover:border-[var(--preview-gold)]"
                      : "bg-[var(--preview-white)] border-[var(--preview-line)] hover:border-[var(--preview-navy)] shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="w-9 h-9 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-gold)] text-xs font-black flex items-center justify-center">
                        {s.step}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-sand)] text-[var(--preview-navy)]">
                        {s.tag}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold mb-2">{s.title}</h3>
                    <p
                      className={`text-xs leading-relaxed mb-6 ${
                        isDark ? "text-[var(--preview-cream)]/75" : "text-[var(--preview-navy)]/75"
                      }`}
                    >
                      {s.desc}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-[var(--preview-line)] dark:border-[var(--preview-dark-line)] flex items-center justify-between text-xs font-extrabold">
                    <Link to={s.route} className="text-[var(--preview-orange)] hover:underline">
                      {s.routeLabel}
                    </Link>
                    <Link
                      to={s.docRoute}
                      className="opacity-60 hover:opacity-100 flex items-center gap-1 text-[11px]"
                    >
                      <span>Docs</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================================================
              SECTION 6: FREQUENTLY ASKED QUESTIONS (FAQ)
          ========================================================================== */}
          <section
            className={`py-16 border-t ${
              isDark
                ? "bg-[var(--preview-darkest)] border-[var(--preview-dark-line)]"
                : "bg-[var(--preview-sand)]/40 border-[var(--preview-line)]"
            }`}
          >
            <div className="max-w-4xl mx-auto px-4 sm:px-8">
              <div className="text-center max-w-xl mx-auto mb-10">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--preview-orange)]">
                  Got questions?
                </span>
                <h2 className="text-3xl font-black mt-1">Frequently asked questions.</h2>
                <p
                  className={`text-xs sm:text-sm font-medium mt-2 ${
                    isDark ? "text-[var(--preview-cream)]/75" : "text-[var(--preview-navy)]/75"
                  }`}
                >
                  Everything you want to know about phone calls, privacy, listeners, and care plans.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: "Do my parents need a smartphone, internet connection, or app installed?",
                    a: "No! SomeoneNear is built specifically so parents need zero technology. A friendly, verified human listener dials their ordinary phone number — landline or basic mobile. They just pick up and chat.",
                  },
                  {
                    q: "Who are the listeners and how are they vetted?",
                    a: "Our listeners are carefully vetted through identity verification, criminal background checks, and rigorous empathy assessments. They are trained in warm active listening, respectful conversational boundaries, and crisis escalation protocols.",
                  },
                  {
                    q: "What updates do family members receive after a call?",
                    a: "Immediately following each completed check-in, family circle members receive a concise 3-line reassurance summary detailing mood, general wellness, and any special notes or follow-ups. The 3D family globe updates in real time.",
                  },
                  {
                    q: "How does the Medication Pill Strip photo reminder work?",
                    a: "You can upload a photo of the exact pill strip or bottle. When the scheduled dose time arrives, the system rings their phone or prompts the app. Once taken, your family globe displays the green checkmark instantly.",
                  },
                  {
                    q: "Is our conversation private and secure?",
                    a: "Yes. Calls are strictly private. We never sell or monetize personal or health information. Data is encrypted in transit and at rest with role-based family access permissions.",
                  },
                  {
                    q: "What if there is an emergency during a call?",
                    a: "SomeoneNear is a non-clinical companionship service, not an emergency dispatcher. However, if a listener identifies an urgent crisis, our safety protocol immediately alerts family contacts and directs emergency guidance.",
                  },
                ].map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={faq.q}
                      className={`rounded-2xl border-2 transition-all overflow-hidden ${
                        isDark
                          ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                          : "bg-[var(--preview-white)] border-[var(--preview-line)]"
                      }`}
                    >
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-extrabold text-sm sm:text-base hover:text-[var(--preview-orange)] transition-colors"
                      >
                        <span>{faq.q}</span>
                        <CaretDown
                          className={`w-4 h-4 flex-shrink-0 text-[var(--preview-orange)] transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div
                          className={`px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm font-medium leading-relaxed border-t ${
                            isDark
                              ? "border-[var(--preview-dark-line)] text-[var(--preview-cream)]/80"
                              : "border-[var(--preview-line)]/50 text-[var(--preview-navy)]/80"
                          }`}
                        >
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-center mt-8">
                <Link
                  to="/docs/faq"
                  className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--preview-orange)] hover:underline"
                >
                  <Question className="w-4 h-4" />
                  <span>Have more questions? Read our complete FAQ documentation →</span>
                </Link>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              SECTION 7: COMPREHENSIVE PRODUCTION FOOTER (NEW-UI BRAND PALETTE)
          ========================================================================== */}
          <footer className="bg-[var(--preview-navy)] text-[var(--preview-cream)] border-t border-[var(--preview-gold)]/30 mt-16">
            {/* Crisis Disclaimer Notice Banner */}
            <div className="bg-[var(--preview-darkest)] border-b border-[var(--preview-white)]/10 py-3.5 px-4 sm:px-8">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--preview-coral)] text-[var(--preview-navy)] font-black text-[10px] uppercase tracking-wider">
                    Crisis &amp; Safety Notice
                  </span>
                  <span className="font-bold opacity-85">
                    SomeoneNear is a non-clinical companionship service, not an emergency response hotline.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-black text-[var(--preview-gold)]">
                  <span>US: 988 or 911</span>
                  <span>·</span>
                  <span>India: 112 / 1800-599-0019</span>
                  <span>·</span>
                  <span>UK: 111 or 999</span>
                </div>
              </div>
            </div>

            {/* Main Footer Links Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                {/* Brand Info (2 Cols) */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <PreviewBrandMark size={36} />
                    <span className="text-xl font-black tracking-tight text-[var(--preview-cream)]">
                      SomeoneNear
                    </span>
                  </div>
                  <p className="text-xs text-[var(--preview-cream)]/75 leading-relaxed max-w-sm">
                    Everyday human presence &amp; care for your loved ones, anywhere in the world.
                    Connecting older adults via ordinary phone calls and keeping families gently synchronized on the 3D globe.
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-extrabold text-[var(--preview-gold)]">
                      24/7 Global Care Network Active
                    </span>
                  </div>
                </div>

                {/* Col 1: Product */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--preview-gold)]">
                    Product
                  </h4>
                  <ul className="space-y-2 text-xs font-bold text-[var(--preview-cream)]/80">
                    <li>
                      <Link to="/family" className="hover:text-[var(--preview-coral)] transition-colors">
                        Family Hub
                      </Link>
                    </li>
                    <li>
                      <Link to="/listeners" className="hover:text-[var(--preview-coral)] transition-colors">
                        Verified Listeners
                      </Link>
                    </li>
                    <li>
                      <Link to="/companion" className="hover:text-[var(--preview-coral)] transition-colors">
                        AI Companion
                      </Link>
                    </li>
                    <li>
                      <Link to="/calm" className="hover:text-[var(--preview-coral)] transition-colors">
                        Calm Space
                      </Link>
                    </li>
                    <li>
                      <Link to="/connected-home" className="hover:text-[var(--preview-coral)] transition-colors">
                        Connected Home
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 2: Documentation */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--preview-gold)]">
                    Documentation
                  </h4>
                  <ul className="space-y-2 text-xs font-bold text-[var(--preview-cream)]/80">
                    <li>
                      <Link to="/docs/getting-started" className="hover:text-[var(--preview-coral)] transition-colors">
                        Getting Started
                      </Link>
                    </li>
                    <li>
                      <Link to="/docs/family" className="hover:text-[var(--preview-coral)] transition-colors">
                        Family Setup Guide
                      </Link>
                    </li>
                    <li>
                      <Link to="/docs/check-in" className="hover:text-[var(--preview-coral)] transition-colors">
                        Check-in Calls
                      </Link>
                    </li>
                    <li>
                      <Link to="/docs/safety" className="hover:text-[var(--preview-coral)] transition-colors">
                        Safety &amp; Vetting
                      </Link>
                    </li>
                    <li>
                      <Link to="/docs/medication" className="hover:text-[var(--preview-coral)] transition-colors">
                        Medication Strips
                      </Link>
                    </li>
                    <li>
                      <Link to="/docs/faq" className="hover:text-[var(--preview-coral)] transition-colors">
                        FAQ Knowledge Base
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 3: Legal & Support */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--preview-gold)]">
                    Legal &amp; Support
                  </h4>
                  <ul className="space-y-2 text-xs font-bold text-[var(--preview-cream)]/80">
                    <li>
                      <Link to="/privacy" className="hover:text-[var(--preview-coral)] transition-colors">
                        Privacy Policy
                      </Link>
                    </li>
                    <li>
                      <Link to="/terms" className="hover:text-[var(--preview-coral)] transition-colors">
                        Terms of Service
                      </Link>
                    </li>
                    <li>
                      <Link to="/cookies" className="hover:text-[var(--preview-coral)] transition-colors">
                        Cookie Preferences
                      </Link>
                    </li>
                    <li>
                      <Link to="/docs/billing" className="hover:text-[var(--preview-coral)] transition-colors">
                        Billing &amp; Refunds
                      </Link>
                    </li>
                    <li className="pt-2">
                      <a
                        href="mailto:care@someonenear.com"
                        className="text-[var(--preview-gold)] hover:underline flex items-center gap-1.5"
                      >
                        <span>care@someonenear.com</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bottom Copyright Bar */}
              <div className="mt-12 pt-8 border-t border-[var(--preview-white)]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-[var(--preview-cream)]/60">
                <p>© 2026 SomeoneNear Technologies Inc. All rights reserved.</p>
                <div className="flex items-center gap-4">
                  <span>Built with warm human empathy &amp; care.</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--preview-orange)]" />
                  <span>v2.4 Production</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* ============================================================================
          EXPERIENCE 1B: DEDICATED STEP #9 CHATAK-PATAK & ASMR RELIEF VIEW
      ============================================================================ */}
      {experienceView === "chatak-arcade" && (
        <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 flex-1 space-y-6">
          <ChatakPatakAsmrArcade
            isDark={isDark}
            onSendCareSparkToGlobe={() => {
              simulateMemberNotification(
                "mum",
                "🎉 Chatak-Patak Relief Wave!",
                "Your playful care wave lit up Mum’s evening check-in!",
              );
            }}
            onTriggerToast={triggerToast}
          />
        </main>
      )}

      {/* ============================================================================
          EXPERIENCE 2: "OUR FAMILY" DASHBOARD (Sidebar + 5 Top Tabs + 3D Globe)
      ============================================================================ */}
      {experienceView === "family-app" && (
        <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
          {/* Left Sidebar matching original SomeoneNear screenshot */}
          <aside
            className={`w-full lg:w-60 border-b lg:border-b-0 lg:border-r p-4 flex lg:flex-col gap-1.5 overflow-x-auto ${
              isDark
                ? "bg-[var(--preview-darkest)]/70 border-[var(--preview-dark-line)]"
                : "bg-[var(--preview-sand)]/65 border-[var(--preview-line)]"
            }`}
          >
            {[
              { id: "Dashboard", icon: LayoutGrid },
              { id: "Calm", icon: Compass },
              { id: "Companion", icon: MessageCircle },
              { id: "Listeners", icon: Headphones },
              { id: "Medication", icon: Pill },
              { id: "Send Later", icon: CalendarClock },
              { id: "Insights", icon: TrendingUp },
              { id: "Family", icon: Users },
              { id: "Safety", icon: ShieldCheck },
              { id: "Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    if (item.id === "Calm") setExperienceView("calm-space");
                    if (item.id === "Medication") setActiveTab("Health");
                    else if (item.id === "Family") setActiveTab("Family");
                    else setActiveTab(item.id);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all ${
                    active
                      ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] shadow-sm"
                      : "opacity-75 hover:opacity-100 hover:bg-black/5"
                  }`}
                >
                  <Icon className="w-4 h-4 text-[var(--preview-orange)]" />
                  <span>{item.id}</span>
                </button>
              );
            })}
          </aside>

          {/* Main Family Workspace */}
          <main data-family-workspace className="flex-1 min-w-0 p-4 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--preview-orange)]">
                  {activeNav}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black">
                  {activeNav === "Family" ? "Our family" : activeNav}
                </h1>
                <p className="text-xs sm:text-sm opacity-75">
                  Stay close, with care that respects everyone&apos;s space.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-[var(--preview-orange)] text-[var(--preview-cream)] text-xs font-extrabold flex items-center gap-1.5 shadow-md hover:bg-[var(--preview-navy)] transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Invite to Circle</span>
                </button>
              </div>
            </div>

            {/* 5 Top Tabs (Today, Family, My sharing, Health, Calls) */}
            <div
              className={`grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl border ${
                isDark
                  ? "bg-[var(--preview-darkest)] border-[var(--preview-dark-line)]"
                  : "bg-[var(--preview-sand)] border-[var(--preview-line)]"
              }`}
            >
              {[
                { id: "Today", icon: Calendar },
                { id: "Family", icon: Users },
                { id: "My sharing", icon: Share2 },
                { id: "Health", icon: HeartPulse },
                { id: "Calls", icon: Phone },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveNav("Family");
                      setActiveTab(t.id);
                    }}
                    aria-pressed={activeTab === t.id}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === t.id
                        ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] shadow"
                        : "opacity-75 hover:opacity-100"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.id}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === "Family" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold">Your family, connected</h2>
                    <p className="text-xs opacity-70">
                      {familyMembers.length} people in your circle
                    </p>
                  </div>
                </div>

                <ThreeJsFamilyStage
                  members={familyMembers}
                  sceneMode={threeSceneMode}
                  setSceneMode={setThreeSceneMode}
                  isDark={isDark}
                  zoom={globeZoom}
                  setZoom={setGlobeZoom}
                  autoRotate={autoRotateGlobe}
                  setAutoRotate={setAutoRotateGlobe}
                  expandedNotifId={expandedNotifId}
                  setExpandedNotifId={setExpandedNotifId}
                  notifStyle={notifStyle}
                  onSimulateMember={(id) => simulateMemberNotification(id)}
                  onTriggerConfetti={triggerConfetti}
                  onDownloadToPhone={handleDownloadToPhone}
                  confettiBursts={confettiBursts}
                  playingAudioId={playingAudioId}
                  setPlayingAudioId={setPlayingAudioId}
                  targetRotationYaw={targetRotationYaw}
                />

                {/* Bottom Family Member Cards matching screenshot */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {familyMembers.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        setCustomizingMemberId(m.id);
                        setShowAvatarCustomizer(true);
                      }}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01] ${
                        isDark
                          ? "bg-[var(--preview-deep)] border-[var(--preview-dark-line)]"
                          : "bg-[var(--preview-white)] border-[var(--preview-line)] shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <EditorialAvatar member={m} size="sm" isDark={isDark} />
                        <div>
                          <p className="text-sm font-extrabold">{m.displayName || m.name}</p>
                          <p className="text-xs opacity-75 line-clamp-1">{m.statusText}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-60 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div hidden={activeTab === "Family"}>
              <PreviewWorkspace
                view={activeTab}
                members={familyMembers}
                reminders={reminders}
                setReminders={setReminders}
                medications={medications}
                onToggleMedication={handleToggleMedicationTaken}
                sharedFeed={sharedFeed}
                setSharedFeed={setSharedFeed}
                bookedSessions={bookedSessions}
                setBookedSessions={setBookedSessions}
                listeners={VERIFIED_LISTENERS}
                openTask={(task) => {
                  setAssistiveOpen(true);
                  setAssistiveTask(task);
                }}
                onNavigate={(view) => {
                  setActiveNav("Family");
                  setActiveTab(view);
                }}
                isDark={isDark}
                onTheme={() => setThemeMode(isDark ? "light" : "dark")}
                parentSimpleMode={parentSimpleMode}
                onSimpleMode={() => setParentSimpleMode((value) => !value)}
              />
            </div>
          </main>
        </div>
      )}

      {/* ============================================================================
          EXPERIENCE 3: CALM SPACE (Name a Worry & Watch It Float Away)
      ============================================================================ */}
      {experienceView === "calm-space" && (
        <main className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-10 flex-1 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-gold)] shadow-2xl space-y-4">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-[var(--preview-coral)] text-[var(--preview-navy)]">
              Calm Space • Release a Worry
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">
              Name a worry, release it into the night sky, or pop it in Chatak-Patak.
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!worryInput.trim()) return;
                setFloatingWorries((prev) => [
                  { id: `w-${Date.now()}`, text: worryInput.trim() },
                  ...prev,
                ]);
                setWorryInput("");
                asmrAudio.playSingingBowl(432);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={worryInput}
                onChange={(e) => setWorryInput(e.target.value)}
                placeholder="Write a worry you are carrying right now..."
                className="flex-1 px-4 py-3 rounded-2xl bg-[var(--preview-darkest)] border border-[var(--preview-white)]/20 text-sm font-bold text-[var(--preview-cream)]"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-2xl bg-[var(--preview-gold)] text-[var(--preview-navy)] text-xs font-black"
              >
                Release ✨
              </button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {floatingWorries.map((w) => (
                <span
                  key={w.id}
                  onClick={() => {
                    asmrAudio.playChatakPop(1.4);
                    setFloatingWorries((prev) => prev.filter((item) => item.id !== w.id));
                  }}
                  className="px-3.5 py-2 rounded-full bg-[var(--preview-coral)] text-[var(--preview-navy)] text-xs font-extrabold cursor-pointer animate-float-above"
                >
                  {w.text} ✕
                </span>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ============================================================================
          MODAL 1: EDITORIAL AVATAR CUSTOMIZER STUDIO
      ============================================================================ */}
      {showAvatarCustomizer && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl p-6 bg-[var(--preview-cream)] text-[var(--preview-navy)] border-2 border-[var(--preview-navy)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Editorial Avatar Customizer</h3>
              <button
                onClick={() => setShowAvatarCustomizer(false)}
                className="p-1.5 rounded-xl bg-[var(--preview-navy)] text-[var(--preview-cream)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--preview-sand)] border border-[var(--preview-line)]">
              <EditorialAvatar member={customizingMember} size="lg" />
              <div>
                <p className="text-base font-black">{customizingMember.name}</p>
                <p className="text-xs opacity-75">{customizingMember.role}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {familyMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCustomizingMemberId(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${
                    customizingMemberId === m.id
                      ? "bg-[var(--preview-navy)] text-[var(--preview-cream)]"
                      : "bg-[var(--preview-sand)] text-[var(--preview-navy)]"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["leaves", "waves", "stripes", "clouds"].map((motif) => (
                <button
                  key={motif}
                  onClick={() =>
                    setFamilyMembers((prev) =>
                      prev.map((m) =>
                        m.id === customizingMember.id ? { ...m, backdropMotif: motif } : m,
                      ),
                    )
                  }
                  className="py-2 px-3 rounded-xl bg-[var(--preview-white)] border border-[var(--preview-line)] text-xs font-extrabold capitalize"
                >
                  Motif: {motif}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          MODAL 2: STEP #7 ENHANCED FAMILY INVITE (MOBILE NO. OR INVITE ID +
          INVITEE CALL OPT-IN OR IGNORE CONSENT FLOW)
      ============================================================================ */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-3xl p-6 border-2 shadow-2xl max-h-[92vh] overflow-y-auto ${
              isDark
                ? "bg-[var(--preview-deep)] border-[var(--preview-coral)] text-[var(--preview-cream)]"
                : "bg-[var(--preview-cream)] border-[var(--preview-navy)] text-[var(--preview-navy)]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-gold)] text-[var(--preview-navy)]">
                  Invite to your circle
                </span>
                <h3 className="text-lg font-extrabold mt-1">Invite Family Member to Circle</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-xl bg-[var(--preview-navy)] text-[var(--preview-cream)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method Toggle: Mobile Number vs Shareable Invite ID */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setInviteMethod("mobile")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all ${
                  inviteMethod === "mobile"
                    ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[var(--preview-coral)]"
                    : "bg-[var(--preview-white)] text-[var(--preview-navy)] border-[var(--preview-line)]"
                }`}
              >
                📞 Add by Mobile No.
              </button>
              <button
                type="button"
                onClick={() => setInviteMethod("inviteId")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all ${
                  inviteMethod === "inviteId"
                    ? "bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[var(--preview-coral)]"
                    : "bg-[var(--preview-white)] text-[var(--preview-navy)] border-[var(--preview-line)]"
                }`}
              >
                🔑 Share Invite ID
              </button>
            </div>

            <form onSubmit={handleAddFamilyInvite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-extrabold mb-1">
                  Parent / Family Member Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Nani Ji, Papa, Chacha Ji..."
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--preview-line)] bg-[var(--preview-white)] text-[var(--preview-navy)] text-sm font-bold"
                />
              </div>

              {inviteMethod === "mobile" ? (
                <div>
                  <label className="block text-xs font-extrabold mb-1">
                    Mobile or Landline Number (We ask consent on the call)
                  </label>
                  <input
                    type="tel"
                    required
                    value={inviteMobile}
                    onChange={(e) => setInviteMobile(e.target.value)}
                    placeholder="+91 98201 54321"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--preview-line)] bg-[var(--preview-white)] text-[var(--preview-navy)] text-sm font-bold"
                  />
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border border-[var(--preview-gold)]">
                  <p className="text-[10px] font-bold text-[var(--preview-gold)] uppercase">
                    Unique Circle Invite ID
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-base font-black tracking-wider">{generatedInviteId}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(generatedInviteId);
                          triggerToast("Preview invite ID copied.");
                        } catch {
                          triggerToast(
                            "Copy unavailable. Select the invite ID and copy it manually.",
                          );
                        }
                      }}
                      className="px-3 py-1 rounded-xl bg-[var(--preview-coral)] text-[var(--preview-navy)] text-xs font-extrabold flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ID</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-extrabold mb-1">Age Archetype</label>
                  <select
                    value={inviteArchetype}
                    onChange={(e) => setInviteArchetype(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--preview-line)] bg-[var(--preview-white)] text-[var(--preview-navy)] text-xs font-bold"
                  >
                    <option value="aged-woman">Aged Woman (Parent)</option>
                    <option value="aged-man">Aged Man (Parent)</option>
                    <option value="adult-woman">Adult Woman</option>
                    <option value="adult-man">Adult Man</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-1">Initial Greeting Note</label>
                  <input
                    type="text"
                    value={inviteStatus}
                    onChange={(e) => setInviteStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--preview-line)] bg-[var(--preview-white)] text-[var(--preview-navy)] text-xs font-bold"
                  />
                </div>
              </div>

              {/* Step #7 Two Bullet Guarantees */}
              <div className="p-3.5 rounded-2xl bg-[var(--preview-sand)] text-[var(--preview-navy)] border border-[var(--preview-line)] text-xs space-y-1.5">
                <p className="font-extrabold text-[var(--preview-orange)]">Your invitation</p>
                <p className="font-semibold">
                  • <strong>Inform on Call:</strong> The invitee can inform our listener right on
                  the phone call whether they want to be part of the circle or not.
                </p>
                <p className="font-semibold">
                  • <strong>Freedom to Ignore:</strong> The invitee can ignore the invite anytime if
                  they want — zero pressure.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[var(--preview-orange)] hover:bg-[var(--preview-navy)] text-[var(--preview-cream)] font-extrabold text-xs transition-colors"
              >
                Add preview invitation
              </button>
            </form>

            {/* Live Invitee Call Opt-In / Ignore Simulator */}
            <div className="mt-4 pt-3 border-t border-[var(--preview-line)] dark:border-[var(--preview-dark-line)]">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--preview-orange)] mb-2">
                Pending Invites (Simulate Invitee Call Response):
              </p>
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-2.5 rounded-2xl bg-[var(--preview-white)] text-[var(--preview-navy)] border border-[var(--preview-line)] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-extrabold">
                        {inv.name} ({inv.mobile})
                      </p>
                      <p className="text-[10px] font-bold text-[var(--preview-orange)]">
                        Status: {inv.callConsentStatus}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePendingInviteDecision(inv.id, "Accepted on Call")}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-[var(--preview-white)] text-[10px] font-extrabold"
                      >
                        ✅ Accept on Call
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePendingInviteDecision(inv.id, "Ignored by Invitee")}
                        className="px-2.5 py-1 rounded-lg bg-stone-200 text-stone-700 text-[10px] font-extrabold"
                      >
                        🙈 Ignore Invite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          MODAL 3: STEP #6 SIGN IN WITH GOOGLE, APPLE ID, OR CREATE AN ACCOUNT
      ============================================================================ */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full rounded-3xl p-6 border-2 shadow-2xl ${
              isDark
                ? "bg-[var(--preview-deep)] border-[var(--preview-gold)] text-[var(--preview-cream)]"
                : "bg-[var(--preview-cream)] border-[var(--preview-navy)] text-[var(--preview-navy)]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-coral)] text-[var(--preview-navy)]">
                  Account preview
                </span>
                <h3 className="text-xl font-black mt-1">
                  {authTab === "signin" ? "Sign in to SomeoneNear" : "Create your Family Account"}
                </h3>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-1.5 rounded-xl bg-[var(--preview-navy)] text-[var(--preview-cream)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1-Click OAuth Buttons: Google & Apple ID */}
            <div className="space-y-2.5 mb-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentUser({
                    name: "Aarav (Google)",
                    provider: "Google",
                  });
                  setShowAuthModal(false);
                  asmrAudio.playPatakFirework();
                  setExperienceView("family-app");
                  triggerToast("Google sign-in preview. No account was authenticated.");
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[var(--preview-white)] text-[var(--preview-navy)] border-2 border-[var(--preview-navy)] text-xs font-extrabold flex items-center justify-center gap-2.5 shadow-sm hover:scale-[1.01] transition-transform"
              >
                <span className="w-5 h-5 rounded-full bg-[var(--preview-orange)] text-[var(--preview-white)] font-black flex items-center justify-center text-xs">
                  G
                </span>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentUser({
                    name: "Aarav (Apple ID)",
                    provider: "Apple ID",
                  });
                  setShowAuthModal(false);
                  asmrAudio.playPatakFirework();
                  setExperienceView("family-app");
                  triggerToast("Apple sign-in preview. No account was authenticated.");
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-gold)] text-xs font-extrabold flex items-center justify-center gap-2.5 shadow-sm hover:scale-[1.01] transition-transform"
              >
                <span className="text-base leading-none"></span>
                <span>Continue with Apple ID</span>
              </button>
            </div>

            <div className="flex items-center gap-3 my-3">
              <div className="h-px flex-1 bg-current opacity-20" />
              <span className="text-[10px] font-extrabold uppercase opacity-65">
                Or Create an Account
              </span>
              <div className="h-px flex-1 bg-current opacity-20" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCurrentUser({
                  name: authName.trim() || "Aarav",
                  email: authEmail,
                });
                setShowAuthModal(false);
                triggerToast("Preview profile opened. No account was created.", "Preview only");
              }}
              className="space-y-3"
            >
              <input
                type="text"
                required
                placeholder="Your Full Name (e.g., Aarav Sharma)"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--preview-line)] bg-[var(--preview-white)] text-[var(--preview-navy)] text-xs font-bold"
              />
              <input
                type="email"
                required
                placeholder="Email or Mobile Number"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--preview-line)] bg-[var(--preview-white)] text-[var(--preview-navy)] text-xs font-bold"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[var(--preview-orange)] text-[var(--preview-cream)] text-xs font-extrabold"
              >
                Open preview profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
          MODAL 4: STEP #4 & #5 COUNTRY PAYMENT GATEWAY CHECKOUT (*7 DAYS FREE)
      ============================================================================ */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl p-6 bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-gold)] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[var(--preview-gold)] text-[var(--preview-navy)]">
                {activeCountryConfig.flag} {activeCountryConfig.name} Gateway
              </span>
              <button
                onClick={() => setShowCheckoutModal(null)}
                className="p-1.5 rounded-xl bg-[var(--preview-white)]/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xl font-black">{showCheckoutModal.planName}</h3>
            <p className="text-xs text-[var(--preview-gold)] font-bold mt-1">
              Checkout preview · No payment collected
            </p>
            <p className="text-[11px] text-[var(--preview-cream)]/80 mt-1 mb-4">
              <strong>{showCheckoutModal.price}/month</strong>. Payment will be connected after the
              frontend is approved. No subscription starts here.
            </p>
            <div className="space-y-2 mb-4">
              {activeCountryConfig.gateways.map((gw) => (
                <button
                  key={gw}
                  disabled
                  className="w-full py-2.5 px-4 rounded-2xl bg-[var(--preview-darkest)] hover:bg-[var(--preview-orange)] border border-[var(--preview-white)]/15 text-xs font-extrabold flex items-center justify-between transition-colors"
                >
                  <span>{gw}</span>
                  <ArrowRight className="w-4 h-4 text-[var(--preview-gold)]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          PERSISTENT DRAGGABLE ANIMATED ASSISTIVE GESTURE BUTTON ("ALL OVER THE SITE")
      ============================================================================ */}
      <div
        data-assist-root
        style={{
          transform: `translate(${orbPos.x}px, ${orbPos.y}px)`,
          display:
            experienceView === "family-app" && activeTab === "Companion" ? "none" : undefined,
        }}
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end select-none"
      >
        {/* Active Assistive Task Modal Drawer */}
        {assistiveOpen && assistiveTask && (
          <div
            data-assist
            role="region"
            aria-label="Care action"
            className="mb-3 w-80 sm:w-96 rounded-3xl bg-[var(--preview-navy)] text-[var(--preview-cream)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] border-2 border-[var(--preview-coral)] animate-spring-pop"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--preview-white)]/15">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--preview-gold)]">
                {assistiveTask === "audioShare" && "3. 1-Click Audio Store & Family Share"}
                {assistiveTask === "reminder" && "2. Reminder (Self or Parents)"}
                {assistiveTask === "medPhoto" && "4. Medicine Photo & Dose Time"}
                {assistiveTask === "listener" && "1. Tell to Book Listener"}
                {assistiveTask === "followupMemory" && "10. Follow-Up & Instant Memory Send-Later"}
                {assistiveTask === "voice" && "Assistive Voice Command"}
              </span>
              <button
                onClick={() => {
                  setIsRecordingAudio(false);
                  setAssistiveTask(null);
                }}
                className="p-1 rounded-lg bg-[var(--preview-white)]/10 hover:bg-[var(--preview-white)]/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assistiveTask === "audioShare" && (
              <div className="text-center">
                <div className="my-4 flex items-center justify-center gap-1.5 h-12">
                  {[0, 0.12, 0.24, 0.08, 0.3, 0.18, 0.05, 0.22].map((d, i) => (
                    <span
                      key={i}
                      style={{
                        animation: `eqCoralBounce 0.65s ease-in-out ${d}s infinite`,
                      }}
                      className="w-2 rounded-full bg-[var(--preview-coral)] block"
                    />
                  ))}
                </div>
                <p className="text-xs font-bold text-[var(--preview-gold)] mb-3">
                  Recording animation preview · {recordingSeconds}s
                </p>
                <button
                  onClick={completeOneClickAudioShare}
                  className="w-full py-3 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>Add sample voice note</span>
                </button>
              </div>
            )}

            {assistiveTask === "reminder" && (
              <form onSubmit={handleAssistiveAddReminder} className="space-y-3">
                <p className="text-[11px] text-[var(--preview-cream)]/80">
                  Set for yourself or on behalf of your parents:
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "dad", label: "For Dad" },
                    { id: "mum", label: "For Mum" },
                    { id: "aarav", label: "Myself" },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setAssistTargetMember(t.id)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold border ${
                        assistTargetMember === t.id
                          ? "bg-[var(--preview-coral)] text-[var(--preview-navy)] border-[var(--preview-coral)]"
                          : "bg-[var(--preview-white)]/10 text-[var(--preview-cream)] border-[var(--preview-white)]/15"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g., Evening walk or Dr. checkup"
                  value={assistReminderText}
                  onChange={(e) => setAssistReminderText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--preview-darkest)] border border-[var(--preview-white)]/20 text-xs font-bold text-[var(--preview-cream)]"
                />
                <div className="flex items-center justify-between bg-[var(--preview-darkest)] px-3 py-2 rounded-xl border border-[var(--preview-white)]/20">
                  <span className="text-xs font-bold text-[var(--preview-gold)]">
                    Reminder Time
                  </span>
                  <input
                    type="text"
                    value={assistReminderTime}
                    onChange={(e) => setAssistReminderTime(e.target.value)}
                    className="w-24 text-right bg-transparent text-xs font-extrabold focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-2xl bg-[var(--preview-gold)] text-[var(--preview-navy)] font-extrabold text-xs"
                >
                  Save &amp; Notify on Three.js Globe
                </button>
              </form>
            )}

            {assistiveTask === "medPhoto" && (
              <form onSubmit={handleAssistiveAddMedicine} className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "dad", label: "Dad" },
                    { id: "mum", label: "Mum" },
                    { id: "aarav", label: "Myself" },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setAssistTargetMember(t.id)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold ${
                        assistTargetMember === t.id
                          ? "bg-[var(--preview-gold)] text-[var(--preview-navy)]"
                          : "bg-[var(--preview-white)]/10 text-[var(--preview-cream)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  required
                  value={assistMedName}
                  onChange={(e) => setAssistMedName(e.target.value)}
                  placeholder="Medicine Name & Strip Description"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--preview-darkest)] border border-[var(--preview-white)]/20 text-xs font-bold text-[var(--preview-cream)]"
                />

                <div className="flex items-center justify-between bg-[var(--preview-darkest)] p-2.5 rounded-xl border border-[var(--preview-white)]/20">
                  <span className="text-xs font-bold">Pill Photo Color:</span>
                  <div className="flex gap-1.5">
                    {["#F36D89", "#D95732", "#EAB84B", "#5C8EA6"].map((col) => (
                      <button
                        type="button"
                        key={col}
                        onClick={() => setAssistMedColor(col)}
                        style={{ backgroundColor: col }}
                        className={`w-6 h-6 rounded-full border-2 ${
                          assistMedColor === col
                            ? "border-[var(--preview-white)] scale-110"
                            : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-[var(--preview-darkest)] px-3 py-2 rounded-xl border border-[var(--preview-white)]/20">
                  <span className="text-xs font-bold text-[var(--preview-gold)]">Dose Time</span>
                  <input
                    type="text"
                    value={assistMedTime}
                    onChange={(e) => setAssistMedTime(e.target.value)}
                    className="w-24 text-right bg-transparent text-xs font-extrabold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] font-extrabold text-xs"
                >
                  Attach Pill Photo &amp; Set Phone Alarm
                </button>
              </form>
            )}

            {assistiveTask === "listener" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--preview-cream)]/85">
                  Instant 1-tap booking with a verified empathetic Listener for yourself or Dad/Mum:
                </p>
                {VERIFIED_LISTENERS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setBookedSessions((prev) => [
                        ...prev,
                        {
                          id: `bk-${Date.now()}`,
                          listenerName: l.name,
                          forWho: "Dad / Family",
                          slot: l.nextSlot,
                        },
                      ]);
                      setAssistiveTask(null);
                      setAssistiveOpen(false);
                      triggerToast(`Booked ${l.name} for ${l.nextSlot}!`, "Listener Confirmed");
                    }}
                    className="w-full p-3 rounded-2xl bg-[var(--preview-darkest)] hover:bg-[var(--preview-orange)] text-left transition-colors border border-[var(--preview-white)]/15 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-extrabold">{l.name}</p>
                      <p className="text-[10px] text-[var(--preview-gold)]">{l.nextSlot}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--preview-coral)] text-[var(--preview-navy)] text-[10px] font-black">
                      Book
                    </span>
                  </button>
                ))}
              </div>
            )}

            {assistiveTask === "voice" && (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-[var(--preview-coral)] text-[var(--preview-navy)] mx-auto mb-2 flex items-center justify-center animate-pulse">
                  <Mic className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-[var(--preview-cream)] mb-3">
                  {voiceTranscript}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  <button
                    onClick={() => setAssistiveTask("listener")}
                    className="px-2.5 py-1 rounded-lg bg-[var(--preview-white)]/10 text-[10px] font-bold"
                  >
                    &ldquo;Book Listener&rdquo;
                  </button>
                  <button
                    onClick={() => setAssistiveTask("followupMemory")}
                    className="px-2.5 py-1 rounded-lg bg-[var(--preview-white)]/10 text-[10px] font-bold"
                  >
                    &ldquo;Birthday / Appointment Follow-up&rdquo;
                  </button>
                  <button
                    onClick={() => setAssistiveTask("medPhoto")}
                    className="px-2.5 py-1 rounded-lg bg-[var(--preview-white)]/10 text-[10px] font-bold"
                  >
                    &ldquo;Add Medicine Photo&rdquo;
                  </button>
                </div>
              </div>
            )}

            {/* STEP #10: FOLLOW-UP (APPOINTMENT, BIRTHDAY WISHES, HOW'S YOUR DAY) + INSTANT MEMORY SEND LATER */}
            {assistiveTask === "followupMemory" && (
              <form onSubmit={handleSaveFollowUpAndMemory} className="space-y-3">
                <p className="text-[11px] text-[var(--preview-cream)]/85">
                  Create a follow-up or share an instant memory to <strong>Send Later</strong>:
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "appointment", label: "🩺 Appointment" },
                    { id: "birthday", label: "🎂 Birthday" },
                    { id: "howsyourday", label: "☀️ How’s Day" },
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setFollowUpCategory(cat.id)}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold border ${
                        followUpCategory === cat.id
                          ? "bg-[var(--preview-gold)] text-[var(--preview-navy)] border-[var(--preview-gold)]"
                          : "bg-[var(--preview-white)]/10 text-[var(--preview-cream)] border-[var(--preview-white)]/15"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "dad", label: "For Dad" },
                    { id: "mum", label: "For Mum" },
                    { id: "aarav", label: "Myself" },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setAssistTargetMember(t.id)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold ${
                        assistTargetMember === t.id
                          ? "bg-[var(--preview-coral)] text-[var(--preview-navy)]"
                          : "bg-[var(--preview-white)]/10 text-[var(--preview-cream)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Instant memory or follow-up note..."
                  value={instantMemoryNote}
                  onChange={(e) => setInstantMemoryNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--preview-darkest)] border border-[var(--preview-white)]/20 text-xs font-bold text-[var(--preview-cream)]"
                />

                <div className="flex items-center justify-between bg-[var(--preview-darkest)] px-3 py-2 rounded-xl border border-[var(--preview-white)]/20">
                  <span className="text-xs font-bold text-[var(--preview-gold)]">
                    Send Later Time
                  </span>
                  <input
                    type="text"
                    value={instantMemorySendTime}
                    onChange={(e) => setInstantMemorySendTime(e.target.value)}
                    className="w-32 text-right bg-transparent text-xs font-extrabold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-2xl bg-[var(--preview-coral)] text-[var(--preview-navy)] font-extrabold text-xs"
                >
                  Schedule Follow-Up &amp; Instant Memory →
                </button>
              </form>
            )}
          </div>
        )}

        {/* Fan-Out Menu of All Site Tasks (Steps #2, #9, #10) */}
        {assistiveOpen && !assistiveTask && (
          <div className="mb-3 flex flex-col items-end gap-2 animate-spring-pop">
            <button
              onClick={startAssistiveVoiceCommand}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[var(--preview-navy)] text-[var(--preview-cream)] border-2 border-[var(--preview-gold)] shadow-xl text-xs font-extrabold hover:scale-105 transition-transform"
            >
              <Mic className="w-4 h-4 text-[var(--preview-coral)] animate-pulse" />
              <span>&ldquo;Ask follow-up, Send Later, or book listener...&rdquo;</span>
            </button>

            {[
              {
                id: "chatakGame",
                title: "🎮 Play Chatak-Patak & ASMR (#9)",
                sub: "Pop bubbles, worry splat & singing bowls",
                icon: Gamepad2,
                bg: "bg-[var(--preview-coral)] text-[var(--preview-navy)]",
                onClick: () => {
                  setExperienceView("chatak-arcade");
                  setAssistiveOpen(false);
                  asmrAudio.playPatakFirework();
                },
              },
              {
                id: "followupMemory",
                title: "🎂 Follow-Up & Instant Send Later (#10)",
                sub: "Appointment, birthday wish or How’s your day",
                icon: CalendarClock,
                bg: "bg-[var(--preview-gold)] text-[var(--preview-navy)]",
                onClick: () => setAssistiveTask("followupMemory"),
              },
              {
                id: "listener",
                title: "1. Tell to Book Listener",
                sub: "Voice or 1-tap empathetic listener",
                icon: Headphones,
                bg: "bg-[var(--preview-navy)] text-[var(--preview-cream)]",
                onClick: () => setAssistiveTask("listener"),
              },
              {
                id: "audioShare",
                title: "3. 1-Click Audio to Family",
                sub: "Instant record, store & share on 3D Globe",
                icon: Radio,
                bg: "bg-[var(--preview-orange)] text-[var(--preview-cream)]",
                onClick: () => {
                  setAssistiveTask("audioShare");
                  setIsRecordingAudio(true);
                },
              },
              {
                id: "medPhoto",
                title: "4. Medicine Photo + Time",
                sub: "Attach pill strip photo & dose alarm",
                icon: Pill,
                bg: "bg-[var(--preview-navy)] text-[var(--preview-gold)]",
                onClick: () => setAssistiveTask("medPhoto"),
              },
            ].map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  onClick={act.onClick}
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[var(--preview-cream)] text-[var(--preview-navy)] border-2 border-[var(--preview-navy)] shadow-xl hover:scale-105 transition-transform"
                >
                  <div className="text-right">
                    <p className="text-xs font-extrabold">{act.title}</p>
                    <p className="text-[10px] opacity-75 font-semibold">{act.sub}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${act.bg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Draggable Animated Assistive Gesture Orb Button */}
        <button
          aria-label="Open care actions"
          aria-expanded={assistiveOpen}
          onClick={(event) => {
            if (event.detail === 0) {
              setAssistiveOpen((value) => !value);
              setAssistiveTask(null);
              setOrbPos({ x: 0, y: 0 });
            }
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            orbDragRef.current = {
              dragging: true,
              startX: e.clientX,
              startY: e.clientY,
              origX: orbPos.x,
              origY: orbPos.y,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            if (!orbDragRef.current.dragging) return;
            const dx = e.clientX - orbDragRef.current.startX;
            const dy = e.clientY - orbDragRef.current.startY;
            if (Math.hypot(dx, dy) > 6) orbDragRef.current.moved = true;
            setOrbPos({
              x: Math.max(-window.innerWidth + 108, Math.min(0, orbDragRef.current.origX + dx)),
              y: Math.max(-window.innerHeight + 108, Math.min(0, orbDragRef.current.origY + dy)),
            });
          }}
          onPointerUp={() => {
            const wasMoved = orbDragRef.current.moved;
            orbDragRef.current.dragging = false;
            if (!wasMoved) {
              setAssistiveOpen(!assistiveOpen);
              setAssistiveTask(null);
              setIsRecordingAudio(false);
              setOrbPos({ x: 0, y: 0 });
            }
          }}
          className="relative w-16 h-16 rounded-full bg-[var(--preview-navy)] text-[var(--preview-cream)] border-[3px] border-[var(--preview-coral)] shadow-[0_14px_35px_rgba(16,47,80,0.55)] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-grab active:cursor-grabbing"
          title="Assistive Care Gesture Button (Drag anywhere or Tap)"
        >
          <span className="absolute -inset-2 rounded-full border-2 border-[var(--preview-orange)] animate-coral-ring pointer-events-none" />
          <Sparkles className="w-6 h-6 text-[var(--preview-gold)]" />
          <span className="text-[8px] font-black uppercase tracking-wider text-[var(--preview-coral)] mt-0.5">
            Assist
          </span>
        </button>
      </div>
    </div>
  );
}
