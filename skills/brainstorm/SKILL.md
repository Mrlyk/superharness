---
name: brainstorm
description: "Superharness brainstorming skill. You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Checklist

You MUST create a task for each of these items and complete them in order:

1. **Explore project context + spec discovery** — check files, docs, recent commits. Also check if `.superharness/spec/` needs updating (see Spec Discovery below)
2. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
3. **Propose 2-3 approaches** — with trade-offs and your recommendation
4. **Present design** — in sections scaled to their complexity, get user approval after each section
5. **Write spec + task artifacts** — save spec to `.superharness/tasks/{MM}-{DD}-{name}/prd.md`, create `task.json` and `contract.md` in the same directory, commit all files
6. **Spec self-review** — quick inline check for placeholders, contradictions, ambiguity, scope (see below)
7. **User reviews written spec** — ask user to review the spec file before proceeding
8. **Transition to implementation** — invoke `superharness:writing-plans` skill to create implementation plan

## Process Flow

```dot
digraph brainstorming {
    "Explore project context" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Propose 2-3 approaches" [shape=box];
    "Present design sections" [shape=box];
    "User approves design?" [shape=diamond];
    "Write spec + task artifacts" [shape=box];
    "Spec self-review\n(fix inline)" [shape=box];
    "User reviews spec?" [shape=diamond];
    "Invoke writing-plans skill" [shape=doublecircle];

    "Explore project context" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Propose 2-3 approaches";
    "Propose 2-3 approaches" -> "Present design sections";
    "Present design sections" -> "User approves design?";
    "User approves design?" -> "Present design sections" [label="no, revise"];
    "User approves design?" -> "Write spec + task artifacts" [label="yes"];
    "Write spec + task artifacts" -> "Spec self-review\n(fix inline)";
    "Spec self-review\n(fix inline)" -> "User reviews spec?";
    "User reviews spec?" -> "Write spec + task artifacts" [label="changes requested"];
    "User reviews spec?" -> "Invoke writing-plans skill" [label="approved"];
}
```

**The terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after brainstorming is `superharness:writing-plans`.

## Spec Discovery (embedded in Step 1)

During "Explore project context", also check whether `.superharness/spec/` needs updating. This is NOT a separate step — it happens as part of your normal project exploration.

### First Run (spec files are still skeletons)

If `.superharness/spec/` files contain only TODO comments or empty checklists, scan the project and identify key patterns:

1. **Scan key files**: package.json, tsconfig.json, config files, entry points, existing code structure
2. **Identify patterns to document**:
   - Tech stack (framework, language version, package manager)
   - State management (zustand / redux / pinia / etc.)
   - Testing framework and patterns (vitest / jest / pytest)
   - API style (RESTful / GraphQL / tRPC)
   - Code organization (layered architecture, module patterns)
   - Styling approach (Tailwind / CSS Modules / styled-components)
   - Error handling conventions
   - Import/export patterns
3. **Write discoveries into the corresponding spec files** (e.g., state management → `spec/components/state-management.md`)
4. **Present a summary to the user**: "I've analyzed the codebase and found these conventions. Please confirm before I save them to spec."
5. **Only write after user confirms.** If user rejects, skip and proceed with brainstorming.

### Subsequent Runs (spec already populated)

On each brainstorm session, while exploring project context:

- If you notice a pattern that ISN'T in the spec files (e.g., a new error handling convention, a recently adopted library), mention it:
  > "I noticed the project now uses [pattern X] which isn't in the spec. Should I update `.superharness/spec/[file]`?"
- If user confirms → update the spec file and commit
- If user declines → move on, don't block the brainstorm

### Rules

- **Record facts, not aspirations.** Write "project uses zustand for state management", NOT "state management should use zustand". Spec describes what IS, not what should be.
- **Don't over-document.** Only record patterns that are genuinely project-wide conventions, not one-off choices in a single file.
- **User confirms all writes.** Never silently update spec files.
- **Don't delay brainstorming.** Spec discovery is a quick check (under 2 minutes), not a deep audit. If the codebase is large, focus on the most visible patterns and move on.

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits)
- Before asking detailed questions, assess scope: if the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of a project that needs to be decomposed first.
- If the project is too large for a single spec, help the user decompose into sub-projects: what are the independent pieces, how do they relate, what order should they be built? Then brainstorm the first sub-project through the normal design flow. Each sub-project gets its own spec, plan, and implementation cycle.
- For appropriately-scoped projects, ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**

- Once you believe you understand what you're building, present the design
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

**Design for isolation and clarity:**

- Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently
- For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?
- Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

**Working in existing codebases:**

- Explore the current structure before proposing changes. Follow existing patterns.
- Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.
- Don't propose unrelated refactoring. Stay focused on what serves the current goal.

## After the Design

**Writing Spec and Task Artifacts:**

When the user approves the design, create the task directory and write three files:

1. **Spec (prd.md):** Write the validated design to `.superharness/tasks/{MM}-{DD}-{name}/prd.md`
   - `{MM}-{DD}` is the current date (zero-padded month and day)
   - `{name}` is a short kebab-case identifier for the topic (e.g., `04-03-auth-system`)

2. **Task metadata (task.json):** Create `.superharness/tasks/{MM}-{DD}-{name}/task.json` with initial state:
   ```json
   {
     "name": "{name}",
     "title": "Human-readable title from the spec",
     "status": "planning",
     "phase": "brainstorm",
     "worktree_path": null,
     "sprint": {
       "current": 0,
       "total": 0
     },
     "created_at": "ISO date",
     "updated_at": "ISO date"
   }
   ```

3. **Contract (contract.md):** Create `.superharness/tasks/{MM}-{DD}-{name}/contract.md` with an initial Done Definition derived from the spec's success criteria. This will be refined when the plan is written.

4. **Update .current-task pointer:**
   ```bash
   echo ".superharness/tasks/{MM}-{DD}-{name}" > .superharness/tasks/.current-task
   ```

5. **Commit all files to git.**

**Trace Logging:**

Log brainstorm events to the task's `trace.jsonl`:

```bash
# At the start of brainstorming
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"brainstorm","event":"brainstorm:start","detail":"用户输入: {requirement}"}' >> .superharness/tasks/{MM}-{DD}-{name}/trace.jsonl

# When spec is confirmed by user
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"brainstorm","event":"brainstorm:spec_confirmed","detail":"需求文档已写入 prd.md，任务产物已创建"}' >> .superharness/tasks/{MM}-{DD}-{name}/trace.jsonl
```

**Spec Self-Review:**
After writing the spec document, look at it with fresh eyes:

1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
2. **Internal consistency:** Do any sections contradict each other? Does the architecture match the feature descriptions?
3. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
4. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.

Fix any issues inline. No need to re-review — just fix and move on.

**User Review Gate:**
After the spec review loop passes, ask the user to review the written spec before proceeding:

> "Spec written and committed to `.superharness/tasks/{MM}-{DD}-{name}/prd.md`. Task artifacts (task.json, contract.md) created. Please review the spec and let me know if you want to make any changes before we start writing out the implementation plan."

Wait for the user's response. If they request changes, make them and re-run the spec review loop. Only proceed once the user approves.

**Implementation:**

- Invoke the `superharness:writing-plans` skill to create a detailed implementation plan
- Do NOT invoke any other skill. `superharness:writing-plans` is the next step.

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design, get approval before moving on
- **Be flexible** - Go back and clarify when something doesn't make sense

## Red Flags

- Jumping to implementation before the user approves the design
- Skipping the spec self-review after writing prd.md
- Forgetting to create task.json or contract.md alongside the spec
- Not logging trace events (brainstorm:start, brainstorm:spec_confirmed)
- Invoking any skill other than `superharness:writing-plans` after spec approval
- Writing a spec that covers multiple independent subsystems without decomposing first
- Combining multiple questions into one message
