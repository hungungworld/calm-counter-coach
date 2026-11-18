import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  Heart,
  LayoutGrid,
  PenLine,
  Quote,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { EmotionChart, EngineBadge, ScoreRing } from "@/components/coach/parts";
import { Button } from "@/components/ui/button";
import type { PracticeSetup, SessionResult } from "@/hooks/use-practice-session";
import { addRecord } from "@/lib/practice-store";
import { getFeedback, getModelCompare, type Engine } from "@/lib/roleplay.functions";
import {
  CALM_STEPS,
  SCORE_KEYS,
  SCORE_LABEL,
  gradeLabel,
  totalScore,
  type Feedback,
  type ModelCompare,
  type Scenario,
} from "@/lib/roleplay-rules";
import {
  PACE_TEXT,
  detectSignals,
  paceLabel,
  simulateCompare,
  simulateFeedback,
  syllablesPerMinute,
} from "@/lib/roleplay-sim";
import { cn } from "@/lib/utils";

const disclosure =
  "group paper-card [&_summary::-webkit-details-marker]:hidden [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:justify-between [&>summary]:gap-3 [&>summary]:p-5 [&>summary]:outline-none [&>summary]:focus-visible:ring-2 [&>summary]:focus-visible:ring-ring";

export function FeedbackScreen({
  scenario,
  setup,
  result,
  onRetrySame,
  onPickAnother,
  onHome,
}: {
  scenario: Scenario;
  setup: PracticeSetup;
  result: SessionResult;
  onRetrySame: () => void;
  onPickAnother: () => void;
  onHome: () => void;
}) {
  const fetchFeedback = useServerFn(getFeedback);
  const fetchCompare = useServerFn(getModelCompare);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [engine, setEngine] = useState<Engine>(result.engine);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<ModelCompare[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const started = useRef(false);
  const saved = useRef(false);

  const plain = useMemo(
    () => result.turns.map(({ role, text }) => ({ role, text })),
    [result.turns],
  );
  const request = useMemo(
    () => ({ scenarioId: scenario.id, difficulty: setup.difficulty, turns: plain }),
    [plain, scenario.id, setup.difficulty],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFeedback({ data: request });
      if (res.ok) {
        setFeedback(res.feedback);
        if (res.engine === "sim") setEngine("sim");
      } else {
        setError(res.error);
      }
    } catch {
      // Offline: the built-in coach still gives rubric-based feedback.
      setFeedback(simulateFeedback(scenario, plain));
      setEngine("sim");
    } finally {
      setLoading(false);
    }
  }, [fetchFeedback, plain, request, scenario]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  const total = feedback ? totalScore(feedback.scores) : 0;
  const angerStart = result.angerTrail[0] ?? 0;
  const angerEnd = result.angerTrail[result.angerTrail.length - 1] ?? angerStart;
  const staff = result.turns.filter((t) => t.role === "staff");

  // Only the scores are remembered on this device; the conversation is not.
  useEffect(() => {
    if (!feedback || saved.current) return;
    saved.current = true;
    addRecord({
      scenarioId: scenario.id,
      difficulty: setup.difficulty,
      mode: setup.mode,
      total: totalScore(feedback.scores),
      scores: feedback.scores,
      angerStart,
      angerEnd,
      replies: staff.length,
      seconds: result.seconds,
    });
  }, [angerEnd, angerStart, feedback, result.seconds, scenario.id, setup, staff.length]);

  const loadCompare = async () => {
    setComparing(true);
    try {
      const res = await fetchCompare({ data: request });
      setCompare(res.ok ? res.compare : simulateCompare(scenario, plain));
    } catch {
      setCompare(simulateCompare(scenario, plain));
    } finally {
      setComparing(false);
    }
  };

  /* How the answers were delivered, for rounds answered by voice. */
  const delivery = useMemo(() => {
    const voiced = staff.filter((t) => t.viaVoice && t.speakSeconds);
    const reactions = staff.flatMap((t) =>
      t.reactionSeconds === undefined ? [] : [t.reactionSeconds],
    );
    const detections = staff.map((t) => detectSignals(t.text, scenario.lang));
    const pace = voiced.length
      ? Math.round(
          voiced.reduce(
            (sum, t) => sum + syllablesPerMinute(t.text, t.speakSeconds ?? 0, scenario.lang),
            0,
          ) / voiced.length,
        )
      : null;
    return {
      pace,
      reaction: reactions.length
        ? Math.round((reactions.reduce((a, b) => a + b, 0) / reactions.length) * 10) / 10
        : null,
      cushions: detections.reduce((n, d) => n + d.cushions.length, 0),
      cautions: detections.flatMap((d) => d.cautions),
    };
  }, [scenario.lang, staff]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-6 pt-8 safe-bottom lg:max-w-6xl lg:px-12">
      <div className="lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-12">
        {/* ---------- verdict ---------- */}
        <div className="lg:sticky lg:top-8">
          <p className="eyebrow">3단계 · {scenario.tag}</p>
          <h2 className="mt-2 text-[2rem] font-extrabold leading-tight text-primary lg:text-[2.6rem]">
            오늘의 피드백
          </h2>
          <div className="gold-rule mt-5 w-28" />

          {loading && (
            <div className="paper-card mt-8 p-6 text-center">
              <Shimmer className="text-base">코치가 대화를 읽고 있어요…</Shimmer>
            </div>
          )}

          {error && !loading && (
            <div className="paper-card mt-8 space-y-3 p-5" role="alert">
              <p className="text-destructive">{error}</p>
              <Button variant="quiet" className="h-12 w-full" onClick={() => void load()}>
                <RotateCcw />
                다시 시도
              </Button>
            </div>
          )}

          {feedback && (
            <div className="animate-rise mt-8 grid grid-cols-[auto_1fr] items-center gap-5">
              <ScoreRing score={total} />
              <div>
                <p className="font-serif text-xl font-bold leading-snug text-primary">
                  {gradeLabel(total)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feedback.summary}
                </p>
                {engine === "sim" && <EngineBadge className="mt-3" />}
              </div>
            </div>
          )}

          <div className="mt-8 hidden space-y-3 lg:block">
            <Actions
              loading={loading}
              onRetrySame={onRetrySame}
              onPickAnother={onPickAnother}
              onHome={onHome}
            />
          </div>
        </div>

        {/* ---------- detail ---------- */}
        <div className="mt-8 space-y-4 lg:mt-0">
          {feedback && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {feedback.good.map((good, i) => (
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
                    <p className="mt-3 leading-relaxed">{good}</p>
                  </section>
                ))}
              </div>

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
                <p className="mt-3 font-serif text-xl font-bold leading-relaxed lg:text-2xl">
                  “{feedback.nextLine}”
                </p>
              </section>

              <section className="paper-card animate-rise p-5 [animation-delay:340ms]">
                <h3 className="text-base font-bold text-primary">응대 4단계와 말투</h3>
                <ul className="mt-4 space-y-4">
                  {SCORE_KEYS.map((key) => {
                    const score = feedback.scores[key];
                    return (
                      <li key={key} className="grid grid-cols-[5rem_1fr_auto] items-center gap-x-3">
                        <span className="text-sm font-medium">{SCORE_LABEL[key]}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full w-full origin-left rounded-full",
                              score >= 4
                                ? "bg-mood-calm"
                                : score >= 3
                                  ? "bg-mood-softening"
                                  : "bg-mood-angry",
                            )}
                            style={{ transform: `scaleX(${score / 5})` }}
                          />
                        </span>
                        <span className="font-serif text-lg font-bold tabular-nums text-primary">
                          {score}
                          <span className="text-xs font-normal text-muted-foreground">/5</span>
                        </span>
                        <span className="col-span-2 col-start-2 mt-1 text-xs leading-relaxed text-muted-foreground">
                          {feedback.notes[key]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <section className="paper-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-bold text-primary">손님의 감정 변화</h3>
              <p className="font-serif text-lg font-bold tabular-nums text-primary">
                {angerStart}
                <span className="mx-2 text-gold">→</span>
                {angerEnd}
              </p>
            </div>
            <EmotionChart trail={result.angerTrail} className="mt-3" />
            <p className="mt-3 rounded-sm bg-background px-3 py-2 text-sm leading-relaxed">
              <span className="mr-2 font-medium text-gold">손님의 속마음</span>
              {scenario.hiddenNeed}
            </p>
          </section>

          {delivery.pace !== null && (
            <section className="paper-card p-5">
              <h3 className="text-base font-bold text-primary">말하기 습관</h3>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <dt className="text-xs text-muted-foreground">말 속도</dt>
                  <dd className="mt-1 font-serif text-2xl font-bold text-primary">
                    {delivery.pace}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">음절/분</span>
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {PACE_TEXT[paceLabel(delivery.pace)]}
                  </dd>
                </div>
                {delivery.reaction !== null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">답을 시작하기까지</dt>
                    <dd className="mt-1 font-serif text-2xl font-bold text-primary">
                      {delivery.reaction}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">초</span>
                    </dd>
                    <dd className="text-xs text-muted-foreground">손님 말이 끝난 뒤 평균</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">부드러운 표현</dt>
                  <dd className="mt-1 font-serif text-2xl font-bold text-primary">
                    {delivery.cushions}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">번</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">주의할 표현</dt>
                  <dd className="mt-1 font-serif text-2xl font-bold text-primary">
                    {delivery.cautions.length}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">번</span>
                  </dd>
                  {delivery.cautions.length > 0 && (
                    <dd className="text-xs text-mood-angry">“{delivery.cautions[0]}”</dd>
                  )}
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                기기가 받아 적은 글로 잰 참고값이에요.
              </p>
            </section>
          )}

          <details className={disclosure}>
            <summary>
              <span className="text-base font-bold text-primary">대화 다시 보기</span>
              <ChevronDown className="size-5 text-gold transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <ol className="space-y-4 px-5 pb-5">
              {result.turns.map((turn, i) =>
                turn.role === "customer" ? (
                  <li key={i}>
                    <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold">손님</p>
                    <p className="mt-1 border-l-2 border-gold pl-3 leading-relaxed">{turn.text}</p>
                    {turn.thought && (
                      <p className="mt-1 pl-3 text-xs text-muted-foreground">
                        속마음 · {turn.thought}
                      </p>
                    )}
                  </li>
                ) : (
                  <li key={i} className="pl-6">
                    <p className="text-[0.7rem] font-medium tracking-[0.2em] text-gold">나</p>
                    <p className="mt-1 rounded-sm bg-primary px-3 py-2 leading-relaxed text-primary-foreground">
                      {turn.text}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-1">
                      {CALM_STEPS.filter((step) => turn.signals?.[step.id]).map((step) => (
                        <span
                          key={step.id}
                          className="rounded-sm border border-gold-soft px-2 py-0.5 text-xs text-primary"
                        >
                          {step.letter} {step.name}
                        </span>
                      ))}
                    </p>
                  </li>
                ),
              )}
            </ol>
          </details>

          <details className={disclosure}>
            <summary>
              <span className="text-base font-bold text-primary">모범 답안 보기</span>
              <ChevronDown className="size-5 text-gold transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-5">
              <p className="text-sm text-muted-foreground">
                교육 담당자가 다듬어 둔 문장이에요. 소리 내어 한 번 읽어 보세요.
              </p>
              <ol className="mt-4 space-y-3">
                {CALM_STEPS.map((step) => (
                  <li key={step.id} className="grid grid-cols-[2rem_1fr] gap-x-2">
                    <span className="font-serif text-2xl font-extrabold leading-none text-gold">
                      {step.letter}
                    </span>
                    <span>
                      <span className="block text-xs text-muted-foreground">{step.name}</span>
                      <span className="mt-0.5 block leading-relaxed">
                        {scenario.model[step.id]}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              {compare ? (
                <ul className="mt-6 space-y-4 border-t border-gold-soft pt-5">
                  {compare.map((item, i) => (
                    <li key={i} className="text-[0.95rem] leading-relaxed">
                      <p className="text-muted-foreground line-through decoration-gold/60">
                        {item.yours}
                      </p>
                      <p className="mt-1 font-medium text-primary">→ {item.better}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Button
                  variant="quiet"
                  className="mt-5 h-12 w-full"
                  disabled={comparing}
                  onClick={() => void loadCompare()}
                >
                  <Sparkles />
                  {comparing ? "비교하고 있어요…" : "내 답을 이렇게 바꿔 보기"}
                </Button>
              )}
            </div>
          </details>

          <p className="flex items-start gap-2 px-1 pt-2 text-sm leading-relaxed text-muted-foreground">
            <Heart className="mt-1 size-4 shrink-0 text-gold" />
            수고했어요. 연습 속 손님의 화는 연습실에 두고 가세요. 점수만 이 기기에 남고, 대화 내용은
            저장하지 않아요.
          </p>

          <div className="space-y-3 pb-2 pt-4 lg:hidden">
            <Actions
              loading={loading}
              onRetrySame={onRetrySame}
              onPickAnother={onPickAnother}
              onHome={onHome}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Actions({
  loading,
  onRetrySame,
  onPickAnother,
  onHome,
}: {
  loading: boolean;
  onRetrySame: () => void;
  onPickAnother: () => void;
  onHome: () => void;
}) {
  return (
    <>
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
        className="h-11 w-full rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        처음 화면으로
      </button>
    </>
  );
}
