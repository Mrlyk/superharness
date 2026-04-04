---
name: spec-discover
description: "Scan the project codebase and discover conventions, tech stack, and patterns. Update .superharness/spec/ with findings after user confirmation. Works in two modes: full discovery (when specs are empty) and incremental check (when specs exist but code has evolved). Invoke before any feature work to keep specs current, or run manually anytime. Triggers when brainstorm starts, when user asks to update conventions, or when you notice project patterns diverging from documented specs."
---

# Spec Discovery

Scan the project codebase to discover conventions and tech stack choices. Update `.superharness/spec/` with findings after user confirmation.

Project specs are living documents, not static templates. Every time this skill runs, it compares what the codebase actually does against what the spec files document. The gap between "what the spec says" and "what the code does" is what this skill closes.

## When This Runs

- **brainstorm** invokes this as Step 1 before requirement clarification
- User runs `/superharness:spec-discover` manually at any time
- session-start hook detects skeleton specs and suggests running this

## Process

### Step 1: Determine Spec State

Read `.superharness/spec/` files. If the directory doesn't exist, tell the user to run `superharness init` first and stop.

Check whether spec files are **skeletons** (only contain TODO comments, `<!-- TODO -->`, or empty checklists with no real content) or **populated** (have substantive content describing actual project conventions).

- Skeleton → go to Step 2 (Full Discovery)
- Populated → go to Step 3 (Incremental Check)

### Step 2: Full Discovery

The spec files are empty. Scan the project and build an initial picture of what conventions exist.

**What to scan** (focus on high-signal files, not every file in the repo):

| Source | What to look for |
|--------|-----------------|
| `package.json` | Framework, key dependencies, scripts, package manager |
| `tsconfig.json` / `jsconfig.json` | Language settings, path aliases, module system |
| Config files (vite, next, webpack, etc.) | Build tooling, environment setup |
| `.eslintrc` / `biome.json` / `.prettierrc` | Linting and formatting conventions |
| Entry points (`src/index.*`, `src/main.*`, `src/app.*`) | App structure, routing patterns |
| A few representative source files | Code organization, import patterns, error handling |
| Test files (if any exist) | Testing framework, test patterns |
| `Dockerfile` / `docker-compose.yml` | Deployment patterns (if visible) |

**What to identify**:

- Tech stack: framework, language version, package manager
- State management: zustand / redux / pinia / mobx / context
- Testing: vitest / jest / pytest / mocha, testing patterns
- API style: RESTful / GraphQL / tRPC, route conventions
- Code organization: layered architecture, feature-based modules, barrel exports
- Styling: Tailwind / CSS Modules / styled-components / SCSS
- Error handling: error boundary patterns, try-catch conventions
- Import/export: ESM / CJS, path alias usage

**Present findings to user in Chinese**:

> "我分析了项目代码，发现以下约定:
> - 框架: React 18 + Next.js 14 (App Router)
> - 状态管理: zustand
> - 测试: vitest + @testing-library/react
> - 样式: Tailwind CSS
> - API: RESTful, 路由前缀 /api/
> - 代码组织: 按功能模块划分 (features/)
>
> 是否将这些写入 `.superharness/spec/`? 后续可以随时修改。"

**Only write after user confirms.** If the user says no or wants changes, adjust and ask again, or skip entirely.

Write each discovery into the most relevant spec file. For example:
- State management → `spec/components/state-management.md` (if it exists)
- API style → `spec/api/design.md` (if it exists)
- General patterns → `spec/guides/index.md`

If the matching spec file doesn't exist, write to the closest match or `spec/guides/index.md`.

Commit the updated files after writing.

### Step 3: Incremental Check

The spec already has content. Do a quick comparison: what does the code do now vs. what does the spec say?

1. Read the current spec files to know what's already documented
2. Quick-scan for changes since last check:
   - New dependencies in package.json not mentioned in spec
   - New config files or major directory changes
   - Changed patterns (e.g., migrated from CSS Modules to Tailwind)
3. If new or changed patterns found, present them one by one in Chinese:
   > "发现项目新增了 [X] 模式，当前 spec 中未记录。是否更新?"
4. User confirms → update the specific spec file and commit
5. User declines → skip, continue to next finding
6. Nothing new → report "项目规范已是最新" and finish

The incremental check should be noticeably faster than full discovery -- under a minute for most projects. Don't re-read every source file; focus on config and package changes as signals.

## What Good Spec Entries Look Like

**Good** (records what IS):
```markdown
## 状态管理

项目使用 zustand 进行全局状态管理。

- Store 文件位于 `src/stores/` 目录
- 每个 store 是独立文件，使用 `create()` 创建
- 组件通过 `useXxxStore` hook 访问 store
```

**Bad** (invents rules):
```markdown
## 状态管理

所有状态管理必须使用 zustand。禁止使用 Redux 或 Context API。
Store 文件必须放在 src/stores/ 目录下。
```

The difference: good entries describe observed patterns that a new developer (or AI) can follow. Bad entries prescribe rules that may not reflect reality. This skill discovers -- it doesn't legislate.

## Trace Logging

If there is an active task (`.superharness/tasks/.current-task` exists), log events:

```bash
echo '{"ts":"...","phase":"spec-discover","event":"start","detail":"扫描项目约定"}' >> .superharness/tasks/{task}/trace.jsonl
echo '{"ts":"...","phase":"spec-discover","event":"complete","detail":"更新了 N 个 spec 文件"}' >> .superharness/tasks/{task}/trace.jsonl
```

If no active task, skip trace logging.

## Constraints

- **Speed over completeness.** 2 minutes max for full discovery, 1 minute for incremental. If the codebase is large, focus on the most visible patterns and stop. The user can always run this again.
- **Human in the loop.** Every write to spec must be confirmed by the user. No silent updates.
- **Facts only.** Record "项目使用 X" not "应该使用 X". Describe what you observe, not what you think should be.
- **Don't block the caller.** If brainstorm invoked you, finish quickly so the brainstorm flow continues.
