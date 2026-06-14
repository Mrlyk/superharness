---
name: discover
description: "Discover an existing project's conventions from real evidence and write them as the project spec: AGENTS.md + CLAUDE.md as the thin always-loaded entry, with detail under .superharness/spec/. Use when a project lacks AGENTS.md/CLAUDE.md, when asked to generate conventions (\"生成规范\", \"discover conventions\"), or when the spec is stale."
---

# Discover Conventions

Generate or refresh the project's AI-facing spec from evidence in the codebase. Two layers, kept distinct from learnings:

- **Always-loaded entry** (thin — every line costs tokens forever): `AGENTS.md` + `CLAUDE.md`.
- **Detail spec** (read on demand): `.superharness/spec/`, organized by topic.

Spec is project conventions. Learnings (`.superharness/learnings/`) are session lessons. Keep their responsibilities separate; the only bridge is promotion (see Refresh mode).

## Scan (read evidence, don't guess)

- Manifests / configs: package.json / pyproject.toml / go.mod / Cargo.toml / pom.xml, lockfiles, linter / formatter / tsconfig, CI files.
- Existing docs: README, CONTRIBUTING, docs/, existing AGENTS.md / CLAUDE.md / editor rules.
- Code sample: 3-5 representative source files plus 1-2 tests; note naming, module structure, error handling, test style.
- Git: `git log --oneline -20` for the commit-message convention.

## Write

1. `.superharness/spec/` — the detail, evidence-only and lean. Start from `guides/index.md` as the entry (a short pre-dev checklist that links to the topic files that matter), then add only the topic files the evidence warrants (e.g. `architecture/`, `api/`, `testing/`), each short. Every line must be project-specific and evidenced; drop generic advice ("write clean code"). Do NOT scaffold empty TODO templates — write what the code actually does. Prefer one line over three.

2. `AGENTS.md` (max ~20 lines) — a one-paragraph project description, the real key commands, then exactly these pointers:
   - `Read .superharness/spec/guides/index.md before writing code; follow its links for detail.`
   - `Check .superharness/learnings/INDEX.md for past learnings; read a linked entry when relevant.`
   - `If anything in a request is unclear, do not guess — trigger the superharness clarify skill before coding; when the request is already specific, just implement.`
   - `When all development on a task is done, run the superharness test skill once: Spec Review, Code Review, then the test suite.`

   If AGENTS.md exists, only append the pointer lines that are missing. Never rewrite existing user content.

3. `CLAUDE.md` — exactly these imports (append only the missing ones if it already exists):

   ```
   @AGENTS.md
   @.superharness/spec/guides/index.md
   ```

4. `.superharness/learnings/INDEX.md` — create with a `# Learnings` header if missing.

## Refresh mode

If `.superharness/spec/` already exists: diff reality against it (recent commits, new configs, changed structure) and update only what drifted, keeping each file lean. **Promotion** is the one-way bridge from learnings to spec: fold learnings from `.superharness/learnings/` that have hardened into stable conventions into the spec, then delete those learning files and their INDEX lines.

Finish by suggesting a commit of `.superharness/`, `AGENTS.md`, and `CLAUDE.md`.
