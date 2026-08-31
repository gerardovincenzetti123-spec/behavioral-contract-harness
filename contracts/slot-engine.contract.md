# Behavioral contract — slot resolution

Written and reviewed **before** the implementation. Every clause maps to at
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

**C3 — Turnaround is not optional.**
A slot may not begin inside a reservation's trailing turnaround buffer. The
buffer is part of the reservation for collision purposes.

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

## Out of scope

Time zones, dates, pricing, cancellation, notification, and anything the model
says to the user. This contract governs the deterministic core only.
