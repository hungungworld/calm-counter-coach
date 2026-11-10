import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ChatScreen } from "@/components/coach/ChatScreen";
import { FeedbackScreen } from "@/components/coach/FeedbackScreen";
import { SelectScreen } from "@/components/coach/SelectScreen";
import { StartScreen } from "@/components/coach/StartScreen";
import { getScenario, type ChatTurn, type ScenarioId } from "@/lib/roleplay-rules";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "응대 리허설 · 3분 고객 응대 연습" },
      {
        name: "description",
        content: "백화점 현장 직원을 위한 3분 롤플레이. AI 고객과 대화하고 바로 피드백을 받아요.",
      },
      { property: "og:title", content: "응대 리허설 · 3분 고객 응대 연습" },
      {
        property: "og:description",
        content: "백화점 현장 직원을 위한 3분 롤플레이. AI 고객과 대화하고 바로 피드백을 받아요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Step =
  | { name: "start" }
  | { name: "select"; last?: ScenarioId }
  | { name: "chat"; scenarioId: ScenarioId; round: number }
  | { name: "feedback"; scenarioId: ScenarioId; turns: ChatTurn[] };

// Conversation lives only in memory: nothing is saved anywhere.
function Index() {
  const [step, setStep] = useState<Step>({ name: "start" });
  const [round, setRound] = useState(0);

  const startChat = (scenarioId: ScenarioId) => {
    const next = round + 1;
    setRound(next);
    setStep({ name: "chat", scenarioId, round: next });
  };

  return (
    <main className="mx-auto w-full max-w-md bg-background">
      {step.name === "start" && <StartScreen onStart={() => setStep({ name: "select" })} />}

      {step.name === "select" && (
        <SelectScreen
          initial={step.last}
          onBack={() => setStep({ name: "start" })}
          onChoose={startChat}
        />
      )}

      {step.name === "chat" && (
        <ChatScreen
          key={step.round}
          scenario={getScenario(step.scenarioId)}
          onExit={() => setStep({ name: "select", last: step.scenarioId })}
          onFinish={(turns) => setStep({ name: "feedback", scenarioId: step.scenarioId, turns })}
        />
      )}

      {step.name === "feedback" && (
        <FeedbackScreen
          scenario={getScenario(step.scenarioId)}
          turns={step.turns}
          onRetrySame={() => startChat(step.scenarioId)}
          onPickAnother={() => setStep({ name: "select", last: step.scenarioId })}
          onHome={() => setStep({ name: "start" })}
        />
      )}
    </main>
  );
}
