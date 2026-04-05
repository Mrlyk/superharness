---
name: spec-update
description: "Save a user-stated convention or rule to .superharness/spec/. Triggers when the user explicitly says 'save this as a convention', 'from now on use X', 'add to project rules', '记住这个约定', '保存为项目规范', or any instruction to persist a project-level guideline."
---

# Spec Update

Save user-stated conventions and rules to `.superharness/spec/`. This skill handles the direction: user intent → spec file.

This is distinct from `spec-discover`, which scans the codebase and infers conventions (code → spec). Here the user is explicitly telling you what they want the project convention to be. The user is the authority -- they may be prescribing something new, correcting something outdated, or documenting a decision not yet visible in the code.

## When This Runs

- User says "save this as a convention" / "from now on use X" / "add to project rules"
- User says "记住这个约定" / "保存为项目规范" / "以后都这样做"
- During any workflow (brainstorm, implementation, review), user states a convention they want persisted
- User explicitly asks to update or change an existing spec entry

## Process

### Step 1: Extract the Convention

Parse what the user wants to save. Identify:

1. **The convention itself**: what rule or pattern the user is stating
2. **The scope**: which part of the project it applies to (state management? styling? API design? general?)

If the user's statement is vague, ask one clarifying question:

> "你想保存的约定是：[your understanding]。理解得对吗？"

Do not ask more than one question. If you're mostly confident, proceed and let the user correct at the confirmation step.

### Step 2: Check if This Belongs in Spec

Apply this test: "Would a human developer joining the project need to know this?"

- **Yes** → this is a project convention, proceed to Step 3
- **No, it's AI-specific** → redirect:
  > "这条更像是 AI 行为偏好，不是项目约定。建议写入 CLAUDE.md 而不是 spec。要我帮你更新 CLAUDE.md 吗？"

  If the user insists on spec, respect their choice and proceed.

Examples of AI-specific (→ CLAUDE.md):
- "When I say 'fix it', run tests first"
- "Always respond in Chinese"
- "Use verbose explanations"

Examples of project conventions (→ spec):
- "Use zustand for state management"
- "All API endpoints must return JSON with `{ data, error }` shape"
- "Components use PascalCase file names"
- "Always use semicolons"

### Step 3: Convert to Descriptive Tone

Rewrite the user's statement into descriptive format, consistent with how spec-discover writes entries. Spec files describe how this project works -- statements of fact, not commands.

| User says | Spec entry |
|-----------|-----------|
| "From now on use zustand" | "项目使用 zustand 进行全局状态管理。" |
| "All API responses must have error field" | "API 响应统一使用 `{ data, error }` 结构。" |
| "We're migrating from Redux to zustand" | "项目正在从 Redux 迁移到 zustand。新代码使用 zustand，现有 Redux 代码逐步迁移。" |
| "Use Tailwind, no CSS modules" | "样式使用 Tailwind CSS。不使用 CSS Modules。" |

The reason for descriptive tone: spec-discover and spec-update both write to the same files. Mixing imperative commands ("必须使用 X") with descriptive statements ("项目使用 X") creates inconsistency. Descriptive tone also ages better -- "项目使用 zustand" remains true as long as it's in the file, while "从现在开始使用 zustand" implies a point-in-time command.

If the convention contradicts what currently exists in the codebase (and the user tells you so), note the transition rather than stating it as established fact.

### Step 4: Route to Target File

Determine which spec file to write to based on topic:

| Topic | Target file |
|-------|------------|
| State management | `components/state-management.md` |
| Component patterns, naming | `components/conventions.md` |
| Styling, CSS, Tailwind | `styling/index.md` |
| API design, endpoints | `api/design.md` |
| Security, auth | `api/security.md` |
| Database, data modeling | `data/database.md` |
| Testing patterns | `testing/index.md` |
| Architecture, layers | `architecture/layering.md` |
| General / unclear | `guides/index.md` |

All paths are relative to `.superharness/spec/`.

**If the target file doesn't exist**: check if the parent directory exists. If yes, create the file. If no, write to `guides/index.md` instead.

**If the target file is a skeleton** (only `<!-- TODO -->` markers or empty checklists): replace the TODO content with the new entry. Don't append after the TODO.

Read the target file before writing to check for existing content on the same topic.

### Step 5: Detect Conflicts

If the target file already has content about the same topic, show the conflict:

> "当前 spec 中已有相关记录：
>
> ```
> [existing content]
> ```
>
> 你的新约定：
>
> ```
> [new content]
> ```
>
> 选择：
> 1. **替换** — 用新约定覆盖旧内容
> 2. **标记迁移** — 保留旧内容并注明正在迁移
> 3. **追加** — 在现有内容后添加（适用于补充而非冲突的情况）
> 4. **取消** — 不做修改"

Wait for user choice before proceeding.

If no conflict, skip to Step 6.

### Step 6: Confirm and Write

Present the final write operation to the user:

> "将写入 `.superharness/spec/{target-file}`：
>
> ```markdown
> [content to write]
> ```
>
> 确认写入？"

Only write after user confirms. If user wants changes, adjust and ask again.

After writing, commit the updated file with message: `docs(spec): update {topic} convention`

### Step 7: Report

> "已保存到 `.superharness/spec/{target-file}`。下次 AI session 开始时会自动加载此约定。"

## Trace Logging

If there is an active task (`.superharness/tasks/.current-task` exists), log events:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"spec-update","event":"start","detail":"用户约定: {summary}"}' >> .superharness/tasks/{task}/trace.jsonl
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"spec-update","event":"complete","detail":"已写入 {target-file}"}' >> .superharness/tasks/{task}/trace.jsonl
```

If no active task, skip trace logging.

## Constraints

- **One convention per invocation.** If the user states multiple conventions, handle the first one, then ask "还有其他约定要保存吗？" and handle the next. Don't batch-write without per-item confirmation.
- **Human in the loop.** Every write must be confirmed. No silent updates.
- **Descriptive tone.** Convert user's prescriptive statements to descriptive format before writing.
- **Don't invent.** Write exactly what the user stated (in descriptive form). Don't add related conventions the user didn't mention.
- **Respect existing content.** Read the target file first. Don't blindly append -- check for conflicts.
- **Fast.** This should take under 30 seconds. No codebase scanning needed (that's spec-discover's job).

## Red Flags

- Writing to spec without user confirmation
- Using imperative/prescriptive tone ("必须", "禁止") in spec entries
- Scanning the codebase to validate the user's convention (not your job -- trust the user)
- Writing AI behavior preferences to spec instead of redirecting to CLAUDE.md
- Silently overwriting existing content without showing the conflict
- Adding conventions the user didn't ask for
