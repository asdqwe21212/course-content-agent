import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 课程任务表：存储用户提交的课程大纲和生成任务
 */
export const courseTasks = mysqlTable("course_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  outline: text("outline").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CourseTask = typeof courseTasks.$inferSelect;
export type InsertCourseTask = typeof courseTasks.$inferInsert;

/**
 * 讲义内容表：存储内容生成 Agent 生成的讲义
 */
export const lectureContent = mysqlTable("lecture_content", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull(),
  content: text("content").notNull(), // Markdown 格式的讲义
  knowledgePoints: json("knowledge_points").$type<string[]>().notNull(), // 知识点列表
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LectureContent = typeof lectureContent.$inferSelect;
export type InsertLectureContent = typeof lectureContent.$inferInsert;

/**
 * 习题与答案表：存储习题生成 Agent 生成的练习题和答案
 */
export const exercisesAndAnswers = mysqlTable("exercises_and_answers", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull(),
  exercises: text("exercises").notNull(), // Markdown 格式的习题
  answers: text("answers").notNull(), // Markdown 格式的答案解析
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExercisesAndAnswers = typeof exercisesAndAnswers.$inferSelect;
export type InsertExercisesAndAnswers = typeof exercisesAndAnswers.$inferInsert;

/**
 * 评估报告表：存储评估 Agent 生成的质量审核报告
 */
export const assessmentReport = mysqlTable("assessment_report", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull(),
  lectureScore: int("lecture_score").notNull(), // 讲义评分 0-100
  exerciseScore: int("exercise_score").notNull(), // 习题评分 0-100
  overallScore: int("overall_score").notNull(), // 总体评分 0-100
  lectureFeedback: text("lecture_feedback").notNull(), // 讲义反馈
  exerciseFeedback: text("exercise_feedback").notNull(), // 习题反馈
  suggestions: text("suggestions").notNull(), // 改进建议
  status: mysqlEnum("status", ["pass", "fail"]).notNull(), // 是否通过审核
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AssessmentReport = typeof assessmentReport.$inferSelect;
export type InsertAssessmentReport = typeof assessmentReport.$inferInsert;

/**
 * Agent 执行日志表：记录 Agent 协作流水线的执行过程
 */
export const agentExecutionLog = mysqlTable("agent_execution_log", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull(),
  agentType: mysqlEnum("agent_type", ["content", "exercise", "assessment"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).notNull(),
  input: text("input"), // 输入内容
  output: text("output"), // 输出内容
  error: text("error"), // 错误信息
  retryCount: int("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AgentExecutionLog = typeof agentExecutionLog.$inferSelect;
export type InsertAgentExecutionLog = typeof agentExecutionLog.$inferInsert;
