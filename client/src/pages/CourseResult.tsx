import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Download, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function CourseResult() {
  const { taskId } = useParams();
  const [, setLocation] = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const contentQuery = trpc.course.getContent.useQuery(Number(taskId), {
    refetchInterval: autoRefresh ? 2000 : false,
  });

  const task = contentQuery.data?.task;
  const lecture = contentQuery.data?.lecture;
  const exercises = contentQuery.data?.exercises;
  const assessment = contentQuery.data?.assessment;

  // 当任务完成时停止自动刷新
  useEffect(() => {
    if (task?.status === "completed" || task?.status === "failed") {
      setAutoRefresh(false);
    }
  }, [task?.status]);

  const handleCopyToClipboard = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${type}已复制到剪贴板`);
  };

  const getStatusDisplay = () => {
    switch (task?.status) {
      case "pending":
        return <span className="text-muted-foreground">等待处理中...</span>;
      case "processing":
        return (
          <span className="flex items-center gap-2 text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
            生成中...
          </span>
        );
      case "completed":
        return <span className="text-green-600">已完成</span>;
      case "failed":
        return <span className="text-red-600">生成失败</span>;
      default:
        return <span className="text-muted-foreground">未知状态</span>;
    }
  };

  if (contentQuery.isLoading && !task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 返回按钮和标题 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{task?.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                状态: {getStatusDisplay()}
              </p>
            </div>
          </div>
        </div>

        {/* 内容展示区域 */}
        {task?.status === "completed" ? (
          <Tabs defaultValue="lecture" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="lecture">讲义</TabsTrigger>
              <TabsTrigger value="exercises">习题</TabsTrigger>
              <TabsTrigger value="answers">答案解析</TabsTrigger>
              <TabsTrigger value="assessment">评估报告</TabsTrigger>
            </TabsList>

            {/* 讲义 Tab */}
            <TabsContent value="lecture">
              <Card className="card-minimal">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">讲义内容</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleCopyToClipboard(lecture?.content || "", "讲义")
                    }
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
                <div className="markdown-content">
                  <Streamdown>{lecture?.content || ""}</Streamdown>
                </div>
              </Card>
            </TabsContent>

            {/* 习题 Tab */}
            <TabsContent value="exercises">
              <Card className="card-minimal">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">练习题</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleCopyToClipboard(exercises?.exercises || "", "习题")
                    }
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
                <div className="markdown-content">
                  <Streamdown>{exercises?.exercises || ""}</Streamdown>
                </div>
              </Card>
            </TabsContent>

            {/* 答案解析 Tab */}
            <TabsContent value="answers">
              <Card className="card-minimal">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">答案解析</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleCopyToClipboard(exercises?.answers || "", "答案解析")
                    }
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
                <div className="markdown-content">
                  <Streamdown>{exercises?.answers || ""}</Streamdown>
                </div>
              </Card>
            </TabsContent>

            {/* 评估报告 Tab */}
            <TabsContent value="assessment">
              <Card className="card-minimal">
                <div className="space-y-6">
                  {/* 评分卡片 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-1">讲义评分</p>
                      <p className="text-2xl font-bold text-accent">
                        {assessment?.lectureScore}/100
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-1">习题评分</p>
                      <p className="text-2xl font-bold text-accent">
                        {assessment?.exerciseScore}/100
                      </p>
                    </div>
                    <div className="bg-accent/10 p-4 rounded-lg text-center border-2 border-accent">
                      <p className="text-sm text-muted-foreground mb-1">总体评分</p>
                      <p className="text-2xl font-bold text-accent">
                        {assessment?.overallScore}/100
                      </p>
                    </div>
                  </div>

                  {/* 审核状态 */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">审核状态</p>
                    <p
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        assessment?.status === "pass"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {assessment?.status === "pass" ? "✓ 通过审核" : "✗ 未通过审核"}
                    </p>
                  </div>

                  {/* 反馈信息 */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">讲义反馈</h3>
                    <p className="text-muted-foreground">
                      {assessment?.lectureFeedback}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">习题反馈</h3>
                    <p className="text-muted-foreground">
                      {assessment?.exerciseFeedback}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">改进建议</h3>
                    <p className="text-muted-foreground">
                      {assessment?.suggestions}
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="card-minimal text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-muted-foreground mb-2">正在生成课程内容...</p>
            <p className="text-sm text-muted-foreground">
              这可能需要几分钟，请耐心等待
            </p>
          </Card>
        )}

        {/* 返回首页按钮 */}
        <div className="mt-8 flex gap-4">
          <Button
            onClick={() => setLocation("/")}
            className="btn-nordic-primary flex-1"
          >
            生成新课程
          </Button>
          <Button
            onClick={() => setLocation("/history")}
            variant="outline"
            className="flex-1"
          >
            查看历史记录
          </Button>
        </div>
      </div>
    </div>
  );
}
