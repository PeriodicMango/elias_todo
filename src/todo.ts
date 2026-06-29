// ---------------------------------------------------------------------------
// Elias Todo App — active goals / to-do list management
//
// Standalone app. Configured with a path to the goals markdown file.
// ---------------------------------------------------------------------------

import fs from "node:fs/promises";
import path from "node:path";

// Local types (standalone — no dependency on eliasCore)
interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface ToolResult {
  content: string;
}

export interface App {
  readonly name: string;
  readonly description: string;
  getTools(): ToolDef[];
  execute(toolName: string, input: Record<string, unknown>): Promise<ToolResult>;
}

export interface TodoConfig {
  /** Path to the goals markdown file. */
  goalsFile: string;
}

/** ISO timestamp in Sydney timezone. */
function sydneyTimestamp(): string {
  const now = new Date();
  const s = now.toLocaleString("sv-SE", { timeZone: "Australia/Sydney" });
  return s.replace("T", " ");
}

const DEFAULT_GOALS =
  "---\ntags:\n  - elias\n  - elias/goals\n---\n\n# Active\n\n# Done\n";

function parseSection(body: string, section: string): string[] {
  const lines: string[] = [];
  let inSection = false;
  for (const line of body.split("\n")) {
    const secMatch = line.match(/^##?\s+(Active|Done|Expired)\s*$/i);
    if (secMatch) {
      inSection = secMatch[1]!.toLowerCase() === section.toLowerCase();
      continue;
    }
    if (inSection && line.trim()) lines.push(line);
  }
  return lines;
}

export function createTodoApp(config: TodoConfig): App {
  async function writeGoalsFile(
    raw: string,
    active: string[],
    done: string[],
  ): Promise<ToolResult> {
    const frontmatterMatch = raw.match(/^(---\n[\s\S]*?\n---)/);
    const frontmatter = frontmatterMatch
      ? frontmatterMatch[1]!
      : "---\ntags:\n  - elias\n  - elias/goals\n---";
    const content = `${frontmatter}\n\n# Active\n${active.join("\n") || "(空)"}\n\n# Done\n${done.join("\n") || "(空)"}\n`;
    try {
      await fs.mkdir(path.dirname(config.goalsFile), { recursive: true });
      await fs.writeFile(config.goalsFile, content, "utf8");
      return { content: `目标已更新。当前活跃：${active.length} 个。` };
    } catch (err) {
      return { content: `写入目标文件失败: ${err}` };
    }
  }

  async function execute(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    if (toolName !== "manage_goals") {
      return { content: `未知工具: ${toolName}` };
    }

    const action = (input.action as string) ?? "list";
    const now = sydneyTimestamp();

    let raw = "";
    try {
      raw = await fs.readFile(config.goalsFile, "utf8");
    } catch {
      raw = DEFAULT_GOALS;
    }

    const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1]! : raw;
    const active = parseSection(body, "active");
    const done = parseSection(body, "done");

    if (action === "list") {
      if (active.length === 0) return { content: "目前没有活跃目标。" };
      return {
        content:
          "### 活跃目标\n" +
          active.map((l) => l.replace(/^-\s*/, "")).join("\n"),
      };
    }

    if (action === "add") {
      const desc = (input.description as string) ?? "";
      if (!desc) return { content: "请提供目标描述（description）。" };
      const due = (input.due as string) ?? "";
      const id = `goal-${now.slice(0, 10)}-${String(active.length + 1).padStart(3, "0")}`;
      const parts = [`[${id}] ${desc}`];
      if (due) parts.push(`due: ${due}`);
      parts.push(`created: ${now}`);
      active.push(`- ${parts.join(" | ")}`);
      return await writeGoalsFile(raw, active, done);
    }

    if (action === "done") {
      const goalId = (input.id as string) ?? "";
      if (!goalId)
        return { content: "请提供要划掉的目标 ID（用 list 查看）。" };
      const idx = active.findIndex((l) => l.includes(`[${goalId}]`));
      if (idx === -1)
        return {
          content: `未找到目标 ${goalId}。用 list 查看当前活跃目标。`,
        };
      const goal = active.splice(idx, 1)[0]!
        .replace(/^-\s*/, "")
        .replace(/\s*$/, "");
      const newDone = done.map((l) =>
        l.replace(/^-\s*/, "").replace(/\s*$/, ""),
      );
      newDone.push(`${goal} | done: ${now}`);
      return await writeGoalsFile(
        raw,
        active,
        newDone.map((l) => `- ${l}`),
      );
    }

    if (action === "cleanup") {
      const nowDate = new Date(
        new Date().toLocaleString("en-US", {
          timeZone: "Australia/Sydney",
        }),
      );
      const kept: string[] = [];
      const moved: string[] = [];
      for (const g of active) {
        const dueMatch = g.match(/due:\s*(.+?)(?:\s*[|]|\s*$)/);
        if (!dueMatch) {
          kept.push(g);
          continue;
        }
        const dueStr = dueMatch[1]!;
        let dueDate: Date | null = null;
        const isoMatch = dueStr.match(/(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) dueDate = new Date(isoMatch[1]!);
        if (dueDate && !isNaN(dueDate.getTime())) {
          const hoursSinceDue =
            (nowDate.getTime() - dueDate.getTime()) / 3600000;
          if (hoursSinceDue > 24) {
            moved.push(
              g.replace(/^-\s*/, "").replace(/\s*$/, "") +
                ` | expired: ${now}`,
            );
            continue;
          }
        }
        kept.push(g);
      }
      const newDone = done.map((l) =>
        l.replace(/^-\s*/, "").replace(/\s*$/, ""),
      );
      const nextDone = [...newDone, ...moved].map(
        (l) => `- ${l}`,
      );
      if (moved.length === 0)
        return { content: "没有过期超过 24 小时的目标需要清理。" };
      const result = await writeGoalsFile(raw, kept, nextDone);
      return {
        content: `清理了 ${moved.length} 个过期目标。\n${result.content}`,
      };
    }

    return { content: `未知操作: ${action}` };
  }

  const TOOLS: ToolDef[] = [
    {
      name: "manage_goals",
      description: `管理指挥官的目标列表。她说的计划、安排、要做的事——你记下来。

操作：
- list：列出所有活跃目标
- add：添加新目标。description 必填，due 可选（截止时间，ISO 格式或自然语言如"今晚""明天"）
- done：标记目标为已完成。用 id 指定。
- cleanup：清理已过期超过 24 小时的目标（移到 Done 区域）`,
      input_schema: {
        type: "object" as const,
        properties: {
          action: {
            type: "string",
            description: "操作：list | add | done | cleanup",
          },
          description: { type: "string", description: "目标描述（add 时必填）" },
          due: { type: "string", description: "截止时间（add 时可选）" },
          id: { type: "string", description: "目标 ID（done 时必填）" },
        },
        required: ["action"],
      },
    },
  ];

  return {
    name: "todo",
    description:
      "待办事项 — 记录、追踪、完成指挥官的待办事项和计划。",
    getTools: () => TOOLS,
    execute,
  };
}
