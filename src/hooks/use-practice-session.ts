import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getCustomerReply, type Engine } from "@/lib/roleplay.functions";
import {
  CALM_ORDER,
  DIFFICULTIES,
  MAX_REPLY_LENGTH,
  MAX_STAFF_TURNS,
  NO_SIGNALS,
  TIME_LIMIT_SECONDS,
  canRequestFeedback,
  canSendReply,
  moodFromAnger,
  type CalmSignals,
  type CalmStep,
  type Difficulty,
  type PracticeMode,
  type Scenario,
  type ScenarioId,
  type SessionTurn,
} from "@/lib/roleplay-rules";
import { detectSignals, simulateCustomer } from "@/lib/roleplay-sim";

export type PracticeSetup = { scenarioId: ScenarioId; difficulty: Difficulty; mode: PracticeMode };

/** Everything the feedback screen needs once a round is over. Lives in memory only. */
export type SessionResult = {
  turns: SessionTurn[];
  /** Emotion temperature at the start and after each customer line. */
  angerTrail: number[];
  seconds: number;
  engine: Engine;
};

type ReplyMeta = Pick<SessionTurn, "viaVoice" | "speakSeconds" | "reactionSeconds">;

/**
 * One practice round: the transcript, the customer's emotion temperature, the 3-minute
 * clock and the turn limits. Both the face-to-face stage and the chat screen run on it.
 */
export function usePracticeSession({
  scenario,
  difficulty,
  hold = false,
}: {
  scenario: Scenario;
  difficulty: Difficulty;
  /** Pauses the clock while the customer is talking, so listening costs no time. */
  hold?: boolean;
}) {
  const ask = useServerFn(getCustomerReply);
  const startAnger = DIFFICULTIES[difficulty].startAnger;

  const [turns, setTurns] = useState<SessionTurn[]>(() => [
    {
      role: "customer",
      text: scenario.firstLine,
      anger: startAnger,
      thought: scenario.sim.thoughts.angry,
    },
  ]);
  const [anger, setAnger] = useState(startAnger);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT_SECONDS);
  const [engine, setEngine] = useState<Engine>("ai");

  const requestId = useRef(0);
  const angerRef = useRef(startAnger);

  const staffTurns = turns.filter((t) => t.role === "staff").length;
  const timeUp = secondsLeft <= 0;
  const sendable = canSendReply({ staffTurns, timeUp, waiting }) && !error;
  const feedbackReady = canRequestFeedback({ staffTurns, timeUp, waiting });
  const finished = !waiting && !error && (timeUp || staffTurns >= MAX_STAFF_TURNS);

  // The clock runs only while it is the staff member's turn to answer.
  useEffect(() => {
    if (timeUp || waiting || hold) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [timeUp, waiting, hold]);

  const requestReply = useCallback(
    async (history: SessionTurn[]) => {
      const myId = ++requestId.current;
      setWaiting(true);
      setError(null);

      const plain = history.map(({ role, text }) => ({ role, text }));
      const options = { difficulty, anger: angerRef.current };
      let result: Awaited<ReturnType<typeof ask>>;
      try {
        result = await ask({ data: { scenarioId: scenario.id, turns: plain, ...options } });
      } catch {
        // Offline or the server is unreachable: the built-in engine keeps the round going.
        result = { ok: true, engine: "sim", ...simulateCustomer(scenario, plain, options) };
      }
      if (myId !== requestId.current) return;

      if (result.ok) {
        const reply = result;
        angerRef.current = reply.anger;
        setAnger(reply.anger);
        if (reply.engine === "sim") setEngine("sim");
        setTurns((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          const last = next[lastIndex];
          // The coach's reading of the staff reply replaces the instant local guess.
          if (last && last.role === "staff") next[lastIndex] = { ...last, signals: reply.signals };
          next.push({
            role: "customer",
            text: reply.reply,
            anger: reply.anger,
            thought: reply.thought,
          });
          return next;
        });
      } else {
        setError(result.error);
      }
      setWaiting(false);
    },
    [ask, difficulty, scenario],
  );

  /** Adds a staff reply and asks the customer to answer. Returns false if not allowed now. */
  const submit = useCallback(
    (text: string, meta: ReplyMeta = {}) => {
      const clean = text.trim().slice(0, MAX_REPLY_LENGTH);
      if (!clean || !sendable) return false;
      const next: SessionTurn[] = [
        ...turns,
        {
          role: "staff",
          text: clean,
          signals: detectSignals(clean, scenario.lang).signals,
          ...meta,
        },
      ];
      setTurns(next);
      void requestReply(next);
      return true;
    },
    [requestReply, scenario.lang, sendable, turns],
  );

  const retry = useCallback(() => void requestReply(turns), [requestReply, turns]);

  /** CALM steps used so far in this round. */
  const covered = useMemo<CalmSignals>(() => {
    const all = { ...NO_SIGNALS };
    for (const turn of turns) {
      if (turn.role !== "staff" || !turn.signals) continue;
      for (const step of CALM_ORDER) if (turn.signals[step]) all[step] = true;
    }
    return all;
  }, [turns]);

  /** The next step to try and a model sentence for it (shown at the entry level). */
  const hint = useMemo<{ step: CalmStep; line: string } | null>(() => {
    const step = CALM_ORDER.find((s) => !covered[s]);
    return step ? { step, line: scenario.model[step] } : null;
  }, [covered, scenario.model]);

  const result = useCallback(
    (): SessionResult => ({
      turns,
      angerTrail: turns.filter((t) => t.role === "customer").map((t) => t.anger ?? startAnger),
      seconds: TIME_LIMIT_SECONDS - Math.max(0, secondsLeft),
      engine,
    }),
    [engine, secondsLeft, startAnger, turns],
  );

  return {
    turns,
    anger,
    mood: moodFromAnger(anger),
    waiting,
    error,
    secondsLeft,
    timeUp,
    staffTurns,
    sendable,
    feedbackReady,
    finished,
    engine,
    covered,
    hint,
    submit,
    retry,
    result,
  };
}
