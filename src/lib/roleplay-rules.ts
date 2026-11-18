// Shared, browser-safe rules and data for the role-play coach.
// The UI, the server functions and the offline engine all read limits from here.

import { SCENARIOS } from "./scenarios";
import type { Scenario, ScenarioId } from "./scenarios";

export { SCENARIOS, SCENARIO_IDS } from "./scenarios";
export type { CustomerLook, Scenario, ScenarioId, ScenarioLang } from "./scenarios";

export const MIN_STAFF_TURNS = 3;
export const MAX_STAFF_TURNS = 5;
export const TIME_LIMIT_SECONDS = 180;
export const MAX_REPLY_LENGTH = 300;
/** One spoken answer is capped so a stuck microphone never eats the whole 3 minutes. */
export const MAX_VOICE_SECONDS = 30;
/** Upper bound for an uploaded recording (base64 characters), about 1.5 MB of audio. */
export const MAX_AUDIO_BASE64_LENGTH = 2_000_000;

export function getScenario(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error("알 수 없는 상황이에요.");
  return found;
}

/* ---------- CALM: the four-step response model the coach teaches ---------- */

export type CalmStep = "care" | "apologize" | "lead" | "makeSure";

export type CalmStepInfo = {
  id: CalmStep;
  letter: "C" | "A" | "L" | "M";
  name: string;
  english: string;
  summary: string;
  desc: string;
  examples: [string, string];
  avoid: [string, string];
};

export const CALM_STEPS: CalmStepInfo[] = [
  {
    id: "care",
    letter: "C",
    name: "공감",
    english: "Care",
    summary: "감정을 먼저 받아 줘요",
    desc: "해결책보다 먼저, 고객이 느낀 불편을 말로 알아줘요.",
    examples: ["오래 기다리셔서 많이 답답하셨죠.", "얼마나 놀라셨을지요."],
    avoid: ["진정하세요.", "그건 고객님 사정이고요."],
  },
  {
    id: "apologize",
    letter: "A",
    name: "사과·확인",
    english: "Apologize & Ask",
    summary: "사과하고, 물어서 확인해요",
    desc: "불편에 대해 사과하고, 추측하지 말고 질문으로 상황을 확인해요.",
    examples: ["불편을 드려 죄송합니다.", "구매하신 날짜를 여쭤봐도 될까요?"],
    avoid: ["그럴 리가 없는데요.", "원래 그렇습니다."],
  },
  {
    id: "lead",
    letter: "L",
    name: "대안",
    english: "Lead to a solution",
    summary: "할 수 있는 일을 말해요",
    desc: "안 되는 이유보다, 지금 할 수 있는 방법을 구체적으로 먼저 말해요.",
    examples: ["대신 이렇게 도와드릴 수 있습니다.", "지금 바로 확인해 드리겠습니다."],
    avoid: ["규정상 안 됩니다.", "제 담당이 아니라서요."],
  },
  {
    id: "makeSure",
    letter: "M",
    name: "마무리",
    english: "Make sure",
    summary: "약속을 확인하고 감사로 끝내요",
    desc: "언제까지 무엇을 할지 다시 말하고, 감사 인사로 마무리해요.",
    examples: ["오늘 안에 연락드리겠습니다.", "기다려 주셔서 감사합니다."],
    avoid: ["네, 그럼 가 보세요.", "말없이 응대를 끝내기"],
  },
];

export const CALM_ORDER: CalmStep[] = ["care", "apologize", "lead", "makeSure"];

export function getCalmStep(id: CalmStep): CalmStepInfo {
  const found = CALM_STEPS.find((s) => s.id === id);
  if (!found) throw new Error("알 수 없는 단계예요.");
  return found;
}

export type CalmSignals = Record<CalmStep, boolean>;

export const NO_SIGNALS: CalmSignals = {
  care: false,
  apologize: false,
  lead: false,
  makeSure: false,
};

/* ---------- Difficulty ---------- */

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTY_IDS = ["easy", "normal", "hard"] as const;

export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; desc: string; startAnger: number; soften: number; hints: boolean }
> = {
  easy: { label: "입문", desc: "힌트를 보며 천천히", startAnger: 62, soften: 1.25, hints: true },
  normal: { label: "실전", desc: "힌트 없이 실제처럼", startAnger: 76, soften: 1, hints: false },
  hard: { label: "고난도", desc: "쉽게 풀리지 않아요", startAnger: 90, soften: 0.7, hints: false },
};

export type PracticeMode = "stage" | "chat";

/* ---------- Customer emotion ---------- */

export type Mood = "angry" | "softening" | "calm";

export const MOOD_LABEL: Record<Mood, string> = {
  angry: "화가 많이 났어요",
  softening: "조금 누그러졌어요",
  calm: "많이 진정됐어요",
};

/** `anger` is the customer's emotion temperature, 0 (calm) to 100 (furious). */
export function clampAnger(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function moodFromAnger(anger: number): Mood {
  if (anger >= 62) return "angry";
  if (anger >= 34) return "softening";
  return "calm";
}

/* ---------- Conversation ---------- */

export type ChatTurn = { role: "staff" | "customer"; text: string };

/** A turn as the practice screen keeps it: the words plus what the coach noticed. */
export type SessionTurn = ChatTurn & {
  /** Customer turns: emotion temperature right after this line. */
  anger?: number;
  /** Customer turns: what the customer was really thinking (shown only in the debrief). */
  thought?: string;
  /** Staff turns: which CALM steps this reply covered. */
  signals?: CalmSignals;
  /** Staff turns: how the reply was given. */
  viaVoice?: boolean;
  /** Staff turns: seconds spent speaking, when answered by voice. */
  speakSeconds?: number;
  /** Staff turns: seconds between the customer finishing and the staff starting. */
  reactionSeconds?: number;
};

type TurnState = { staffTurns: number; timeUp: boolean; waiting?: boolean };

/** Staff can type another reply only while time remains and the 5-reply limit is not reached. */
export function canSendReply({ staffTurns, timeUp, waiting = false }: TurnState): boolean {
  return !waiting && !timeUp && staffTurns < MAX_STAFF_TURNS;
}

/** Feedback opens after 3 replies, or earlier if time ran out after at least one reply. */
export function canRequestFeedback({ staffTurns, timeUp, waiting = false }: TurnState): boolean {
  if (waiting) return false;
  return staffTurns >= MIN_STAFF_TURNS || (timeUp && staffTurns >= 1);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ---------- Feedback ---------- */

export type ScoreKey = CalmStep | "tone";

export const SCORE_KEYS: ScoreKey[] = ["care", "apologize", "lead", "makeSure", "tone"];

export const SCORE_LABEL: Record<ScoreKey, string> = {
  care: "공감",
  apologize: "사과·확인",
  lead: "대안",
  makeSure: "마무리",
  tone: "말투",
};

export type Scores = Record<ScoreKey, number>;

export type Feedback = {
  good: [string, string];
  improve: string;
  nextLine: string;
  /** One encouraging sentence that sums up the round. */
  summary: string;
  /** Each 1 to 5. */
  scores: Scores;
  /** One short reason per score, grounded in what the staff actually said. */
  notes: Record<ScoreKey, string>;
};

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

/** Five rubric items of 1 to 5 points become a 0 to 100 total (5 points → 100). */
export function totalScore(scores: Scores): number {
  const sum = SCORE_KEYS.reduce((acc, key) => acc + clampScore(scores[key]), 0);
  return Math.round(((sum - SCORE_KEYS.length) / (SCORE_KEYS.length * 4)) * 100);
}

export function gradeLabel(total: number): string {
  if (total >= 85) return "믿고 맡길 수 있는 응대";
  if (total >= 70) return "안정적인 응대";
  if (total >= 50) return "조금만 다듬으면 좋아질 응대";
  return "다시 한번 연습해 볼 응대";
}

export type ModelCompare = { yours: string; better: string; why: string };
