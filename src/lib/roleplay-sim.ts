// Offline practice engine: a rule-based customer and coach.
// It keeps practice running when the AI gateway cannot be reached (no network, quota
// used up, local development) and gives the UI instant CALM hints without a round trip.
// Browser-safe and deterministic, so it is also what the unit tests exercise.

import {
  CALM_ORDER,
  DIFFICULTIES,
  MAX_STAFF_TURNS,
  clampAnger,
  clampScore,
  moodFromAnger,
  type CalmSignals,
  type CalmStep,
  type ChatTurn,
  type Difficulty,
  type Feedback,
  type ModelCompare,
  type Mood,
  type Scenario,
  type ScenarioLang,
  type Scores,
} from "./roleplay-rules";

type Lexicon = Record<CalmStep | "caution" | "cushion", RegExp>;

const KO: Lexicon = {
  care: /불편|답답|속상|놀라|걱정|당황|힘드|서운|번거로|기다리[셨게]|마음이|그러셨|얼마나|이해(합니다|해요|가 됩니다|됩니다|돼요)/,
  apologize:
    /죄송|사과드|사과 ?말씀|송구|미안|양해|여쭤|여쭈|확인해 ?봐도|알려 ?주실|말씀해 ?주실|보여 ?주실|[될일실]까요/,
  lead: /(드리|보|열|모시|하|찾)겠|해 ?드릴게요|드릴 수|도와드릴|수 있습니다|가능합니다|대신|방법|상의|연결해|요청하/,
  makeSure:
    /감사합니다|감사드|고맙습니다|연락 ?드리|알려 ?드리겠|다시 (한번 )?안내|분 안에|오늘 안에|내일까지|더 필요하신|괜찮으(실까요|신가요)|약속드리|확인되는 대로/,
  caution:
    /안 ?됩니다|안 ?돼요|안 ?되세요|불가능|불가합니다|규정상|규정이라|원래 ?그렇|어쩔 수 없|담당이 아니|모르겠|진정하세요|소리 ?(지르|치)|그건 고객님|셨잖아요|말씀하시면 곤란|못 ?해 ?드|잘못이 아니/g,
  cushion:
    /실례지만|괜찮으시다면|번거로우시겠지만|죄송하지만|죄송합니다만|바쁘시겠지만|불편하시겠지만|혹시|여쭤봐도/g,
};

const EN: Lexicon = {
  care: /understand|frustrat|must (have been|be)|i see|i hear you|that sounds|can imagine|in a hurry|inconvenien|stressful/i,
  apologize: /sorry|apolog|may i ask|could you (tell|show)|can i (see|check)|what time|\?/i,
  lead: /i('| wi)ll|let me|i can|we can|right (now|away)|this way|walk you|take you|floor|you('| wi)ll need|instead|option/i,
  makeSure:
    /thank you|thanks|anything else|have a (safe|nice|good)|you can also|let me know|appreciate/i,
  caution:
    /can't|cannot|not my (job|fault)|policy|calm down|nothing (i|we) can|impossible|your fault|should have/gi,
  cushion: /please|may i|would you|kindly|if you don't mind/gi,
};

export type Detection = {
  signals: CalmSignals;
  /** Phrases that tend to escalate, as they appeared. */
  cautions: string[];
  /** Softening phrases, as they appeared. */
  cushions: string[];
};

export function detectSignals(text: string, lang: ScenarioLang = "ko"): Detection {
  const lex = lang === "en" ? EN : KO;
  return {
    signals: {
      care: lex.care.test(text),
      apologize: lex.apologize.test(text),
      lead: lex.lead.test(text),
      makeSure: lex.makeSure.test(text),
    },
    cautions: text.match(lex.caution) ?? [],
    cushions: text.match(lex.cushion) ?? [],
  };
}

/** How much one staff reply moves the customer's emotion temperature. */
export function angerDelta(
  detection: Detection,
  text: string,
  difficulty: Difficulty,
  focus: CalmStep,
): number {
  const { signals, cautions } = detection;
  let delta = 0;
  if (signals.care) delta -= 9;
  if (signals.apologize) delta -= 7;
  if (signals.lead) delta -= 13;
  if (signals.makeSure) delta -= 6;
  if (signals[focus]) delta -= 4;
  if (!CALM_ORDER.some((step) => signals[step])) delta += 9;
  delta += Math.min(2, cautions.length) * 11;
  if (text.trim().length < 12) delta += 6;

  const soften = DIFFICULTIES[difficulty].soften;
  return delta < 0 ? delta * soften : delta * (2 - soften);
}

const EXTRA: Record<ScenarioLang, Record<Mood, [string, string]>> = {
  ko: {
    angry: [
      "같은 말만 반복하시네요. 제 말을 듣고는 있는 거예요?",
      "그래서 지금 뭘 해 주겠다는 건지 모르겠어요.",
    ],
    softening: ["네, 듣고 있어요. 계속 말해 보세요.", "그건 알겠어요. 그럼 그다음은요?"],
    calm: ["네, 알겠어요.", "좋아요. 그렇게 해 주세요."],
  },
  en: {
    angry: [
      "You keep saying the same thing. Are you even listening?",
      "So what exactly will you do?",
    ],
    softening: ["Okay, I'm listening. Go on.", "I get that. Then what's next?"],
    calm: ["All right, I understand.", "Good. Let's do that."],
  },
};

const REACTION: Record<ScenarioLang, { caution: [string, string]; relief: [string, string] }> = {
  ko: {
    caution: ["안 된다는 말부터 하시네요.", "규정 얘기는 그만하세요."],
    relief: ["그렇게 말해 주니 좀 낫네요.", "그 말은 고맙네요."],
  },
  en: {
    caution: ["So the answer is just no?", "I don't want to hear about your policy."],
    relief: ["Okay, that helps.", "Thank you for saying that."],
  },
};

export type CustomerResult = {
  reply: string;
  anger: number;
  mood: Mood;
  thought: string;
  signals: CalmSignals;
};

function lastStaffText(turns: ChatTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn && turn.role === "staff") return turn.text;
  }
  return "";
}

export function simulateCustomer(
  scenario: Scenario,
  turns: ChatTurn[],
  options: { difficulty: Difficulty; anger: number },
): CustomerResult {
  const staffTurns = turns.filter((t) => t.role === "staff").length;
  const text = lastStaffText(turns);
  const detection = detectSignals(text, scenario.lang);
  const anger = clampAnger(
    options.anger + angerDelta(detection, text, options.difficulty, scenario.focus),
  );
  const mood = moodFromAnger(anger);
  const thought = scenario.sim.thoughts[mood];

  if (staffTurns >= MAX_STAFF_TURNS) {
    return { reply: scenario.sim.closing[mood], anger, mood, thought, signals: detection.signals };
  }

  const said = turns.filter((t) => t.role === "customer").map((t) => t.text);
  const unused = (line: string) => !said.some((s) => s.includes(line));
  const pick = staffTurns % 2 === 0 ? 1 : 0;
  const line =
    scenario.sim.lines[mood].find(unused) ??
    EXTRA[scenario.lang][mood].find(unused) ??
    EXTRA[scenario.lang][mood][pick];

  const reaction = REACTION[scenario.lang];
  let prefix = "";
  if (detection.cautions.length > 0) prefix = reaction.caution[pick];
  else if (options.anger - anger >= 12 && mood !== "calm") prefix = reaction.relief[pick];

  return {
    reply: prefix ? `${prefix} ${line}` : line,
    anger,
    mood,
    thought,
    signals: detection.signals,
  };
}

/* ---------- Coach ---------- */

const GOOD: Record<CalmStep, (quote: string) => string> = {
  care: (q) => `“${q}”라고 고객의 마음을 먼저 받아 준 점이 좋았어요.`,
  apologize: (q) => `“${q}”라고 사과하며 상황을 확인하려 한 점이 좋았어요.`,
  lead: (q) => `“${q}”라고 할 수 있는 일을 구체적으로 말한 점이 좋았어요.`,
  makeSure: (q) => `“${q}”라고 약속을 확인하며 마무리한 점이 좋았어요.`,
};

const GOOD_FALLBACK: [string, string] = [
  "끝까지 대화를 이어 가며 고객의 말을 들으려 한 점이 좋았어요.",
  "짧은 시간 안에 답을 놓치지 않고 이어 간 점이 좋았어요.",
];

const IMPROVE: Record<CalmStep, string> = {
  care: "해결책을 말하기 전에, 고객이 느낀 불편을 먼저 한마디로 받아 주세요.",
  apologize: "사과와 함께, 추측하지 말고 질문으로 상황을 한 번 확인해 주세요.",
  lead: "안 되는 이유보다, 지금 할 수 있는 방법을 한 가지라도 구체적으로 말해 주세요.",
  makeSure: "언제까지 무엇을 할지 다시 말하고, 감사 인사로 마무리해 주세요.",
};

const WHY: Record<CalmStep, string> = {
  care: "감정을 먼저 받아 주면 고객이 들을 준비가 돼요.",
  apologize: "사과와 확인 질문이 있으면 추측으로 생기는 오해가 줄어요.",
  lead: "할 수 있는 방법을 먼저 말하면 거절로 들리지 않아요.",
  makeSure: "언제까지 무엇을 할지 약속하면 고객이 안심해요.",
};

const NOTE_NAME: Record<CalmStep, string> = {
  care: "공감 표현",
  apologize: "사과나 확인 질문",
  lead: "대안 제시",
  makeSure: "약속과 마무리 인사",
};

/** Cuts the sentence that carries a match down to a short quote. */
function quoteOf(text: string, pattern: RegExp): string {
  const sentences = text.split(/(?<=[.!?。])\s+/).filter(Boolean);
  const source = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const hit = sentences.find((s) => source.test(s)) ?? text;
  const clean = hit.trim().replace(/[.!?]+$/, "");
  return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
}

/** A round has only 3 to 5 replies, so using a step once is solid and twice is full marks. */
function stepScore(step: CalmStep, count: number): number {
  if (count === 0) return 1;
  // Closing happens once by nature: doing it at all is complete.
  if (step === "makeSure") return 5;
  return count >= 2 ? 5 : 4;
}

type Review = {
  lexicon: Lexicon;
  staff: string[];
  detections: Detection[];
  counts: Record<CalmStep, number>;
  cautions: string[];
  cushions: string[];
};

function review(scenario: Scenario, turns: ChatTurn[]): Review {
  const lexicon = scenario.lang === "en" ? EN : KO;
  const staff = turns.filter((t) => t.role === "staff").map((t) => t.text);
  const detections = staff.map((text) => detectSignals(text, scenario.lang));
  const counts: Record<CalmStep, number> = { care: 0, apologize: 0, lead: 0, makeSure: 0 };
  for (const d of detections) {
    for (const step of CALM_ORDER) if (d.signals[step]) counts[step] += 1;
  }
  return {
    lexicon,
    staff,
    detections,
    counts,
    cautions: detections.flatMap((d) => d.cautions),
    cushions: detections.flatMap((d) => d.cushions),
  };
}

export function simulateFeedback(scenario: Scenario, turns: ChatTurn[]): Feedback {
  const r = review(scenario, turns);
  const averageLength = r.staff.reduce((sum, s) => sum + s.length, 0) / Math.max(1, r.staff.length);

  let tone = 4;
  if (r.cushions.length >= 1 && r.cautions.length === 0) tone += 1;
  tone -= r.cautions.length;
  if (averageLength < 15) tone -= 1;

  const scores: Scores = {
    care: stepScore("care", r.counts.care),
    apologize: stepScore("apologize", r.counts.apologize),
    lead: stepScore("lead", r.counts.lead),
    makeSure: stepScore("makeSure", r.counts.makeSure),
    tone: clampScore(tone),
  };

  // Praise the two steps the staff used most, the scenario's key step first on a tie.
  const ranked = [...CALM_ORDER]
    .filter((step) => r.counts[step] > 0)
    .sort(
      (a, b) =>
        r.counts[b] - r.counts[a] || Number(b === scenario.focus) - Number(a === scenario.focus),
    );
  const goods = ranked.slice(0, 2).map((step) => {
    const index = r.detections.findIndex((d) => d.signals[step]);
    return GOOD[step](quoteOf(r.staff[index] ?? "", r.lexicon[step]));
  });
  const good: [string, string] = [goods[0] ?? GOOD_FALLBACK[0], goods[1] ?? GOOD_FALLBACK[1]];

  // Coach the scenario's key step first when it is missing, then the usual order.
  const missing = [scenario.focus, ...CALM_ORDER].find((step) => r.counts[step] === 0);
  const firstCaution = r.cautions[0];
  let improve = "네 단계를 모두 썼어요. 다음에는 더 짧고 또렷한 문장으로 말해 보세요.";
  if (firstCaution) {
    improve = `“${firstCaution}” 같은 말은 고객을 더 화나게 할 수 있어요. 안 되는 이유보다 할 수 있는 방법을 먼저 말해 보세요.`;
  } else if (missing) {
    improve = IMPROVE[missing];
  }

  const covered = CALM_ORDER.filter((step) => r.counts[step] > 0).length;
  let summary = "쉽지 않은 고객이었어요. 한 단계씩 더해 가면 금방 좋아져요.";
  if (covered === 4 && r.cautions.length === 0) {
    summary = "공감부터 마무리까지 네 단계를 고르게 쓴 응대였어요.";
  } else if (covered >= 3) {
    summary = "고객의 마음을 살피며 차분하게 이끈 응대였어요.";
  } else if (covered === 2) {
    summary = "좋은 표현이 있었어요. 빠진 단계를 더하면 훨씬 탄탄해져요.";
  }

  const stepNote = (step: CalmStep) =>
    r.counts[step] > 0
      ? `${NOTE_NAME[step]}이 ${r.counts[step]}번 있었어요.`
      : `${NOTE_NAME[step]}이 보이지 않았어요.`;

  return {
    good,
    improve,
    nextLine: scenario.model[firstCaution ? "lead" : (missing ?? scenario.focus)],
    summary,
    scores,
    notes: {
      care: stepNote("care"),
      apologize: stepNote("apologize"),
      lead: stepNote("lead"),
      makeSure: stepNote("makeSure"),
      tone:
        r.cautions.length > 0
          ? `주의할 표현이 ${r.cautions.length}번 있었어요.`
          : "정중한 말투를 끝까지 지켰어요.",
    },
  };
}

/** Pairs each staff reply with the curated model sentence for the step it missed. */
export function simulateCompare(scenario: Scenario, turns: ChatTurn[]): ModelCompare[] {
  const r = review(scenario, turns);
  const priority: CalmStep[] = ["care", "lead", "apologize", "makeSure"];
  const used = new Set<CalmStep>();

  return r.staff.slice(0, 3).map((yours, i) => {
    const signals = r.detections[i]?.signals;
    const missing =
      priority.find((step) => !signals?.[step] && !used.has(step)) ??
      priority.find((step) => !used.has(step)) ??
      scenario.focus;
    used.add(missing);
    const alreadyGood = signals ? CALM_ORDER.filter((step) => signals[step]).length >= 3 : false;
    return {
      yours,
      better: scenario.model[missing],
      why: alreadyGood ? "이미 좋은 답이에요. 이렇게 더 짧게 말해도 돼요." : WHY[missing],
    };
  });
}

/* ---------- Delivery metrics for spoken answers ---------- */

export type PaceLabel = "slow" | "good" | "fast";

/** Korean pace is counted in syllables, English in words scaled to syllables. */
export function countSyllables(text: string, lang: ScenarioLang = "ko"): number {
  if (lang === "en") return Math.round((text.match(/[A-Za-z']+/g) ?? []).length * 1.4);
  return (text.match(/[가-힣]/g) ?? []).length;
}

export function syllablesPerMinute(text: string, seconds: number, lang: ScenarioLang = "ko") {
  if (seconds <= 0.5) return 0;
  return Math.round((countSyllables(text, lang) / seconds) * 60);
}

/** Reference bands for a calm service voice; a guide, not a grade. */
export function paceLabel(perMinute: number): PaceLabel {
  if (perMinute < 230) return "slow";
  if (perMinute > 340) return "fast";
  return "good";
}

export const PACE_TEXT: Record<PaceLabel, string> = {
  slow: "차분하고 느린 편이에요",
  good: "듣기 편한 속도예요",
  fast: "조금 빠른 편이에요",
};
