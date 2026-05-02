import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function CourseHistory() {
  const [, setLocation] = useLocation();
  const historyQuery = trpc.course.getHistory.useQuery();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">已完成</span>;
      case "processing":
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">生成中</span>;
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">待处理</span>;
      case "failed":
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">失败</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h1 className="text-3xl font-bold text-foreground">历史记录</h1>
        </div>

        {/* 历史列表 */}
        {historyQuery.isLoading ? (
          <Card className="card-minimal text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-muted-foreground">加载中...</p>
          </Card>
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="space-y-4">
            {historyQuery.data.map((task) => (
              <Card
                key={task.id}
                className="card-minimal cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setLocation(`/result/${task.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {task.title}
                      </h3>
                      {getStatusBadge(task.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {task.outline}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="card-minimal text-center py-12">
            <p className="text-muted-foreground mb-4">暂无历史记录</p>
            <Button
              onClick={() => setLocation("/")}
              className="btn-nordic-primary"
            >
              创建新课程
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
