import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Keyboard, Mic } from "lucide-react";

import { CustomerAvatar } from "@/components/stage/CustomerAvatar";
import { Button } from "@/components/ui/button";
import type { PracticeSetup } from "@/hooks/use-practice-session";
import {
  DIFFICULTIES,
  DIFFICULTY_IDS,
  SCENARIOS,
  type Difficulty,
  type PracticeMode,
  type ScenarioId,
} from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

const MODES: { id: PracticeMode; label: string; desc: string; icon: typeof Mic }[] = [
  { id: "stage", label: "마주 보고 말하기", desc: "손님을 보며 목소리로 답해요", icon: Mic },
  { id: "chat", label: "글로 답하기", desc: "조용한 곳이 아닐 때", icon: Keyboard },
];

const segment =
  "rounded-sm border px-3 py-3 text-left outline-none transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]";

export function SelectScreen({
  initial,
  best,
  onBack,
  onChoose,
}: {
  initial?: PracticeSetup | undefined;
  /** Best score so far per scenario, from this device's record. */
  best: Partial<Record<ScenarioId, number>>;
  onBack: () => void;
  onChoose: (setup: PracticeSetup) => void;
}) {
  const [picked, setPicked] = useState<ScenarioId | undefined>(initial?.scenarioId);
  const [mode, setMode] = useState<PracticeMode>(initial?.mode ?? "stage");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "normal");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-28 pt-5 lg:max-w-6xl lg:px-12 lg:pb-12">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
      >
        <ArrowLeft className="size-4" />
        처음으로
      </button>

      <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-12">
        <div>
          <div className="mt-4">
            <p className="eyebrow">1단계</p>
            <h2 className="mt-2 text-[1.75rem] font-extrabold leading-snug text-primary lg:text-[2.4rem]">
              어떤 상황을 연습할까요?
            </h2>
            <p className="mt-2 text-muted-foreground">카드 한 장을 눌러 골라 주세요.</p>
          </div>

          <ul
            className="mt-6 grid gap-3 lg:grid-cols-2 lg:gap-4"
            role="radiogroup"
            aria-label="연습 상황"
          >
            {SCENARIOS.map((s, i) => {
              const active = picked === s.id;
              const score = best[s.id];
              return (
                <li key={s.id} className="animate-rise" style={{ animationDelay: `${i * 45}ms` }}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPicked(s.id)}
                    className={cn(
                      "group relative grid h-full w-full grid-cols-[1fr_auto] gap-x-4 rounded-md border p-4 text-left shadow-soft outline-none",
                      "transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0",
                      active
                        ? "border-gold bg-primary text-primary-foreground"
                        : "gold-frame border-gold-soft bg-card",
                    )}
                  >
                    <span>
                      <span
                        className={cn(
                          "font-serif text-xs tracking-widest",
                          active ? "text-gold-soft" : "text-gold",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")} · {s.place}
                      </span>
                      <span className="mt-2 block font-serif text-xl font-bold">{s.tag}</span>
                      <span
                        className={cn(
                          "mt-1 block text-sm leading-relaxed",
                          active ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      {score !== undefined && (
                        <span
                          className={cn(
                            "mt-2 inline-block text-xs",
                            active ? "text-gold-soft" : "text-gold",
                          )}
                        >
                          최고 {score}점
                        </span>
                      )}
                    </span>
                    <span className="relative self-start">
                      <CustomerAvatar
                        scenario={s}
                        anger={active ? 80 : 60}
                        className={cn(
                          "size-14 rounded-full border",
                          active
                            ? "border-gold-soft bg-primary-foreground/10"
                            : "border-gold-soft bg-background",
                        )}
                      />
                      {active && (
                        <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-gold-soft text-primary">
                          <Check className="size-4" />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* how to practise: sticks beside the cards on wide screens */}
        <aside className="mt-10 lg:sticky lg:top-8 lg:mt-16 lg:self-start">
          <p className="eyebrow">2단계</p>
          <h2 className="mt-2 text-xl font-bold text-primary">어떻게 연습할까요?</h2>

          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="연습 방식">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    segment,
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-gold-soft bg-card",
                  )}
                >
                  <m.icon className={cn("size-5", active ? "text-gold-soft" : "text-gold")} />
                  <span className="mt-2 block text-[0.95rem] font-semibold">{m.label}</span>
                  <span
                    className={cn(
                      "mt-1 block text-xs leading-relaxed",
                      active ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {m.desc}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="난이도">
            {DIFFICULTY_IDS.map((id) => {
              const active = difficulty === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDifficulty(id)}
                  className={cn(
                    segment,
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-gold-soft bg-card",
                  )}
                >
                  <span className="block text-[0.95rem] font-semibold">
                    {DIFFICULTIES[id].label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-xs leading-relaxed",
                      active ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {DIFFICULTIES[id].desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* On a phone the button stays pinned, so the choice can be confirmed from any card. */}
          <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md border-t border-gold-soft bg-background/95 px-6 pt-3 safe-bottom lg:static lg:mx-0 lg:mt-8 lg:max-w-none lg:border-0 lg:bg-transparent lg:p-0">
            <Button
              variant="lux"
              size="xl"
              disabled={!picked}
              onClick={() => picked && onChoose({ scenarioId: picked, mode, difficulty })}
            >
              {picked ? "이 상황 준비하기" : "상황을 먼저 골라 주세요"}
              {picked && <ArrowRight />}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
