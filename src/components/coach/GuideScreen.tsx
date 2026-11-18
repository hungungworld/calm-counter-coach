import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Lines } from "@/components/ui/lines";
import { CALM_STEPS } from "@/lib/roleplay-rules";

/** The four-step response model as a one-minute read before practising. */
export function GuideScreen({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
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

      <div className="mt-4 lg:max-w-2xl">
        <p className="eyebrow">1분 미리 보기</p>
        <h2 className="mt-2 text-[1.9rem] font-extrabold leading-tight text-primary lg:text-[2.8rem]">
          화난 고객을 만나면,
          <span className="block whitespace-nowrap">C · A · L · M</span>
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          <Lines text="순서대로 한 문장씩만 말해도 대화가 달라져요. 연습이 끝나면 이 네 가지로 피드백을 드려요." />
        </p>
      </div>

      <ol className="mt-8 grid gap-4 lg:grid-cols-2 lg:gap-6">
        {CALM_STEPS.map((step, i) => (
          <li
            key={step.id}
            className="paper-card animate-rise grid grid-cols-[auto_1fr] gap-x-4 p-5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="row-span-2 font-serif text-[3.2rem] font-extrabold leading-none text-gold">
              {step.letter}
            </span>
            <div>
              <h3 className="text-xl font-bold text-primary">
                {step.name}
                <span className="ml-2 font-sans text-xs font-medium tracking-wide text-muted-foreground">
                  {step.english}
                </span>
              </h3>
              <p className="mt-1 text-[0.95rem] leading-relaxed">
                <Lines text={step.desc} />
              </p>
            </div>
            <ul className="col-start-2 mt-4 space-y-2 text-[0.95rem]">
              {step.examples.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check
                    className="mt-1 size-4 shrink-0 text-mood-calm"
                    aria-label="이렇게 말해요"
                  />
                  <span>{line}</span>
                </li>
              ))}
              {step.avoid.map((line) => (
                <li key={line} className="flex gap-2 text-muted-foreground">
                  <X className="mt-1 size-4 shrink-0 text-mood-angry" aria-label="이 말은 피해요" />
                  <span className="line-through decoration-mood-angry/50">{line}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-8 lg:mt-10 lg:max-w-sm">
        <Button variant="lux" size="xl" onClick={onStart}>
          연습하러 가기
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
