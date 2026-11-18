import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, LineChart } from "lucide-react";

import heroImg from "@/assets/concierge-desk.jpg";
import { Button } from "@/components/ui/button";
import { Lines } from "@/components/ui/lines";
import type { PracticeSummary } from "@/lib/practice-store";

export function StartScreen({
  summary,
  onStart,
  onGuide,
  onRecords,
}: {
  /** Null until this device's record has been read (and when it is empty). */
  summary: PracticeSummary | null;
  onStart: () => void;
  onGuide: () => void;
  onRecords: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-10 safe-bottom lg:max-w-6xl lg:flex-row lg:items-center lg:gap-16 lg:px-12 lg:pt-0">
      {/* On wide screens the illustration leads and the words sit off-centre beside it. */}
      <div className="animate-rise overflow-hidden rounded-md border border-gold-soft shadow-soft [animation-delay:80ms] max-lg:order-2 max-lg:mt-8 lg:w-[56%] lg:shrink-0">
        <img
          src={heroImg}
          alt="금색 선으로 그린 백화점 안내데스크"
          width={1024}
          height={768}
          className="block aspect-[4/3] w-full object-cover lg:aspect-[5/4]"
        />
      </div>

      <div className="flex flex-1 flex-col max-lg:contents">
        <div className="animate-rise max-lg:order-1 max-lg:text-center">
          <p className="eyebrow">현장 직원 연습실</p>
          <h1 className="mt-4 text-[2.4rem] font-extrabold leading-[1.1] text-primary lg:text-[4.5rem]">
            응대 리허설
          </h1>
          <div className="gold-rule mt-6 w-32 max-lg:mx-auto lg:w-48" />
        </div>

        <div className="animate-rise mt-8 space-y-3 [animation-delay:160ms] max-lg:order-3 max-lg:text-center">
          <p className="font-serif text-xl font-bold leading-snug text-foreground lg:text-2xl">
            화난 고객, 미리 만나 보세요
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            <Lines text="AI 고객이 카운터 앞에서 말을 걸어요. 3분 동안 답하고, 바로 피드백을 받아요." />
          </p>
        </div>

        {summary && summary.count > 0 && (
          <button
            type="button"
            onClick={onRecords}
            className="animate-rise group mt-8 grid grid-cols-[1.4fr_1fr_1fr] items-end gap-4 rounded-md border border-gold-soft bg-card p-4 text-left shadow-soft outline-none transition-transform duration-200 ease-out [animation-delay:220ms] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 max-lg:order-4"
          >
            <span>
              <span className="block text-xs text-muted-foreground">평균 점수</span>
              <span className="font-serif text-[2.2rem] font-extrabold leading-none text-primary">
                {summary.average}
              </span>
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">연습</span>
              <span className="font-serif text-xl font-bold text-foreground">
                {summary.count}회
              </span>
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">이어서</span>
              <span className="font-serif text-xl font-bold text-foreground">
                {summary.streak}일째
              </span>
            </span>
          </button>
        )}

        <div className="mt-auto pt-10 max-lg:order-5 lg:mt-10 lg:pt-0">
          <Button variant="lux" size="xl" onClick={onStart}>
            연습 시작하기
            <ArrowRight />
          </Button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="quiet" className="h-12" onClick={onGuide}>
              <BookOpen />
              응대 4단계 보기
            </Button>
            <Button variant="quiet" className="h-12" onClick={onRecords}>
              <LineChart />내 기록
            </Button>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground max-lg:text-center">
            연습용입니다. 실제 회사 규정은 확인 필요
            <br />
            <Link
              to="/hrd"
              className="whitespace-nowrap rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              교육 담당자 화면
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
