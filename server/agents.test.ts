import { describe, it, expect } from "vitest";
import { contentGenerationAgent, exerciseGenerationAgent, assessmentAgent } from "./agents";

describe("Agent Logic Tests", () => {
  describe("Content Generation Agent", () => {
    it("should generate lecture content with knowledge points and token usage", async () => {
      const outline = "1. 基础概念\n   - 变量和数据类型\n2. 控制流\n   - 条件语句";
      const result = await contentGenerationAgent(outline);

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("knowledgePoints");
      expect(result).toHaveProperty("usage");
      expect(typeof result.content).toBe("string");
      expect(Array.isArray(result.knowledgePoints)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);

      // Token usage should be recorded
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    }, { timeout: 15000 });

    it("should extract knowledge points from outline", async () => {
      const outline = "1. Python 基础\n   - 语法\n   - 数据类型";
      const result = await contentGenerationAgent(outline);

      expect(result.knowledgePoints.length).toBeGreaterThan(0);
    }, { timeout: 15000 });
  });

  describe("Exercise Generation Agent", () => {
    it("should generate exercises and answers with token usage", async () => {
      const lecture = "# Python 基础\n\n变量是存储数据的容器。";
      const knowledgePoints = ["变量", "数据类型"];

      const result = await exerciseGenerationAgent(lecture, knowledgePoints);

      expect(result).toHaveProperty("exercises");
      expect(result).toHaveProperty("answers");
      expect(result).toHaveProperty("usage");
      expect(typeof result.exercises).toBe("string");
      expect(typeof result.answers).toBe("string");
      expect(result.exercises.length).toBeGreaterThan(0);
      expect(result.answers.length).toBeGreaterThan(0);

      // Token usage should be recorded
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    }, { timeout: 15000 });
  });

  describe("Assessment Agent", () => {
    it("should assess lecture and exercises with token usage", async () => {
      const lecture = "# 讲义内容\n\n这是一份完整的讲义。";
      const exercises = "1. 问题 1\n2. 问题 2";
      const answers = "1. 答案 1\n2. 答案 2";

      const result = await assessmentAgent(lecture, exercises, answers);

      expect(result).toHaveProperty("lectureScore");
      expect(result).toHaveProperty("exerciseScore");
      expect(result).toHaveProperty("overallScore");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("lectureFeedback");
      expect(result).toHaveProperty("exerciseFeedback");
      expect(result).toHaveProperty("suggestions");
      expect(result).toHaveProperty("usage");

      // 检查分数范围
      expect(result.lectureScore).toBeGreaterThanOrEqual(0);
      expect(result.lectureScore).toBeLessThanOrEqual(100);
      expect(result.exerciseScore).toBeGreaterThanOrEqual(0);
      expect(result.exerciseScore).toBeLessThanOrEqual(100);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);

      // 检查状态
      expect(["pass", "fail"]).toContain(result.status);

      // Token usage should be recorded
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    }, { timeout: 15000 });

    it("should provide constructive feedback with token usage", async () => {
      const lecture = "# 讲义";
      const exercises = "1. 问题";
      const answers = "1. 答案";

      const result = await assessmentAgent(lecture, exercises, answers);

      expect(result.lectureFeedback.length).toBeGreaterThan(0);
      expect(result.exerciseFeedback.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    }, { timeout: 15000 });
  });
});
