import {
  generateResponse,
  generateSpeech,
  transcribeAudio,
  GatewayError,
  PaymentRequiredError,
  RateLimitError,
  PermissionDeniedError,
} from "@lovable.dev/ai-gateway";
import type { ResponsesResponse } from "@lovable.dev/ai-gateway";

import {
  DIFFICULTIES,
  MAX_STAFF_TURNS,
  clampAnger,
  clampScore,
  moodFromAnger,
  type CalmSignals,
  type ChatTurn,
  type Difficulty,
  type Feedback,
  type ModelCompare,
  type Mood,
  type Scenario,
  type ScenarioLang,
} from "./roleplay-rules";

const MODEL = "openai/gpt-6-astra" as const;
const SPEECH_MODEL = "openai/gpt-4o-mini-tts" as const;
const TRANSCRIBE_MODEL = "openai/gpt-4o-mini-transcribe" as const;

const SAFETY_RULES = `
- 실제 회사, 브랜드, 매장, 사람 이름은 절대 말하지 않아요.
- 의료나 법률에 대한 판단·조언은 하지 않아요.
- 전화번호, 주소, 카드번호 같은 개인정보를 묻거나 말하지 않아요.
- 욕설, 차별, 위협하는 말은 쓰지 않아요.`;

const DIFFICULTY_RULE: Record<Difficulty, string> = {
  easy: "직원이 조금만 노력해도 비교적 빨리 누그러져요.",
  normal: "실제 고객처럼 한두 번은 더 따져요.",
  hard: "쉽게 풀리지 않아요. 구체적인 대안과 약속이 있을 때만 조금씩 누그러지고, 한 번은 추가 요구를 해요.",
};

const CALM_RUBRIC = `- care(공감): 고객의 감정이나 불편을 말로 알아줬다.
- apologize(사과·확인): 사과했거나, 질문으로 사실을 확인했다.
- lead(대안): 지금 할 수 있는 방법을 구체적으로 제시했다.
- makeSure(마무리): 언제까지 무엇을 할지 약속했거나, 감사 인사로 마무리했다.`;

function extractText(res: ResponsesResponse<typeof MODEL>): string {
  const parts: string[] = [];
  for (const item of res.output ?? []) {
    if (item.type === "message") {
      for (const c of item.content) {
        if (c.type === "output_text") parts.push(c.text);
      }
    }
  }
  return parts.join("").trim();
}

function transcriptText(turns: ChatTurn[]): string {
  return turns.map((t) => `${t.role === "staff" ? "직원" : "고객"}: ${t.text}`).join("\n");
}

function policyText(scenario: Scenario): string {
  return scenario.policy.map((p) => `- ${p}`).join("\n");
}

export function friendlyError(error: unknown): string {
  if (error instanceof PaymentRequiredError) {
    return "AI 사용 한도가 다 됐어요. 관리자에게 알려 주세요.";
  }
  if (error instanceof RateLimitError) {
    return "지금 요청이 많아요. 잠시 뒤 다시 눌러 주세요.";
  }
  if (error instanceof PermissionDeniedError) {
    return "지금은 AI를 쓸 수 없어요. 관리자에게 알려 주세요.";
  }
  logGatewayError(error);
  return "답을 불러오지 못했어요. 다시 시도해 주세요.";
}

export function logGatewayError(error: unknown): void {
  if (error instanceof GatewayError) {
    console.error("[roleplay] gateway error", error.code, error.httpStatus, error.ids);
  } else {
    console.error("[roleplay] unexpected error", error);
  }
}

export type CustomerReply = {
  reply: string;
  mood: Mood;
  anger: number;
  thought: string;
  signals: CalmSignals;
};

export async function askCustomer(
  scenario: Scenario,
  turns: ChatTurn[],
  options: { difficulty: Difficulty; anger: number },
): Promise<CustomerReply> {
  const staffTurns = turns.filter((t) => t.role === "staff").length;
  const isLast = staffTurns >= MAX_STAFF_TURNS;
  const english = scenario.lang === "en";

  const instructions = `당신은 백화점 직원 응대 연습용 롤플레이에서 "화난 고객" 역할을 맡았어요.
상황: ${scenario.place} — ${scenario.title}
고객 성격: ${scenario.persona}
고객의 속마음(직접 말하지는 않아요): ${scenario.hiddenNeed}
이 연습의 가상 규정(직원이 이 범위에서 제안하면 받아들일 수 있어요):
${policyText(scenario)}

지금 감정 온도: ${options.anger} (0은 완전히 진정, 100은 매우 화남)
난이도: ${DIFFICULTIES[options.difficulty].label} — ${DIFFICULTY_RULE[options.difficulty]}

말투 규칙:
${
  english
    ? "- 고객은 영어로만 말해요. reply는 자연스럽고 쉬운 영어 1~3문장이에요. 직원이 한국어로 답하면 알아듣지 못하고 영어로 다시 물어요."
    : "- 해요체로, 감정 온도에 맞는 말투로 1~3문장만 말해요. 짧고 실감 나게. 쉬운 한국어만 써요."
}
- 절대 역할에서 벗어나지 말고, AI라고 말하지 않아요. 고객의 말만 해요. 따옴표나 "고객:" 같은 머리말은 붙이지 않아요.
- 직원이 먼저 공감하고, 사과하고, 할 수 있는 대안을 구체적으로 말하면 조금씩 누그러져요.
- 직원이 속마음을 알아채고 채워 주면 더 빨리 풀려요.
- 직원이 변명하거나, 규정만 말하거나, 무시하면 더 화를 내요.
- 한 번에 감정 온도는 보통 5~20 정도만 움직여요. 너무 쉽게 바로 풀리지는 않아요.
${isLast ? "- 이번이 마지막 말이에요. 직원 대응에 따라 한 문장으로 대화를 마무리해요." : ""}
${SAFETY_RULES}

JSON 필드:
- reply: 고객의 다음 말.
- anger: 이 말을 하는 순간의 감정 온도(0~100 정수).
- thought: 이 순간 고객의 속마음 한 문장. 한국어, 30자 안팎. 대화가 끝난 뒤 직원에게 보여 줘요.
- care, apologize, lead, makeSure: 직원의 "마지막 답"에 아래 행동이 있었는지 true/false.
${CALM_RUBRIC}`;

  const res = await generateResponse({
    model: MODEL,
    instructions,
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: `지금까지 대화예요. 다음 고객의 말을 JSON으로 답해 주세요.\n\n${transcriptText(turns)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "customer_reply",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reply: { type: "string" },
            anger: { type: "integer" },
            thought: { type: "string" },
            care: { type: "boolean" },
            apologize: { type: "boolean" },
            lead: { type: "boolean" },
            makeSure: { type: "boolean" },
          },
          required: ["reply", "anger", "thought", "care", "apologize", "lead", "makeSure"],
        },
      },
    },
  });

  const parsed = JSON.parse(extractText(res)) as {
    reply: string;
    anger: number;
    thought: string;
  } & CalmSignals;

  // One reply should never swing the customer from furious to delighted (or back).
  const anger = clampAnger(
    Math.max(options.anger - 30, Math.min(options.anger + 30, parsed.anger)),
  );
  const reply = parsed.reply.trim();
  if (!reply) throw new Error("empty customer reply");

  return {
    reply,
    anger,
    mood: moodFromAnger(anger),
    thought: parsed.thought.trim(),
    signals: {
      care: Boolean(parsed.care),
      apologize: Boolean(parsed.apologize),
      lead: Boolean(parsed.lead),
      makeSure: Boolean(parsed.makeSure),
    },
  };
}

export async function coachFeedback(scenario: Scenario, turns: ChatTurn[]): Promise<Feedback> {
  const instructions = `당신은 백화점 고객 응대 교육 코치예요. 현장 직원이 화난 고객과 연습한 대화를 보고 짧고 따뜻하게 피드백해요.
상황: ${scenario.place} — ${scenario.title}
이 상황의 연습 목표: ${scenario.goal}
이 연습의 가상 규정:
${policyText(scenario)}

평가 기준(CALM 응대법):
${CALM_RUBRIC}
- tone(말투): 정중하고 쉬운 말을 썼고, "안 됩니다", "규정상" 같은 단정적인 거절 표현을 피했다.

점수 규칙: 항목마다 1~5점.
5 = 대화 내내 자연스럽고 충분했다 / 4 = 분명히 있었다 / 3 = 있었지만 짧거나 한 번뿐이다 / 2 = 시도했지만 어색하거나 부족하다 / 1 = 없었다.

피드백 규칙:
- 모든 피드백은 한국어로, 쉬운 말로 써요.
- 직원이 실제로 한 말을 근거로, 구체적으로 써요.
- good1, good2: 잘한 점 2개. 각각 한 문장.
- improve: 고칠 점 1개. 어떻게 바꾸면 좋은지 한 문장으로.
- nextLine: 다음에 같은 상황에서 고객에게 바로 쓸 수 있는 직원의 말 한 문장. 40자 안팎으로 짧게, 정중하고 자연스럽게. 외우기 쉬워야 해요.${
    scenario.lang === "en" ? " 이 상황은 영어 응대라서 nextLine은 쉬운 영어 한 문장으로 써요." : ""
  }
- summary: 이번 연습 전체를 격려하는 말투로 한 문장으로 요약해요.
- careNote, apologizeNote, leadNote, makeSureNote, toneNote: 각 점수의 이유를 25자 안팎 한 문장으로.
- 직원 답이 짧거나 부족해도 격려하는 말투를 유지해요.
- 회사 규정을 단정하지 말고, 필요하면 "매장 규정을 확인해" 정도로만 말해요.
${SAFETY_RULES}`;

  const score = { type: "integer" } as const;
  const text = { type: "string" } as const;
  const res = await generateResponse({
    model: MODEL,
    instructions,
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: `연습 대화예요. 피드백을 JSON으로 주세요.\n\n${transcriptText(turns)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "coach_feedback",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            good1: text,
            good2: text,
            improve: text,
            nextLine: text,
            summary: text,
            care: score,
            apologize: score,
            lead: score,
            makeSure: score,
            tone: score,
            careNote: text,
            apologizeNote: text,
            leadNote: text,
            makeSureNote: text,
            toneNote: text,
          },
          required: [
            "good1",
            "good2",
            "improve",
            "nextLine",
            "summary",
            "care",
            "apologize",
            "lead",
            "makeSure",
            "tone",
            "careNote",
            "apologizeNote",
            "leadNote",
            "makeSureNote",
            "toneNote",
          ],
        },
      },
    },
  });

  const p = JSON.parse(extractText(res)) as Record<
    | "good1"
    | "good2"
    | "improve"
    | "nextLine"
    | "summary"
    | "careNote"
    | "apologizeNote"
    | "leadNote"
    | "makeSureNote"
    | "toneNote",
    string
  > &
    Record<"care" | "apologize" | "lead" | "makeSure" | "tone", number>;

  return {
    good: [p.good1, p.good2],
    improve: p.improve,
    nextLine: p.nextLine,
    summary: p.summary,
    scores: {
      care: clampScore(p.care),
      apologize: clampScore(p.apologize),
      lead: clampScore(p.lead),
      makeSure: clampScore(p.makeSure),
      tone: clampScore(p.tone),
    },
    notes: {
      care: p.careNote,
      apologize: p.apologizeNote,
      lead: p.leadNote,
      makeSure: p.makeSureNote,
      tone: p.toneNote,
    },
  };
}

/** Rewrites up to three of the staff's own replies so they can compare line by line. */
export async function coachCompare(scenario: Scenario, turns: ChatTurn[]): Promise<ModelCompare[]> {
  const instructions = `당신은 백화점 고객 응대 교육 코치예요. 직원이 연습에서 실제로 한 답을, 같은 상황에서 더 좋은 답으로 고쳐 보여 줘요.
상황: ${scenario.place} — ${scenario.title}
이 상황의 연습 목표: ${scenario.goal}
이 연습의 가상 규정:
${policyText(scenario)}

CALM 응대법:
${CALM_RUBRIC}

규칙:
- 직원의 답을 앞에서부터 최대 3개 골라요.
- yours: 직원이 한 말 그대로.
- better: 같은 순간에 쓸 수 있는 더 좋은 답. 1~2문장, 정중하고 자연스럽게.${
    scenario.lang === "en" ? " 이 상황은 영어 응대라서 better는 쉬운 영어로 써요." : ""
  }
- why: 왜 더 좋은지 한국어 한 문장으로, 쉬운 말로.
- 가상 규정을 넘는 약속은 쓰지 않아요.
${SAFETY_RULES}`;

  const res = await generateResponse({
    model: MODEL,
    instructions,
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: `연습 대화예요. 비교 결과를 JSON으로 주세요.\n\n${transcriptText(turns)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "model_compare",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  yours: { type: "string" },
                  better: { type: "string" },
                  why: { type: "string" },
                },
                required: ["yours", "better", "why"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  });

  const parsed = JSON.parse(extractText(res)) as { items: ModelCompare[] };
  const items = parsed.items.slice(0, 3).filter((item) => item.yours && item.better);
  if (items.length === 0) throw new Error("empty compare result");
  return items;
}

/* ---------- Voice ---------- */

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const AUDIO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** Turns one spoken answer into text. The recording is used once and never stored. */
export async function transcribeAnswer(
  audioBase64: string,
  mime: string,
  lang: ScenarioLang,
): Promise<string> {
  const type = mime.split(";")[0] ?? "audio/webm";
  const file = new File([fromBase64(audioBase64)], `answer.${AUDIO_EXTENSION[type] ?? "webm"}`, {
    type,
  });
  const res = await transcribeAudio({
    model: TRANSCRIBE_MODEL,
    file,
    language: lang,
    prompt:
      lang === "en"
        ? "A department store employee politely helps an upset customer."
        : "백화점 직원이 화난 고객에게 정중하게 응대하는 말입니다.",
  });
  return (typeof res === "string" ? res : res.text).trim();
}

function voiceDirection(anger: number, lang: ScenarioLang): string {
  const language =
    lang === "en"
      ? "Speak natural English as a foreign tourist."
      : "Speak natural, conversational Korean (해요체).";
  if (anger >= 62) {
    return `${language} You are an upset department store customer: irritated, fast, sharp and loud, with clipped endings. Do not shout or scream.`;
  }
  if (anger >= 34) {
    return `${language} You are a customer who is still annoyed but starting to listen: guarded, a little tired, slower than before.`;
  }
  return `${language} You are a customer who has calmed down: relieved, softer and warmer, at an unhurried pace.`;
}

/** Speaks one customer line in a voice that matches the emotion temperature. */
export async function speakLine(
  text: string,
  voice: string,
  anger: number,
  lang: ScenarioLang,
): Promise<{ audio: string; mime: string }> {
  const res = await generateSpeech({
    model: SPEECH_MODEL,
    input: text,
    voice,
    instructions: voiceDirection(anger, lang),
    response_format: "mp3",
  });
  const blob = await res.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0) throw new Error("empty speech audio");
  return { audio: toBase64(bytes), mime: "audio/mpeg" };
}
