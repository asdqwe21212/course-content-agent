import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { courseContentPipeline } from "./pipeline";
import { getCourseTask, getLectureContent, getExercisesAndAnswers, getAssessmentReport, getUserCourseTasks } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  course: router({
    submit: protectedProcedure
      .input(z.object({
        title: z.string().min(1, "课程标题不能为空"),
        outline: z.string().min(1, "课程大纲不能为空"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await courseContentPipeline(ctx.user.id, input.title, input.outline);
        return result;
      }),

    getContent: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        // 权限校验：确保用户只能查看自己的课程
        const task = await getCourseTask(input);
        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "课程不存在",
          });
        }

        if (task.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权访问此课程",
          });
        }

        const lecture = await getLectureContent(input);
        const exercises = await getExercisesAndAnswers(input);
        const assessment = await getAssessmentReport(input);
        
        return { task, lecture, exercises, assessment };
      }),

    getHistory: protectedProcedure.query(async ({ ctx }) => {
      return await getUserCourseTasks(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
