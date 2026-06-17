# superharness lite — benchmark methodology

A/B benchmark of the lite harness: **arm A** is the bare model, **arm B** is the
same model with `superharness init` (lite) installed in the fixture, so the four
lite capabilities (learn / discover / clarify / test) are the only variable. All
runs are real end-to-end `claude -p` invocations (model: Sonnet); every scenario
is scored by a deterministic grader, never by a model judge.

The capability scenarios reuse [superskills](https://github.com/Mrlyk/superskills)'
fixtures and graders (they probe code, tests, and git — not skill names), pointed
at superharness paths. The code rows use the community **HumanEval+** dataset and
**HumanEval/0–9** as a no-regression control.

## How each arm is built

- **Arm A** — the fixture plus a bare `CLAUDE.md`; the `Skill` tool is disallowed,
  so the model has no harness assistance.
- **Arm B** — `superharness init -y` runs in the fixture, installing the lite
  skills (`.claude/skills/`), the SessionStart + Stop hooks, and the operating
  manual (`.superharness/using-superharness-lite.md`). The background learner is
  disabled during scenario runs (`SUPERHARNESS_NO_BG_LEARN=1`) so a run never
  spawns a second model; auto-learning is benchmarked separately by feeding the
  real Stop-hook instruction into the prompt.

## Results summary

Cells are mean check score (or pass@1 for the code rows). 3 trials per arm for
the capability scenarios; 8 trials × 7 problems for HumanEval+; 10 problems for
the control.

| Scenario | Baseline (bare model) | + superharness lite | Δ |
|----------|-----------------------|---------------------|---|
| Auto-learning · recall | 56% | 100% | **+44pp** |
| Auto-learning · precision (wiki) | 29% | 100% | **+71pp** |
| Cross-session memory | 20% | 100% | **+80pp** |
| Requirement clarification | 0% | 33% | **+33pp** |
| Clarify · self-triggered | 0% | 67% | **+67pp** |
| Clarify · over-ask guard (clear task) | — | 100% | guard holds |
| Final test pass | 40% | 53% | **+13pp** |
| Convention adherence | 100% | 100% | even |
| HumanEval+ hard subset | 30% (17/56) | 57% (32/56) | **+27pp** |
| Control · HumanEval/0–9 | 100% (10/10) | 100% (10/10) | no regression |

## Per-scenario detail

Each capability scenario reports the per-check pass rate across 3 trials.

### Convention adherence (`lite-suite.sh` s1, `sh-test`/`sh-discover`)

The discount task must follow the project's evidenced conventions (integer cents,
`E_*` typed errors, JSDoc, barrel export, `node:test`). Both arms reach 100% — the
conventions are visible in the existing code, so even the bare model picks them up.
This is the control for "lite does not hurt when the spec is already obvious."

| Check | Baseline | + lite |
|-------|----------|--------|
| implemented | 3/3 | 3/3 |
| barrelExport | 3/3 | 3/3 |
| jsdoc | 3/3 | 3/3 |
| integerCents | 3/3 | 3/3 |
| rangeError | 3/3 | 3/3 |
| typedError | 3/3 | 3/3 |
| testsCoverAndPass | 3/3 | 3/3 |

### Cross-session memory (`lite-suite.sh` s2, `sh-learn` + SessionStart hook)

Three persisted learnings (pnpm not npm, ISO-8601 UTC timestamps, README
quickstart) must shape the new work. The SessionStart hook injects the learnings
index; the bare model, with no memory channel, ignores all three.

| Check | Baseline | + lite |
|-------|----------|--------|
| usesPnpm | 0/3 | 3/3 |
| noPlainNpm | 0/3 | 3/3 |
| isoTimestamp | 0/3 | 3/3 |
| readmeExample | 0/3 | 3/3 |
| testsPass | 3/3 | 3/3 |

### Requirement clarification (`lite-suite.sh` s3, `sh-clarify`)

On an ambiguous request the assistant should surface the load-bearing question
(format/fields) instead of guessing an implementation. Scored as full success only
when it asked AND wrote no premature code.

| Check | Baseline | + lite |
|-------|----------|--------|
| askedKeyQuestion | 0/3 | 1/3 |
| noPrematureCode | 0/3 | 1/3 |

### Final test pass (`lite-suite.sh` s4, `sh-test`)

A just-developed `applyCoupon` carries two planted bugs (float result, missing
`E_RANGE` validation). The test skill should expose them and land the fixes with
the suite green. The verify gate catches the float bug; the range bug remains the
hard tail.

| Check | Baseline | + lite |
|-------|----------|--------|
| testsCoverCoupon | 3/3 | 3/3 |
| suitePasses | 3/3 | 3/3 |
| floatBugFixed | 0/3 | 1/3 |
| rangeBugFixed | 0/3 | 0/3 |
| edgeCasesTested | 0/3 | 1/3 |

### Auto-learning · recall (`lite-learn.sh`, standard)

Both arms replay the same finished session with two corrections stated only in
dialogue (ISO timestamps, integer cents). Arm B appends the real Stop-hook
instruction; arm A appends a neutral close. Grading inspects the
`.superharness/learnings/` the model wrote.

| Check | Baseline | + lite |
|-------|----------|--------|
| generated | 2/3 | 3/3 |
| capturesIsoRule | 2/3 | 3/3 |
| capturesCentsRule | 2/3 | 3/3 |
| indexUpdated | 2/3 | 3/3 |
| formatOk | 0/3 | 3/3 |
| concise | 2/3 | 3/3 |

### Auto-learning · precision / wiki (`lite-learn.sh --hard`)

One durable team convention (`E_*` error prefix) buried among two throwaway
instructions (skip validation, temporary console.log) that must NOT be persisted.
Tests precision plus wiki hygiene: a deduplicated INDEX with markdown links, merged
topic pages, and the throwaways rejected.

| Check | Baseline | + lite |
|-------|----------|--------|
| generated | 1/3 | 3/3 |
| capturesErrorPrefix | 1/3 | 3/3 |
| rejectsTransientValidation | 1/3 | 3/3 |
| rejectsTransientLogging | 1/3 | 3/3 |
| indexUpdated | 1/3 | 3/3 |
| formatOk | 0/3 | 3/3 |
| concise | 1/3 | 3/3 |

### Clarify auto-trigger (`lite-clarify.sh`)

Measures whether lite makes the model *auto*-trigger clarify — no one says "apply
clarify" — driven by the clarify skill's description and the SessionStart-injected
operating manual. The lift is on an ambiguous task; the guard is a fully specified
task that should be implemented, not interrogated.

| Arm | Task | asked a question | wrote code | full score |
|-----|------|------------------|------------|------------|
| base-ambiguous | ambiguous | 0/3 | 3/3 | 0% |
| lite-ambiguous | ambiguous | 2/3 | 1/3 | 67% |
| lite-clear | clear | 0/3 | 3/3 | 100% |

The guard holds: on the clear task lite proceeds without over-asking (0/3 asked,
3/3 implemented).

## HumanEval+ hard subset (`heval-lite.sh --plus`)

Phase 1 screens HumanEval/100–163 with the bare model to find the problems the
Sonnet baseline fails (here: 101, 132, 144, 146, 151, 154, 163 — 7 problems).
Phase 2 measures both arms on that hard set, 8 trials each (56 samples per arm).
The verify-before-done gate forces the model to run its solution against the
documented examples plus edge cases before declaring done.

| Arm | pass@1 |
|-----|--------|
| Baseline (bare model) | 30% (17/56) |
| + superharness lite | **57% (32/56)** &nbsp; **+27pp** |

## Reproduce

```bash
# capability suite (s1 conventions / s2 memory / s3 clarify / s4 test + control)
tests/bench/lite-suite.sh --trials 3
# auto-learning recall + precision/wiki
tests/bench/lite-learn.sh --trials 3
tests/bench/lite-learn.sh --trials 3 --hard
# clarify auto-trigger
tests/bench/lite-clarify.sh --trials 3
# community code benchmark (HumanEval+ hard subset)
tests/bench/heval-lite.sh --plus --trials 8
# regenerate this report's tables
node tests/bench/report-lite.cjs tests/bench/results
```

The capability scenarios reuse superskills' fixtures and graders; set `SS_BENCH`
to a superskills checkout (defaults to a sibling clone). The HumanEval / HumanEval+
datasets are vendored gzipped under `superskills/tests/bench/humaneval/` (MIT,
OpenAI) — `gunzip -k` them once before the first code run.
