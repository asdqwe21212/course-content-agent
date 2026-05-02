# 课程内容自动生成 Agent

基于多 Agent 协作的课程内容自动生成系统。输入课程大纲，系统通过长链推理自动拆解知识点，生成结构化讲义、配套习题和答案解析，并通过评估 Agent 进行质量审核，确保内容准确性。

## 核心功能

- **智能知识拆解** — 基于课程大纲，通过长链推理（Chain-of-Thought）自动识别和组织知识点
- **结构化讲义生成** — 自动生成 Markdown 格式的完整讲义，包含实例和应用场景
- **配套习题生成** — 为每个知识点生成多种题型的练习题（选择、填空、简答、应用）
- **答案解析** — 每道题配有详细解析，解释正确答案的原因
- **质量审核** — 评估 Agent 对生成内容进行多维度打分（准确性、完整性、清晰度、实用性），不通过自动重试
- **多 Agent 协作** — 内容 Agent → 习题 Agent → 评估 Agent 流水线式协作，确保内容质量

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (React)                       │
│  CourseInput ──→ CourseResult ──→ CourseHistory             │
│  (大纲输入)       (结果展示)        (历史记录)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ tRPC
┌──────────────────────────▼──────────────────────────────────┐
│                    Backend (Express + tRPC)                   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Agent Collaboration Pipeline              │  │
│  │                                                        │  │
│  │  Outline ──→ Content Agent ──→ Exercise Agent         │  │
│  │                (讲义生成)        (习题生成)              │  │
│  │                     │                    │              │  │
│  │                     └────────┬───────────┘              │  │
│  │                              ▼                          │  │
│  │                      Assessment Agent                  │  │
│  │                       (质量审核)                         │  │
│  │                              │                          │  │
│  │                    ┌─────────┴─────────┐                │  │
│  │                    ▼                   ▼                │  │
│  │               Pass (≥80)          Fail (<80)            │  │
│  │                    │                   │                │  │
│  │                    ▼                   ▼                │  │
│  │               Completed           Retry (≤2)            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  LLM: Manus Forge API (Gemini 2.5 Flash)                    │
│  DB: MySQL + Drizzle ORM                                    │
│  Auth: Manus OAuth                                          │
└─────────────────────────────────────────────────────────────┘
```

### Agent 协作流程

1. **内容生成 Agent** — 接收课程大纲，通过长链推理拆解知识点，生成结构化 Markdown 讲义
2. **习题生成 Agent** — 基于讲义和知识点，生成配套练习题和答案解析
3. **评估 Agent** — 对讲义和习题进行 4 维度打分（总分 100），≥80 分通过
4. **自动重试** — 评估未通过时自动重试（最多 2 次），确保内容质量

## 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm
- MySQL 数据库

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd course-content-agent

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入必要配置
```

### 数据库初始化

```bash
# 执行数据库迁移
pnpm db:push
```

### 启动开发服务

```bash
pnpm dev
```

访问 `http://localhost:3000` 即可使用。

### 生产构建

```bash
pnpm build
pnpm start
```

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | 是 | MySQL 连接字符串 |
| `JWT_SECRET` | 是 | JWT Cookie 签名密钥 |
| `BUILT_IN_FORGE_API_URL` | 是 | Manus Forge API 地址 |
| `BUILT_IN_FORGE_API_KEY` | 是 | Manus Forge API 密钥 |
| `OAUTH_SERVER_URL` | 是 | OAuth 服务地址 |
| `VITE_APP_ID` | 是 | OAuth 应用 ID |
| `VITE_OAUTH_PORTAL_URL` | 是 | OAuth 门户地址 |
| `OWNER_OPEN_ID` | 是 | 项目所有者 OpenID |
| `LLM_MAX_TOKENS` | 否 | 最大输出 token（默认 32768） |
| `LLM_THINKING_BUDGET` | 否 | 思考预算 token（默认 4096） |

## 项目结构

```
course-content-agent/
├── client/                     # 前端 (React + Vite + Tailwind)
│   └── src/
│       ├── pages/
│       │   ├── CourseInput.tsx   # 课程大纲输入页
│       │   ├── CourseResult.tsx  # 生成结果展示页
│       │   └── CourseHistory.tsx # 历史记录页
│       ├── components/          # UI 组件 (shadcn/ui)
│       └── lib/                 # tRPC 客户端、工具函数
├── server/                     # 后端 (Express + tRPC)
│   ├── agents.ts               # 3 个 AI Agent 实现
│   ├── pipeline.ts             # Agent 协作流水线
│   ├── routers.ts              # tRPC 路由定义
│   ├── db.ts                   # 数据库操作层
│   ├── storage.ts              # S3 存储操作
│   └── _core/                  # 核心基础设施
│       ├── llm.ts              # LLM 调用封装 (Manus Forge)
│       ├── oauth.ts            # OAuth 认证
│       ├── env.ts              # 环境变量
│       └── index.ts            # 服务入口
├── drizzle/                    # 数据库 Schema 和迁移
│   └── schema.ts               # 6 张表定义
├── shared/                     # 前后端共享代码
└── .env.example                # 环境变量模板
```

## 数据库表

| 表名 | 说明 |
|------|------|
| `users` | 用户表（OAuth 认证） |
| `course_tasks` | 课程生成任务 |
| `lecture_content` | 讲义内容 |
| `exercises_and_answers` | 习题与答案解析 |
| `assessment_report` | 评估报告 |
| `agent_execution_log` | Agent 执行日志（含 Token 用量） |

## 技术栈

- **前端**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, tRPC Client, Streamdown
- **后端**: Express 4, tRPC 11, Drizzle ORM, MySQL
- **AI**: Manus Forge API (Gemini 2.5 Flash), Structured Output (json_schema), Chain-of-Thought
- **认证**: Manus OAuth
- **测试**: Vitest
- **语言**: TypeScript (strict mode)

## License

MIT
