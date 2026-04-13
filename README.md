<h1 align="center">
  <strong>superharness</strong><br/>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/superharness"><img src="https://img.shields.io/npm/v/superharness.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/superharness"><img src="https://img.shields.io/npm/dm/superharness.svg" alt="npm downloads" /></a>
  <a href="https://github.com/Mrlyk/superharness/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/superharness.svg" alt="license" /></a>
</p>

<p align="center">
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#multi-platform-support">Multi-Platform</a> &bull;
  <a href="#acknowledgements">Acknowledgements</a> &bull;
  <a href="./README.zh-CN.md">中文文档</a>
</p>

<p align="center">
<sub>Harness your AI coding tools &mdash; a tool-agnostic software engineering workflow engine</sub><br />
  <sub>Works with Claude Code, Cursor, Codex, Qoder, Aone Copilot, Gemini CLI, GitHub Copilot</sub>
</p>

## What is this?

Superharness is not another AI coding tool. It's a **workflow program that runs inside your AI tool**. It makes your chosen AI coding agent follow proven software engineering discipline: requirement clarification → task decomposition → TDD implementation → two-stage review → QA validation, all automated.

AI coding tools are powerful, but unconstrained power is dangerous: skipping tests, drifting from requirements, writing code that runs but can't be maintained, declaring "done" without verification. Superharness turns development discipline into mechanically enforced workflows, not suggestions the AI can rationalize away.

## How it works

<p align="center">
  <img src="https://raw.githubusercontent.com/Mrlyk/superharness/main/docs/images/superharness-workflow-en.svg" alt="Superharness Workflow Overview" width="100%" />
</p>

```
/superharness:go "Build a travel planning app"

  1. Brainstorm ── Clarify requirements one question at a time, propose 2-3 approaches, user approves design
     (First run: auto-scans codebase, generates conventions to .superharness/spec/)
  2. Plan ── Generate bite-sized tasks (2-5 min each), complete code, precise file paths
  3. Isolate ── Auto-create git worktree, work on isolated branch
  4. TDD ── Per task: write failing test → implement → tests pass → commit
  5. Review ── Spec compliance review → code quality review, blocks until both pass
  6. QA ── External QA service (optional), auto-fix issues if found
  7. Merge ── Merge worktree after all tasks pass, output summary
```

The AI tool runs autonomously through the entire process. You only participate during brainstorming.

**Small changes don't need this workflow.** The session-start hook injects project conventions and the dispatch protocol into every AI session automatically. Fix a bug, tweak a config, change a few lines — just say it, no superharness commands needed.

## Getting Started

```bash
# 1. Install
npm install -g superharness

# 2. Initialize in your project (pick platform and spec template)
superharness init --platforms claude-code --template frontend

# 3. Use in your AI tool
/superharness:go "your requirement or link to spec"
```

> [!IMPORTANT]
> **To update the tool, run `superharness update` — do NOT re-run `init`.**
>
> After upgrading the global package, run inside your project:
>
> ```bash
> superharness update
> ```
>
> It refreshes skills / agents / hooks / platform settings while **preserving** `.superharness/spec/`, `config.yaml`, `workflow.md`, `worktree.yaml` (so your `spec-discover` results aren't wiped). The command also queries the npm registry and, if the global package is outdated, prompts to upgrade — auto-detecting your package manager (npm / pnpm / yarn / bun) and re-executing the new version on success.
>
> Use `superharness update --force` to reset spec + config files (requires confirmation). Use `superharness init --force` to fully re-initialize. `-y` skips all prompts (CI use).

<details>
<summary><strong>Options</strong></summary>

`--template` values:

| Template | Use case |
|----------|---------|
| `frontend` | Web frontend projects |
| `backend` | Backend API services |
| `ai-agent` | AI Agent applications |
| `fullstack` | Full-stack projects |
| `blank` | Empty template, customize yourself |

`--platforms` values: `claude-code`, `cursor`, `codex`, `qoder`, `aone-copilot`, `gemini`, `copilot`

Multiple platforms: `--platforms claude-code,cursor`

</details>

## Core Capabilities

### Three Iron Laws

The core of Superharness is three non-negotiable rules, each with pre-built rebuttals against the AI's rationalization attempts.

| Law | Rule | Typical excuse / Rebuttal |
|-----|------|--------------------------|
| TDD | No production code without a failing test first | "Too simple to test" / Simple code breaks too, tests take 30 seconds |
| Verification | No completion claims without fresh evidence | "It should pass" / "Should" isn't evidence, run the command |
| Debugging | No fix attempts without root cause investigation | "Let me try changing this" / Blind changes waste time |

### Spec System

Project conventions are living documents that evolve with the codebase, not static templates filled once.

- **spec-discover** (code → spec): Auto-detects project ecosystem (JS/TS, Python, Java/Kotlin) → loads language-specific reference → scans manifest files, config, source code → identifies framework, testing, code quality, API patterns → writes to `.superharness/spec/` after user confirmation
- **spec-update** (user → spec): User says "use zustand from now on" → converts to descriptive format → writes to spec → takes effect next session
- Records facts ("project uses zustand"), doesn't invent rules ("must use zustand")

### Three-Level Hook System

| Hook | When | What |
|------|------|------|
| SessionStart | Every AI session start | Injects dispatch protocol + spec summaries + unfinished task recovery |
| PreToolUse | Before subagent dispatch | Injects role-specific JSONL context (implement.jsonl / check.jsonl) |
| SubagentStop | When check agent finishes | Ralph Loop: blocks if verify commands fail or completion markers missing |

### QA System

Superharness separates QA from the AI tool itself — QA is performed by external services, with a file-based protocol connecting everything. This is a key differentiator: the AI writes code, external systems judge quality, and a structured file contract bridges the two.

**Two commands, one loop:**

```
/superharness:sh-qa     →  calls external QA services  →  writes qa-issues.json
/superharness:sh-fix    →  reads qa-issues.json        →  TDD fix per issue  →  re-runs sh-qa
```

If issues remain after fixing, the loop repeats (max 3 rounds). Regressions auto-escalate severity. After 3 rounds or two consecutive regressions, remaining issues escalate to human.

**Registering QA services** in `.superharness/config.yaml`:

```yaml
qa:
  max_fix_rounds: 3        # Anti-oscillation: max fix rounds per issue
  services:
    # Managed mode: POST request to service, service designs test cases
    - name: ai-agent-qa
      type: managed
      endpoint: http://localhost:8080

    # Autonomous mode: run a command, read the result file
    - name: frontend-e2e
      type: autonomous
      command: npm run qa:e2e
      output: .superharness/tasks/{task}/qa-results-e2e.json
```

Two service types:
- **managed** — Superharness sends a POST request with task context; the service runs its own test cases and returns results
- **autonomous** — Superharness runs a command (e.g. an E2E suite) and reads the output file

**File protocol — `qa-issues.json`:**

All QA services write results to a unified `qa-issues.json` in the task directory. This is the contract between QA and fix:

```json
[
  {
    "id": "qa-001",
    "severity": "critical",
    "category": "logic-error",
    "file": "src/planner/schedule.ts",
    "line": 42,
    "message": "Off-by-one: loop skips last day of trip",
    "fix_hint": "Change < to <= in the for-loop condition",
    "status": "pending",
    "fix_round": 0
  },
  {
    "id": "qa-002",
    "severity": "major",
    "category": "missing-validation",
    "file": "src/api/trips.ts",
    "line": 15,
    "message": "No input validation on date range — negative durations accepted",
    "fix_hint": "Add guard: if (end <= start) throw",
    "status": "pending",
    "fix_round": 0
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique issue identifier |
| `severity` | `"critical"` \| `"major"` \| `"minor"` \| `"suggestion"` | Fix priority order |
| `category` | string | Issue category (e.g. `logic-error`, `missing-validation`, `perf`) |
| `file` | string | File path |
| `line` | number | Line number |
| `message` | string | What's wrong |
| `fix_hint` | string | Suggested fix |
| `status` | `"pending"` \| `"fixed"` \| `"escalated"` | Updated by sh-fix during fix loop |
| `fix_round` | number | Incremented each fix attempt; exceeding `max_fix_rounds` → escalated |

`sh-fix` processes issues in severity order (critical → major → minor), applies TDD per issue (write failing test → fix → verify), updates `status` and `fix_round` in-place, then re-runs `sh-qa` to check for regressions. Suggestion-level issues are never auto-fixed.

### Session Recovery

When AI context fills up or a session disconnects, code is safe (git worktree) and progress is safe (task.json). The session-start hook detects unfinished tasks and the AI asks whether to continue or start fresh.

### Observability

Structured logs at every key transition in `trace.jsonl`:

```bash
superharness trace --task .superharness/tasks/04-02-intent    # Execution path summary
superharness trace --diff task1 task2                          # Compare two task paths
```

## Project Structure

`superharness init` creates a `.superharness/` directory in your project:

```
.superharness/
├── using-superharness.md             # Dispatch protocol (injected by session-start hook)
├── config.yaml                       # Project config
├── workflow.md                       # Workflow overview (human-readable reference)
├── worktree.yaml                     # Worktree config
├── spec/                             # Project conventions (hook injects index.md files)
│   ├── guides/index.md
│   └── {module}/index.md
├── tasks/                            # Task management
│   ├── .current-task                 # (gitignored) Current task pointer
│   └── {MM}-{DD}-{name}/
│       ├── task.json                 # Status, phase, sprint progress
│       ├── prd.md                    # Requirements doc
│       ├── contract.md               # Sprint contract
│       ├── trace.jsonl               # Execution log
│       ├── implement.jsonl           # Implement phase context
│       ├── check.jsonl               # Review phase context
│       └── qa-issues.json            # QA issues
└── .gitignore                        # Excludes runtime state
```

## Skills

| Category | Skill | Purpose |
|----------|-------|---------|
| Workflow | `go` | Main entry: end-to-end workflow orchestration |
| | `brainstorm` | Requirement clarification + spec discovery + mindmap |
| | `writing-plans` | Task decomposition: bite-sized tasks, complete code |
| | `subagent-driven-development` | Fresh subagent per task + two-stage review |
| | `using-git-worktrees` | Isolated development environments |
| | `finishing-a-development-branch` | merge/PR/keep/discard + trace summary |
| Iron Laws | `test-driven-development` | RED-GREEN-REFACTOR cycle |
| | `verification-before-completion` | No claims without evidence |
| | `systematic-debugging` | Root cause first |
| QA | `sh-qa` | Call external QA service, write `qa-issues.json` |
| | `sh-fix` | Read `qa-issues.json`, TDD fix, re-run QA |
| Helper | `using-superharness` | Dispatch protocol (session-start hook injected) |
| | `spec-discover` | Scan codebase for conventions (auto-called by brainstorm) |
| | `spec-update` | Save user-stated conventions to spec |
| | `mindmap` | Mindmap visualization (Markmap + WebSocket) |

## Agents

| Agent | Purpose | Dispatch |
|-------|---------|----------|
| `implement` | Implement tasks with TDD | `Task(subagent_type: "implement")` |
| `check` | Review implementation (spec compliance / code quality) | `Task(subagent_type: "check")` |
| `debug` | Root cause debugging | `Task(subagent_type: "debug")` |
| `research` | Read-only investigation | `Task(subagent_type: "research")` |
| `code-reviewer` | Standalone code review | `superpowers:code-reviewer` |
| `spec-reviewer` | Standalone spec compliance review | Direct invoke |

## CLI Commands

| Command | Purpose |
|---------|---------|
| `superharness init` | Initialize project + copy skills/agents/hooks to platform directories |
| `superharness sync` | Re-sync after spec/skill changes |
| `superharness spec add` | Add spec template (monorepo) |
| `superharness task list` | View task progress |
| `superharness qa` | Call external QA service |
| `superharness status` | Current status |
| `superharness trace` | View execution path summary / diff |

## Multi-Platform Support

One set of skill source files, `superharness init` adapts format and paths per platform.

| Platform | Skill Directory | Agent Directory | Hook Support |
|----------|----------------|-----------------|-------------|
| Claude Code | `.claude/commands/superharness/` | `.claude/agents/` | SessionStart + PreToolUse + SubagentStop |
| Cursor | `.cursor/commands/` | `.cursor/agents/` | sessionStart + preToolUse + subagentStop |
| Aone Copilot | `.aone_copilot/skills/` | — | sessionStart + preToolUse + stop |
| Codex | `.codex/skills/` | — | — |
| Qoder | `.qoder/skills/` | — | — |
| Gemini CLI | `.gemini/commands/` (Phase 4) | — | BeforeTool + AfterResponse |
| GitHub Copilot | `~/.copilot/skills/` | — | TBD |

## Acknowledgements

Superharness is built on [Superpowers](https://github.com/obra/superpowers) (MIT) and draws workflow infrastructure from [Trellis](https://github.com/Mindfold/trellis).

**Inherited from Superpowers**: SKILL.md format, three Iron Laws (TDD / Verification / Debugging), Brainstorm → Writing-plans → Subagent-driven-development workflow, HARD-GATE, rationalization rebuttal system, two-stage review.

**Architectural differences**:

| Dimension | Superpowers | Superharness |
|-----------|------------|-------------|
| Delivery | Claude Code plugin | npm package + CLI, tool-agnostic |
| Platforms | Primarily Claude Code | 7 platforms with unified adaptation |
| Hooks | SessionStart only | SessionStart + PreToolUse + SubagentStop (3-level) |
| Agents | 1 custom (code-reviewer) | 6 custom (implement/check/debug/research + code-reviewer/spec-reviewer) |

**Added capabilities**: Spec system (spec-discover + spec-update), PreToolUse JSONL context auto-injection, Ralph Loop (SubagentStop prevents premature completion), Task system (task.json + trace.jsonl + session recovery), Markmap mindmap, external QA integration (managed/autonomous + anti-oscillation), Trace observability.

**Improvements**: Inline spec self-review from day one (Superpowers switched to inline in v5.0.6); registered custom agents + hook auto-injection (Superpowers uses general-purpose + inline prompts); Visual Companion replaced with standalone mindmap skill.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript / Node.js 20+ |
| CLI | commander |
| Build | tsup |
| Test | vitest |
| Hooks | TS → tsup compile → node execute |

## License

MIT License
