---
name: spec-discover
description: "Scan the project codebase to discover conventions, tech stack, and patterns, then update .superharness/spec/. Primarily invoked by brainstorm as Step 1. Can also be run manually when the user asks to scan or re-scan the codebase for conventions."
---

# Spec Discovery

Scan the project codebase to discover conventions and tech stack choices. Update `.superharness/spec/` with findings after user confirmation.

Project specs are living documents, not static templates. Every time this skill runs, it compares what the codebase actually does against what the spec files document. The gap between "what the spec says" and "what the code does" is what this skill closes.

This skill supports multiple ecosystems (JS/TS, Python, Java, and others). Language-specific detection knowledge is in `./reference/` files.

## When This Runs

- **brainstorm** invokes this as Step 1 before requirement clarification
- User runs `/superharness:spec-discover` manually at any time
- session-start hook detects skeleton specs and suggests running this

## Process

### Step 0: Detect Project Type

Before scanning, determine what kind of project this is so you know what to look for.

1. Read `.superharness/config.yaml` and check the `project.type` field
2. If `type` is explicitly set (not `auto`), use that type and load the matching reference file
3. If `type` is `auto`, check which manifest files or project bundles exist in the project root (note: `.xcodeproj` and `.xcworkspace` are directory bundles, match by extension on directories):

| Manifest file(s) / bundle(s) present | Ecosystem | Reference to load |
|--------------------------------------|-----------|-------------------|
| `package.json` | JS/TS | `./reference/js-ts.md` |
| `pyproject.toml`, `setup.py`, `requirements.txt`, `Pipfile` | Python | `./reference/python.md` |
| `pom.xml`, `build.gradle`, `build.gradle.kts` | Java/Kotlin | `./reference/java.md` |
| `Package.swift`, `*.xcodeproj/`, `*.xcworkspace/` | Swift (iOS/macOS) | `./reference/swift.md` |
| None of the above | Unknown | No reference file |

4. If multiple manifest types are present (e.g., both `package.json` and `pyproject.toml`), load all matching references -- this is a polyglot or fullstack project
5. Log the detected ecosystem(s) in your initial output

**Fallback for unknown ecosystems:** If no reference file matches, you still run discovery using your general programming knowledge. Identify the same categories (language, framework, testing, code organization, etc.) -- you just don't have a lookup table for framework detection signatures.

### Step 1: Determine Spec State

Read `.superharness/spec/` files. If the directory doesn't exist, tell the user to run `superharness init` first and stop.

Check whether spec files are **skeletons** (only contain TODO comments, `<!-- TODO -->`, or empty checklists with no real content) or **populated** (have substantive content describing actual project conventions).

- Skeleton -> go to Step 2 (Full Discovery)
- Populated -> go to Step 3 (Incremental Check)

### Step 2: Full Discovery

The spec files are empty. Scan the project and build an initial picture of what conventions exist.

**If a reference file was loaded in Step 0**, follow its guidance:
- Use the **Manifest Files** table to know what files to scan and what to extract from each
- Use the **Framework Detection Signatures** table to identify the specific framework
- Use the **Detection Dimensions** list to know what categories to identify
- Use the **Example Output** as a format guide

**If no reference file was loaded**, scan using general knowledge:
- Look for build/config files in the project root to identify the language and build system
- Identify the primary framework from file extensions, directory structure, and dependencies
- Check for testing frameworks, linting tools, and CI/CD configuration
- Examine a few representative source files for code organization patterns

**In all cases**, also check these universal sources:

| Source | What to look for |
|--------|-----------------|
| `Dockerfile` / `docker-compose.yml` | Deployment patterns |
| `.github/workflows/` / `.gitlab-ci.yml` | CI/CD pipeline |
| `README.md` | Project description, setup instructions |
| `.gitignore` | What's excluded (hints at tooling) |
| A few representative source files | Code organization, import patterns, error handling |

**Present findings to user in Chinese**:

> "我分析了项目代码，发现以下约定:
> - 语言/框架: [detected language and framework]
> - 包管理/构建: [detected package manager or build tool]
> - 测试: [detected testing framework and patterns]
> - 代码质量: [detected linting/formatting/type-checking tools]
> - API 风格: [detected API patterns, if applicable]
> - 代码组织: [detected project structure and module patterns]
>
> 是否将这些写入 `.superharness/spec/`? 后续可以随时修改。"

Adjust the categories based on what the reference file's Detection Dimensions specify. Not all categories apply to every project -- omit dimensions that aren't relevant.

**Only write after user confirms.** If the user says no or wants changes, adjust and ask again, or skip entirely.

Write each discovery into the most relevant spec file. For example:
- State management -> `spec/components/state-management.md` (if it exists)
- API style -> `spec/api/design.md` (if it exists)
- General patterns -> `spec/guides/index.md`

If the matching spec file doesn't exist, write to the closest match or `spec/guides/index.md`.

Commit the updated files after writing.

### Step 3: Incremental Check

The spec already has content. Do a quick comparison: what does the code do now vs. what does the spec say?

1. Read the current spec files to know what's already documented
2. Quick-scan for changes since last check:
   - New dependencies in the project's manifest file(s) not mentioned in spec
   - New config files or major directory changes
   - Changed patterns (e.g., migrated testing framework, added new tooling)
3. If new or changed patterns found, present them one by one in Chinese:
   > "发现项目新增了 [X] 模式，当前 spec 中未记录。是否更新?"
4. User confirms -> update the specific spec file and commit
5. User declines -> skip, continue to next finding
6. Nothing new -> report "项目规范已是最新" and finish

The incremental check should be noticeably faster than full discovery -- under a minute for most projects. Don't re-read every source file; focus on manifest and config changes as signals.

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

**Good** (Python project example):
```markdown
## Web 框架

项目使用 FastAPI 构建 REST API。

- 路由定义在 `app/routers/` 目录，按资源分文件
- 使用 Pydantic model 做请求/响应校验
- 依赖注入通过 `Depends()` 实现
```

The difference: good entries describe observed patterns that a new developer (or AI) can follow. Bad entries prescribe rules that may not reflect reality. This skill discovers -- it doesn't legislate.

## Reference Files

Language-specific detection knowledge is in `./reference/` files in this directory:

- `reference/js-ts.md` -- JavaScript / TypeScript projects
- `reference/python.md` -- Python projects
- `reference/java.md` -- Java / Kotlin projects

Each reference file contains:
1. **Manifest Files** table -- what files to scan and what to extract
2. **Framework Detection Signatures** table -- how to identify specific frameworks from dependencies/config
3. **Detection Dimensions** list -- what categories to identify for this ecosystem
4. **Example Output** -- sample discovery results in the expected format

Load the relevant reference file(s) in Step 0. If none match, use your general knowledge. To add support for a new language, create a new reference file following the same structure.

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
