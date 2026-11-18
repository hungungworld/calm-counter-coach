import { useEffect, useRef, type RefObject } from "react";

import type { CustomerArt } from "@/lib/customer-art";
import { moodFromAnger, type Mood } from "@/lib/roleplay-rules";
import type { StageState } from "@/lib/stage/scene";
import { cn } from "@/lib/utils";

const MOODS: Mood[] = ["angry", "softening", "calm"];

/**
 * The customer as rendered film-style stills. One still per mood cross-fades as the
 * emotion temperature moves; while a line is spoken the frame pushes in with the voice
 * and, when a mouth-open twin exists, flips to it on the loud syllables.
 * Only transform and opacity ever change, so it stays smooth on a phone.
 */
export function CinematicStage({
  art,
  anger,
  state,
  levelRef,
  className,
  children,
}: {
  art: CustomerArt;
  anger: number;
  state: StageState;
  levelRef: RefObject<number>;
  className?: string;
  children?: React.ReactNode;
}) {
  const mood = moodFromAnger(anger);
  const push = useRef<HTMLDivElement>(null);
  const talk = useRef<HTMLImageElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const jolt = useRef(0);
  const speaking = state === "speaking";

  // A jump in temperature punches the camera in; a drop lets it breathe out.
  const previous = useRef(anger);
  useEffect(() => {
    const change = anger - previous.current;
    previous.current = anger;
    if (change >= 8) jolt.current = 1;
    else if (change <= -8) jolt.current = -0.6;
  }, [anger]);

  useEffect(() => {
    let frame = 0;
    let smooth = 0;
    let open = false;
    let heldUntil = 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const loop = (now: number) => {
      const level = speaking ? (levelRef.current ?? 0) : 0;
      smooth += (level - smooth) * (level > smooth ? 0.5 : 0.18);
      jolt.current *= 0.93;

      if (push.current && !still) {
        const scale = 1 + smooth * 0.014 + jolt.current * 0.035;
        push.current.style.transform = `scale(${scale.toFixed(4)}) translate3d(0, ${(-smooth * 0.35).toFixed(3)}%, 0)`;
      }
      if (flash.current) flash.current.style.opacity = String(Math.max(0, jolt.current) * 0.32);

      // Mouth flap: open on loud syllables, held briefly so it never flickers.
      if (talk.current) {
        const wantOpen = level > 0.34;
        if (wantOpen !== open && now >= heldUntil) {
          open = wantOpen;
          heldUntil = now + 70;
          talk.current.style.opacity = open ? "1" : "0";
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [levelRef, speaking, mood]);

  const talkFrame = art.talk[mood];

  return (
    <div className={cn("relative overflow-hidden bg-stage", className)}>
      <div className="animate-stage-drift absolute inset-0 will-change-transform">
        <div ref={push} className="absolute inset-0 will-change-transform">
          {MOODS.map((m) => (
            <img
              key={m}
              src={art.frames[m]}
              alt={m === mood ? "매장 카운터 앞에 선 연습 상대 고객" : ""}
              aria-hidden={m !== mood}
              draggable={false}
              className={cn(
                "absolute inset-0 h-full w-full object-cover object-[50%_22%]",
                "transition-opacity ease-out",
                m === mood ? "opacity-100 duration-700" : "opacity-0 duration-300",
              )}
            />
          ))}
          {talkFrame && (
            <img
              ref={talk}
              key={talkFrame}
              src={talkFrame}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-[50%_22%] opacity-0"
            />
          )}
        </div>
      </div>
      {/* a warm flush over the frame the instant the customer flares up */}
      <div
        ref={flash}
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-mood-angry opacity-0 mix-blend-soft-light"
      />
      {children}
    </div>
  );
}
