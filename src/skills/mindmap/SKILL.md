---
name: mindmap
description: "Infrastructure skill: start a local visualization server that renders Mermaid diagrams in the browser. Write .mmd files with pure Mermaid code, the browser updates in real-time via WebSocket (no page reload). Used by brainstorm, writing-plans, and other skills."
---

# Mindmap Visualization Server

Infrastructure skill for rendering interactive mindmaps in the browser via Markmap. Write Markdown heading hierarchy to a `.mmd` file, the server pushes it via WebSocket, the browser renders with Markmap (interactive: fold/unfold, zoom, drag).

**This skill is a tool, not a workflow.** It starts a server and returns `{url, content_dir}`. The calling skill (brainstorm, writing-plans, etc.) generates Markdown content and writes it to `content_dir/current.mmd`.

## Starting the Server

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/start-server.sh --project-dir "$(pwd)"
```

> If the path above doesn't resolve, the scripts are located relative to this SKILL.md file, under `scripts/start-server.sh`.

The script outputs JSON on success:
```json
{"type":"server-started","port":52341,"url":"http://localhost:52341","content_dir":".superharness/visualize/12345-1706000000/content"}
```

Save the `url` and `content_dir` from the output. Tell the user to open the URL in their browser.

## Pushing Content

Write Markdown heading hierarchy to `content_dir/current.mmd`. The server detects the change, reads the file, and pushes it via WebSocket. The browser renders it as an interactive mindmap with Markmap (supports fold/unfold, zoom, drag).

```bash
cat > "$content_dir/current.mmd" << 'EOF'
# 旅行规划 App
## 用户系统
### 注册登录
### 个人偏好
## 行程规划
### 目的地搜索
### 日程安排
EOF
```

## Updating Content

Overwrite the same `current.mmd` file. The browser smoothly re-renders with animation, no reload or flicker.

```bash
cat > "$content_dir/current.mmd" << 'EOF'
# 旅行规划 App
## 用户系统
### 注册登录
### 个人偏好
### 第三方登录
## 行程规划
### 目的地搜索
### 日程安排
### 预算管理
## 社交功能
### 行程分享
### 评论系统
## 技术选型
### React + Zustand
### Node.js API
EOF
```

## When to Use

| Calling Skill | Diagram Type | Content |
|--------------|-------------|---------|
| brainstorm | mindmap | Feature decomposition, scope overview |
| writing-plans | mindmap or flowchart | Task breakdown tree, sprint structure |
| finishing-a-development-branch | flowchart | Execution path from trace-summary |

## Server Lifecycle

- Server runs in the background (macOS/Linux) or foreground (Windows/Codex)
- Auto-shuts down after 5 minutes of no activity
- Content directory: `.superharness/visualize/{session-id}/content/`
- Only one file on disk: `current.mmd` (overwritten each update)
- No cleanup needed - `.superharness/visualize/` can be gitignored

## Stopping the Server

The server stops automatically on idle. To force stop:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/stop-server.sh
```

## Rules

- **Always tell the user the URL** before pushing content
- **Don't block on the server** - start it and move on with brainstorming
- **Update frequently** - overwrite `current.mmd` after each clarification round
- **Write Markdown heading hierarchy** - use `# ## ### ####` for nesting levels, no HTML
- **Use Chinese for node names** - the primary audience is Chinese-speaking developers
- **Markmap renders interactively** - users can fold/unfold branches, zoom, and drag to explore
