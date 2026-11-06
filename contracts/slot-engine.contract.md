# Behavioral contract — slot resolution

Written and reviewed **before** the implementation, and amended through refutation rounds (see `refutation/rounds/`). Every clause maps to at
least one test in `tests/`, and every test names the clause it enforces. A
clause with no test is not part of the contract; a test with no clause is
scope creep.

## Scope

`resolveSlot(resources, request)` returns the earliest slot that satisfies
every constraint in `request` simultaneously, or a rejection explaining why no
such slot exists.

## Clauses

**C1 — All constraints or none.**
A returned slot satisfies every constraint in the request. The engine never
returns a slot that honours some constraints and quietly drops others. If all
constraints cannot be satisfied together, the result is a rejection.

**C2 — Earliest wins.**
When multiple slots satisfy the request, the one with the smallest start time
is returned. Ties across resources may resolve to any tied resource, but never
to a later start.

**C3 — Turnaround is not optional, in either direction.**
A slot may not begin inside a reservation's trailing turnaround buffer, and a
reservation may not begin inside the proposed slot's trailing buffer. The
buffer is part of every reservation — existing or proposed — for collision
purposes. *(Amended in round 2: the original clause covered only existing
reservations, so a slot could be returned that left no turnaround before the
next booking.)*

**C4 — Boundaries are half-open.**
Intervals are `[start, end)`. A slot ending exactly when another begins does
not collide. Adjacency is legal; overlap is not.

**C5 — Rejections are typed and total.**
Every failure returns `{ ok: false, reason }` with a reason from `REJECTION`.
The engine never throws on a well-formed call, never returns `null`, and never
returns `ok: true` without a slot.

**C6 — Window bounds are inclusive of the whole slot.**
`notBefore` and `notAfter` bound the entire slot, not just its start. A slot
must end at or before `notAfter`.

**C7 — An empty resource set is a distinct failure.**
Filtering to zero resources returns `NO_RESOURCE`, not `NO_AVAILABILITY`. The
caller must be able to distinguish "nothing to search" from "searched, found
nothing", because the two produce different responses to the user.

**C8 — Invalid input is rejected before search.**
Non-positive or non-integer durations return `INVALID_DURATION`. An empty or
inverted window returns `INVALID_WINDOW`. Neither is reported as
`NO_AVAILABILITY`.

**C9 — Malformed resources fail closed, before search.**
A resource with a missing or non-numeric `turnaroundMinutes`, or with
non-interval `openHours`/`booked`, returns `INVALID_RESOURCE`. So does a
`resourceIds` filter that is not an array. The engine never searches over
data it cannot trust: a missing turnaround must not silently erase the
reservations it was meant to pad. *(Added in round 2.)*

## Out of scope

Time zones, dates, pricing, cancellation, notification, and anything the model
says to the user. This contract governs the deterministic core only.
