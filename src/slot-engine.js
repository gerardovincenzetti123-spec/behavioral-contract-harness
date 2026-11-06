/**
 * A deterministic slot-resolution engine.
 *
 * This is the "business logic" half of an LLM-backed system. The model never
 * calls into this with free text; it calls it with a parsed, typed request and
 * renders whatever comes back. Nothing here is probabilistic, so everything
 * here is testable in a table.
 *
 * Domain is intentionally generic — resources with open hours, existing
 * reservations, and a request for a window. No product-specific concepts.
 */

/**
 * @typedef {Object} Interval
 * @property {number} start  minutes from midnight, inclusive
 * @property {number} end    minutes from midnight, exclusive
 */

/**
 * @typedef {Object} Resource
 * @property {string} id
 * @property {Interval[]} openHours
 * @property {Interval[]} booked
 * @property {number} turnaroundMinutes  buffer required after each reservation
 */

/**
 * @typedef {Object} SlotRequest
 * @property {number} durationMinutes
 * @property {number} [notBefore]        minutes from midnight
 * @property {number} [notAfter]         minutes from midnight
 * @property {string[]} [resourceIds]    restrict to these resources
 */

export const REJECTION = {
  INVALID_DURATION: 'INVALID_DURATION',
  INVALID_WINDOW: 'INVALID_WINDOW',
  INVALID_RESOURCE: 'INVALID_RESOURCE',
  NO_RESOURCE: 'NO_RESOURCE',
  NO_AVAILABILITY: 'NO_AVAILABILITY',
};

function isInterval(x) {
  return x && Number.isFinite(x.start) && Number.isFinite(x.end);
}

/**
 * A resource is well-formed when its intervals are numeric and its turnaround
 * is a non-negative finite number. A missing turnaround is NOT treated as 0:
 * `b.end + undefined` is NaN, NaN never overlaps anything, and every
 * reservation on that resource silently disappears from the collision check.
 * That failure mode hands a user a time that is already taken (C9).
 */
function isWellFormedResource(r) {
  return (
    r &&
    typeof r.id === 'string' &&
    Array.isArray(r.openHours) && r.openHours.every(isInterval) &&
    Array.isArray(r.booked) && r.booked.every(isInterval) &&
    Number.isFinite(r.turnaroundMinutes) && r.turnaroundMinutes >= 0
  );
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function normalizeConstraints(request) {
  const notBefore = request.notBefore ?? 0;
  const notAfter = request.notAfter ?? 24 * 60;
  return { notBefore, notAfter };
}

/**
 * Blocked intervals for a resource: every reservation extended by the
 * turnaround buffer on its trailing edge. The proposed slot is extended the
 * same way before the collision check, so the buffer is symmetric (C3).
 */
function blockedIntervals(resource) {
  return resource.booked.map((b) => ({
    start: b.start,
    end: b.end + resource.turnaroundMinutes,
  }));
}

/**
 * Resolve the earliest slot satisfying every constraint at once.
 *
 * Returns either { ok: true, slot } or { ok: false, reason }. It never throws
 * on a well-formed call and never returns a partially-satisfying slot: a
 * constraint the engine cannot honour is a rejection, not a compromise.
 *
 * @param {Resource[]} resources
 * @param {SlotRequest} request
 * @returns {{ok: true, slot: {resourceId: string, start: number, end: number}} | {ok: false, reason: string}}
 */
export function resolveSlot(resources, request) {
  if (!Number.isInteger(request.durationMinutes) || request.durationMinutes <= 0) {
    return { ok: false, reason: REJECTION.INVALID_DURATION };
  }

  const { notBefore, notAfter } = normalizeConstraints(request);
  if (notAfter <= notBefore) {
    return { ok: false, reason: REJECTION.INVALID_WINDOW };
  }

  if (request.resourceIds !== undefined && !Array.isArray(request.resourceIds)) {
    // A string here would match by substring and silently widen the filter.
    return { ok: false, reason: REJECTION.INVALID_RESOURCE };
  }
  if (!Array.isArray(resources) || !resources.every(isWellFormedResource)) {
    return { ok: false, reason: REJECTION.INVALID_RESOURCE };
  }

  const candidates = request.resourceIds
    ? resources.filter((r) => request.resourceIds.includes(r.id))
    : resources;

  if (candidates.length === 0) {
    return { ok: false, reason: REJECTION.NO_RESOURCE };
  }

  let best = null;

  for (const resource of candidates) {
    const blocked = blockedIntervals(resource);

    for (const open of resource.openHours) {
      const windowStart = Math.max(open.start, notBefore);
      const windowEnd = Math.min(open.end, notAfter);

      for (let start = windowStart; start + request.durationMinutes <= windowEnd; start += 1) {
        const proposed = { start, end: start + request.durationMinutes };
        // The proposed slot carries the same trailing buffer as any reservation
        // (C3): once booked, the next reservation may not begin inside it.
        const proposedBlocked = { start, end: proposed.end + resource.turnaroundMinutes };
        const collides = blocked.some((b) => overlaps(proposedBlocked, b));
        if (collides) continue;

        if (best === null || proposed.start < best.start) {
          best = { resourceId: resource.id, start: proposed.start, end: proposed.end };
        }
        break; // earliest slot in this open interval; later ones cannot beat it
      }
    }
  }

  if (best === null) {
    return { ok: false, reason: REJECTION.NO_AVAILABILITY };
  }

  return { ok: true, slot: best };
}
