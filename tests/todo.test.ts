// ---------------------------------------------------------------------------
// Tests for Todo App (active goals / to-do tracking)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTodoApp } from "../src/todo.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("TodoApp", () => {
  let goalsFile: string;
  let app: ReturnType<typeof createTodoApp>;

  beforeEach(async () => {
    const dir = path.join(os.tmpdir(), `goals-test-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    goalsFile = path.join(dir, "goals.md");
    app = createTodoApp({ goalsFile });
  });

  afterEach(async () => {
    await fs
      .rm(path.dirname(goalsFile), { recursive: true, force: true })
      .catch(() => {});
  });

  it("has correct name", () => {
    expect(app.name).toBe("todo");
  });

  describe("getTools", () => {
    it("returns one tool: manage_goals", () => {
      const tools = app.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]!.name).toBe("manage_goals");
    });
  });

  describe("list", () => {
    it("returns empty message when no goals exist", async () => {
      const result = await app.execute("manage_goals", { action: "list" });
      expect(result.content).toContain("没有活跃目标");
    });
  });

  describe("add + list", () => {
    it("adds a goal and lists it", async () => {
      await app.execute("manage_goals", {
        action: "add",
        description: "完成数学作业",
      });

      const result = await app.execute("manage_goals", { action: "list" });
      expect(result.content).toContain("完成数学作业");
      expect(result.content).toContain("goal-");
    });

    it("adds multiple goals", async () => {
      await app.execute("manage_goals", {
        action: "add",
        description: "任务一",
      });
      await app.execute("manage_goals", {
        action: "add",
        description: "任务二",
      });

      const result = await app.execute("manage_goals", { action: "list" });
      expect(result.content).toContain("任务一");
      expect(result.content).toContain("任务二");
    });
  });

  describe("done", () => {
    it("marks a goal as done", async () => {
      await app.execute("manage_goals", {
        action: "add",
        description: "完成测试",
      });

      const list = await app.execute("manage_goals", { action: "list" });
      const match = list.content.match(/\[(goal-[^\]]+)\]/);
      expect(match).not.toBeNull();

      const id = match![1]!;
      const doneResult = await app.execute("manage_goals", {
        action: "done",
        id,
      });
      expect(doneResult.content).toContain("目标已更新");

      const newList = await app.execute("manage_goals", { action: "list" });
      expect(newList.content).not.toContain(id);
    });

    it("returns error for invalid ID", async () => {
      const result = await app.execute("manage_goals", {
        action: "done",
        id: "nonexistent-id",
      });
      expect(result.content).toContain("未找到目标");
    });
  });

  describe("cleanup", () => {
    it("returns message when nothing to clean", async () => {
      const result = await app.execute("manage_goals", { action: "cleanup" });
      expect(result.content).toContain("没有过期");
    });
  });
});
