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
