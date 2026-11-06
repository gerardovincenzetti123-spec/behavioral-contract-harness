# Behavioral contract harness

[![verify](https://github.com/gerardovincenzetti123-spec/behavioral-contract-harness/actions/workflows/verify.yml/badge.svg)](https://github.com/gerardovincenzetti123-spec/behavioral-contract-harness/actions/workflows/verify.yml)

A worked, runnable example of how I gate quality in LLM-backed systems:
**executable behavioral contracts**, **blind refutation**, and **mutation
testing**.

This is a sanitized extract of the method I use on a production system. The
domain here is generic — a slot-resolution engine — and contains none of that
product's logic. The method is the point, not the example.

**How it was built.** I don't hand-write code. This repository, like the system
it comes from, was built by directing Claude Code under the method described
here. My part is the contract, the refutation, the graduation rules and the
decision about what ships.

```bash
npm test         # 20 tests across 9 contract clauses (incl. a seeded randomized invariant)
npm run trace    # every clause has a test; every test and mutant names a real clause
npm run mutation # 9 named defects, each must be caught
npm run verify   # all three — what CI runs
```

No dependencies. Node 20 or newer (CI runs 20 and 22; round 2 found the published
scripts only worked on 22 — a quoted glob that Node 20 does not expand).

**Five-minute read:** `contracts/slot-engine.contract.md` (what the engine
promises) → `refutation/rounds/2026-11-06-round-2.md` (a real round that found
a HIGH defect in this very repository and how it was closed) → `mutation/mutants.js`
(the defects the suite is proven to catch).

---

## Why this exists

Over six months on a production LLM system I documented and classified 78
conversational defects by root cause.

**65% traced to deterministic code. 19% to model decisions.** Of the rest, 10%
were neither — a product decision, or a path that did not exist yet — and 5%
could not be determined from the evidence.

I had assumed the opposite. The model was the part I did not control, so it was
the part I instrumented; meanwhile most of the failures that showed up in
conversations were
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

## How the method has evolved

This extract shows the core. In daily use on the source system the method now
runs as follows:

- **Understanding to the model, determinism to anything that can do harm.** The
  model interprets intent; code decides writes, confirmations, identity and
  feasibility. When the model gets something wrong, the fix is the prompt, the
  schema or the state, never a list of words to classify input.
- **Separate roles.** A constructor builds against the contract; a blind refuter
  sees only the contract and the running system; impact, code quality and
  security each get their own read-only reviewer. Decisions and signatures are
  recorded in the delivery artifacts, not in anyone's memory.
- **The model that builds never refutes.** Construction and blind review run on
  different models, so the reviewer does not share the builder's blind spots.
- **Every order is the first message of a fresh session**, with its possible
  verdicts declared up front, so no run ends in "it depends".
- **Contracts are written against the real shapes in the code**, read first by
  an analyst with file and line, not against what the code is assumed to look
  like.
- **Regression is a deterministic replay**: recorded model responses, requests
  compared byte for byte. Live runs measure understanding; they never block a
  release on model variance.
- **Refutation runs in rounds until a round finds nothing material.** Each round
  starts from the corrected version; the same class of failure appearing twice
  triggers a design review instead of one more rule.
- **A growing checklist of mistakes already seen.** Every order is audited
  against it before it runs, so the same mistake is not paid for twice.
- **Anything that touches the outside world** (payments, messaging providers,
  DNS, banking) is declared as an external action and signed by me first.
- **I am the final judge.** No corpus or threshold proves the product works;
  every delivery reaches me in a form I can try myself, with a trace.

## Applied to a client

I used the same discipline with a non-technical client whose software
operations I ran with Claude agents. The contract there was every message I
sent:

- each line traced to a source, in a verification table, before sending;
- any state that can change (a ticket status, a check result) re-read less than
  30 minutes before sending;
- a blind review of the final text by a session that did not write it;
- one action per request, with the exact clicks and what happens next, in
  plain language.

The reason is the same as in the code: the author of a message is the worst
reviewer of it.

---

## What this is not

Not a framework, not a library, not something to install. It is a small, honest
demonstration of a method; every claim about the example is runnable.

The production system it comes from adds things that do not sanitize well: a
permanent adversarial corpus of conversation scenarios that gates every
conversational release, a nine-step deploy protocol, and feature-flagged
rollout. Happy to walk through any of it.

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
