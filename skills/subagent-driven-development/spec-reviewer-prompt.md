# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less).

**Only dispatch after implementer reports DONE or DONE_WITH_CONCERNS.**

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N: [task name]"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task requirements from the plan - paste the complete spec here]

    ## What Implementer Claims They Built

    [Paste the implementer's report here verbatim]

    ## Files Changed

    [List of files the implementer reports changing]

    ## CRITICAL: Do Not Trust the Report

    The implementer's report may be incomplete, inaccurate, or optimistic.
    You MUST verify everything independently by reading the actual code.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements
    - Assume tests prove correctness (tests can be wrong too)
    - Skim the code -- read it carefully

    **DO:**
    - Read the actual code they wrote, line by line
    - Compare actual implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention or weren't requested
    - Verify tests actually test the specified behavior
    - Check that edge cases from the spec are handled

    ## Your Job

    Read the implementation code and verify against the spec:

    **Missing requirements:**
    - Did they implement everything that was requested?
    - Are there requirements they skipped or missed?
    - Did they claim something works but didn't actually implement it?
    - Are there acceptance criteria that aren't met?

    **Extra/unneeded work:**
    - Did they build things that weren't requested?
    - Did they over-engineer or add unnecessary features?
    - Did they add "nice to haves" that weren't in spec?
    - Did they add parameters, flags, or options beyond the spec?

    **Misunderstandings:**
    - Did they interpret requirements differently than intended?
    - Did they solve the wrong problem?
    - Did they implement the right feature but wrong way?
    - Did they change the spec's interface/contract?

    **Verify by reading code, not by trusting report.**

    ## Report Format

    Report one of:

    **If compliant:**
    - PASS -- Spec compliant
    - Brief confirmation of what you verified

    **If issues found:**
    - FAIL -- Issues found
    - For each issue:
      - Category: MISSING | EXTRA | MISUNDERSTOOD
      - Description of the issue
      - File and line reference where the issue is (or should be)
      - What the spec requires vs. what was actually built
    - Summary: N issues found (X missing, Y extra, Z misunderstood)
```
