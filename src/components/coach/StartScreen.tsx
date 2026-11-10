import { ArrowRight } from "lucide-react";

import heroImg from "@/assets/concierge-desk.jpg";
import { Button } from "@/components/ui/button";

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col px-6 pt-10 safe-bottom">
      <div className="animate-rise text-center">
        <p className="eyebrow">현장 직원 연습실</p>
        <h1 className="mt-4 text-[2.1rem] font-bold leading-tight text-primary">응대 리허설</h1>
        <div className="gold-rule mx-auto mt-6 w-32" />
      </div>

      <div className="animate-rise mt-8 overflow-hidden rounded-md border border-gold-soft shadow-soft [animation-delay:80ms]">
        <img
          src={heroImg}
          alt="금색 선으로 그린 백화점 안내데스크"
          width={1024}
          height={768}
          className="block aspect-[4/3] w-full object-cover"
        />
      </div>

      <div className="animate-rise mt-8 space-y-3 text-center [animation-delay:160ms]">
        <p className="font-serif text-xl font-bold leading-snug text-foreground">
          화난 고객, 미리 만나 보세요
        </p>
        <p className="text-base text-muted-foreground">
          AI가 고객 역할을 해요.
          <br />
          3분 동안 3~5번 답하고, 피드백을 받아요.
        </p>
      </div>

      <div className="mt-auto pt-10">
        <Button variant="lux" size="xl" onClick={onStart}>
          연습 시작하기
          <ArrowRight />
        </Button>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          연습용입니다. 실제 회사 규정은 확인 필요
        </p>
      </div>
    </div>
  );
}
