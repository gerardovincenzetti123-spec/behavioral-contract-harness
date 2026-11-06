import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSlot, REJECTION } from '../src/slot-engine.js';

const HOUR = 60;

function resource(overrides = {}) {
  return {
    id: 'r1',
    openHours: [{ start: 9 * HOUR, end: 17 * HOUR }],
    booked: [],
    turnaroundMinutes: 0,
    ...overrides,
  };
}

test('C1 — satisfies every constraint at once, or rejects', async (t) => {
  await t.test('honours notBefore and duration together', () => {
    const result = resolveSlot([resource()], { durationMinutes: 30, notBefore: 14 * HOUR });
    assert.equal(result.ok, true);
    assert.ok(result.slot.start >= 14 * HOUR);
    assert.equal(result.slot.end - result.slot.start, 30);
  });

  await t.test('rejects rather than dropping a constraint it cannot meet', () => {
    // Duration cannot fit inside the requested window at all.
    const result = resolveSlot([resource()], {
      durationMinutes: 120,
      notBefore: 16 * HOUR,
      notAfter: 17 * HOUR,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, REJECTION.NO_AVAILABILITY);
  });
});

test('C2 — returns the earliest satisfying slot', () => {
  const result = resolveSlot([resource()], { durationMinutes: 60 });
  assert.equal(result.ok, true);
  assert.equal(result.slot.start, 9 * HOUR);
});

test('C2 — prefers the earlier slot across resources', () => {
  const late = resource({ id: 'late', openHours: [{ start: 11 * HOUR, end: 17 * HOUR }] });
  const early = resource({ id: 'early', openHours: [{ start: 10 * HOUR, end: 17 * HOUR }] });
  const result = resolveSlot([late, early], { durationMinutes: 30 });
  assert.equal(result.ok, true);
  assert.equal(result.slot.resourceId, 'early');
  assert.equal(result.slot.start, 10 * HOUR);
});

test('C3 — a slot may not start inside the turnaround buffer', () => {
  const r = resource({
    booked: [{ start: 9 * HOUR, end: 10 * HOUR }],
    turnaroundMinutes: 15,
  });
  const result = resolveSlot([r], { durationMinutes: 30 });
  assert.equal(result.ok, true);
  assert.equal(result.slot.start, 10 * HOUR + 15, 'must clear the 15-minute buffer');
});

test('C3 — the proposed slot carries its own trailing buffer before the next reservation', () => {
  // Open 9–11, booked 10–11, 15-minute turnaround. A 60-minute slot at 9:00
  // would end at 10:00 with no turnaround before the 10:00 reservation.
  const r = resource({
    openHours: [{ start: 9 * HOUR, end: 11 * HOUR }],
    booked: [{ start: 10 * HOUR, end: 11 * HOUR }],
    turnaroundMinutes: 15,
  });
  const result = resolveSlot([r], { durationMinutes: 60 });
  assert.equal(result.ok, false, 'no slot leaves 15 minutes before the 10:00 reservation');
  assert.equal(result.reason, REJECTION.NO_AVAILABILITY);

  const shorter = resolveSlot([r], { durationMinutes: 45 });
  assert.equal(shorter.ok, true);
  assert.equal(shorter.slot.end, 9 * HOUR + 45, '9:00–9:45 plus 15 minutes reaches exactly 10:00: adjacency is legal');
});

test('C4 — intervals are half-open; adjacency does not collide', () => {
  const r = resource({
    openHours: [{ start: 9 * HOUR, end: 11 * HOUR }],
    booked: [{ start: 10 * HOUR, end: 11 * HOUR }],
    turnaroundMinutes: 0,
  });
  const result = resolveSlot([r], { durationMinutes: 60 });
  assert.equal(result.ok, true);
  assert.equal(result.slot.start, 9 * HOUR);
  assert.equal(result.slot.end, 10 * HOUR, 'ending exactly at a reservation start is legal');
});

test('C5 — rejections are typed, and success always carries a slot', () => {
  const rejected = resolveSlot([resource({ openHours: [] })], { durationMinutes: 30 });
  assert.equal(rejected.ok, false);
  assert.ok(Object.values(REJECTION).includes(rejected.reason));
  assert.equal(rejected.slot, undefined);

  const accepted = resolveSlot([resource()], { durationMinutes: 30 });
  assert.equal(accepted.ok, true);
  assert.ok(accepted.slot);
  assert.equal(accepted.reason, undefined);
});

test('C6 — notAfter bounds the end of the slot, not its start', () => {
  const result = resolveSlot([resource()], {
    durationMinutes: 60,
    notBefore: 16 * HOUR,
    notAfter: 16 * HOUR + 30,
  });
  assert.equal(result.ok, false, 'a slot starting at 16:00 would end at 17:00, past notAfter');
  assert.equal(result.reason, REJECTION.NO_AVAILABILITY);
});

test('C7 — empty resource set is NO_RESOURCE, not NO_AVAILABILITY', () => {
  const result = resolveSlot([resource()], { durationMinutes: 30, resourceIds: ['nope'] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, REJECTION.NO_RESOURCE);
});

test('C9 — malformed resources fail closed before search', async (t) => {
  await t.test('a missing turnaround never erases the reservations it should pad', () => {
    const r = resource({ booked: [{ start: 9 * HOUR, end: 10 * HOUR }] });
    delete r.turnaroundMinutes;
    const result = resolveSlot([r], { durationMinutes: 30 });
    assert.equal(result.ok, false, 'a 9:00 slot over a 9:00 reservation is the failure this clause exists to stop');
    assert.equal(result.reason, REJECTION.INVALID_RESOURCE);
  });

  await t.test('non-interval booked entries are rejected', () => {
    const r = resource({ booked: [{ start: 9 * HOUR }] });
    assert.equal(resolveSlot([r], { durationMinutes: 30 }).reason, REJECTION.INVALID_RESOURCE);
  });

  await t.test('a resourceIds filter that is not an array is rejected, not matched by substring', () => {
    const result = resolveSlot([resource()], { durationMinutes: 30, resourceIds: 'r1' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, REJECTION.INVALID_RESOURCE);
  });
});

test('C8 — invalid input is rejected before any search', async (t) => {
  await t.test('non-positive duration', () => {
    const result = resolveSlot([resource()], { durationMinutes: 0 });
    assert.equal(result.reason, REJECTION.INVALID_DURATION);
  });

  await t.test('non-integer duration', () => {
    const result = resolveSlot([resource()], { durationMinutes: 30.5 });
    assert.equal(result.reason, REJECTION.INVALID_DURATION);
  });

  await t.test('inverted window', () => {
    const result = resolveSlot([resource()], {
      durationMinutes: 30,
      notBefore: 15 * HOUR,
      notAfter: 12 * HOUR,
    });
    assert.equal(result.reason, REJECTION.INVALID_WINDOW);
  });
});

// A seeded generator keeps this reproducible: the same 400 cases every run.
function lcg(seed) {
  let x = seed >>> 0;
  return () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

test('C1 — randomized: every accepted slot satisfies every constraint at once', () => {
  const rnd = lcg(20261106);
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  for (let i = 0; i < 400; i += 1) {
    const resources = Array.from({ length: int(1, 3) }, (_, k) => {
      const openStart = int(6, 12) * HOUR;
      const booked = Array.from({ length: int(0, 4) }, () => {
        const s = int(openStart, 20 * HOUR);
        return { start: s, end: s + int(15, 120) };
      });
      return {
        id: `r${k}`,
        openHours: [{ start: openStart, end: openStart + int(2, 10) * HOUR }],
        booked,
        turnaroundMinutes: int(0, 30),
      };
    });
    const notBefore = int(0, 18) * HOUR;
    const request = {
      durationMinutes: int(15, 120),
      notBefore,
      notAfter: notBefore + int(1, 8) * HOUR,
      resourceIds: rnd() < 0.3 ? [resources[0].id] : undefined,
    };

    const result = resolveSlot(resources, request);
    if (!result.ok) {
      assert.ok(Object.values(REJECTION).includes(result.reason), `typed rejection (case ${i})`);
      continue;
    }
    const { slot } = result;
    const r = resources.find((x) => x.id === slot.resourceId);
    assert.ok(r, `slot names a real resource (case ${i})`);
    assert.ok(!request.resourceIds || request.resourceIds.includes(r.id), `filter honoured (case ${i})`);
    assert.equal(slot.end - slot.start, request.durationMinutes, `duration (case ${i})`);
    assert.ok(slot.start >= request.notBefore && slot.end <= request.notAfter, `window (case ${i})`);
    assert.ok(r.openHours.some((o) => slot.start >= o.start && slot.end <= o.end), `open hours (case ${i})`);
    for (const b of r.booked) {
      const blocked = { start: b.start, end: b.end + r.turnaroundMinutes };
      const mine = { start: slot.start, end: slot.end + r.turnaroundMinutes };
      assert.ok(!(mine.start < blocked.end && blocked.start < mine.end), `no collision incl. both buffers (case ${i})`);
    }
  }
});
