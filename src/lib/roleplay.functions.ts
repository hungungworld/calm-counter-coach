import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  DIFFICULTY_IDS,
  MAX_AUDIO_BASE64_LENGTH,
  MAX_REPLY_LENGTH,
  MAX_STAFF_TURNS,
  SCENARIO_IDS,
  getScenario,
} from "./roleplay-rules";
import type { CalmSignals, Feedback, ModelCompare, Mood } from "./roleplay-rules";
import { simulateCompare, simulateCustomer, simulateFeedback } from "./roleplay-sim";
import {
  askCustomer,
  coachCompare,
  coachFeedback,
  friendlyError,
  logGatewayError,
  speakLine,
  transcribeAnswer,
} from "./roleplay.server";

/** "ai" came from the gateway; "sim" is the built-in rule-based engine that took over. */
export type Engine = "ai" | "sim";

const talkSchema = z.object({
  scenarioId: z.enum(SCENARIO_IDS),
  difficulty: z.enum(DIFFICULTY_IDS).default("normal"),
  turns: z
    .array(
      z.object({
        role: z.enum(["staff", "customer"]),
        text: z
          .string()
          .trim()
          .min(1)
          .max(MAX_REPLY_LENGTH + 200),
      }),
    )
    .min(1)
    .max(MAX_STAFF_TURNS * 2 + 1),
});

const replySchema = talkSchema.extend({ anger: z.number().min(0).max(100) });

type CustomerReplyResult =
  | {
      ok: true;
      engine: Engine;
      reply: string;
      mood: Mood;
      anger: number;
      thought: string;
      signals: CalmSignals;
    }
  | { ok: false; error: string };

// Practice must never dead-end: when the gateway fails for any reason, the rule-based
// engine answers instead and the response says so (`engine: "sim"`).
export const getCustomerReply = createServerFn({ method: "POST" })
  .validator((data: unknown) => replySchema.parse(data))
  .handler(async ({ data }): Promise<CustomerReplyResult> => {
    const staffTurns = data.turns.filter((t) => t.role === "staff").length;
    if (staffTurns === 0 || staffTurns > MAX_STAFF_TURNS) {
      return { ok: false, error: "대화 횟수를 넘었어요. 피드백을 받아 보세요." };
    }
    const scenario = getScenario(data.scenarioId);
    const options = { difficulty: data.difficulty, anger: data.anger };
    try {
      const result = await askCustomer(scenario, data.turns, options);
      return { ok: true, engine: "ai", ...result };
    } catch (error) {
      logGatewayError(error);
      return { ok: true, engine: "sim", ...simulateCustomer(scenario, data.turns, options) };
    }
  });

export const getFeedback = createServerFn({ method: "POST" })
  .validator((data: unknown) => talkSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; engine: Engine; feedback: Feedback } | { ok: false; error: string }
    > => {
      const staffTurns = data.turns.filter((t) => t.role === "staff").length;
      if (staffTurns === 0) {
        return { ok: false, error: "직원 답변이 없어서 피드백을 만들 수 없어요." };
      }
      const scenario = getScenario(data.scenarioId);
      try {
        return { ok: true, engine: "ai", feedback: await coachFeedback(scenario, data.turns) };
      } catch (error) {
        logGatewayError(error);
        return { ok: true, engine: "sim", feedback: simulateFeedback(scenario, data.turns) };
      }
    },
  );

export const getModelCompare = createServerFn({ method: "POST" })
  .validator((data: unknown) => talkSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; engine: Engine; compare: ModelCompare[] } | { ok: false; error: string }
    > => {
      const staffTurns = data.turns.filter((t) => t.role === "staff").length;
      if (staffTurns === 0) {
        return { ok: false, error: "직원 답변이 없어서 비교할 수 없어요." };
      }
      const scenario = getScenario(data.scenarioId);
      try {
        return { ok: true, engine: "ai", compare: await coachCompare(scenario, data.turns) };
      } catch (error) {
        logGatewayError(error);
        return { ok: true, engine: "sim", compare: simulateCompare(scenario, data.turns) };
      }
    },
  );

const transcribeSchema = z.object({
  audio: z.string().min(200).max(MAX_AUDIO_BASE64_LENGTH),
  mime: z.string().min(3).max(60),
  lang: z.enum(["ko", "en"]),
});

/** Speech to text for one spoken answer. The audio is not stored anywhere. */
export const transcribeSpeech = createServerFn({ method: "POST" })
  .validator((data: unknown) => transcribeSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    try {
      const text = await transcribeAnswer(data.audio, data.mime, data.lang);
      if (!text) return { ok: false, error: "말소리가 잘 들리지 않았어요. 다시 말해 주세요." };
      return { ok: true, text: text.slice(0, MAX_REPLY_LENGTH) };
    } catch (error) {
      return { ok: false, error: friendlyError(error) };
    }
  });

const speechSchema = z.object({
  scenarioId: z.enum(SCENARIO_IDS),
  text: z.string().trim().min(1).max(400),
  anger: z.number().min(0).max(100),
});

/** Text to speech for one customer line. The browser voice takes over when this fails. */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .validator((data: unknown) => speechSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; audio: string; mime: string } | { ok: false }> => {
    const scenario = getScenario(data.scenarioId);
    try {
      const speech = await speakLine(data.text, scenario.look.voice.id, data.anger, scenario.lang);
      return { ok: true, ...speech };
    } catch (error) {
      logGatewayError(error);
      return { ok: false };
    }
  });
