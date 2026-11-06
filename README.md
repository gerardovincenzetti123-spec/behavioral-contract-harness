# Behavioral contract harness

[![verify](https://github.com/gerardovincenzetti123-spec/behavioral-contract-harness/actions/workflows/verify.yml/badge.svg)](https://github.com/gerardovincenzetti123-spec/behavioral-contract-harness/actions/workflows/verify.yml)

A worked, runnable example of how I gate quality in LLM-backed systems:
**executable behavioral contracts**, **blind refutation**, and **mutation
testing**.

This is a sanitized extract of the method I use on a production system. The
domain here is generic — a slot-resolution engine — and contains none of that
product's logic. The method is the point, not the example.

```bash
npm test         # 20 tests across 9 contract clauses (incl. a seeded randomized invariant)
npm run trace    # every clause has a test; every test and mutant names a real clause
npm run mutation # 9 named defects, each must be caught
npm run verify   # all three — what CI runs
```

No dependencies. Node 20 or newer.

**Five-minute read:** `contracts/slot-engine.contract.md` (what the engine
promises) → `refutation/rounds/2026-11-06-round-2.md` (a real round that found
a HIGH defect in this very repository and how it was closed) → `mutation/mutants.js`
(the defects the suite is proven to catch).

---

## Why this exists

Over six months on a production LLM system I documented and classified 78
conversational defects by root cause.

**67% traced to deterministic code. 19% to model decisions.** The remaining
14% were integration and infrastructure (provider errors, timeouts, data that
arrived in the wrong shape).

I had assumed the opposite. The model was the part I did not control, so it was
the part I instrumented; meanwhile the majority of user-visible failures were
coming from ordinary logic bugs in the code around it — availability
calculations, validation, state handling.

Two consequences followed, and both are visible in this repository.

**First, the architecture changed.** The model interprets and speaks; every
business write is deterministic. Confirmations are rendered by code from the
database row re-read after commit, never asserted by the model. A model cannot
fabricate a confirmation it does not author. That whole defect class went to
zero by construction rather than by prompt tuning.

**Second, the deterministic core deserved the heavier machinery.** It is the
part that can be specified exactly and tested in a table — so it gets a written
contract, tests that cite it, and mutation testing to prove those tests are
real.

The uncomfortable implication is that "LLM quality" work is mostly not
LLM work.

---

## The three parts

### 1. Executable behavioral contract

`contracts/slot-engine.contract.md`

Written and refuted **before** implementation. Numbered clauses, each mapping
to at least one test; each test names the clause it enforces.

A clause with no test is not part of the contract. A test with no clause is
scope creep. When a refutation round exposes an ambiguity, the contract is
amended — the contract is the artifact under maintenance, not a document
written once and abandoned.

### 2. Blind refutation

`refutation/PROTOCOL.md` · worked example in `refutation/example-round.md`

A second agent receives the contract and the running system, and nothing else:
no diff, no commit messages, no builder's narrative, no test suite. It looks
for inputs where observed behaviour violates a clause.

Withholding context is the mechanism. An agent that has read your explanation
of why the code is correct will evaluate the explanation. An agent with only
the contract has to evaluate the behaviour.

Specs get refuted on paper first, before code exists — the cheapest round by a
wide margin. Four consecutive specs on the source system surfaced blocking
flaws at that stage.

It works on this repository too. Round 2 (`refutation/rounds/`) was run blind
against the published v1 and found that a resource with a missing turnaround
field made every reservation on it vanish from the collision check — the
engine handed out a taken slot with full confidence. That became clause C9,
a test, and mutant M8. Rounds are logged because a regression has to be
traceable to the round that should have caught it.

### 3. Mutation testing

`mutation/mutants.js` · `mutation/run-mutation.js`

Each mutant reintroduces one named defect and asserts the suite catches it.
These are not random operator flips — every one is a defect class that occurs
in real scheduling logic and survives review:

| Mutant | Clause | Defect reintroduced |
|--------|--------|---------------------|
| M1 | C3 | Turnaround buffer dropped from collision checks |
| M2 | C4 | Half-open intervals treated as closed |
| M3 | C6 | `notAfter` bounds the slot start instead of its end |
| M4 | C7 | Empty resource set collapses into generic no-availability |
| M5 | C8 | Fractional durations accepted |
| M6 | C2 | First resource wins instead of earliest start |
| M7 | C3 | Proposed slot carries no trailing buffer before the next reservation |
| M8 | C9 | Missing turnaround tolerated; `NaN` arithmetic erases every reservation |
| M9 | C9 | String `resourceIds` accepted and matched by substring |

A surviving mutant means the clause is not really enforced — the test passes
for a reason other than the behaviour it claims to check. `npm run mutation`
exits non-zero when that happens, because coverage that does not detect a
defect is not coverage.

M3 is drawn from a refutation finding on the source system (`refutation/example-round.md`);
M7–M9 are drawn from round 2 on this repository (`refutation/rounds/`).

`npm run trace` closes the loop from the other side: it reads the clause ids
out of the contract and fails if any clause has no test, or any test or
mutant names a clause that does not exist. The traceability rule above is a
check, not a sentence.

---

## Making it terminate

Refutation does not converge on its own. An agent asked to find problems will
always find something to say, and each round costs money and time.

So each objective is dispatched with:

- a **verifiable done-criterion** — checkable without discussion
- a **do-not-touch list** — files and behaviours outside scope
- explicit **dollar and turn budgets**
- a **pre-signed graduation rule**, agreed before the round begins

A graduation rule agreed after seeing the results is not a rule. Without one,
an objective reopens indefinitely and the process becomes a way of not
shipping.

---

## What this is not

Not a framework, not a library, not something to install. It is a small, honest
demonstration of a method, with every claim in it runnable.

The production system it comes from adds things that do not sanitize well: a
permanent adversarial corpus built from reconstructed field transcripts, a
nine-step deploy protocol, per-tenant feature-flag rollout. Happy to walk
through any of it.

---

## Layout

```
contracts/   the behavioral contract — read this first
src/         the deterministic engine under test
tests/       one file, tests named for the clauses they enforce
mutation/    named defects + the runner that proves they are caught
refutation/  protocol, prompt, an illustrative round, and the real rounds/ log
scripts/     trace.js — contract ↔ tests ↔ mutants traceability check
.github/     CI: npm run verify on Node 20 and 22
```

MIT licensed.
