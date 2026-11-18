import { describe, expect, it } from "vitest";

import {
  CALM_STEPS,
  DIFFICULTIES,
  SCENARIOS,
  SCENARIO_IDS,
  TIME_LIMIT_SECONDS,
  canRequestFeedback,
  canSendReply,
  clampAnger,
  gradeLabel,
  moodFromAnger,
  totalScore,
} from "@/lib/roleplay-rules";

describe("role-play rules", () => {
  it("gives a 3-minute practice timer", () => {
    expect(TIME_LIMIT_SECONDS).toBe(180);
  });

  it("keeps the three original scenarios first: refund, VIP claim, waiting complaint", () => {
    expect(SCENARIOS.slice(0, 3).map((s) => s.tag)).toEqual([
      "환불 요구",
      "VIP 클레임",
      "대기 항의",
    ]);
  });

  it("has one complete scenario for every scenario id", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual([...SCENARIO_IDS]);
    for (const scenario of SCENARIOS) {
      expect(scenario.firstLine.length).toBeGreaterThan(10);
      expect(scenario.policy).toHaveLength(3);
      for (const step of CALM_STEPS) expect(scenario.model[step.id].length).toBeGreaterThan(5);
    }
  });

  it("opens feedback only after 3 staff replies while time remains", () => {
    expect(canRequestFeedback({ staffTurns: 2, timeUp: false })).toBe(false);
    expect(canRequestFeedback({ staffTurns: 3, timeUp: false })).toBe(true);
  });

  it("stops new replies after the 5th staff reply", () => {
    expect(canSendReply({ staffTurns: 4, timeUp: false })).toBe(true);
    expect(canSendReply({ staffTurns: 5, timeUp: false })).toBe(false);
  });

  it("stops replies when time is up but still allows feedback after one reply", () => {
    expect(canSendReply({ staffTurns: 1, timeUp: true })).toBe(false);
    expect(canRequestFeedback({ staffTurns: 1, timeUp: true })).toBe(true);
    expect(canRequestFeedback({ staffTurns: 0, timeUp: true })).toBe(false);
  });

  it("blocks sending and feedback while the customer is still answering", () => {
    expect(canSendReply({ staffTurns: 1, timeUp: false, waiting: true })).toBe(false);
    expect(canRequestFeedback({ staffTurns: 3, timeUp: false, waiting: true })).toBe(false);
  });

  it("starts harder levels with an angrier customer", () => {
    expect(DIFFICULTIES.easy.startAnger).toBeLessThan(DIFFICULTIES.normal.startAnger);
    expect(DIFFICULTIES.normal.startAnger).toBeLessThan(DIFFICULTIES.hard.startAnger);
    expect(moodFromAnger(DIFFICULTIES.easy.startAnger)).toBe("angry");
  });

  it("maps the emotion temperature to three moods", () => {
    expect(moodFromAnger(90)).toBe("angry");
    expect(moodFromAnger(50)).toBe("softening");
    expect(moodFromAnger(20)).toBe("calm");
    expect(clampAnger(140)).toBe(100);
    expect(clampAnger(-5)).toBe(0);
  });

  it("turns five rubric scores of 1 to 5 into a 0 to 100 total", () => {
    const all = (n: number) => ({ care: n, apologize: n, lead: n, makeSure: n, tone: n });
    expect(totalScore(all(1))).toBe(0);
    expect(totalScore(all(3))).toBe(50);
    expect(totalScore(all(5))).toBe(100);
    expect(gradeLabel(100)).not.toBe(gradeLabel(0));
  });
});
