import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Download, FlaskConical } from "lucide-react";

import { BarCell, TrendChart } from "@/components/hrd/charts";
import { Button } from "@/components/ui/button";
import { HRD_SAMPLE, hrdCsv, hrdTotals } from "@/lib/hrd-sample";
import { summarize, useRecords } from "@/lib/practice-store";
import {
  CALM_ORDER,
  SCORE_KEYS,
  SCORE_LABEL,
  getCalmStep,
  getScenario,
} from "@/lib/roleplay-rules";
import { cn } from "@/lib/utils";

const TITLE = "응대 리허설 · 교육 담당자 화면";

export const Route = createFileRoute("/hrd")({
  head: () => ({
    meta: [
      { title: TITLE },
      {
        name: "description",
        content:
          "응대 리허설 연습 결과를 점포·직군·상황별로 보고 다음 교육을 정하는 화면 (예시 데이터)",
      },
      { property: "og:title", content: TITLE },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const data = HRD_SAMPLE;
  const totals = useMemo(() => hrdTotals(data), [data]);
  const { records } = useRecords();
  const mine = useMemo(() => summarize(records), [records]);

  const weakestStep = [...CALM_ORDER].sort((a, b) => data.steps[a] - data.steps[b])[0] ?? "lead";
  const hardest = [...data.scenarios].sort((a, b) => a.average - b.average);
  const hardestScenario = hardest[0];
  const quietStore = [...data.stores].sort((a, b) => a.active / a.staff - b.active / b.staff)[0];
  const step = getCalmStep(weakestStep);

  const download = () => {
    const csv = hrdCsv(data, (id) => getScenario(id).tag);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "응대리허설_운영현황_예시.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="-ml-2 flex h-11 items-center gap-1 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
        >
          <ArrowLeft className="size-4" />
          연습 화면으로
        </Link>
        <Button variant="quiet" className="h-11" onClick={download}>
          <Download />
          표로 내려받기 (CSV)
        </Button>
      </div>

      <header className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">교육 담당자 화면</p>
          <h1 className="mt-3 text-[2.2rem] font-extrabold leading-[1.15] text-primary lg:text-[3.4rem]">
            누가 얼마나 연습했고,
            <br />
            어디서 막히는지
          </h1>
        </div>
        <p className="flex gap-3 rounded-md border border-gold bg-card p-4 text-sm leading-relaxed">
          <FlaskConical className="mt-1 size-4 shrink-0 text-gold" />
          <span>
            <strong className="font-semibold text-primary">예시 데이터입니다.</strong> 이 앱은
            서버에 아무것도 저장하지 않아요. 아래 숫자는 사내 계정과 연결했을 때 보게 될 화면을
            설명하려고 만든 값이에요. ({data.period})
          </span>
        </p>
      </header>

      {/* ---------- headline numbers: one leads, three support ---------- */}
      <section className="mt-10 grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]" aria-label="핵심 지표">
        <div className="rounded-md border border-gold bg-primary p-6 text-primary-foreground shadow-soft gold-frame">
          <p className="text-sm text-gold-soft">최근 주 평균 점수</p>
          <p className="mt-2 font-serif text-[4.5rem] font-extrabold leading-none">
            {totals.average}
          </p>
          <p className="mt-3 text-sm text-primary-foreground/85">
            8주 전보다{" "}
            <strong className="font-semibold text-gold-soft">+{totals.averageGain}점</strong>
          </p>
        </div>
        <Stat
          label="참여 인원"
          value={`${totals.active}명`}
          note={`대상 ${totals.staff}명 중 ${totals.participation}%`}
        />
        <Stat
          label="1인당 연습"
          value={`${totals.perPerson}회`}
          note={`8주 동안 모두 ${totals.sessions.toLocaleString("ko-KR")}회`}
        />
        <Stat
          label="다시 했을 때"
          value={`+${data.retryGain}점`}
          note="같은 상황 첫 시도 대비 평균"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="평균 점수는 8주 동안 꾸준히 올랐어요" caption="주차별 평균 점수 (100점 만점)">
          <TrendChart
            name="주차별 평균 점수"
            unit="점"
            ticks={[50, 60, 70, 80]}
            points={data.weeks.map((w) => ({ label: w.week, value: w.average }))}
          />
        </Panel>
        <Panel title="참여율은 4명 중 3명까지 늘었어요" caption="주차별 참여율 (대상 인원 대비 %)">
          <TrendChart
            name="주차별 참여율"
            unit="%"
            ticks={[0, 25, 50, 75, 100]}
            points={data.weeks.map((w) => ({ label: w.week, value: w.participation }))}
          />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <Panel
          title={`가장 약한 단계는 ${step.letter} · ${step.name}`}
          caption="응대 4단계와 말투, 각 5점 만점 평균"
        >
          <ul className="space-y-4">
            {SCORE_KEYS.map((key) => (
              <li key={key} className="grid grid-cols-[5rem_1fr] items-center gap-3">
                <span
                  className={cn("text-sm", key === weakestStep && "font-semibold text-primary")}
                >
                  {SCORE_LABEL[key]}
                </span>
                <BarCell
                  value={data.steps[key]}
                  max={5}
                  label={data.steps[key].toFixed(1)}
                  emphasis={key === weakestStep}
                />
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-sm bg-background px-3 py-2 text-sm leading-relaxed">
            {step.desc} 이 단계의 모범 문장을 다음 조회 때 함께 읽어 보면 좋아요.
          </p>
        </Panel>

        <Panel title="어려워하는 상황부터 보기" caption="상황별 연습 수와 평균 점수, 낮은 순">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-gold-soft">
                  <th className="pb-2 font-medium">상황</th>
                  <th className="pb-2 text-right font-medium">연습</th>
                  <th className="pb-2 pl-4 font-medium">평균 점수</th>
                  <th className="pb-2 text-right font-medium">감정 하락</th>
                  <th className="pb-2 pl-4 font-medium">약한 단계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-soft/60">
                {hardest.map((row, i) => (
                  <tr key={row.id}>
                    <td className={cn("py-3 pr-2", i === 0 && "font-semibold text-primary")}>
                      {getScenario(row.id).tag}
                    </td>
                    <td className="py-3 text-right tabular-nums">{row.sessions}</td>
                    <td className="w-44 py-3 pl-4">
                      <BarCell
                        value={row.average}
                        max={100}
                        label={`${row.average}점`}
                        emphasis={i === 0}
                      />
                    </td>
                    <td className="py-3 text-right tabular-nums">−{row.cooling}</td>
                    <td className="py-3 pl-4 text-muted-foreground">
                      {getCalmStep(row.weakest).name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="점포별 참여와 점수" caption="참여율은 대상 인원 대비">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-gold-soft">
                <th className="pb-2 font-medium">점포</th>
                <th className="pb-2 pl-4 font-medium">참여율</th>
                <th className="pb-2 text-right font-medium">평균</th>
                <th className="pb-2 text-right font-medium">재도전</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold-soft/60">
              {data.stores.map((row) => {
                const rate = Math.round((row.active / row.staff) * 100);
                const low = row.store === quietStore?.store;
                return (
                  <tr key={row.store}>
                    <td className={cn("py-3", low && "font-semibold text-primary")}>{row.store}</td>
                    <td className="w-48 py-3 pl-4">
                      <BarCell value={rate} max={100} label={`${rate}%`} emphasis={low} />
                    </td>
                    <td className="py-3 text-right tabular-nums">{row.average}점</td>
                    <td className="py-3 text-right tabular-nums">+{row.retryGain}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="직군별로 보면" caption="신입·직영·협력사원이 같은 도구로 연습해요">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-gold-soft">
                <th className="pb-2 font-medium">직군</th>
                <th className="pb-2 pl-4 font-medium">참여율</th>
                <th className="pb-2 text-right font-medium">평균</th>
                <th className="pb-2 text-right font-medium">1인당</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold-soft/60">
              {data.roles.map((row) => {
                const rate = Math.round((row.active / row.staff) * 100);
                return (
                  <tr key={row.role}>
                    <td className="py-3">{row.role}</td>
                    <td className="w-40 py-3 pl-4">
                      <BarCell value={rate} max={100} label={`${rate}%`} />
                    </td>
                    <td className="py-3 text-right tabular-nums">{row.average}점</td>
                    <td className="py-3 text-right tabular-nums">{row.perPerson}회</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-md border border-gold bg-primary p-6 text-primary-foreground shadow-soft gold-frame">
          <p className="text-sm text-gold-soft">이번 주에 해 볼 일</p>
          <ol className="mt-4 space-y-4">
            <Action n={1}>
              <strong className="font-semibold">{step.name}</strong> 단계 평균이{" "}
              {data.steps[weakestStep].toFixed(1)}점으로 가장 낮아요. 파트 조회 때 “안 됩니다” 대신
              쓸 문장을 10분 함께 연습해요.
            </Action>
            {hardestScenario && (
              <Action n={2}>
                <strong className="font-semibold">{getScenario(hardestScenario.id).tag}</strong>{" "}
                상황 평균이 {hardestScenario.average}점이에요. 책임자에게 넘기는 기준을 다시
                안내하고 이 상황을 주간 과제로 정해요.
              </Action>
            )}
            {quietStore && (
              <Action n={3}>
                <strong className="font-semibold">{quietStore.store}</strong> 참여율이{" "}
                {Math.round((quietStore.active / quietStore.staff) * 100)}%로 가장 낮아요. 오픈 전
                3분 연습 시간을 점포와 상의해요.
              </Action>
            )}
          </ol>
        </div>

        <Panel
          title="이 기기에서 실제로 연습한 기록"
          caption="예시가 아닌, 지금 이 브라우저에 남은 값"
        >
          {mine.count === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              아직 없어요. 연습을 한 번 마치면 점수가 여기에 나타나요. 실제 운영에서는 이 값이 모여
              위 화면이 돼요.
            </p>
          ) : (
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">평균</dt>
                <dd className="font-serif text-3xl font-extrabold text-primary">{mine.average}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">연습</dt>
                <dd className="font-serif text-3xl font-extrabold text-primary">{mine.count}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">감정 하락</dt>
                <dd className="font-serif text-3xl font-extrabold text-primary">
                  −{mine.averageCooling}
                </dd>
              </div>
            </dl>
          )}
        </Panel>
      </section>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="paper-card flex flex-col justify-end p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-[2rem] font-extrabold leading-none text-primary">
        {value}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="paper-card p-6">
      <h2 className="text-lg font-bold leading-snug text-primary">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Action({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-2 leading-relaxed">
      <span className="font-serif text-2xl font-extrabold leading-none text-gold-soft">{n}</span>
      <span className="text-[0.95rem] text-primary-foreground/90">{children}</span>
    </li>
  );
}
