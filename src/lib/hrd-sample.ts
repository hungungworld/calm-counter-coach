// Example numbers for the HRD dashboard.
//
// The app stores nothing on a server, so there is no real cohort data to show. These
// figures are made up to demonstrate what a training owner would see once practice
// results are collected through a company account. Every screen that uses them says so.
// The totals are kept consistent with each other (people, sessions, weighted averages).

import type { CalmStep, ScenarioId, ScoreKey } from "./roleplay-rules";

export type WeekRow = { week: string; sessions: number; participation: number; average: number };
export type StoreRow = {
  store: string;
  staff: number;
  active: number;
  average: number;
  retryGain: number;
};
export type RoleRow = {
  role: string;
  staff: number;
  active: number;
  average: number;
  perPerson: number;
};
export type ScenarioRow = {
  id: ScenarioId;
  sessions: number;
  average: number;
  /** Average drop in the customer's emotion temperature. */
  cooling: number;
  weakest: CalmStep;
};

export const HRD_SAMPLE: {
  period: string;
  weeks: WeekRow[];
  stores: StoreRow[];
  roles: RoleRow[];
  scenarios: ScenarioRow[];
  steps: Record<ScoreKey, number>;
  /** Average gain between a first attempt and a retry of the same situation. */
  retryGain: number;
} = {
  period: "2026년 9월 4주 ~ 11월 3주 (8주)",
  weeks: [
    { week: "9월 4주", sessions: 212, participation: 31, average: 58 },
    { week: "10월 1주", sessions: 298, participation: 42, average: 61 },
    { week: "10월 2주", sessions: 356, participation: 51, average: 63 },
    { week: "10월 3주", sessions: 401, participation: 58, average: 65 },
    { week: "10월 4주", sessions: 447, participation: 63, average: 67 },
    { week: "11월 1주", sessions: 489, participation: 68, average: 68 },
    { week: "11월 2주", sessions: 512, participation: 71, average: 70 },
    { week: "11월 3주", sessions: 538, participation: 74, average: 71 },
  ],
  stores: [
    { store: "A점", staff: 120, active: 98, average: 74, retryGain: 11 },
    { store: "B점", staff: 104, active: 81, average: 72, retryGain: 9 },
    { store: "C점", staff: 96, active: 73, average: 70, retryGain: 10 },
    { store: "D점", staff: 88, active: 60, average: 69, retryGain: 8 },
    { store: "E점", staff: 82, active: 55, average: 67, retryGain: 7 },
    { store: "F점", staff: 70, active: 45, average: 66, retryGain: 6 },
  ],
  roles: [
    { role: "신입사원 (입문교육)", staff: 64, active: 61, average: 68, perPerson: 10.2 },
    { role: "직영 사원", staff: 196, active: 150, average: 73, perPerson: 7.1 },
    { role: "협력사원", staff: 300, active: 201, average: 69, perPerson: 7.9 },
  ],
  scenarios: [
    { id: "refund", sessions: 742, average: 66, cooling: 31, weakest: "lead" },
    { id: "vip", sessions: 586, average: 70, cooling: 34, weakest: "care" },
    { id: "queue", sessions: 533, average: 74, cooling: 38, weakest: "makeSure" },
    { id: "food", sessions: 371, average: 68, cooling: 30, weakest: "apologize" },
    { id: "alteration", sessions: 318, average: 72, cooling: 36, weakest: "makeSure" },
    { id: "pickup", sessions: 284, average: 69, cooling: 33, weakest: "lead" },
    { id: "overclaim", sessions: 236, average: 58, cooling: 22, weakest: "lead" },
    { id: "global", sessions: 183, average: 61, cooling: 27, weakest: "lead" },
  ],
  steps: { care: 3.6, apologize: 3.9, lead: 2.9, makeSure: 3.1, tone: 3.8 },
  retryGain: 9,
};

export function hrdTotals(sample = HRD_SAMPLE) {
  const staff = sample.stores.reduce((sum, s) => sum + s.staff, 0);
  const active = sample.stores.reduce((sum, s) => sum + s.active, 0);
  const sessions = sample.weeks.reduce((sum, w) => sum + w.sessions, 0);
  const first = sample.weeks[0];
  const last = sample.weeks[sample.weeks.length - 1];
  return {
    staff,
    active,
    sessions,
    participation: Math.round((active / staff) * 100),
    perPerson: Math.round((sessions / active) * 10) / 10,
    average: last?.average ?? 0,
    averageGain: (last?.average ?? 0) - (first?.average ?? 0),
  };
}

/** Byte-order mark so spreadsheet apps read the Korean text as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** Rows of the tables as CSV, for a training owner who wants them in a spreadsheet. */
export function hrdCsv(sample = HRD_SAMPLE, scenarioName: (id: ScenarioId) => string): string {
  const lines = [
    "구분,항목,연습 수,참여율(%),평균 점수",
    ...sample.weeks.map((w) => `주차,${w.week},${w.sessions},${w.participation},${w.average}`),
    ...sample.stores.map(
      (s) => `점포,${s.store},,${Math.round((s.active / s.staff) * 100)},${s.average}`,
    ),
    ...sample.roles.map(
      (r) => `직군,${r.role},,${Math.round((r.active / r.staff) * 100)},${r.average}`,
    ),
    ...sample.scenarios.map((s) => `상황,${scenarioName(s.id)},${s.sessions},,${s.average}`),
  ];
  return BOM + lines.join("\n");
}
