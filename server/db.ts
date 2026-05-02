import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, courseTasks, lectureContent, exercisesAndAnswers, assessmentReport, agentExecutionLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== 课程任务相关查询 =====

export async function createCourseTask(userId: number, title: string, outline: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(courseTasks).values({
    userId,
    title,
    outline,
    status: "pending",
  });

  return result;
}

export async function getCourseTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(courseTasks).where(eq(courseTasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateCourseTaskStatus(taskId: number, status: "pending" | "processing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(courseTasks).set({ status }).where(eq(courseTasks.id, taskId));
}

export async function getUserCourseTasks(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(courseTasks).where(eq(courseTasks.userId, userId)).orderBy(desc(courseTasks.createdAt));
}

// ===== 讲义内容相关查询 =====

export async function createLectureContent(taskId: number, content: string, knowledgePoints: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(lectureContent).values({
    taskId,
    content,
    knowledgePoints,
  });

  return result;
}

export async function getLectureContent(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(lectureContent).where(eq(lectureContent.taskId, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ===== 习题与答案相关查询 =====

export async function createExercisesAndAnswers(taskId: number, exercises: string, answers: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(exercisesAndAnswers).values({
    taskId,
    exercises,
    answers,
  });

  return result;
}

export async function getExercisesAndAnswers(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(exercisesAndAnswers).where(eq(exercisesAndAnswers.taskId, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ===== 评估报告相关查询 =====

export async function createAssessmentReport(
  taskId: number,
  lectureScore: number,
  exerciseScore: number,
  overallScore: number,
  lectureFeedback: string,
  exerciseFeedback: string,
  suggestions: string,
  status: "pass" | "fail"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(assessmentReport).values({
    taskId,
    lectureScore,
    exerciseScore,
    overallScore,
    lectureFeedback,
    exerciseFeedback,
    suggestions,
    status,
  });

  return result;
}

export async function getAssessmentReport(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(assessmentReport).where(eq(assessmentReport.taskId, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ===== Agent 执行日志相关查询 =====

export async function createAgentExecutionLog(
  taskId: number,
  agentType: "content" | "exercise" | "assessment",
  status: "pending" | "running" | "completed" | "failed",
  input?: string,
  output?: string,
  error?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentExecutionLog).values({
    taskId,
    agentType,
    status,
    input,
    output,
    error,
    retryCount: 0,
  });

  return result;
}

export async function updateAgentExecutionLog(
  logId: number,
  updates: {
    status?: "pending" | "running" | "completed" | "failed";
    output?: string;
    error?: string;
    retryCount?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(agentExecutionLog).set(updates).where(eq(agentExecutionLog.id, logId));
}

export async function getAgentExecutionLogs(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(agentExecutionLog).where(eq(agentExecutionLog.taskId, taskId)).orderBy(agentExecutionLog.createdAt);
}
