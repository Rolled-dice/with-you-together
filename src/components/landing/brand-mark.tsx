import { cn } from "@/lib/utils";

// Original mark from the deployed test_front prototype.
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      width={42}
      height={42}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {/* Rounded Navy Squircle Container with Subtle Warm Gold Border */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#0F2C4C"
        stroke="#A99260"
        strokeWidth="2.4"
      />
      {/* Left Figure: Terracotta Head & Shoulder Arch */}
      <circle cx="24.5" cy="23" r="5" fill="#D95732" />
      <path
        d="M17.5 45 V35.5 C17.5 31.2 20.3 29.2 24.5 29.2 C28.2 29.2 30.8 30.8 32.2 33.8"
        stroke="#D95732"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Figure: Coral Pink Head & Warm Cream Embracing Arch */}
      <circle cx="39.5" cy="23" r="5" fill="#F36D89" />
      <path
        d="M30.5 40.2 L34.8 32.2 C36.1 29.9 38.1 29.2 40.8 29.2 C44.4 29.2 46.8 31.4 46.8 35.5 V45"
        stroke="#FAF7F2"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("sn-wordmark", className)}>
      <BrandMark />
      <span>
        <span className="sn-wordmark-name">
          Someone<em>Near</em>
        </span>
        <span className="sn-wordmark-tagline">WITH YOU TOGETHER</span>
      </span>
    </span>
  );
}
