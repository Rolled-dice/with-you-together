import { useId } from "react";
import { familyAvatarIndex } from "@/lib/family-avatars";

export function FamilyAvatar({
  value,
  fallback = 0,
}: {
  value?: string | null;
  fallback?: number;
}) {
  const saved = familyAvatarIndex(value);
  const index = saved >= 0 ? saved : fallback % 12;
  const clip = `portrait-${useId().replaceAll(":", "")}`;
  const skin = ["#c88b60", "#d69a75", "#865537", "#edb28a"][index % 4];
  const hair = index >= 4 && index < 8 ? "#e7e2da" : "#382c30";
  const shirt = ["#5c8ea6", "#f36d89", "#102f50", "#d95732"][index % 4];
  const long = index % 2 === 1;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="family-avatar"
      style={{ backgroundImage: "none" }}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path fill="#eab84b" d="M0 0h100v100H0z" />
        <path
          d="M-5 20Q25 0 45 20T105 18M-5 80Q20 60 50 80T105 75"
          fill="none"
          stroke="#f7f0e5"
          strokeWidth="3"
          opacity=".6"
        />
        <path
          d={long ? "M23 76V39Q21 12 49 12Q80 11 78 42V79Z" : "M27 42Q22 12 51 12Q79 12 74 44Z"}
          fill={hair}
        />
        <path d="M13 106Q12 73 40 72H60Q88 73 88 106Z" fill={shirt} />
        <path d="M43 62h14v16Q50 85 43 76Z" fill={skin} />
        <ellipse cx="50" cy="44" rx="22" ry="27" fill={skin} />
        <path d="M28 36Q25 13 50 13Q73 13 73 32Q55 34 43 22Q39 33 28 36Z" fill={hair} />
        <path d="M36 39h8m12 0h8" stroke="#243238" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="40" cy="45" rx="2" ry="2.8" fill="#243238" />
        <ellipse cx="60" cy="45" rx="2" ry="2.8" fill="#243238" />
        <path
          d="m50 45-2 9h5M43 59q7 6 14 0"
          fill="none"
          stroke="#663f35"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <ellipse cx="34" cy="54" rx="4" ry="2.5" fill="#f36d89" opacity=".55" />
        <ellipse cx="66" cy="54" rx="4" ry="2.5" fill="#f36d89" opacity=".55" />
        {index % 3 === 1 && (
          <g fill="none" stroke="#102f50" strokeWidth="2">
            <rect x="30" y="39" width="17" height="13" rx="5" />
            <rect x="53" y="39" width="17" height="13" rx="5" />
            <path d="M47 44h6" />
          </g>
        )}
        <path
          d="m27 86 4 4m38-4 4 4m-29 5 4 4m13-12 4 4"
          stroke="#f7f0e5"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
