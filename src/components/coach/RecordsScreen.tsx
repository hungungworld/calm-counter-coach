import { useState } from "react";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Lines } from "@/components/ui/lines";
import type { PracticeRecord, PracticeSummary } from "@/lib/practice-store";
import {
  CALM_ORDER,
  DIFFICULTIES,
  SCORE_KEYS,
  SCORE_LABEL,
  getCalmStep,
  getScenario,
} from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

const dateText = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });

/** Score history kept on this device: how often, how well, and what to work on next. */
export function RecordsScreen({
  records,
  summary,
  onBack,
  onStart,
  onClear,
}: {
  records: PracticeRecord[];
  summary: PracticeSummary;
  onBack: () => void;
  onStart: () => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const recent = [...records].reverse().slice(0, 12);
  const trend = records.slice(-12).map((r) => r.total);
  const weakest = summary.weakest ? getCalmStep(summary.weakest) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-5 safe-bottom lg:max-w-5xl lg:px-12">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
      >
        <ArrowLeft className="size-4" />
        처음으로
      </button>

      <div className="mt-4">
        <p className="eyebrow">이 기기에만 남는 기록</p>
        <h2 className="mt-2 text-[2rem] font-extrabold leading-tight text-primary lg:text-[2.8rem]">
          내 기록
        </h2>
      </div>

      {summary.count === 0 ? (
        <div className="paper-card mt-8 p-6">
          <p className="font-serif text-xl font-bold text-primary">아직 연습한 기록이 없어요</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            연습을 한 번 마치면 점수와 응대 4단계별 평균이 여기에 쌓여요.
          </p>
          <Button variant="lux" size="xl" className="mt-6" onClick={onStart}>
            첫 연습 시작하기
            <ArrowRight />
          </Button>
        </div>
      ) : (
        <div className="mt-8 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-12">
          <div>
            {/* one number leads; the rest support it */}
            <div className="grid grid-cols-[1.3fr_1fr] items-end gap-4">
              <div>
                <p className="text-xs text-muted-foreground">평균 점수</p>
                <p className="font-serif text-[4.2rem] font-extrabold leading-none text-primary">
                  {summary.average}
                </p>
              </div>
              <dl className="space-y-2 pb-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">연습</dt>
                  <dd className="font-semibold">{summary.count}회</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">최고</dt>
                  <dd className="font-semibold">{summary.best}점</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">이어서</dt>
                  <dd className="font-semibold">{summary.streak}일째</dd>
                </div>
              </dl>
            </div>

            {trend.length > 1 && (
              <div className="mt-6" aria-label="최근 점수 흐름">
                <div className="flex h-16 items-end gap-1">
                  {trend.map((score, i) => (
                    <span
                      key={i}
                      title={`${score}점`}
                      className={cn(
                        "w-full origin-bottom rounded-t-sm",
                        i === trend.length - 1 ? "bg-primary" : "bg-gold-soft",
                      )}
                      style={{
                        height: "100%",
                        transform: `scaleY(${Math.max(0.06, score / 100)})`,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  최근 {trend.length}번의 점수
                  {summary.growth !== null &&
                    ` · 처음 세 번보다 ${summary.growth >= 0 ? "+" : ""}${summary.growth}점`}
                </p>
              </div>
            )}

            {weakest && (
              <section className="mt-6 rounded-md border border-gold bg-primary p-5 text-primary-foreground shadow-soft gold-frame">
                <p className="text-sm text-gold-soft">다음에 집중할 단계</p>
                <p className="mt-2 font-serif text-xl font-bold">
                  {weakest.letter} · {weakest.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-primary-foreground/85">
                  <Lines text={weakest.desc} />
                </p>
              </section>
            )}
          </div>

          <div className="mt-8 space-y-4 lg:mt-0">
            <section className="paper-card p-5">
              <h3 className="text-base font-bold text-primary">단계별 평균</h3>
              <ul className="mt-4 space-y-3">
                {SCORE_KEYS.map((key) => {
                  const value = summary.stepAverage[key];
                  const isWeakest = key === summary.weakest;
                  return (
                    <li key={key} className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-3">
                      <span className={cn("text-sm", isWeakest && "font-semibold text-primary")}>
                        {SCORE_LABEL[key]}
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full w-full origin-left rounded-full",
                            isWeakest ? "bg-mood-softening" : "bg-primary",
                          )}
                          style={{ transform: `scaleX(${value / 5})` }}
                        />
                      </span>
                      <span className="text-right font-serif text-base font-bold tabular-nums">
                        {value.toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {CALM_ORDER.length}단계와 말투를 각각 5점 만점으로 본 평균이에요.
              </p>
            </section>

            <section className="paper-card p-5">
              <h3 className="text-base font-bold text-primary">최근 연습</h3>
              <ul className="mt-3 divide-y divide-gold-soft/70">
                {recent.map((record) => {
                  const scenario = getScenario(record.scenarioId);
                  return (
                    <li
                      key={record.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{scenario.tag}</span>
                        <span className="text-xs text-muted-foreground">
                          {dateText.format(new Date(record.at))} ·{" "}
                          {DIFFICULTIES[record.difficulty].label} ·{" "}
                          {record.mode === "stage" ? "마주 보고" : "글로"} · 감정{" "}
                          {record.angerStart}→{record.angerEnd}
                        </span>
                      </span>
                      <span className="font-serif text-xl font-bold tabular-nums text-primary">
                        {record.total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button variant="lux" className="h-12 px-6 text-base" onClick={onStart}>
                연습하러 가기
                <ArrowRight />
              </Button>
              {confirming ? (
                <span className="flex items-center gap-2 text-sm">
                  정말 지울까요?
                  <Button
                    variant="destructive"
                    className="h-11"
                    onClick={() => {
                      onClear();
                      setConfirming(false);
                    }}
                  >
                    지우기
                  </Button>
                  <Button variant="quiet" className="h-11" onClick={() => setConfirming(false)}>
                    취소
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="flex h-11 items-center gap-2 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
                >
                  <Trash2 className="size-4" />
                  기록 지우기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
