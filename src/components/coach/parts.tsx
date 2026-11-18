import { useEffect, useRef, type RefObject } from "react";
import { Check, Loader2, Mic, Square, WifiOff } from "lucide-react";

import {
  CALM_STEPS,
  MOOD_LABEL,
  moodFromAnger,
  type CalmSignals,
  type CalmStep,
  type Mood,
} from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

const moodFill: Record<Mood, string> = {
  angry: "bg-mood-angry",
  softening: "bg-mood-softening",
  calm: "bg-mood-calm",
};

/**
 * The customer's emotion temperature. The bar fills from the left and changes colour
 * as it crosses into "softening" and "calm", so progress reads at a glance.
 */
export function AngerGauge({
  anger,
  tone = "paper",
  className,
}: {
  anger: number;
  /** "stage" is for text laid over the dark 3D counter. */
  tone?: "paper" | "stage";
  className?: string;
}) {
  const mood = moodFromAnger(anger);
  const onStage = tone === "stage";
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "text-[0.7rem] font-medium tracking-[0.2em]",
            onStage ? "text-gold-soft" : "text-gold",
          )}
        >
          감정 온도
        </p>
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            onStage ? "text-stage-foreground" : "text-foreground",
          )}
          aria-live="polite"
        >
          <span className={cn("size-2 rounded-full", moodFill[mood])} />
          {MOOD_LABEL[mood]}
        </p>
      </div>
      <div
        role="meter"
        aria-label="고객의 감정 온도"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={anger}
        className={cn(
          "relative mt-2 h-2 overflow-hidden rounded-full",
          onStage ? "bg-stage-foreground/20" : "bg-muted",
        )}
      >
        <div
          className={cn(
            "h-full w-full origin-left rounded-full transition-transform duration-700 ease-out",
            moodFill[mood],
          )}
          style={{ transform: `scaleX(${Math.max(0.03, anger / 100)})` }}
        />
        {/* thresholds: below 34 is calm, below 62 is softening */}
        {[34, 62].map((mark) => (
          <span
            key={mark}
            className={cn("absolute top-0 h-full w-px", onStage ? "bg-stage/70" : "bg-background")}
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** C · A · L · M progress for the round: a step lights up once the staff has used it. */
export function CalmChips({
  covered,
  next,
  className,
}: {
  covered: CalmSignals;
  /** The step to try next, outlined as a nudge (entry level only). */
  next?: CalmStep | null | undefined;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-4 gap-2", className)} aria-label="응대 4단계 진행">
      {CALM_STEPS.map((step) => {
        const done = covered[step.id];
        return (
          <li
            key={step.id}
            className={cn(
              "relative flex flex-col gap-1 rounded-sm border px-2 py-2",
              done
                ? "animate-step-pop border-primary bg-primary text-primary-foreground"
                : "border-gold-soft bg-card text-muted-foreground",
              !done && next === step.id && "border-gold text-foreground",
            )}
          >
            <span
              className={cn(
                "font-serif text-lg font-extrabold leading-none",
                done ? "text-gold-soft" : "text-gold",
              )}
            >
              {step.letter}
            </span>
            <span className="whitespace-nowrap text-xs font-medium">{step.name}</span>
            {done && <Check className="absolute right-2 top-2 size-3" aria-label="했어요" />}
          </li>
        );
      })}
    </ul>
  );
}

/** Total score as a ring: the number is the hero, the arc is the context. */
export function ScoreRing({ score, className }: { score: number; className?: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, score));
  return (
    <div className={cn("relative size-36", className)}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--gold-soft)" strokeWidth="5" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[2.6rem] font-extrabold leading-none text-primary">
          {value}
        </span>
        <span className="mt-1 text-xs tracking-[0.2em] text-gold">100점 만점</span>
      </div>
    </div>
  );
}

/** How the customer's temperature moved over the round, one point per customer line. */
export function EmotionChart({ trail, className }: { trail: number[]; className?: string }) {
  const width = 320;
  const height = 120;
  const padX = 16;
  const top = 12;
  const bottom = 100;
  const points = trail.length > 1 ? trail : [trail[0] ?? 50, trail[0] ?? 50];
  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) => bottom - (v / 100) * (bottom - top);
  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const first = points[0] ?? 50;
  const last = points[points.length - 1] ?? 50;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`고객의 감정 온도가 ${first}에서 ${last}로 바뀌었어요`}
      className={cn("block w-full", className)}
    >
      {/* mood bands, top to bottom: angry, softening, calm */}
      <rect
        x="0"
        y={top}
        width={width}
        height={y(62) - top}
        fill="var(--mood-angry)"
        opacity="0.07"
      />
      <rect
        x="0"
        y={y(62)}
        width={width}
        height={y(34) - y(62)}
        fill="var(--mood-softening)"
        opacity="0.09"
      />
      <rect
        x="0"
        y={y(34)}
        width={width}
        height={bottom - y(34)}
        fill="var(--mood-calm)"
        opacity="0.09"
      />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === points.length - 1 ? 5.5 : 4.5}
          fill="var(--primary)"
          stroke="var(--card)"
          strokeWidth="2"
        />
      ))}
      <text x={padX} y={height - 4} fontSize="10" fill="var(--muted-foreground)">
        첫마디
      </text>
      <text
        x={width - padX}
        y={height - 4}
        fontSize="10"
        textAnchor="end"
        fill="var(--muted-foreground)"
      >
        마지막
      </text>
    </svg>
  );
}

/** Shown when the built-in rule-based engine has taken over from the AI gateway. */
export function EngineBadge({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-gold-soft bg-card px-2 py-1 text-[0.7rem] text-muted-foreground",
        className,
      )}
      title="AI 연결이 어려워 내장된 연습 엔진으로 이어 가고 있어요."
    >
      <WifiOff className="size-3" />
      간이 엔진으로 연습 중
    </p>
  );
}

/** Push-to-talk button. The halo follows the microphone level while listening. */
export function MicButton({
  status,
  levelRef,
  disabled,
  onPress,
  className,
}: {
  status: "idle" | "listening" | "transcribing";
  levelRef: RefObject<number>;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
}) {
  const halo = useRef<HTMLSpanElement>(null);
  const listening = status === "listening";

  useEffect(() => {
    if (!listening) return;
    let frame = 0;
    let smooth = 0;
    const loop = () => {
      smooth += ((levelRef.current ?? 0) - smooth) * 0.25;
      // The live recogniser reports 1 on every result and nothing in between: let it decay.
      levelRef.current = Math.max(0, (levelRef.current ?? 0) - 0.04);
      if (halo.current) {
        halo.current.style.transform = `scale(${1 + smooth * 0.45})`;
        halo.current.style.opacity = String(0.25 + smooth * 0.45);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [levelRef, listening]);

  const label =
    status === "listening"
      ? "말하기 끝내기"
      : status === "transcribing"
        ? "말을 글로 바꾸는 중"
        : "눌러서 말하기";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || status === "transcribing"}
      aria-label={label}
      aria-pressed={listening}
      className={cn(
        "group relative flex size-20 shrink-0 items-center justify-center rounded-full outline-none",
        "transition-transform duration-200 ease-out active:scale-95 disabled:opacity-45",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        className,
      )}
    >
      {listening && (
        <>
          <span className="animate-mic-ring absolute inset-0 rounded-full border border-mood-angry" />
          <span ref={halo} className="absolute inset-0 rounded-full bg-mood-angry/40" />
        </>
      )}
      <span
        className={cn(
          "relative flex size-16 items-center justify-center rounded-full border shadow-soft",
          "transition-transform duration-200 ease-out group-hover:scale-105 group-disabled:scale-100",
          listening
            ? "border-mood-angry bg-mood-angry text-primary-foreground"
            : "border-gold/70 bg-primary text-primary-foreground",
        )}
      >
        {status === "transcribing" ? (
          <Loader2 className="size-6 animate-spin" />
        ) : listening ? (
          <Square className="size-5 fill-current" />
        ) : (
          <Mic className="size-7" />
        )}
      </span>
    </button>
  );
}
