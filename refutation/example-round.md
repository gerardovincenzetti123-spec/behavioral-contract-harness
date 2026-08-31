# Refutation round 1 — slot engine

Contract version: `slot-engine.contract.md` @ initial
Rounds allowed: 3 · Round: 1 of 3
Graduation rule signed before the round started (see PROTOCOL.md).

An illustrative round, shortened. Real logs are longer and duller.

---

## Candidates raised

### R1

```
CLAUSE:   C6
INPUT:    resolveSlot([r], { durationMinutes: 60, notBefore: 960, notAfter: 990 })
EXPECTED: rejection — a 60-minute slot cannot end by 16:30 if it starts at 16:00
OBSERVED: { ok: true, slot: { start: 960, end: 1020 } }
SEVERITY: HIGH
```

**Triage: real violation.** The loop bounded the slot *start* by `notAfter`
instead of the slot *end*. A user asking for "an hour, done by 4:30" was being
handed a slot ending at 5:00 — and the model would have confirmed it, because
the model renders whatever the engine returns.

Test added first (`C6 — notAfter bounds the end of the slot, not its start`),
confirmed failing, then fixed. Mutant `M3` now encodes the defect permanently.

### R2

```
CLAUSE:   C4
INPUT:    booked [600,660), request 60 minutes in open hours [540,660)
EXPECTED: unclear — does a slot ending at 600 collide with one starting at 600?
OBSERVED: { ok: true, slot: { start: 540, end: 600 } }
SEVERITY: LOW
```

**Triage: contract ambiguity, not a defect.** The contract said "intervals" but
never stated whether they were open or closed. The behaviour was right; the
contract was underspecified.

Resolved by amending C4 to state half-open `[start, end)` explicitly, and
adding a test that pins adjacency as legal. Amending the contract — rather than
arguing the agent was wrong — is the point of this triage category.

### R3

```
CLAUSE:   C2
INPUT:    two resources, one open from 10:00 and one from 11:00
EXPECTED: the 10:00 resource
OBSERVED: the 10:00 resource
SEVERITY: LOW
```

**Triage: noise.** No violation. Logged anyway, because a round with no
recorded clean results looks like a round that only ran until it found
something.

---

## Outcome

- 1 HIGH violation found and fixed, with a test written before the fix.
- 1 contract ambiguity closed.
- Contract clauses C1–C8: all covered by passing tests.
- Mutants: 6/6 killed.
- No unresolved HIGH candidates.

**Graduated** under the pre-signed rule, in round 1 of 3.

---

## Note on cost

This round ran under a fixed turn and dollar budget. Without one, refutation
does not converge: there is always another edge case, and an agent asked to
find problems will always find something to say. The budget and the
pre-signed graduation rule are what make the process terminate — they matter
as much as the technique.
