/**
 * Each mutant reintroduces one defect into the engine source.
 *
 * These are not random operator flips. Every one of them corresponds to a
 * defect class that actually occurs in scheduling logic — the kind that ships,
 * survives review, and is discovered in production by a user who was given a
 * time that was not really free.
 *
 * A mutant that survives means the contract clause it targets is not really
 * enforced: the test passes for a reason other than the behaviour it claims to
 * check. That is the failure this harness exists to catch.
 */

export const mutants = [
  {
    id: 'M1',
    clause: 'C3',
    describes: 'Turnaround buffer dropped from collision checks.',
    find: 'end: b.end + resource.turnaroundMinutes,',
    replace: 'end: b.end,',
  },
  {
    id: 'M2',
    clause: 'C4',
    describes: 'Half-open intervals treated as closed; adjacency reads as collision.',
    find: 'return a.start < b.end && b.start < a.end;',
    replace: 'return a.start <= b.end && b.start <= a.end;',
  },
  {
    id: 'M3',
    clause: 'C6',
    describes: 'notAfter bounds the slot start instead of the slot end.',
    find: 'for (let start = windowStart; start + request.durationMinutes <= windowEnd; start += 1) {',
    replace: 'for (let start = windowStart; start <= windowEnd; start += 1) {',
  },
  {
    id: 'M4',
    clause: 'C7',
    describes: 'Empty resource set collapses into the generic no-availability path.',
    find: "    return { ok: false, reason: REJECTION.NO_RESOURCE };",
    replace: "    return { ok: false, reason: REJECTION.NO_AVAILABILITY };",
  },
  {
    id: 'M5',
    clause: 'C8',
    describes: 'Fractional durations accepted, producing slots on non-integer boundaries.',
    find: 'if (!Number.isInteger(request.durationMinutes) || request.durationMinutes <= 0) {',
    replace: 'if (request.durationMinutes <= 0) {',
  },
  {
    id: 'M6',
    clause: 'C2',
    describes: 'First resource examined wins instead of the earliest start time.',
    find: 'if (best === null || proposed.start < best.start) {',
    replace: 'if (best === null) {',
  },
];
