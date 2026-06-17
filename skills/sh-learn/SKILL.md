---
name: sh-learn
description: Persist durable learnings from the current session (user corrections, pitfalls and fixes, project decisions not visible in code) into the project knowledge wiki at .superharness/learnings/. Use when the user asks to summarize or persist learnings ("总结一下经验", "沉淀一下", "记住这个"), or when triggered automatically at session end.
---

# Learn

Maintain the project's durable knowledge as a **topic wiki**, not a pile of dated entries. It lives at the repository root in `.superharness/learnings/` (next to `.git`, never in a subdirectory you happen to be working in) and is organized by **topic pages**: each `<topic>.md` collects everything known about one topic, deduplicated and cross-linked. `INDEX.md` is the catalog — one line per topic — and is the only file injected into future sessions.

## What qualifies

Persist only items matching at least one of:
- The user corrected your approach (default behavior differed from what they wanted)
- A pitfall and its fix (error → root cause → solution) that would cost time to rediscover
- A project convention or decision that cannot be inferred from the code itself

Do NOT persist: one-off task details, facts readable from the code, generic programming knowledge.

## Steps

1. Review the session and list candidate learnings. If none qualify, say so and stop — write nothing.
2. Read `.superharness/learnings/INDEX.md` (if present) to see the existing topic pages.
3. For each learning, **merge it into the existing `<topic>.md` page it belongs to** — keep the page focused, remove redundancy, and cross-link related topics with `[[topic]]`. Only create a new `<topic>.md` when no existing topic fits. Never duplicate a rule that already lives on another page. When a learning updates or contradicts a rule already on the page, **replace the old rule** rather than keeping both — the wiki holds current truth, not its history. A page looks like:

   ```markdown
   ---
   topic: <topic name>
   tags: [<area>]
   ---
   # <Topic name>

   **<when it applies>**: <the rule, 1-2 sentences> — <why, optional>.

   Related: [[other-topic]]
   ```

4. **Always** update `INDEX.md` so it lists every topic page with a one-line summary:
   `- [<Topic>](<topic>.md) — <what it covers>`

The wiki should get denser, not longer, as knowledge accumulates: prefer editing an existing page over adding a file. `INDEX.md` is the only file auto-injected into future sessions, so a page missing from it is invisible — keep it a tight, navigable catalog. Suggest committing `.superharness/` so the team shares the knowledge.
