# elias-todo

To-do and goals tracking app for Elias.

## Tools

| Tool | Description |
|------|-------------|
| `manage_goals` | List, add, complete, and cleanup goals |

### Actions

| Action | Description |
|--------|-------------|
| `list` | List all active goals |
| `add` | Add a new goal (description required, due optional) |
| `done` | Mark a goal as completed by ID |
| `cleanup` | Remove goals expired for >24 hours |

## Usage

```typescript
import { createTodoApp } from "elias-todo";

const app = createTodoApp({
  goalsFile: "/path/to/goals.md",
});

// List
const list = await app.execute("manage_goals", { action: "list" });

// Add
await app.execute("manage_goals", {
  action: "add",
  description: "完成数学作业",
  due: "今晚",
});

// Complete
await app.execute("manage_goals", { action: "done", id: "goal-2026-07-01-001" });
```

## Data

All goals are stored in a single Markdown file (`goals.md`) with YAML frontmatter. Format:

```markdown
---
tags:
  - elias
  - elias/goals
---

# Active
- [goal-2026-07-01-001] 完成数学作业 | due: 今晚 | created: 2026-07-01 14:00

# Done
- [goal-2026-06-30-001] 买菜 | done: 2026-07-01 10:00
```
