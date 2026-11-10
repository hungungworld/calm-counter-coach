import {
  generateResponse,
  GatewayError,
  PaymentRequiredError,
  RateLimitError,
  PermissionDeniedError,
} from "@lovable.dev/ai-gateway";
import type { ResponsesResponse } from "@lovable.dev/ai-gateway";

import { MAX_STAFF_TURNS, type ChatTurn, type Mood, type Scenario } from "./roleplay-rules";

const MODEL = "openai/gpt-6-astra" as const;

const SAFETY_RULES = `
- 모든 말은 한국어로, 쉬운 말로 해요.
- 실제 회사, 브랜드, 매장, 사람 이름은 절대 말하지 않아요.
- 의료나 법률에 대한 판단·조언은 하지 않아요.
- 전화번호, 주소, 카드번호 같은 개인정보를 묻거나 말하지 않아요.
- 욕설, 차별, 위협하는 말은 쓰지 않아요.`;

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
  if (error instanceof GatewayError) {
    console.error("[roleplay] gateway error", error.code, error.httpStatus, error.ids);
  } else {
    console.error("[roleplay] unexpected error", error);
  }
  return "답을 불러오지 못했어요. 다시 시도해 주세요.";
}

export async function askCustomer(
  scenario: Scenario,
  turns: ChatTurn[],
): Promise<{ reply: string; mood: Mood }> {
  const staffTurns = turns.filter((t) => t.role === "staff").length;
  const isLast = staffTurns >= MAX_STAFF_TURNS;

  const instructions = `당신은 백화점 직원 응대 연습용 롤플레이에서 "화난 고객" 역할을 맡았어요.
상황: ${scenario.place} — ${scenario.title}
고객 성격: ${scenario.persona}

말투 규칙:
- 해요체로, 짜증 나고 화난 말투로 1~3문장만 말해요. 짧고 실감 나게.
- 절대 역할에서 벗어나지 말고, AI라고 말하지 않아요. 고객의 말만 해요. 따옴표나 "고객:" 같은 머리말은 붙이지 않아요.
- 직원이 먼저 공감하고, 사과하고, 할 수 있는 대안을 구체적으로 말하면 조금씩 누그러져요.
- 직원이 변명하거나, 규정만 말하거나, 무시하면 더 화를 내요.
- 너무 쉽게 바로 풀리지는 않아요. 진짜 고객처럼 한두 번은 더 따져요.
${isLast ? "- 이번이 마지막 말이에요. 직원 대응에 따라 한 문장으로 대화를 마무리해요." : ""}
${SAFETY_RULES}

mood 값: 아직 많이 화나 있으면 "angry", 조금 풀렸으면 "softening", 거의 진정됐으면 "calm".`;

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
            mood: { type: "string", enum: ["angry", "softening", "calm"] },
          },
          required: ["reply", "mood"],
        },
      },
    },
  });

  const parsed = JSON.parse(extractText(res)) as { reply: string; mood: Mood };
  return { reply: parsed.reply.trim(), mood: parsed.mood };
}

export type Feedback = {
  good: [string, string];
  improve: string;
  nextLine: string;
};

export async function coachFeedback(scenario: Scenario, turns: ChatTurn[]): Promise<Feedback> {
  const instructions = `당신은 백화점 고객 응대 교육 코치예요. 현장 직원이 화난 고객과 연습한 대화를 보고 짧고 따뜻하게 피드백해요.
상황: ${scenario.place} — ${scenario.title}

피드백 규칙:
- 직원이 실제로 한 말을 근거로, 구체적으로 써요.
- good1, good2: 잘한 점 2개. 각각 한 문장.
- improve: 고칠 점 1개. 어떻게 바꾸면 좋은지 한 문장으로.
- nextLine: 다음에 같은 상황에서 고객에게 바로 쓸 수 있는 직원의 말 한 문장. 40자 안팎으로 짧게, 정중하고 자연스럽게. 외우기 쉬워야 해요.
- 직원 답이 짧거나 부족해도 격려하는 말투를 유지해요.
- 회사 규정을 단정하지 말고, 필요하면 "매장 규정을 확인해" 정도로만 말해요.
${SAFETY_RULES}`;

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
            good1: { type: "string" },
            good2: { type: "string" },
            improve: { type: "string" },
            nextLine: { type: "string" },
          },
          required: ["good1", "good2", "improve", "nextLine"],
        },
      },
    },
  });

  const p = JSON.parse(extractText(res)) as {
    good1: string;
    good2: string;
    improve: string;
    nextLine: string;
  };
  return { good: [p.good1, p.good2], improve: p.improve, nextLine: p.nextLine };
}
