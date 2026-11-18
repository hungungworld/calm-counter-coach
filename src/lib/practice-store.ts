// "My practice record": scores only, kept on this device.
// The conversation itself is never stored, here or on the server. That was a founding
// rule of the app, and the record deliberately has no field that could hold it.

import { useCallback, useEffect, useState } from "react";

import {
  CALM_ORDER,
  DIFFICULTY_IDS,
  SCENARIO_IDS,
  SCORE_KEYS,
  type CalmStep,
  type Difficulty,
  type PracticeMode,
  type ScenarioId,
  type ScoreKey,
  type Scores,
} from "./roleplay-rules";

export type PracticeRecord = {
  id: string;
  /** ISO timestamp of when the round finished. */
  at: string;
  scenarioId: ScenarioId;
  difficulty: Difficulty;
  mode: PracticeMode;
  /** 0 to 100. */
  total: number;
  scores: Scores;
  angerStart: number;
  angerEnd: number;
  replies: number;
  seconds: number;
};

const KEY = "calm-counter-coach.records.v1";
const CHANGED = "calm-counter-coach:records";
const MAX_RECORDS = 200;

function isRecord(value: unknown): value is PracticeRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const scores = r["scores"] as Record<string, unknown> | undefined;
  return (
    typeof r["id"] === "string" &&
    typeof r["at"] === "string" &&
    !Number.isNaN(Date.parse(r["at"])) &&
    (SCENARIO_IDS as readonly string[]).includes(r["scenarioId"] as string) &&
    (DIFFICULTY_IDS as readonly string[]).includes(r["difficulty"] as string) &&
    (r["mode"] === "stage" || r["mode"] === "chat") &&
    typeof r["total"] === "number" &&
    typeof r["angerStart"] === "number" &&
    typeof r["angerEnd"] === "number" &&
    !!scores &&
    SCORE_KEYS.every((key) => typeof scores[key] === "number")
  );
}

export function loadRecords(): PracticeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function write(records: PracticeRecord[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private browsing or a full disk: practice still works, it just is not remembered.
  }
}

export function addRecord(record: Omit<PracticeRecord, "id" | "at">): PracticeRecord {
  const saved: PracticeRecord = {
    ...record,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  write([...loadRecords(), saved]);
  return saved;
}

export function clearRecords(): void {
  write([]);
}

/** Records for this device, re-read whenever a round is saved or the list is cleared. */
export function useRecords(): { records: PracticeRecord[]; ready: boolean; clear: () => void } {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => setRecords(loadRecords());
    read();
    setReady(true);
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const clear = useCallback(() => clearRecords(), []);
  return { records, ready, clear };
}

/* ---------- Summary ---------- */

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export type PracticeSummary = {
  count: number;
  average: number;
  best: number;
  /** Days in a row with at least one round, counting today or yesterday as the latest. */
  streak: number;
  /** Average of the last three rounds minus the first three, once there are six. */
  growth: number | null;
  stepAverage: Record<ScoreKey, number>;
  weakest: CalmStep | null;
  bestByScenario: Partial<Record<ScenarioId, number>>;
  /** Average drop in emotion temperature per round. */
  averageCooling: number;
};

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

export function summarize(records: PracticeRecord[], today = new Date()): PracticeSummary {
  const sorted = [...records].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const totals = sorted.map((r) => r.total);

  const stepAverage = Object.fromEntries(
    SCORE_KEYS.map((key) => [key, Math.round(mean(sorted.map((r) => r.scores[key])) * 10) / 10]),
  ) as Record<ScoreKey, number>;

  const bestByScenario: Partial<Record<ScenarioId, number>> = {};
  for (const r of sorted) {
    bestByScenario[r.scenarioId] = Math.max(bestByScenario[r.scenarioId] ?? 0, r.total);
  }

  const days = new Set(sorted.map((r) => dayKey(new Date(r.at))));
  let streak = 0;
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const weakest =
    sorted.length === 0
      ? null
      : ([...CALM_ORDER].sort((a, b) => stepAverage[a] - stepAverage[b])[0] ?? null);

  return {
    count: sorted.length,
    average: Math.round(mean(totals)),
    best: totals.length ? Math.max(...totals) : 0,
    streak,
    growth:
      totals.length >= 6 ? Math.round(mean(totals.slice(-3)) - mean(totals.slice(0, 3))) : null,
    stepAverage,
    weakest,
    bestByScenario,
    averageCooling: Math.round(mean(sorted.map((r) => r.angerStart - r.angerEnd))),
  };
}
