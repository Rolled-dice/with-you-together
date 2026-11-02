// Artwork extracted verbatim from the supplied integrated prototype. Do not redesign.
export type AvatarAppearance = {
  skinTone?: string;
  avatarBg?: string;
  outfitColor?: string;
  archetype?: string;
  outfitPattern?: string;
  earrings?: string;
  backdropMotif?: string;
  glasses?: boolean;
  frameShape?: string;
};
export const EditorialAvatar = ({
  member,
  size = "md",
}: {
  member?: AvatarAppearance;
  size?: "sm" | "md" | "lg" | "xl";
}) => {
  const dim =
    size === "xl"
      ? "w-28 h-28"
      : size === "lg"
        ? "w-20 h-20"
        : size === "sm"
          ? "w-11 h-11"
          : "w-14 h-14";
  const skin = member?.skinTone || "#E5A98A";
  const bg = member?.avatarBg || "#EAB84B";
  const outfit = member?.outfitColor || "#D95732";
  const arch = member?.archetype || "adult-woman";
  const pattern =
    member?.outfitPattern ||
    (arch === "aged-man"
      ? "shawl"
      : arch === "aged-woman"
        ? "hearts"
        : arch === "teenager"
          ? "polka"
          : arch === "child"
            ? "collar"
            : "solid");
  const earrings =
    member?.earrings ||
    (arch === "adult-woman"
      ? "tassels"
      : arch === "aged-woman"
        ? "hoops"
        : arch === "child"
          ? "pink-hoops"
          : arch === "teenager"
            ? "stud"
            : "none");
  const showGlasses = typeof member?.glasses === "boolean" ? member.glasses : arch === "aged-man";
  const radiusClass = member?.frameShape === "rounded" ? "rounded-2xl" : "rounded-full";

  return (
    <div
      className={`${dim} ${radiusClass} relative overflow-hidden border-[2.5px] border-[#FAF7F2] shadow-[0_8px_20px_rgba(16,47,80,0.22)] flex-shrink-0 select-none`}
      style={{ backgroundColor: bg }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full block">
        {/* Customizable Backdrop Motifs */}
        {member?.backdropMotif === "leaves" && (
          <g opacity="0.92">
            <path d="M16 95 C13 66 17 40 26 20 C30 42 28 68 24 95 Z" fill="#FFFDF9" />
            <path d="M84 95 C87 66 83 40 74 20 C70 42 72 68 76 95 Z" fill="#FFFDF9" />
          </g>
        )}
        {member?.backdropMotif === "waves" && (
          <g opacity="0.65">
            <path
              d="M14 8 C24 28 6 52 18 74 C24 88 18 96 18 100"
              stroke="#D97724"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M86 8 C76 28 94 52 82 74 C76 88 82 96 82 100"
              stroke="#D97724"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
        {member?.backdropMotif === "stripes" && (
          <g opacity="0.45" stroke="#102F50" strokeWidth="3">
            <line x1="0" y1="22" x2="100" y2="22" />
            <line x1="0" y1="42" x2="100" y2="42" />
            <line x1="0" y1="62" x2="100" y2="62" />
          </g>
        )}
        {member?.backdropMotif === "clouds" && (
          <g fill="#FFFDF9" opacity="0.82">
            <circle cx="18" cy="28" r="9" />
            <circle cx="27" cy="30" r="7" />
            <circle cx="82" cy="26" r="9" />
            <circle cx="73" cy="29" r="7" />
          </g>
        )}

        {/* Back Hair Layer */}
        {arch === "adult-woman" && (
          <path d="M22 30 C16 54 19 82 26 98 L74 98 C81 82 84 54 78 30 Z" fill="#3D1220" />
        )}
        {arch === "aged-woman" && <circle cx="50" cy="17" r="13" fill="#D8DCE3" />}
        {arch === "child" && (
          <g>
            <path d="M22 36 C12 44 10 64 16 76 C22 72 26 56 27 42 Z" fill="#5C2C1D" />
            <path d="M78 36 C88 44 90 64 84 76 C78 72 74 56 73 42 Z" fill="#5C2C1D" />
            <circle cx="25" cy="36" r="3.5" fill="#EAB84B" />
            <circle cx="75" cy="36" r="3.5" fill="#EAB84B" />
          </g>
        )}

        {/* Shoulders & Outfit Patterns */}
        <path d="M12 100 C15 73 31 67 50 67 C69 67 85 73 88 100 Z" fill={outfit} />
        {pattern === "shawl" && (
          <g>
            <path d="M28 71 C36 84 64 84 72 71 L66 100 L34 100 Z" fill="#F7F0E5" />
            <path d="M28 71 L35 100" stroke="#EAB84B" strokeWidth="3" />
            <path d="M72 71 L65 100" stroke="#EAB84B" strokeWidth="3" />
          </g>
        )}
        {pattern === "hearts" && (
          <g fill="#FFFDF9" opacity="0.9">
            <circle cx="34" cy="84" r="2.3" />
            <circle cx="50" cy="88" r="2.3" />
            <circle cx="66" cy="84" r="2.3" />
            <circle cx="42" cy="94" r="1.8" fill="#EAB84B" />
            <circle cx="58" cy="94" r="1.8" fill="#EAB84B" />
          </g>
        )}
        {pattern === "polka" && (
          <g fill="#FFFDF9" opacity="0.85">
            <circle cx="30" cy="82" r="1.9" />
            <circle cx="42" cy="88" r="1.9" />
            <circle cx="58" cy="84" r="1.9" />
            <circle cx="70" cy="90" r="1.9" />
            <circle cx="48" cy="95" r="1.9" />
          </g>
        )}
        {pattern === "collar" && (
          <g>
            <path d="M36 69 L50 86 L64 69 Z" fill="#FFFDF9" />
            <path d="M32 70 L45 84 L36 90 Z" fill="#102F50" opacity="0.22" />
            <path d="M68 70 L55 84 L64 90 Z" fill="#102F50" opacity="0.22" />
          </g>
        )}

        {/* Neck & Shadow */}
        <path d="M43 54 L43 74 L57 74 L57 54 Z" fill={skin} />
        <path d="M43 59 Q50 66 57 59 L57 64 Q50 70 43 64 Z" fill="#9E563C" opacity="0.35" />

        {/* Ears & Statement Earrings */}
        <circle cx="31" cy="45" r="5" fill={skin} />
        <circle cx="69" cy="45" r="5" fill={skin} />
        {earrings === "tassels" && (
          <g>
            <circle cx="30" cy="52" r="3" fill="#F36D89" />
            <path d="M27 55 L33 55 L35 64 L25 64 Z" fill="#FFFDF9" />
            <circle cx="70" cy="52" r="3" fill="#F36D89" />
            <path d="M67 55 L73 55 L75 64 L65 64 Z" fill="#FFFDF9" />
          </g>
        )}
        {earrings === "hoops" && (
          <g stroke="#EAB84B" strokeWidth="2.3" fill="none">
            <circle cx="30" cy="53" r="4.3" />
            <circle cx="70" cy="53" r="4.3" />
          </g>
        )}
        {earrings === "pink-hoops" && (
          <g stroke="#F36D89" strokeWidth="2.2" fill="none">
            <circle cx="30" cy="52" r="3.6" />
            <circle cx="70" cy="52" r="3.6" />
          </g>
        )}
        {earrings === "stud" && (
          <g fill="#FFFDF9">
            <circle cx="30" cy="48.5" r="1.8" />
            <circle cx="70" cy="48.5" r="1.8" />
          </g>
        )}

        {/* Face Oval & Cheek Blush */}
        <path
          d="M32 33 C32 19 68 19 68 33 L67 49 C67 59 58 63 50 63 C42 63 33 59 33 49 Z"
          fill={skin}
        />
        <circle cx="38.5" cy="48.5" r="4.8" fill="#C86446" opacity="0.48" />
        <circle cx="61.5" cy="48.5" r="4.8" fill="#C86446" opacity="0.48" />

        {/* Eyebrows, Eyes & Nose */}
        <path
          d="M36 36 Q41 33.5 45 36"
          stroke="#102F50"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M55 36 Q59 33.5 64 36"
          stroke="#102F50"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="41" cy="40.5" rx="3.8" ry="2.4" fill="#FFFDF9" />
        <circle cx="41.4" cy="40.5" r="1.9" fill="#102F50" />
        <ellipse cx="59" cy="40.5" rx="3.8" ry="2.4" fill="#FFFDF9" />
        <circle cx="59.4" cy="40.5" r="1.9" fill="#102F50" />
        <path
          d="M50 38 L48 48 L52.2 49"
          stroke="#8C4A32"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Full Front Hair Crowns & Bangs (Never Bald!) */}
        {arch === "aged-man" && (
          <g>
            <path
              d="M31 35 C30 22 40 18 50 18 C60 18 70 22 69 35 C65 26 58 24 50 24 C42 24 35 26 31 35 Z"
              fill="#E2E6EC"
            />
            <path d="M42 53 Q50 50 58 53 Q54 56 50 55 Q46 56 42 53 Z" fill="#D8DCE3" />
          </g>
        )}
        {arch === "aged-woman" && (
          <g>
            <path
              d="M30 38 C30 20 70 20 70 38 C64 28 56 26 50 26 C44 26 36 28 30 38 Z"
              fill="#E2E6EC"
            />
            <circle cx="50" cy="33.5" r="1.8" fill="#D95732" />
            <path
              d="M45 53 Q50 57 55 53"
              stroke="#8C3B2B"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
        {arch === "adult-man" && (
          <g>
            <path
              d="M29 36 C27 20 40 14 50 15 C62 14 73 20 71 36 C66 26 58 24 50 24 C42 24 34 26 29 36 Z"
              fill="#3B1D1A"
            />
            <path
              d="M33 47 C33 58 41 64 50 64 C59 64 67 58 67 47 L63 47 C61 54 56 57 50 57 C44 57 39 54 37 47 Z"
              fill="#3B1D1A"
            />
            <path
              d="M46 53.5 Q50 56 54 53.5"
              stroke="#FFFDF9"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
        {arch === "adult-woman" && (
          <g>
            <path
              d="M29 39 C29 17 47 14 50 21 C53 14 71 17 71 39 C65 28 56 25 50 27 C44 25 35 28 29 39 Z"
              fill="#3D1220"
            />
            <circle cx="50" cy="33" r="1.5" fill="#D95732" />
            <path
              d="M45 53 Q50 57 55 53"
              stroke="#A8383B"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
        {arch === "teenager" && (
          <g>
            <path
              d="M31 35 C31 19 69 19 69 35 C65 26 57 24 50 24 C43 24 35 26 31 35 Z"
              fill="#231F20"
            />
            <path
              d="M45 53.5 Q50 57 55 53.5"
              stroke="#8C3B2B"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
        {arch === "child" && (
          <g>
            <path d="M31 35 C32 20 68 20 69 35 L31 35 Z" fill="#5C2C1D" />
            <path
              d="M45 53 Q50 57.5 55 53"
              stroke="#A8383B"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {/* Eyeglasses Layer */}
        {showGlasses && (
          <g>
            <circle cx="41" cy="40.5" r="6" stroke="#102F50" strokeWidth="1.8" fill="none" />
            <circle cx="59" cy="40.5" r="6" stroke="#102F50" strokeWidth="1.8" fill="none" />
            <line x1="47" y1="40.5" x2="53" y2="40.5" stroke="#102F50" strokeWidth="1.8" />
          </g>
        )}
      </svg>
    </div>
  );
};
