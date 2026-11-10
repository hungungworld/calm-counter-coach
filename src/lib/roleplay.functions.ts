import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { MAX_REPLY_LENGTH, MAX_STAFF_TURNS, getScenario } from "./roleplay-rules";
import { askCustomer, coachFeedback, friendlyError } from "./roleplay.server";
import type { Feedback } from "./roleplay.server";
import type { Mood } from "./roleplay-rules";

const inputSchema = z.object({
  scenarioId: z.enum(["refund", "vip", "queue"]),
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

export const getCustomerReply = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; reply: string; mood: Mood } | { ok: false; error: string }> => {
      const staffTurns = data.turns.filter((t) => t.role === "staff").length;
      if (staffTurns === 0 || staffTurns > MAX_STAFF_TURNS) {
        return { ok: false, error: "대화 횟수를 넘었어요. 피드백을 받아 보세요." };
      }
      try {
        const result = await askCustomer(getScenario(data.scenarioId), data.turns);
        return { ok: true, ...result };
      } catch (error) {
        return { ok: false, error: friendlyError(error) };
      }
    },
  );

export const getFeedback = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ ok: true; feedback: Feedback } | { ok: false; error: string }> => {
      const staffTurns = data.turns.filter((t) => t.role === "staff").length;
      if (staffTurns === 0) {
        return { ok: false, error: "직원 답변이 없어서 피드백을 만들 수 없어요." };
      }
      try {
        const feedback = await coachFeedback(getScenario(data.scenarioId), data.turns);
        return { ok: true, feedback };
      } catch (error) {
        return { ok: false, error: friendlyError(error) };
      }
    },
  );
