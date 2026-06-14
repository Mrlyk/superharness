---
name: test
description: "After ALL development on a task is complete, run one terminal review-and-test pass: Spec Review, then Code Review, then the test suite. Use when wrapping up a coding task (\"终检\", \"补测试\", \"final review\", finishing development) — not during development, and not per change."
---

# Terminal Review & Test

One pass, after all development on the task is done — not per change, not per round. We ship production code, so the final gate is a little heavier than just running tests: review the change against the spec, review it for quality, then prove it with tests. Run the three steps in order; only the result matters.

## 1. Spec Review

Compare the diff against what was asked, independently — do not trust a self-review summary.

- Read the requirement (what the user asked / the clarified scope) and the project spec in `.superharness/spec/`.
- For each requirement: implemented? correct, not just partial? edge cases handled?
- Flag MISSING (required, absent), EXTRA (built, not asked — remove unless justified), MISUNDERSTOOD (built but wrong).
- For a non-trivial change, dispatch the `spec-reviewer` agent on the diff; for a small change, do it inline.

## 2. Code Review

Review the diff for quality and correctness.

- Conventions: follows `.superharness/spec/` and the surrounding code.
- Correctness: error handling at boundaries, no obvious bugs, types precise (no stray `any`).
- Decomposition / DRY: no needless duplication, no oversized files.
- For a non-trivial change, dispatch the `code-reviewer` agent; for a small change, do it inline.

## 3. Tests

- Identify what changed (git diff). Detect the project's test framework and layout; follow them exactly. If the project has no test setup, do not introduce one unasked — verify with a throwaway script you then delete, and offer to set one up as a follow-up.
- Cover the changed public behavior: every documented example verbatim, then the boundaries the spec implies — empty/None, extremes, malformed input, repeated or trailing separators, off-by-one ranges. Skip trivial code (pure config, pass-through). Never assert on mock behavior; never add test-only methods to production code.
- Run the relevant tests (the whole suite if it is cheap). Fix failures by root cause — a production fix beats a test tweak.

## Report

State the verdict of each stage, what is covered, what is deliberately not, and the passing test output. If Spec Review or Code Review found blocking issues, fix them at root cause before declaring done.
