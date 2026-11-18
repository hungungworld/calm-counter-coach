import type { CustomerLook } from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

/**
 * Flat illustrated customer. Used where a 3D stage would be too heavy (cards, chat
 * header, replay) and as the fallback when WebGL is unavailable. The face reads the
 * same emotion temperature as the 3D customer, so both tell the same story.
 */
export function CustomerPortrait({
  look,
  anger,
  speaking = false,
  className,
  title,
}: {
  look: CustomerLook;
  /** 0 (calm) to 100 (furious). */
  anger: number;
  speaking?: boolean;
  className?: string | undefined;
  title?: string;
}) {
  const heat = Math.max(0, Math.min(1, anger / 100));
  const browTilt = -5 + heat * 24;
  const browY = 55 - heat * -2.5;
  const eyeScale = 1 - heat * 0.32;
  const mouthControl = 91 + (0.55 - heat) * 9;
  const male = look.gender === "m";
  const shoulder = male ? 47 : 42;
  const hair = look.hairColor;

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={title ?? "연습 상대 고객"}
      className={cn("block", className)}
    >
      {/* back hair */}
      {look.hair === "long" && <path d="M33 58 Q30 96 40 108 L80 108 Q90 96 87 58 Z" fill={hair} />}
      {look.hair === "bob" && <path d="M32 56 Q30 82 40 88 L80 88 Q90 82 88 56 Z" fill={hair} />}
      {look.hair === "ponytail" && <path d="M82 50 Q100 60 94 92 Q88 80 84 64 Z" fill={hair} />}
      {look.hair === "updo" && <circle cx="60" cy="22" r="11" fill={hair} />}

      {/* shoulders */}
      <path
        d={`M${60 - shoulder} 120 Q${60 - shoulder} 98 ${60 - 14} 96 L${60 + 14} 96 Q${60 + shoulder} 98 ${60 + shoulder} 120 Z`}
        fill={look.outfit}
      />
      <path d="M49 97 Q60 108 71 97 L66 94 L54 94 Z" fill={look.outfitAccent} />
      {look.accessory === "tie" && <path d="M57 99 L63 99 L65 120 L55 120 Z" fill="#7a2f38" />}
      {look.accessory === "scarf" && (
        <path d="M46 93 Q60 104 74 93 L72 101 Q60 110 48 101 Z" fill="#c9a86a" />
      )}

      {/* neck and head */}
      <rect x="53" y="82" width="14" height="16" rx="6" fill={look.skin} />
      <ellipse cx="60" cy="60" rx="25" ry="29" fill={look.skin} />
      <ellipse cx="35" cy="62" rx="3.4" ry="5.4" fill={look.skin} />
      <ellipse cx="85" cy="62" rx="3.4" ry="5.4" fill={look.skin} />
      {look.accessory === "earrings" && (
        <>
          <circle cx="35" cy="70" r="2" fill="#c9a86a" />
          <circle cx="85" cy="70" r="2" fill="#c9a86a" />
        </>
      )}

      {/* front hair */}
      {look.hair === "short" || look.accessory === "cap" ? (
        <path d="M35 54 Q34 30 60 29 Q86 30 85 54 Q78 40 60 40 Q42 40 35 54 Z" fill={hair} />
      ) : (
        <path
          d="M33 60 Q30 28 60 28 Q90 28 87 60 Q84 44 66 39 Q50 46 38 44 Q34 50 33 60 Z"
          fill={hair}
        />
      )}
      {look.accessory === "cap" && (
        <>
          <path d="M34 46 Q36 24 60 24 Q84 24 86 46 Z" fill={look.outfitAccent} />
          <path
            d="M34 45 Q60 36 92 49 Q64 44 34 49 Z"
            fill={look.outfitAccent}
            stroke="#00000022"
          />
        </>
      )}

      {/* cheeks flush as the temperature rises */}
      <circle cx="44" cy="72" r="6" fill="#d9655a" opacity={0.1 + heat * 0.3} />
      <circle cx="76" cy="72" r="6" fill="#d9655a" opacity={0.1 + heat * 0.3} />

      {/* eyes */}
      <g transform={`translate(49 63) scale(1 ${eyeScale})`}>
        <ellipse rx="5" ry="4" fill="#fbf7f0" />
        <circle r="2.6" fill="#2b1a12" />
        <circle cx="0.9" cy="-0.9" r="0.8" fill="#fff" />
      </g>
      <g transform={`translate(71 63) scale(1 ${eyeScale})`}>
        <ellipse rx="5" ry="4" fill="#fbf7f0" />
        <circle r="2.6" fill="#2b1a12" />
        <circle cx="0.9" cy="-0.9" r="0.8" fill="#fff" />
      </g>

      {/* brows */}
      <g stroke={hair} strokeWidth={male ? 2.6 : 2} strokeLinecap="round">
        <line x1="43" y1={browY} x2="55" y2={browY} transform={`rotate(${browTilt} 49 ${browY})`} />
        <line
          x1="65"
          y1={browY}
          x2="77"
          y2={browY}
          transform={`rotate(${-browTilt} 71 ${browY})`}
        />
      </g>

      {look.accessory === "glasses" && (
        <g fill="none" stroke="#2a2622" strokeWidth="1.4">
          <ellipse cx="49" cy="63" rx="8" ry="6.6" />
          <ellipse cx="71" cy="63" rx="8" ry="6.6" />
          <path d="M57 62 Q60 60 63 62" />
        </g>
      )}

      <path
        d="M58.6 73 Q60 75.4 61.4 73"
        fill="none"
        stroke="#00000030"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* mouth: frown to smile, with a talking flap while the customer speaks */}
      {speaking ? (
        <ellipse cx="60" cy="88" rx="6" ry="3.2" fill="#4a1a1f" className="animate-talk" />
      ) : (
        <path
          d={`M51 88 Q60 ${mouthControl} 69 88`}
          fill="none"
          stroke={male ? "#8c5a48" : "#a94c50"}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
