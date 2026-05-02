import { invokeLLM } from "./_core/llm";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 内容生成 Agent：基于课程大纲进行长链推理，拆解知识点，生成结构化讲义
 * 使用 json_schema 确保可靠的结构化输出
 */
export async function contentGenerationAgent(outline: string): Promise<{
  content: string;
  knowledgePoints: string[];
  usage: TokenUsage;
}> {
  const systemPrompt = `你是一位资深教育专家和课程设计师。你的任务是根据课程大纲进行深度分析和长链推理，生成结构化的讲义内容。

要求：
1. 进行逐步推理，分析课程大纲的核心知识点
2. 将知识点按逻辑层级组织，形成清晰的学习路径
3. 生成 Markdown 格式的讲义，包含标题、小节和详细解释
4. 每个知识点都要有具体例子和应用场景
5. 讲义应该循序渐进，从基础到进阶
6. 提取并返回所有主要知识点列表`;

  const userPrompt = `请根据以下课程大纲生成详细的讲义内容。

课程大纲：
${outline}

请生成一份结构清晰、内容完整的讲义，并在 knowledgePoints 字段中列出所有知识点。`;

  const outputSchema = {
    name: "lecture_content",
    schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Markdown 格式的完整讲义内容",
        },
        knowledgePoints: {
          type: "array",
          items: { type: "string" },
          description: "提取出的所有知识点列表",
        },
      },
      required: ["content", "knowledgePoints"],
    },
    strict: true,
  };

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    outputSchema,
  });

  const msgContent = response.choices[0]?.message?.content;
  const responseText = typeof msgContent === "string" ? msgContent : "";

  const usage: TokenUsage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };

  try {
    const parsed = JSON.parse(responseText);
    return {
      content: parsed.content || "",
      knowledgePoints: parsed.knowledgePoints || [],
      usage,
    };
  } catch (e) {
    console.warn("Failed to parse content agent JSON output, falling back to regex:", e);
    // 降级方案：用正则提取
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    let knowledgePoints: string[] = [];

    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        knowledgePoints = parsed.knowledgePoints || [];
      } catch (e2) {
        console.warn("Fallback parsing also failed:", e2);
      }
    }

    const lectureContent = responseText.replace(/```json\n[\s\S]*?\n```/g, "").trim();

    return {
      content: lectureContent,
      knowledgePoints,
      usage,
    };
  }
}

/**
 * 习题生成 Agent：基于讲义内容和知识点生成配套练习题和答案解析
 * 发送完整讲义内容（不截断）以确保习题质量
 */
export async function exerciseGenerationAgent(
  lectureContent: string,
  knowledgePoints: string[]
): Promise<{
  exercises: string;
  answers: string;
  usage: TokenUsage;
}> {
  const systemPrompt = `你是一位经验丰富的教学设计师和出题专家。你的任务是基于讲义内容和知识点生成高质量的练习题和详细答案解析。

要求：
1. 为每个主要知识点设计 2-3 道不同难度的练习题
2. 题型包括：选择题、填空题、简答题、应用题等
3. 题目应该循序渐进，从基础到进阶
4. 每道题都要有详细的答案解析，解释为什么这是正确答案
5. 答案解析应该帮助学生理解知识点的深层含义
6. 生成 Markdown 格式的内容`;

  const userPrompt = `请基于以下讲义内容和知识点生成配套的练习题和答案解析。

知识点：
${knowledgePoints.join("\n")}

讲义内容：
${lectureContent}

请生成：
1. 一份包含多道练习题的题库（Markdown 格式）
2. 一份详细的答案解析（Markdown 格式）

请分别用 "## 练习题" 和 "## 答案解析" 作为两个部分的标题。`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const msgContent = response.choices[0]?.message?.content;
  const responseText = typeof msgContent === "string" ? msgContent : "";

  const usage: TokenUsage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };

  // 分离练习题和答案解析
  const exercisesMatch = responseText.match(/##\s*练习题([\s\S]*?)(?=##\s*答案解析|$)/);
  const answersMatch = responseText.match(/##\s*答案解析([\s\S]*?)$/);

  const exercisesText = exercisesMatch ? exercisesMatch[1].trim() : responseText;
  const answersText = answersMatch ? answersMatch[1].trim() : "答案解析生成中...";

  return {
    exercises: `## 练习题\n${exercisesText}`,
    answers: `## 答案解析\n${answersText}`,
    usage,
  };
}

/**
 * 评估 Agent：对生成的讲义和习题进行质量审核
 * 使用 json_schema 确保可靠的结构化输出
 * 发送完整内容（不截断）以确保评估准确性
 */
export async function assessmentAgent(
  lectureContent: string,
  exercises: string,
  answers: string
): Promise<{
  lectureScore: number;
  exerciseScore: number;
  overallScore: number;
  lectureFeedback: string;
  exerciseFeedback: string;
  suggestions: string;
  status: "pass" | "fail";
  usage: TokenUsage;
}> {
  const systemPrompt = `你是一位严格的教育质量评审专家。你的任务是对生成的讲义、习题和答案进行全面的质量审核。

评估标准（每项 0-100 分）：
讲义评估：
- 内容准确性（30%）：知识点是否正确、无误
- 完整性（30%）：是否涵盖所有重要知识点
- 清晰度（20%）：结构是否清晰、易于理解
- 实用性（20%）：是否包含实际例子和应用

习题评估：
- 难度合理性（25%）：是否循序渐进
- 题型多样性（25%）：是否包含多种题型
- 覆盖性（25%）：是否覆盖所有知识点
- 答案质量（25%）：答案解析是否详细清晰

总体评分标准：
- 90-100：优秀，内容全面准确，可直接使用
- 80-89：良好，内容基本完整，可小幅修改后使用
- 70-79：及格，内容基本可用，需要较多修改
- 60-69：不及格，内容有较多缺陷，需要重大修改
- <60：不通过，内容存在严重问题，需要重新生成

通过标准：总体评分 >= 80 分

请在 feedback 字段中给出具体、可操作的反馈和改进建议。`;

  const userPrompt = `请对以下生成的课程内容进行质量评审。

讲义内容：
${lectureContent}

练习题：
${exercises}

答案解析：
${answers}

请给出详细的评审结果。`;

  const outputSchema = {
    name: "assessment_result",
    schema: {
      type: "object",
      properties: {
        lectureScore: {
          type: "integer",
          description: "讲义评分 0-100",
        },
        exerciseScore: {
          type: "integer",
          description: "习题评分 0-100",
        },
        overallScore: {
          type: "integer",
          description: "总体评分 0-100",
        },
        lectureFeedback: {
          type: "string",
          description: "讲义的具体反馈意见",
        },
        exerciseFeedback: {
          type: "string",
          description: "习题的具体反馈意见",
        },
        suggestions: {
          type: "string",
          description: "改进建议",
        },
        status: {
          type: "string",
          enum: ["pass", "fail"],
          description: "是否通过审核，overallScore >= 80 为 pass",
        },
      },
      required: ["lectureScore", "exerciseScore", "overallScore", "lectureFeedback", "exerciseFeedback", "suggestions", "status"],
    },
    strict: true,
  };

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    outputSchema,
  });

  const msgContent = response.choices[0]?.message?.content;
  const responseText = typeof msgContent === "string" ? msgContent : "";

  const usage: TokenUsage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };

  try {
    const result = JSON.parse(responseText);
    return {
      lectureScore: result.lectureScore ?? 0,
      exerciseScore: result.exerciseScore ?? 0,
      overallScore: result.overallScore ?? 0,
      lectureFeedback: result.lectureFeedback || "",
      exerciseFeedback: result.exerciseFeedback || "",
      suggestions: result.suggestions || "",
      status: result.status === "pass" ? "pass" : "fail",
      usage,
    };
  } catch (e) {
    console.error("Failed to parse assessment result, falling back to regex:", e);
    // 降级方案：用正则提取 JSON
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);

    if (jsonMatch && jsonMatch[1]) {
      try {
        const result = JSON.parse(jsonMatch[1]);
        return {
          lectureScore: result.lectureScore || 0,
          exerciseScore: result.exerciseScore || 0,
          overallScore: result.overallScore || 0,
          lectureFeedback: result.lectureFeedback || "",
          exerciseFeedback: result.exerciseFeedback || "",
          suggestions: result.suggestions || "",
          status: result.status === "pass" ? "pass" : "fail",
          usage,
        };
      } catch (e2) {
        console.error("Fallback parsing also failed:", e2);
      }
    }
  }

  // 默认返回失败状态
  return {
    lectureScore: 60,
    exerciseScore: 60,
    overallScore: 60,
    lectureFeedback: "评估失败，无法解析评估结果",
    exerciseFeedback: "评估失败，无法解析评估结果",
    suggestions: "请重新生成内容",
    status: "fail",
    usage,
  };
}
