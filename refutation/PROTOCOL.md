# Blind refutation

A second agent tries to break the work. It is given the contract and the
built artifact — and nothing else.

## What "blind" means

The refuting agent must not see:

- the diff
- the commit messages
- the builder's reasoning, notes, or explanation of the approach
- the test suite
- any prior refutation round

It sees the contract and the running system. That is the whole point. An agent
that has read the builder's account of why the code is correct will evaluate
the account. An agent that has only the contract has to evaluate the behaviour.

This is the same reason a reviewer who watches you write the code finds fewer
bugs than one who does not.

## Order of operations

1. **Refute the spec, on paper, before any code exists.** Cheapest round by a
   wide margin. In the system this harness is drawn from, four consecutive
   specs surfaced blocking flaws at this stage — flaws that would otherwise
   have been found after implementation.
2. Build against the contract.
3. **Refute the build.** The agent produces candidate violations only.
4. Triage: each candidate is either a real violation, an ambiguity in the
   contract, or noise. Ambiguities are resolved by amending the contract, not
   by arguing with the agent.
5. Real violations become tests first, then fixes.
6. Every defect that a human found in production enters the corpus *before* it
   is fixed, so it can never silently return.

## Termination

Refutation loops forever unless you stop it. Before the round starts, write
down the graduation rule and sign it:

> This objective graduates when clauses C1–C8 each have a passing test, every
> mutant in `mutation/mutants.js` is killed, and no unresolved candidate
> violation of severity HIGH remains. Rounds: at most 3. Budget: $X.

A rule agreed after seeing the results is not a rule.

## Prompt

```
You are refuting an implementation. You have the behavioral contract below and
the ability to call the system. You do not have the source, the diff, or any
explanation of how it was built. Do not ask for them.

Your job is to find inputs where the observed behaviour violates a contract
clause. You are not reviewing style, performance, or design. You are looking
for violations.

For each candidate violation, output exactly:

  CLAUSE:   the clause id it violates
  INPUT:    the exact call that triggers it
  EXPECTED: what the clause requires
  OBSERVED: what actually happened
  SEVERITY: HIGH if it produces a wrong result a user would act on,
            MEDIUM if it produces a wrong error or classification,
            LOW if it is cosmetic or ambiguous in the contract

Prioritise boundaries, empty sets, adjacent intervals, inverted ranges, and
combinations of constraints that interact. Do not report anything you have not
actually triggered. If you cannot find a violation, say so plainly — a clean
result is a useful result, and a fabricated one destroys the value of this
pass.

CONTRACT:
<paste contracts/slot-engine.contract.md>
```

## Recording the round

Log each round in `refutation/rounds/`: date, contract version, candidates
raised, how each was triaged, and what changed. The log is the evidence that
the process ran, and it is what makes a regression traceable to the round that
should have caught it.
