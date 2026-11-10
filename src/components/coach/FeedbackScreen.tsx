import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, LayoutGrid, PenLine, Quote, RotateCcw } from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { getFeedback } from "@/lib/roleplay.functions";
import type { ChatTurn, Scenario } from "@/lib/roleplay-rules";

type Feedback = { good: [string, string]; improve: string; nextLine: string };

export function FeedbackScreen({
  scenario,
  turns,
  onRetrySame,
  onPickAnother,
  onHome,
}: {
  scenario: Scenario;
  turns: ChatTurn[];
  onRetrySame: () => void;
  onPickAnother: () => void;
  onHome: () => void;
}) {
  const fetchFeedback = useServerFn(getFeedback);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFeedback({ data: { scenarioId: scenario.id, turns } });
      if (res.ok) setFeedback(res.feedback);
      else setError(res.error);
    } catch {
      setError("연결이 불안정해요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [fetchFeedback, scenario.id, turns]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-8 safe-bottom">
      <div className="text-center">
        <p className="eyebrow">3단계 · {scenario.tag}</p>
        <h2 className="mt-3 text-[1.65rem] font-bold text-primary">오늘의 피드백</h2>
        <div className="gold-rule mx-auto mt-5 w-28" />
      </div>

      <div className="mt-8 flex-1 space-y-4">
        {loading && (
          <div className="paper-card p-6 text-center">
            <Shimmer className="text-base">코치가 대화를 읽고 있어요…</Shimmer>
          </div>
        )}

        {error && !loading && (
          <div className="paper-card space-y-3 p-5" role="alert">
            <p className="text-destructive">{error}</p>
            <Button variant="quiet" className="h-12 w-full" onClick={() => void load()}>
              <RotateCcw />
              다시 시도
            </Button>
          </div>
        )}

        {feedback && (
          <>
            {feedback.good.map((g, i) => (
              <section
                key={i}
                className="paper-card animate-rise p-5"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <h3 className="flex items-center gap-2 text-base font-bold text-primary">
                  <span className="flex size-7 items-center justify-center rounded-full bg-mood-calm text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                  잘한 점 {i + 1}
                </h3>
                <p className="mt-3 leading-relaxed">{g}</p>
              </section>
            ))}

            <section className="paper-card animate-rise p-5 [animation-delay:180ms]">
              <h3 className="flex items-center gap-2 text-base font-bold text-primary">
                <span className="flex size-7 items-center justify-center rounded-full bg-mood-softening text-primary-foreground">
                  <PenLine className="size-4" />
                </span>
                고칠 점
              </h3>
              <p className="mt-3 leading-relaxed">{feedback.improve}</p>
            </section>

            <section className="animate-rise rounded-md border border-gold bg-primary p-6 text-primary-foreground shadow-soft gold-frame [animation-delay:270ms]">
              <p className="flex items-center gap-2 text-sm text-gold-soft">
                <Quote className="size-4" />
                다음에 쓸 한 문장
              </p>
              <p className="mt-3 font-serif text-xl font-bold leading-relaxed">
                “{feedback.nextLine}”
              </p>
            </section>
          </>
        )}
      </div>

      <div className="space-y-3 pt-8">
        <Button variant="lux" size="xl" onClick={onRetrySame} disabled={loading}>
          <RotateCcw />
          같은 상황 다시 하기
        </Button>
        <Button variant="quiet" size="xl" onClick={onPickAnother} disabled={loading}>
          <LayoutGrid />
          다른 상황 고르기
        </Button>
        <button
          type="button"
          onClick={onHome}
          className="h-11 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          처음 화면으로
        </button>
      </div>
    </div>
  );
}
