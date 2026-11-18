import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { CustomerPortrait } from "@/components/stage/CustomerPortrait";
import { CustomerStage } from "@/components/stage/CustomerStage";
import { SCENARIOS, type ScenarioId } from "@/lib/roleplay-rules";
import type { StageState } from "@/lib/stage/scene";

// Tuning bench for the 3D customer. Not linked from the app.
export const Route = createFileRoute("/lab")({ component: Lab });

function Lab() {
  const [id, setId] = useState<ScenarioId>("refund");
  const [anger, setAnger] = useState(76);
  const [state, setState] = useState<StageState>("idle");
  const levelRef = useRef(0);
  const scenario = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      const t = now / 1000;
      levelRef.current = Math.abs(Math.sin(t * 9.5)) * (0.55 + 0.45 * Math.sin(t * 2.3));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            data-lab-scenario={s.id}
            onClick={() => setId(s.id)}
            className={`rounded-sm border px-2 py-1 ${s.id === id ? "bg-primary text-primary-foreground" : ""}`}
          >
            {s.tag}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          감정 {anger}
          <input
            data-lab="anger"
            type="range"
            min={0}
            max={100}
            value={anger}
            onChange={(e) => setAnger(Number(e.target.value))}
          />
        </label>
        {(["idle", "listening", "thinking", "speaking"] as StageState[]).map((s) => (
          <button
            key={s}
            type="button"
            data-lab-state={s}
            onClick={() => setState(s)}
            className={`rounded-sm border px-2 py-1 ${s === state ? "bg-primary text-primary-foreground" : ""}`}
          >
            {s}
          </button>
        ))}
        {[10, 45, 76, 95].map((v) => (
          <button
            key={v}
            type="button"
            data-lab-anger={v}
            onClick={() => setAnger(v)}
            className="rounded-sm border px-2 py-1"
          >
            {v}
          </button>
        ))}
      </div>
      <CustomerStage
        key={id}
        scenario={scenario}
        anger={anger}
        state={state}
        levelRef={levelRef}
        className="aspect-[16/10] w-full rounded-md"
      />
      <div className="flex gap-3">
        {SCENARIOS.map((s) => (
          <CustomerPortrait
            key={s.id}
            look={s.look}
            anger={anger}
            speaking={state === "speaking"}
            className="size-20 rounded-md bg-card"
          />
        ))}
      </div>
    </main>
  );
}
