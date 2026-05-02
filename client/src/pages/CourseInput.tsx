import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CourseInput() {
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState("");
  const [, setLocation] = useLocation();
  
  const submitMutation = trpc.course.submit.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("课程内容生成已启动，请稍候...");
        setLocation(`/result/${result.taskId}`);
      } else {
        toast.error(result.message || "生成失败");
      }
    },
    onError: (error) => {
      toast.error(error.message || "提交失败");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("请输入课程标题");
      return;
    }
    
    if (!outline.trim()) {
      toast.error("请输入课程大纲");
      return;
    }

    submitMutation.mutate({ title, outline });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      {/* 装饰性几何图形 */}
      <div className="geometric-accent top-20 left-10 w-32 h-32 bg-secondary rounded-full blur-3xl"></div>
      <div className="geometric-accent bottom-32 right-20 w-40 h-40 bg-accent rounded-full blur-3xl opacity-5"></div>

      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* 页面标题 */}
        <div className="text-center mb-12 spacious">
          <h1 className="text-4xl font-bold text-foreground mb-3">课程内容自动生成</h1>
          <p className="text-hierarchy-secondary">
            输入课程大纲，AI 将自动生成讲义、习题和答案解析
          </p>
        </div>

        {/* 输入表单 */}
        <Card className="card-minimal">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 课程标题输入 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                课程标题
              </label>
              <Input
                type="text"
                placeholder="例如：Python 基础编程"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitMutation.isPending}
                className="w-full"
              />
            </div>

            {/* 课程大纲输入 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                课程大纲
              </label>
              <Textarea
                placeholder={`请输入课程大纲，例如：
1. 基础概念
   - 变量和数据类型
   - 操作符
2. 控制流
   - 条件语句
   - 循环语句
3. 函数
   - 函数定义
   - 参数和返回值`}
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                disabled={submitMutation.isPending}
                className="w-full min-h-64 resize-none"
              />
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="btn-nordic-primary w-full"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "开始生成"
              )}
            </Button>
          </form>
        </Card>

        {/* 提示信息 */}
        <div className="mt-8 p-4 bg-secondary/20 border border-secondary rounded-lg">
          <p className="text-sm text-muted-foreground">
            💡 <strong>提示：</strong> 系统将通过多 Agent 协作，自动生成结构化讲义、配套习题和答案解析。生成过程包括内容生成、习题生成和质量评估三个阶段。
          </p>
        </div>
      </div>
    </div>
  );
}
