import {
  createCourseTask,
  updateCourseTaskStatus,
  createLectureContent,
  createExercisesAndAnswers,
  createAssessmentReport,
  createAgentExecutionLog,
  updateAgentExecutionLog,
  getAgentExecutionLogs,
  getCourseTask,
} from "./db";
import {
  contentGenerationAgent,
  exerciseGenerationAgent,
  assessmentAgent,
} from "./agents";
import { notifyOwner } from "./_core/notification";

const MAX_RETRIES = 2;

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

    // 2. 重试循环：内容生成 -> 习题生成 -> 评估
    while (retryCount <= MAX_RETRIES && !assessmentPassed) {
      try {
        // 2.1 内容生成 Agent
        const contentLogResult = await createAgentExecutionLog(
          taskId,
          "content",
          "running",
          outline
        );
        const contentLogId = (contentLogResult as any).insertId || 0;

        const contentResult = await contentGenerationAgent(outline);
        lectureContent = contentResult.content;
        knowledgePoints = contentResult.knowledgePoints;

        await updateAgentExecutionLog(contentLogId, {
          status: "completed",
          output: lectureContent,
        });

        // 保存讲义内容（第一次创建，后续重试会覆盖）
        if (retryCount === 0) {
          await createLectureContent(taskId, lectureContent, knowledgePoints);
        }

        // 2.2 习题生成 Agent
        const exerciseLogResult = await createAgentExecutionLog(
          taskId,
          "exercise",
          "running",
          lectureContent
        );
        const exerciseLogId = (exerciseLogResult as any).insertId || 0;

        const exerciseResult = await exerciseGenerationAgent(
          lectureContent,
          knowledgePoints
        );
        exercises = exerciseResult.exercises;
        answers = exerciseResult.answers;

        await updateAgentExecutionLog(exerciseLogId, {
          status: "completed",
          output: exercises,
        });

        // 保存习题和答案（第一次创建，后续重试会覆盖）
        if (retryCount === 0) {
          await createExercisesAndAnswers(taskId, exercises, answers);
        }

        // 2.3 评估 Agent
        const assessmentLogResult = await createAgentExecutionLog(
          taskId,
          "assessment",
          "running",
          `Lecture: ${lectureContent.substring(0, 200)}\nExercises: ${exercises.substring(0, 200)}`
        );
        const assessmentLogId = (assessmentLogResult as any).insertId || 0;

        const assessmentResult = await assessmentAgent(
          lectureContent,
          exercises,
          answers
        );

        await updateAgentExecutionLog(assessmentLogId, {
          status: "completed",
          output: JSON.stringify(assessmentResult),
        });

        // 保存评估报告（每次都覆盖最新的评估结果）
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
              `[Pipeline] Assessment failed, retrying... (${retryCount}/${MAX_RETRIES})`
            );
          }
        }
      } catch (error) {
        console.error("[Pipeline] Agent execution error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);

        // 记录错误
        const logs = await getAgentExecutionLogs(taskId);
        if (logs && logs.length > 0) {
          const lastLog = logs[logs.length - 1];
          if (lastLog) {
            await updateAgentExecutionLog(lastLog.id, {
              status: "failed",
              error: errorMsg,
            });
          }
        }

        retryCount++;
        if (retryCount > MAX_RETRIES) {
          // 标记任务为失败
          await updateCourseTaskStatus(taskId, "failed");
          return {
            taskId,
            success: false,
            message: `Pipeline failed after ${MAX_RETRIES} retries: ${errorMsg}`,
          };
        }
      }
    }

    // 3. 根据最终评估结果更新任务状态
    if (assessmentPassed) {
      await updateCourseTaskStatus(taskId, "completed");
    } else {
      // 评估多次未通过，标记为失败
      await updateCourseTaskStatus(taskId, "failed");
    }

    // 4. 发送通知给项目所有者（仅在成功时）
    if (assessmentPassed) {
      try {
        const task = await getCourseTask(taskId);
        if (task) {
          await notifyOwner({
            title: "课程内容生成完成",
            content: `课程"${task.title}"的内容生成和质量审核已完成。讲义、习题和答案解析已生成。`,
          });
        }
      } catch (notifyError) {
        console.warn("[Pipeline] Failed to send notification:", notifyError);
        // 不因通知失败而影响整体流程
      }
    }

    return {
      taskId,
      success: assessmentPassed,
      message: assessmentPassed
        ? "Pipeline completed successfully"
        : `Pipeline completed but assessment did not pass after ${MAX_RETRIES} retries`,
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
