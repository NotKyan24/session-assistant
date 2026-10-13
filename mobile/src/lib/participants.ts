/**
 * PARTICIPANTS: who can be in a session.
 *
 * Privacy rule: participants are identified by `id` (e.g. "youth-001"), and
 * `label` is only what's shown on screen. For Day 1 the ids and labels are the
 * same placeholder codes. Real names, if ever used, would live only in `label`.
 */
export type Participant = {
  id: string;
  label: string;
};

// Hard-coded test roster for Day 1. A real roster (with sign-in) comes later.
export const TEST_PARTICIPANTS: Participant[] = [
  { id: "facilitator", label: "Facilitator" },
  { id: "youth-001", label: "youth-001" },
  { id: "youth-002", label: "youth-002" },
  { id: "youth-003", label: "youth-003" },
];
