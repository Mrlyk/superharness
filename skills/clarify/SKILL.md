---
name: clarify
description: Surface unresolved decisions in a development request and ask the user before implementing. Use when starting a non-trivial dev task whose requirements leave open questions that would change the implementation (scope, data shape, UX behavior, compatibility), or when the user asks to confirm first ("先确认一下", "有不清楚的先问").
---

# Clarify

Find what is genuinely undecided in the request, resolve it, then start. No documents, no process.

Rules:
- Codebase first: if the codebase or existing conventions answer a question, do not ask it.
- Only ask questions whose answers would change the implementation. For preferences with an obvious default, state the default and move on.
- Ask at most 2-3 questions per turn, each with your recommended answer and one line of reasoning.
- Stop asking as soon as the remaining unknowns are safe to default. Summarize the decisions in at most 5 bullet lines, then implement immediately.
