import { invokeLLM } from "./_core/llm";

/**
 * 内容生成 Agent：基于课程大纲进行长链推理，拆解知识点，生成结构化讲义
 */
export async function contentGenerationAgent(outline: string): Promise<{
  content: string;
  knowledgePoints: string[];
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

请生成一份结构清晰、内容完整的讲义，并在最后用 JSON 格式列出所有知识点。
格式示例：
\`\`\`json
{"knowledgePoints": ["知识点1", "知识点2", ...]}
\`\`\``;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const msgContent = response.choices[0]?.message?.content;
  const responseText = typeof msgContent === "string" ? msgContent : "";

  // 提取 JSON 格式的知识点
  const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
  let knowledgePoints: string[] = [];

  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      knowledgePoints = parsed.knowledgePoints || [];
    } catch (e) {
      console.warn("Failed to parse knowledge points JSON:", e);
    }
  }

  // 移除 JSON 块，保留讲义内容
  const lectureContent = responseText.replace(/```json\n[\s\S]*?\n```/g, "").trim();

  return {
    content: lectureContent,
    knowledgePoints,
  };
}

/**
 * 习题生成 Agent：基于讲义内容和知识点生成配套练习题和答案解析
 */
export async function exerciseGenerationAgent(
  lectureContent: string,
  knowledgePoints: string[]
): Promise<{
  exercises: string;
  answers: string;
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

讲义内容摘要：
${lectureContent.substring(0, 1000)}...

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

  // 分离练习题和答案解析
  const exercisesMatch = responseText.match(/##\s*练习题([\s\S]*?)(?=##\s*答案解析|$)/);
  const answersMatch = responseText.match(/##\s*答案解析([\s\S]*?)$/);

  const exercisesText = exercisesMatch ? exercisesMatch[1].trim() : responseText;
  const answersText = answersMatch ? answersMatch[1].trim() : "答案解析生成中...";

  return {
    exercises: `## 练习题\n${exercisesText}`,
    answers: `## 答案解析\n${answersText}`,
  };
}

/**
 * 评估 Agent：对生成的讲义和习题进行质量审核
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

通过标准：总体评分 >= 80 分`;

  const userPrompt = `请对以下生成的课程内容进行质量评审。

讲义内容：
${lectureContent.substring(0, 1500)}...

练习题：
${exercises.substring(0, 1000)}...

答案解析：
${answers.substring(0, 1000)}...

请按照以下 JSON 格式返回评审结果：
\`\`\`json
{
  "lectureScore": <0-100>,
  "exerciseScore": <0-100>,
  "overallScore": <0-100>,
  "lectureFeedback": "<讲义反馈>",
  "exerciseFeedback": "<习题反馈>",
  "suggestions": "<改进建议>",
  "status": "<pass|fail>"
}
\`\`\``;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const msgContent = response.choices[0]?.message?.content;
  const responseText = typeof msgContent === "string" ? msgContent : "";

  // 提取 JSON 格式的评估结果
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
      };
    } catch (e) {
      console.error("Failed to parse assessment result:", e);
    }
  }

  // 默认返回失败状态
  return {
    lectureScore: 60,
    exerciseScore: 60,
    overallScore: 60,
    lectureFeedback: "评估失败",
    exerciseFeedback: "评估失败",
    suggestions: "请重新生成内容",
    status: "fail",
  };
}
