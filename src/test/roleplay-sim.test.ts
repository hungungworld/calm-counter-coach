import { describe, expect, it } from "vitest";

import {
  MAX_STAFF_TURNS,
  SCENARIOS,
  getScenario,
  totalScore,
  type ChatTurn,
} from "@/lib/roleplay-rules";
import {
  detectSignals,
  paceLabel,
  simulateCompare,
  simulateCustomer,
  simulateFeedback,
  syllablesPerMinute,
} from "@/lib/roleplay-sim";

const refund = getScenario("refund");

function talk(scenario: typeof refund, replies: string[], startAnger = 76) {
  let anger = startAnger;
  const turns: ChatTurn[] = [{ role: "customer", text: scenario.firstLine }];
  for (const reply of replies) {
    turns.push({ role: "staff", text: reply });
    const result = simulateCustomer(scenario, turns, { difficulty: "normal", anger });
    anger = result.anger;
    turns.push({ role: "customer", text: result.reply });
  }
  return { turns, anger };
}

describe("offline engine: reading a staff reply", () => {
  it("recognises each CALM step in the curated model sentences", () => {
    for (const scenario of SCENARIOS) {
      expect(detectSignals(scenario.model.care, scenario.lang).signals.care).toBe(true);
      expect(detectSignals(scenario.model.apologize, scenario.lang).signals.apologize).toBe(true);
      expect(detectSignals(scenario.model.lead, scenario.lang).signals.lead).toBe(true);
      expect(detectSignals(scenario.model.makeSure, scenario.lang).signals.makeSure).toBe(true);
    }
  });

  it("flags a flat refusal and finds no CALM step in it", () => {
    const { signals, cautions } = detectSignals("안 됩니다. 규정상 영수증 없으면 환불 불가능해요.");
    expect(cautions.length).toBeGreaterThanOrEqual(2);
    expect(Object.values(signals).some(Boolean)).toBe(false);
  });

  it("never flags the model sentences as cautions", () => {
    for (const scenario of SCENARIOS) {
      const lines = Object.values(scenario.model).join(" ");
      expect(detectSignals(lines, scenario.lang).cautions).toEqual([]);
    }
  });
});

describe("offline engine: the customer", () => {
  it("cools down when the staff follows CALM", () => {
    const { anger } = talk(refund, [refund.model.care, refund.model.apologize, refund.model.lead]);
    expect(anger).toBeLessThan(50);
  });

  it("heats up when the staff only refuses", () => {
    const { anger } = talk(refund, ["안 됩니다.", "규정상 불가능해요."]);
    expect(anger).toBeGreaterThan(76);
  });

  it("softens more slowly at the hard level", () => {
    const turns: ChatTurn[] = [
      { role: "customer", text: refund.firstLine },
      { role: "staff", text: refund.model.lead },
    ];
    const easy = simulateCustomer(refund, turns, { difficulty: "easy", anger: 80 });
    const hard = simulateCustomer(refund, turns, { difficulty: "hard", anger: 80 });
    expect(easy.anger).toBeLessThan(hard.anger);
  });

  it("closes the conversation on the last allowed reply", () => {
    const replies = Array.from({ length: MAX_STAFF_TURNS }, () => refund.model.lead);
    const { turns } = talk(refund, replies);
    const last = turns[turns.length - 1];
    expect(Object.values(refund.sim.closing)).toContain(last?.text);
  });

  it("does not repeat itself while its lines last", () => {
    const { turns } = talk(refund, ["네.", "네.", "네."]);
    const said = turns.filter((t) => t.role === "customer").map((t) => t.text);
    expect(new Set(said).size).toBe(said.length);
  });

  it("answers in English in the English scenario", () => {
    const global = getScenario("global");
    const { turns } = talk(global, [global.model.apologize]);
    expect(turns[turns.length - 1]?.text).toMatch(/^[\x20-\x7E]+$/);
  });
});

describe("offline engine: the coach", () => {
  it("scores a full CALM round above a round of refusals", () => {
    const good = talk(refund, Object.values(refund.model));
    const bad = talk(refund, ["안 됩니다.", "규정상 불가능해요.", "어쩔 수 없어요."]);
    const goodScore = totalScore(simulateFeedback(refund, good.turns).scores);
    const badScore = totalScore(simulateFeedback(refund, bad.turns).scores);
    expect(goodScore).toBeGreaterThan(80);
    expect(badScore).toBeLessThan(30);
  });

  it("quotes what the staff said and coaches the missing step", () => {
    const { turns } = talk(refund, [refund.model.care, refund.model.apologize, "네, 알겠습니다."]);
    const feedback = simulateFeedback(refund, turns);
    expect(feedback.good[0]).toContain("“");
    expect(feedback.improve).toContain("방법");
    expect(feedback.nextLine).toBe(refund.model.lead);
  });

  it("names the escalating phrase when there was one", () => {
    const { turns } = talk(refund, ["안 됩니다.", refund.model.care, refund.model.apologize]);
    expect(simulateFeedback(refund, turns).improve).toContain("안 됩니다");
  });

  it("pairs each reply with a model sentence for comparison", () => {
    const { turns } = talk(refund, ["네.", "확인해 보겠습니다.", "죄송합니다."]);
    const compare = simulateCompare(refund, turns);
    expect(compare).toHaveLength(3);
    expect(compare.every((c) => Object.values(refund.model).includes(c.better))).toBe(true);
  });
});

describe("speech pace", () => {
  it("counts Korean syllables per minute", () => {
    expect(syllablesPerMinute("불편을 드려 죄송합니다", 2)).toBe(300);
    expect(paceLabel(300)).toBe("good");
    expect(paceLabel(400)).toBe("fast");
    expect(paceLabel(150)).toBe("slow");
  });
});
