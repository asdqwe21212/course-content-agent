import {
  createCourseTask,
  updateCourseTaskStatus,
  createLectureContent,
  createExercisesAndAnswers,
  createAssessmentReport,
  createAgentExecutionLog,
  updateAgentExecutionLog,
  getCourseTask,
} from "./db";
import {
  contentGenerationAgent,
  exerciseGenerationAgent,
  assessmentAgent,
  TokenUsage,
} from "./agents";
import { notifyOwner } from "./_core/notification";

const MAX_RETRIES = 2;

function logTokenUsage(agentName: string, usage: TokenUsage) {
  console.log(
    `[Pipeline] ${agentName} token usage: ` +
    `prompt=${usage.promptTokens}, completion=${usage.completionTokens}, total=${usage.totalTokens}`
  );
}

/**
 * Agent 协作流水线：按顺序执行内容生成、习题生成、评估 Agent
 * 如果评估不通过，自动重试内容生成
 */
export async function courseContentPipeline(
  userId: number,
  title: string,
  outline: string
): Promise<{ taskId: number; success: boolean; message: string }> {
  try {
    // 1. 创建课程任务
    const taskResult = await createCourseTask(userId, title, outline);
    const taskId = (taskResult as any).insertId || 0;

    if (!taskId) {
      return {
        taskId: 0,
        success: false,
        message: "Failed to create course task",
      };
    }

    // 更新任务状态为处理中
    await updateCourseTaskStatus(taskId, "processing");

    let lectureContent = "";
    let knowledgePoints: string[] = [];
    let exercises = "";
    let answers = "";
    let assessmentPassed = false;
    let retryCount = 0;
    let totalTokensUsed = 0;

    // 2. 重试循环：内容生成 -> 习题生成 -> 评估
    while (retryCount <= MAX_RETRIES && !assessmentPassed) {
      let contentLogId = 0;
      let exerciseLogId = 0;
      let assessmentLogId = 0;

      try {
        // 2.1 内容生成 Agent
        const contentLogResult = await createAgentExecutionLog(
          taskId,
          "content",
          "running",
          outline,
          undefined,
          undefined,
          retryCount,
        );
        contentLogId = (contentLogResult as any).insertId || 0;

        const contentResult = await contentGenerationAgent(outline);
        lectureContent = contentResult.content;
        knowledgePoints = contentResult.knowledgePoints;

        logTokenUsage("Content", contentResult.usage);
        totalTokensUsed += contentResult.usage.totalTokens;

        await updateAgentExecutionLog(contentLogId, {
          status: "completed",
          output: lectureContent,
          retryCount,
          promptTokens: contentResult.usage.promptTokens,
          completionTokens: contentResult.usage.completionTokens,
          totalTokens: contentResult.usage.totalTokens,
        });

        // 每次执行都保存讲义内容（重试时会新增记录，查询时取最新）
        await createLectureContent(taskId, lectureContent, knowledgePoints);

        // 2.2 习题生成 Agent
        const exerciseLogResult = await createAgentExecutionLog(
          taskId,
          "exercise",
          "running",
          lectureContent.substring(0, 500),
          undefined,
          undefined,
          retryCount,
        );
        exerciseLogId = (exerciseLogResult as any).insertId || 0;

        const exerciseResult = await exerciseGenerationAgent(
          lectureContent,
          knowledgePoints
        );
        exercises = exerciseResult.exercises;
        answers = exerciseResult.answers;

        logTokenUsage("Exercise", exerciseResult.usage);
        totalTokensUsed += exerciseResult.usage.totalTokens;

        await updateAgentExecutionLog(exerciseLogId, {
          status: "completed",
          output: exercises,
          retryCount,
          promptTokens: exerciseResult.usage.promptTokens,
          completionTokens: exerciseResult.usage.completionTokens,
          totalTokens: exerciseResult.usage.totalTokens,
        });

        // 每次执行都保存习题和答案（重试时会新增记录，查询时取最新）
        await createExercisesAndAnswers(taskId, exercises, answers);

        // 2.3 评估 Agent
        const assessmentLogResult = await createAgentExecutionLog(
          taskId,
          "assessment",
          "running",
          `Lecture: ${lectureContent.substring(0, 300)}\nExercises: ${exercises.substring(0, 300)}`,
          undefined,
          undefined,
          retryCount,
        );
        assessmentLogId = (assessmentLogResult as any).insertId || 0;

        const assessmentResult = await assessmentAgent(
          lectureContent,
          exercises,
          answers
        );

        logTokenUsage("Assessment", assessmentResult.usage);
        totalTokensUsed += assessmentResult.usage.totalTokens;

        await updateAgentExecutionLog(assessmentLogId, {
          status: "completed",
          output: JSON.stringify(assessmentResult),
          retryCount,
          promptTokens: assessmentResult.usage.promptTokens,
          completionTokens: assessmentResult.usage.completionTokens,
          totalTokens: assessmentResult.usage.totalTokens,
        });

        // 保存评估报告（每次都新增，查询时取最新）
        await createAssessmentReport(
          taskId,
          assessmentResult.lectureScore,
          assessmentResult.exerciseScore,
          assessmentResult.overallScore,
          assessmentResult.lectureFeedback,
          assessmentResult.exerciseFeedback,
          assessmentResult.suggestions,
          assessmentResult.status
        );

        // 检查评估是否通过
        if (assessmentResult.status === "pass") {
          assessmentPassed = true;
        } else {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(
              `[Pipeline] Assessment failed (score: ${assessmentResult.overallScore}), retrying... (${retryCount}/${MAX_RETRIES})`
            );
            console.log(`[Pipeline] Suggestions: ${assessmentResult.suggestions}`);
          }
        }
      } catch (error) {
        console.error("[Pipeline] Agent execution error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);

        // 直接标记当前正在执行的 agent 日志为失败
        if (assessmentLogId > 0) {
          await updateAgentExecutionLog(assessmentLogId, {
            status: "failed",
            error: errorMsg,
          });
        } else if (exerciseLogId > 0) {
          await updateAgentExecutionLog(exerciseLogId, {
            status: "failed",
            error: errorMsg,
          });
        } else if (contentLogId > 0) {
          await updateAgentExecutionLog(contentLogId, {
            status: "failed",
            error: errorMsg,
          });
        }

        retryCount++;
        if (retryCount > MAX_RETRIES) {
          await updateCourseTaskStatus(taskId, "failed");
          return {
            taskId,
            success: false,
            message: `Pipeline failed after ${MAX_RETRIES + 1} attempts: ${errorMsg}`,
          };
        }
      }
    }

    // 3. 根据最终评估结果更新任务状态
    if (assessmentPassed) {
      await updateCourseTaskStatus(taskId, "completed");
    } else {
      await updateCourseTaskStatus(taskId, "failed");
    }

    console.log(`[Pipeline] Total tokens used: ${totalTokensUsed}`);

    // 4. 发送通知给项目所有者（仅在成功时）
    if (assessmentPassed) {
      try {
        const task = await getCourseTask(taskId);
        if (task) {
          await notifyOwner({
            title: "课程内容生成完成",
            content: `课程"${task.title}"的内容生成和质量审核已完成。\n讲义、习题和答案解析已生成。\n总 Token 用量: ${totalTokensUsed}`,
          });
        }
      } catch (notifyError) {
        console.warn("[Pipeline] Failed to send notification:", notifyError);
      }
    }

    return {
      taskId,
      success: assessmentPassed,
      message: assessmentPassed
        ? "Pipeline completed successfully"
        : `Pipeline completed but assessment did not pass after ${MAX_RETRIES + 1} attempts`,
    };
  } catch (error) {
    console.error("[Pipeline] Unexpected error:", error);
    return {
      taskId: 0,
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
