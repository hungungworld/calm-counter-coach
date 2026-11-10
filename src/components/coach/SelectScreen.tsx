import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SCENARIOS, type ScenarioId } from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

export function SelectScreen({
  initial,
  onBack,
  onChoose,
}: {
  initial?: ScenarioId | undefined;
  onBack: () => void;
  onChoose: (id: ScenarioId) => void;
}) {
  const [picked, setPicked] = useState<ScenarioId | undefined>(initial);

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-5 safe-bottom">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        처음으로
      </button>

      <div className="mt-4">
        <p className="eyebrow">1단계</p>
        <h2 className="mt-2 text-[1.65rem] font-bold leading-snug text-primary">
          어떤 상황을 연습할까요?
        </h2>
        <p className="mt-2 text-muted-foreground">카드 한 장을 눌러 골라 주세요.</p>
      </div>

      <ul className="mt-7 space-y-4" role="radiogroup" aria-label="연습 상황">
        {SCENARIOS.map((s, i) => {
          const active = picked === s.id;
          return (
            <li key={s.id} className="animate-rise" style={{ animationDelay: `${i * 70}ms` }}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPicked(s.id)}
                className={cn(
                  "relative w-full rounded-md border p-5 text-left shadow-soft transition-colors",
                  active
                    ? "border-gold bg-primary text-primary-foreground"
                    : "gold-frame border-gold-soft bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-serif text-sm tracking-widest",
                      active ? "text-gold-soft" : "text-gold",
                    )}
                  >
                    0{i + 1} · {s.place}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border",
                      active ? "border-gold-soft bg-gold-soft text-primary" : "border-gold-soft",
                    )}
                  >
                    {active && <Check className="size-4" />}
                  </span>
                </div>
                <p className="mt-3 font-serif text-xl font-bold">{s.tag}</p>
                <p
                  className={cn(
                    "mt-1 text-[0.95rem] leading-relaxed",
                    active ? "text-primary-foreground/85" : "text-muted-foreground",
                  )}
                >
                  {s.title}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-8">
        <Button
          variant="lux"
          size="xl"
          disabled={!picked}
          onClick={() => picked && onChoose(picked)}
        >
          {picked ? "이 상황으로 대화 시작" : "상황을 먼저 골라 주세요"}
          {picked && <ArrowRight />}
        </Button>
      </div>
    </div>
  );
}
