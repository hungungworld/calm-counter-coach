import { ArrowLeft, ArrowRight, Headphones, Target } from "lucide-react";

import { CustomerAvatar } from "@/components/stage/CustomerAvatar";
import { Button } from "@/components/ui/button";
import { Lines } from "@/components/ui/lines";
import { primeAudio } from "@/hooks/use-customer-voice";
import type { PracticeSetup } from "@/hooks/use-practice-session";
import {
  DIFFICULTIES,
  MAX_STAFF_TURNS,
  MIN_STAFF_TURNS,
  getCalmStep,
  type Scenario,
} from "@/lib/roleplay-rules";

/** The briefing a team lead would give before sending someone out to the counter. */
export function BriefScreen({
  scenario,
  setup,
  onBack,
  onStart,
}: {
  scenario: Scenario;
  setup: PracticeSetup;
  onBack: () => void;
  onStart: () => void;
}) {
  const focus = getCalmStep(scenario.focus);
  const face = setup.mode === "stage";

  const begin = () => {
    // Sound may only start from a tap, so the voice is unlocked here, before the stage.
    if (face) primeAudio();
    onStart();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-5 safe-bottom lg:max-w-5xl lg:px-12">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-opacity duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"
      >
        <ArrowLeft className="size-4" />
        상황 다시 고르기
      </button>

      {/* header spans the full width so both columns below start on the same line */}
      <header className="animate-rise mt-4 grid grid-cols-[1fr_auto] gap-4 lg:gap-8">
        <div>
          <p className="eyebrow">
            브리핑 · {scenario.place} · {DIFFICULTIES[setup.difficulty].label}
          </p>
          <h2 className="mt-2 text-[2rem] font-extrabold leading-tight text-primary lg:text-[3rem]">
            {scenario.tag}
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed">
            <Lines text={scenario.persona} />
          </p>
        </div>
        <CustomerAvatar
          scenario={scenario}
          anger={DIFFICULTIES[setup.difficulty].startAnger}
          className="size-24 rounded-md border border-gold-soft bg-card lg:size-36"
        />
      </header>

      <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-2 lg:gap-6">
        <section className="animate-rise flex flex-col rounded-md border border-gold bg-primary p-6 text-primary-foreground shadow-soft gold-frame [animation-delay:120ms]">
          <p className="flex items-center gap-2 text-sm text-gold-soft">
            <Target className="size-4" />
            이번 연습의 목표
          </p>
          <p className="mt-3 font-serif text-xl font-bold leading-snug lg:text-2xl">
            <Lines text={scenario.goal} />
          </p>
          <p className="mt-auto whitespace-pre-line pt-5 text-sm leading-relaxed text-primary-foreground/80">
            가장 중요한 단계는{" "}
            <strong className="font-semibold text-gold-soft">
              {focus.letter} · {focus.name}
            </strong>
            이에요.{"\n"}
            {focus.summary}.
          </p>
        </section>

        <section className="animate-rise paper-card flex flex-col p-6 [animation-delay:180ms]">
          <h3 className="text-base font-bold text-primary">이 매장의 연습용 규정</h3>
          <ul className="mt-3 space-y-3 text-[0.95rem] leading-relaxed">
            {scenario.policy.map((rule) => (
              <li key={rule} className="grid grid-cols-[auto_1fr] gap-3">
                <span className="mt-[0.7em] size-1 rounded-full bg-gold" />
                <Lines text={rule} />
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-4 text-xs text-muted-foreground">
            <Lines text="연습을 위한 가정이에요. 실제 회사 규정은 꼭 확인해 주세요." />
          </p>
        </section>
      </div>

      <div className="mt-6 grid gap-4 pb-2 lg:mt-8 lg:grid-cols-2 lg:items-center lg:gap-6">
        <p className="animate-rise flex gap-2 text-sm leading-relaxed text-muted-foreground [animation-delay:240ms]">
          {face && <Headphones className="mt-1 size-4 shrink-0 text-gold" />}
          <Lines
            text={`${
              face
                ? "손님이 목소리로 말해요. 마이크를 허용하고, 조용한 곳이나 이어폰으로 연습해 주세요."
                : "손님이 글로 말을 걸어요."
            } 3분 동안 ${MIN_STAFF_TURNS}~${MAX_STAFF_TURNS}번 답하면 피드백을 받아요. 대화 내용은 저장하지 않아요.`}
          />
        </p>
        <Button variant="lux" size="xl" onClick={begin}>
          {face ? "손님 만나러 가기" : "대화 시작하기"}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
