import { describe, expect, it } from "vitest";

import {
  SCENARIOS,
  TIME_LIMIT_SECONDS,
  canRequestFeedback,
  canSendReply,
} from "@/lib/roleplay-rules";

describe("role-play rules", () => {
  it("gives a 3-minute practice timer", () => {
    expect(TIME_LIMIT_SECONDS).toBe(180);
  });

  it("offers exactly three scenarios: refund, VIP claim, waiting complaint", () => {
    expect(SCENARIOS.map((s) => s.tag)).toEqual(["환불 요구", "VIP 클레임", "대기 항의"]);
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
});
