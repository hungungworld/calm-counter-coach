// Shared, browser-safe rules and data for the role-play coach.

export const MIN_STAFF_TURNS = 3;
export const MAX_STAFF_TURNS = 5;
export const TIME_LIMIT_SECONDS = 180;
export const MAX_REPLY_LENGTH = 300;

export type ScenarioId = "refund" | "vip" | "queue";

export type Scenario = {
  id: ScenarioId;
  tag: string;
  title: string;
  place: string;
  firstLine: string;
  persona: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "refund",
    tag: "환불 요구",
    title: "3주 전 산 가방을 영수증 없이 환불해 달라는 고객",
    place: "잡화 매장",
    firstLine:
      "3주 전에 여기서 산 가방이에요. 영수증은 없어요. 그냥 환불해 주세요. 안 된다는 말은 듣기 싫어요!",
    persona:
      "3주 전에 산 가방을 영수증 없이 환불받고 싶어 하는 고객. 영수증이 없다는 이유로 거절당할까 봐 처음부터 날이 서 있다.",
  },
  {
    id: "vip",
    tag: "VIP 클레임",
    title: "VIP 라운지 대기가 길다며 항의하는 고객",
    place: "VIP 라운지",
    firstLine: "지금 몇 분을 기다리게 하는 거예요? 책임자 불러요!",
    persona:
      "오랫동안 우수 고객이었다는 자부심이 큰 고객. VIP 라운지에서 20분 넘게 기다려 무시당했다고 느낀다.",
  },
  {
    id: "queue",
    tag: "대기 항의",
    title: "계산 줄이 길다고 큰 소리로 화내는 고객",
    place: "계산대",
    firstLine: "아니, 계산대를 왜 하나만 열어 놨어요? 줄이 이게 뭐예요! 다들 바쁜 거 안 보여요?",
    persona:
      "약속 시간에 늦을까 봐 초조한 고객. 계산 줄이 길어 주변 사람들 앞에서 큰 소리로 화를 낸다.",
  },
];

export function getScenario(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error("알 수 없는 상황이에요.");
  return found;
}

export type Mood = "angry" | "softening" | "calm";

export const MOOD_LABEL: Record<Mood, string> = {
  angry: "화가 많이 났어요",
  softening: "조금 누그러졌어요",
  calm: "많이 진정됐어요",
};

export type ChatTurn = { role: "staff" | "customer"; text: string };

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
