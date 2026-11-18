import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { BriefScreen } from "@/components/coach/BriefScreen";
import { ChatScreen } from "@/components/coach/ChatScreen";
import { FeedbackScreen } from "@/components/coach/FeedbackScreen";
import { GuideScreen } from "@/components/coach/GuideScreen";
import { RecordsScreen } from "@/components/coach/RecordsScreen";
import { SelectScreen } from "@/components/coach/SelectScreen";
import { StageScreen } from "@/components/coach/StageScreen";
import { StartScreen } from "@/components/coach/StartScreen";
import type { PracticeSetup, SessionResult } from "@/hooks/use-practice-session";
import { summarize, useRecords } from "@/lib/practice-store";
import { getScenario } from "@/lib/roleplay-rules";

const TITLE = "응대 리허설 · 3분 고객 응대 연습";
const DESCRIPTION =
  "백화점 현장 직원을 위한 3분 롤플레이. AI 고객과 마주 보고 대화하고 바로 피드백을 받아요.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Step =
  | { name: "start" }
  | { name: "guide" }
  | { name: "records" }
  | { name: "select"; last?: PracticeSetup }
  | { name: "brief"; setup: PracticeSetup }
  | { name: "practice"; setup: PracticeSetup; round: number }
  | { name: "feedback"; setup: PracticeSetup; result: SessionResult };

// The conversation lives only in memory. Scores alone are kept, on this device.
function Index() {
  const [step, setStep] = useState<Step>({ name: "start" });
  const [round, setRound] = useState(0);
  const { records, ready, clear } = useRecords();
  const summary = useMemo(() => summarize(records), [records]);

  // Screens swap inside one route, so each new screen has to start at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step.name]);

  const startPractice = (setup: PracticeSetup) => {
    const next = round + 1;
    setRound(next);
    setStep({ name: "practice", setup, round: next });
  };

  return (
    <main className="w-full bg-background">
      {step.name === "start" && (
        <StartScreen
          summary={ready ? summary : null}
          onStart={() => setStep({ name: "select" })}
          onGuide={() => setStep({ name: "guide" })}
          onRecords={() => setStep({ name: "records" })}
        />
      )}

      {step.name === "guide" && (
        <GuideScreen
          onBack={() => setStep({ name: "start" })}
          onStart={() => setStep({ name: "select" })}
        />
      )}

      {step.name === "records" && (
        <RecordsScreen
          records={records}
          summary={summary}
          onBack={() => setStep({ name: "start" })}
          onStart={() => setStep({ name: "select" })}
          onClear={clear}
        />
      )}

      {step.name === "select" && (
        <SelectScreen
          initial={step.last}
          best={summary.bestByScenario}
          onBack={() => setStep({ name: "start" })}
          onChoose={(setup) => setStep({ name: "brief", setup })}
        />
      )}

      {step.name === "brief" && (
        <BriefScreen
          scenario={getScenario(step.setup.scenarioId)}
          setup={step.setup}
          onBack={() => setStep({ name: "select", last: step.setup })}
          onStart={() => startPractice(step.setup)}
        />
      )}

      {step.name === "practice" &&
        (step.setup.mode === "stage" ? (
          <StageScreen
            key={step.round}
            scenario={getScenario(step.setup.scenarioId)}
            difficulty={step.setup.difficulty}
            onExit={() => setStep({ name: "select", last: step.setup })}
            onFinish={(result) => setStep({ name: "feedback", setup: step.setup, result })}
          />
        ) : (
          <ChatScreen
            key={step.round}
            scenario={getScenario(step.setup.scenarioId)}
            difficulty={step.setup.difficulty}
            onExit={() => setStep({ name: "select", last: step.setup })}
            onFinish={(result) => setStep({ name: "feedback", setup: step.setup, result })}
          />
        ))}

      {step.name === "feedback" && (
        <FeedbackScreen
          scenario={getScenario(step.setup.scenarioId)}
          setup={step.setup}
          result={step.result}
          onRetrySame={() => setStep({ name: "brief", setup: step.setup })}
          onPickAnother={() => setStep({ name: "select", last: step.setup })}
          onHome={() => setStep({ name: "start" })}
        />
      )}
    </main>
  );
}
