# 睿评 AI

> 面向 K12 的 AI 学情分析平台：**作业/试卷上传 → AI 批改 → 错题归因 → 知识点掌握度分析 → 针对性出题 → 学情报告**。

版本 `1.0` · 教师端 + 家长端 · Node.js 20+ / PostgreSQL / tRPC / React 19

---

## 目录

- [睿评 AI](#睿评-ai)
  - [目录](#目录)
  - [项目简介](#项目简介)
  - [核心功能](#核心功能)
    - [教师端](#教师端)
    - [家长端](#家长端)
    - [AI 能力](#ai-能力)
  - [技术栈](#技术栈)
  - [系统架构](#系统架构)
  - [数据模型](#数据模型)
  - [目录结构](#目录结构)
  - [快速开始](#快速开始)
    - [1. 环境要求](#1-环境要求)
    - [2. 安装与配置](#2-安装与配置)
    - [3. 初始化数据库](#3-初始化数据库)
    - [4. 启动](#4-启动)
  - [演示账号与数据](#演示账号与数据)
  - [环境变量](#环境变量)
  - [常用命令](#常用命令)
  - [测试](#测试)
  - [部署](#部署)
    - [Docker 编排（开发/联调）](#docker-编排开发联调)
    - [生产部署](#生产部署)
  - [项目进展](#项目进展)
    - [P0 —— 主流程与数据口径](#p0--主流程与数据口径)
    - [P1 —— 安全与工程质量](#p1--安全与工程质量)
    - [P2 —— 教育专业性](#p2--教育专业性)
  - [已知限制](#已知限制)
  - [安全设计](#安全设计)
  - [相关文档](#相关文档)
  - [许可证](#许可证)

## 项目简介

睿评 AI 是一个可运行的 K12 学情分析平台，包含**教师端**与**家长端**两个角色：

- 教师创建班级、管理学生，上传学生作业或试卷后由 AI 自动批改，沉淀成绩、错题与知识点掌握度；
- 家长通过班级邀请码或家庭邀请码绑定孩子，上传作业并查看批改报告与学习趋势；
- 平台基于错题和知识薄弱点生成针对性练习，并支持班级学情报告导出为 PDF / Excel。

当前版本已打通「上传 → 批改 → 分析 → 反馈」的主流程，并从早期的演示原型补齐了会话安全、批改队列、限流、AI 用量控制与自动化测试。教育专业性（知识图谱、IRT/贝叶斯掌握度、合规审计）仍在演进中，详见[项目进展](#项目进展)。

## 核心功能

### 教师端

| 模块 | 能力 |
| --- | --- |
| 班级管理 | 创建班级、生成/刷新邀请码、班级归档（结课）、班级升级、学生分组 |
| 学生管理 | 单个添加、批量导入、特别关注标记、学生详情与历史提交记录 |
| 作业/试卷 | 单份上传、批量上传、拍摄/相册上传、AI 批改、失败重试、状态轮询 |
| 学情分析 | 班级/学生成绩趋势、平均分与优秀率/及格率、知识点掌握度、错题本 |
| 智能出题 | 基于薄弱知识点生成针对性练习，支持学生维度与班级维度 |
| 教学资料 | 按知识点管理文本/文件资料，支持上传、编辑、删除 |
| 报告中心 | 班级学情报告导出 PDF / Excel，含成绩统计与明细表 |
| 家校协同 | 审批家长绑定申请、解绑家长、查看家庭成员 |
| 消息与额度 | 批改失败/低分/薄弱知识点提醒，AI 每日额度展示 |

### 家长端

- 手机号注册/登录，注册时通过**班级邀请码 + 孩子姓名**或**家庭邀请码**完成绑定；
- 一个孩子最多可绑定 6 位家长（如爸爸、妈妈等），支持家庭邀请码邀请其他家长；
- 孩子已有家长时，新家长发起绑定会进入教师审批流程；
- 上传作业、查看 AI 批改结果、成绩趋势、知识点掌握度与错题详情。

### AI 能力

- **多模型接入**：硅基流动 Qwen3.6（默认、经济）、阿里云百炼 Qwen-VL-Max（高精度）、OpenAI GPT-4o；仅展示已配置密钥的模型。
- **结构化输出**：Zod Schema 校验 + 超时 + 指数退避重试 + JSON 自动修复重试，避免静默返回伪造结果。
- **持久化批改队列**：队列即数据库（`analysisStatus` + `analysisQueuedAt`），服务重启后自动恢复；多实例通过条件更新原子认领任务。
- **AI 用量控制**：按账号统计每日调用次数（默认 200 次/天），记录输入/输出 Token，失败调用不计费。
- **知识归因**：AI 输出知识点与错题，系统负责规范化（去空格/标点）并复用班级已有知识点，掌握度按指数滑动平均更新。

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 前端 | React 19、TanStack Router（文件路由 + 代码分割）、TanStack Query、Zustand、Tailwind CSS、Recharts、Lucide Icons |
| API | tRPC v11、SuperJSON、Zod |
| 运行时 | Vinxi 0.5 / Nitro（`node-server` 预设）、Vite 6 |
| 数据层 | PostgreSQL、Prisma 6（迁移 + Seed） |
| AI | Vercel AI SDK v4、OpenAI 兼容接口（SiliconCloud / 阿里云百炼 / OpenAI） |
| 存储 | 阿里云 OSS（预签名直传、私有桶读取、短时签名 URL） |
| 报告导出 | ExcelJS（Excel）、puppeteer-core + 本机 Edge/Chrome（PDF） |
| 认证 | JWT + httpOnly Cookie、bcrypt（12 轮） |
| 测试 | Vitest（单元 + 集成）、独立 `*_test` 数据库 |
| 部署 | Docker / Docker Compose、Nginx |

## 系统架构

```mermaid
flowchart TB
    subgraph Client["浏览器"]
        SPA["React 19 SPA<br/>TanStack Router / Query<br/>Zustand / Tailwind"]
    end

    subgraph App["Vinxi / Nitro（node-server）"]
        TRPC["tRPC v11 API<br/>鉴权 · 校验 · 业务过程"]
        WORKER["批改队列 Worker<br/>PostgreSQL 轮询 + 原子认领"]
        AI["AI Service<br/>AI SDK + Zod"]
        REPORT["报告导出<br/>puppeteer-core / ExcelJS"]
    end

    DB[("PostgreSQL<br/>Prisma")]
    OSS[("阿里云 OSS<br/>预签名直传")]
    LLM["AI 提供商<br/>SiliconCloud / 百炼 / OpenAI"]
    BROWSER["本机 Edge / Chrome"]

    SPA -->|"tRPC over HTTP<br/>httpOnly Cookie"| TRPC
    TRPC --> DB
    TRPC -->|"预签名上传 / 签名读取"| OSS
    TRPC --> REPORT --> BROWSER
    WORKER --> DB
    WORKER -->|"下载作业图片"| OSS
    WORKER --> AI --> LLM
```

批改主流程：

1. 前端向 `generatePresignedUploadUrl` 申请预签名 URL，直传图片到 OSS；
2. 上传过程创建作业/试卷记录，并将 `analysisStatus` 置为 `pending`、写入 `analysisQueuedAt`；
3. 后台 Worker 每 5 秒轮询一次，通过条件更新原子认领任务（每实例最多并发 2 个）；
4. Worker 从 OSS 下载图片，调用 AI 进行结构化批改；
5. 在同一事务内写入成绩、反馈、错题与知识点掌握度，并标记 `completed`；
6. 失败会记录 `analysisError`，前端可一键重试；超过 3 次中断的任务会终止并提示重新提交。

## 数据模型

```mermaid
erDiagram
    Teacher ||--o{ "Class" : owns
    Teacher ||--o{ TeachingMaterial : uploads
    RegistrationCode ||--o{ Teacher : invites
    "Class" ||--o{ Student : contains
    "Class" ||--o{ StudentGroup : groups
    Student }o--o{ Parent : ParentStudent
    Student ||--o{ Assignment : submits
    Student ||--o{ Exam : takes
    Assignment ||--o| AssignmentAnalysis : has
    Exam ||--o| ExamAnalysis : has
    AssignmentAnalysis ||--o{ Mistake : records
    ExamAnalysis ||--o{ ExamMistake : records
    KnowledgeArea ||--o{ Mistake : classifies
    KnowledgeArea ||--o{ ExamMistake : classifies
    Student ||--o{ StudentKnowledgeArea : masters
    KnowledgeArea ||--o{ StudentKnowledgeArea : tracked_by
    Parent ||--o{ ParentBindingRequest : requests
    Parent ||--o{ FamilyInvite : creates
    Student ||--o{ ParentBindingRequest : requested_for
    Student ||--o{ FamilyInvite : shared_for
```

**统一数据口径**（`src/lib/grading.ts`）：

- 成绩：数据库只存 `score: Float?`（0–100）。字母等级、中文等级、"18/20"、"85分"等由 `normalizeScore` 换算；`grade` 字段仅保留卷面原始标注用于展示。
- 掌握度：`StudentKnowledgeArea.mastery: Float`（0–1）+ `evidenceCount`；`beginner/intermediate/advanced` 由展示层派生，不入库。
- 统计指标：平均分、优秀率、及格率、低分率、提交覆盖率统一定义在 `src/lib/classStats.ts`。

## 目录结构

```text
ruiping-ai/
├─ src/
│  ├─ routes/                  # TanStack Router 文件式路由
│  │  ├─ dashboard/            # 教师端页面（概览/学情/成绩/作业/试卷/知识图谱/错题/资料/出题/学生/班级/报告/消息/设置）
│  │  ├─ parent-dashboard/     # 家长端页面
│  │  ├─ auth/                 # 登录/注册
│  │  └─ index.tsx             # 营销首页
│  ├─ components/              # 业务组件（class/student/assignment/parent/dashboard/...）
│  ├─ server/
│  │  ├─ trpc/                 # tRPC 上下文、鉴权中间件、限流、procedures/
│  │  ├─ auth/session.ts       # 会话 Cookie、JWT 校验与吊销
│  │  ├─ ai-service.ts         # 模型注册、提示词与业务 AI 调用
│  │  ├─ ai/                   # 结构化输出、重试、错误、用量统计
│  │  ├─ services/grading.ts   # 持久化批改队列与 Worker
│  │  ├─ services/registration.ts # 注册邀请码
│  │  ├─ storage.ts            # 阿里云 OSS
│  │  ├─ pdf.ts                # PDF 渲染
│  │  └─ db.ts                 # Prisma Client
│  ├─ lib/                     # 成绩口径、掌握度、班级统计
│  ├─ stores/                  # Zustand 状态
│  └─ generated/               # TanStack Router 生成文件
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                  # 幂等演示数据
├─ tests/
│  ├─ unit/                    # 纯函数/模块单元测试
│  └─ integration/             # 真实数据库集成测试
├─ docker/                     # Dockerfile / Compose / Nginx
├─ scripts/                    # 邀请码 CLI、容器脚本
├─ app.config.ts               # Vinxi 应用配置
└─ vitest.config.ts
```

## 快速开始

### 1. 环境要求

- **Node.js 20+**（Docker 镜像基于 Node 20）
- **pnpm 9+**（仓库使用 `pnpm-lock.yaml` v9）
- **PostgreSQL 14+**（推荐 16）
- **阿里云 OSS**：作业/试卷上传需要（Bucket 可为私有读）
- **至少一个 AI 服务密钥**：SiliconCloud / 阿里云百炼 / OpenAI
- **Microsoft Edge 或 Google Chrome**：仅 PDF 导出需要，可通过 `PDF_BROWSER_PATH` 指定

### 2. 安装与配置

```bash
pnpm install

# 复制环境变量模板（.env 含有密钥，切勿提交到版本库）
cp .env.example .env
```

编辑 `.env`，至少填写：

```dotenv
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/teachai
JWT_SECRET=<随机长字符串>
SILICONCLOUD_API_KEY=<至少一个 AI 密钥>
```

生成 `JWT_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> 含 `your-` / `placeholder` / `change-me` 等占位符的值会被视为“未配置”；生产环境使用占位符会直接启动失败。

### 3. 初始化数据库

```bash
# 开发环境：应用已有迁移（prisma migrate dev）
pnpm db:generate

# 写入演示数据（可重复执行，幂等）
pnpm seed
```

> `pnpm db:generate` 实际执行的是 `prisma migrate dev`；生产环境应用迁移请使用 `pnpm db:migrate`（`prisma migrate deploy`）。

### 4. 启动

```bash
pnpm dev
```

打开 <http://localhost:3000>。首次启动后可在首页或登录页使用“演示登录”，也可以使用下方账号密码登录。

## 演示账号与数据

`pnpm seed` 会创建 3 个班级、30 名学生、120 份作业、90 场考试，以及错题、分组、知识点和教学资料：

| 角色 | 手机号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 教师 | `13800000001` | `Demo1234` | 示范教师，拥有 3 个班级 |
| 家长 | `13900000001` | `Parent1234` | 张明轩家长 |
| 家长 2 | `13900000002` | `Parent1234` | 张明轩妈妈（同一孩子的另一位家长） |
| 教师注册邀请码 | `EDU-DEMO-2026` | — | Seed 生成，20 次 / 30 天 |
| 班级邀请码 | `MATH3A` / `MATH4B` / `MATH5C` | — | Seed 生成的班级邀请码，7 天内有效 |

> 演示数据中的作业/试卷图片使用 `placeholder.com` 占位地址，**不能重新发起 AI 批改**；体验真实批改流程请使用教师端/家长端新上传的图片。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `NODE_ENV` | 否 | `development` | `development` / `production` / `test` |
| `DATABASE_URL` | 是 | — | PostgreSQL 连接串 |
| `JWT_SECRET` | 是 | — | 至少 16 字符；生产环境禁止占位符 |
| `BASE_URL` | 否 | — | 对外访问地址，用于 Vinxi 允许的 Host |
| `SILICONCLOUD_API_KEY` | 三选一 | — | 硅基流动，默认模型 Qwen3.6-35B-A3B |
| `ALIBABA_BAILIAN_API_KEY` | 三选一 | — | 阿里云百炼，Qwen-VL-Max |
| `OPENAI_API_KEY` | 三选一 | — | OpenAI GPT-4o |
| `AI_DAILY_LIMIT_PER_USER` | 否 | `200` | 单账号每日 AI 调用上限（按中国时区零点重置） |
| `AI_MAX_OUTPUT_TOKENS` | 否 | `4096` | 单次 AI 调用最大输出 Token |
| `OSS_ACCESS_KEY_ID` | 上传必填 | — | 阿里云 OSS AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | 上传必填 | — | 阿里云 OSS AccessKey Secret |
| `OSS_ENDPOINT` | 上传必填 | — | 如 `oss-cn-hangzhou.aliyuncs.com` |
| `OSS_BUCKET` | 上传必填 | — | Bucket 名称 |
| `OSS_REGION` | 上传必填 | — | 如 `oss-cn-hangzhou` |
| `PDF_BROWSER_PATH` | 否 | 自动查找 | Edge/Chrome/Chromium 可执行文件路径 |
| `TRUST_PROXY` | 否 | `false` | 位于 Nginx 等反向代理后设为 `true`，才信任 `X-Forwarded-For` |
| `ALLOW_REGISTRATION` | 否 | `false` | `true` 时教师可免邀请码注册；否则使用数据库邀请码 |
| `TEST_DATABASE_URL` | 测试可选 | — | 集成测试数据库；未设置时由 `DATABASE_URL` 推导 `teachai_test` |

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器（`predev` 会自动清理 `app.config.timestamp_*`） |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint（`--max-warnings 0`） |
| `pnpm format` | Prettier 格式化 |
| `pnpm test` | 运行全部测试 |
| `pnpm test:unit` | 仅单元测试（无需数据库） |
| `pnpm test:integration` | 仅集成测试（需要测试数据库） |
| `pnpm test:watch` | 监听模式 |
| `pnpm db:generate` | `prisma migrate dev`，开发环境创建/应用迁移 |
| `pnpm db:migrate` | `prisma migrate deploy`，部署环境应用迁移 |
| `pnpm db:push` | `prisma db push`，原型阶段快速同步 Schema |
| `pnpm db:studio` | 打开 Prisma Studio |
| `pnpm seed` | 写入/重置演示数据 |
| `pnpm codes` | 教师注册邀请码管理 |

邀请码管理：

```bash
pnpm codes create --uses 5 --days 30 --note "某某学校"
pnpm codes create --count 10
pnpm codes list            # 仅显示可用
pnpm codes list --all      # 显示全部
pnpm codes revoke EDU-7KQ4-M9XC
```

## 测试

项目包含 **9 个单元测试文件 + 6 个集成测试文件**，覆盖：

- 认证与会话 Cookie、登出吊销、CSRF 请求头；
- 教师/家长角色隔离与跨班级越权；
- 登录/注册限流（手机号 + IP）；
- 批改队列的认领、失败重试与中断恢复；
- 家长绑定、家庭邀请与审批流程；
- 成绩归一化、掌握度更新、班级统计指标；
- AI 结构化输出解析、修复与用量额度。

集成测试使用独立数据库，并带有保护：数据库名必须以 `_test` 结尾。

```bash
# 1. 创建测试库（示例）
psql -U postgres -c "CREATE DATABASE teachai_test;"

# 2. 运行
pnpm test

# 或仅运行单元测试（不依赖数据库）
pnpm test:unit
```

测试环境使用假 AI/OSS 密钥，不会调用真实外部服务；每个集成测试文件运行前会清空业务表。

## 部署

### Docker 编排（开发/联调）

仓库提供 `docker/compose.yaml`，包含 PostgreSQL 16、Nginx、MinIO、Adminer 与应用容器。使用前请注意：

- 应用容器通过 `../.env` 注入环境变量；容器内的 `DATABASE_URL` 应指向 `postgres` 服务而非 `localhost`；
- 源码与 `node_modules` 通过卷挂载，需先在宿主机执行 `pnpm install`；
- `redis` 与 `minio` 为预留服务，当前业务代码的队列与限流均使用 PostgreSQL，文件存储使用阿里云 OSS。

```bash
bash scripts/docker-compose up -d --build
# Nginx 入口：http://localhost:8000
```

### 生产部署

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
NODE_ENV=production pnpm start
```

部署检查清单：

- [ ] `NODE_ENV=production`，`JWT_SECRET` 使用随机长字符串；
- [ ] 使用 HTTPS（生产环境 Cookie 带 `Secure`）；
- [ ] 反向代理后设置 `TRUST_PROXY=true`，保证限流能识别真实 IP；
- [ ] OSS Bucket 保持私有读，应用会通过签名 URL 展示图片；
- [ ] 容器内无浏览器时，配置 `PDF_BROWSER_PATH` 或禁用 PDF 导出功能；
- [ ] 上线前关闭演示登录入口（`loginDemo` / `loginDemoParent`）；
- [ ] 批改 Worker 随应用进程启动；如需水平扩容，建议将 Worker 拆分为独立服务。

## 项目进展

以下对照仓库中的 [`分析.md`](分析.md)（项目分析报告）逐项核对当前实现状态（截至 2026-10-19）：

### P0 —— 主流程与数据口径

| 报告中的问题 | 状态 | 当前实现 |
| --- | --- | --- |
| 教师端“上传 → AI 分析”闭环断裂 | ✅ 已修复 | 上传后自动入队；教师可批改本班学生、家长可批改自己孩子（`assertSubmissionAccess`） |
| 家长端 `/parent-dashboard` 路由缺失 | ✅ 已修复 | 家长端页面已上线，`RequireAuth role="parent"` 保护 |
| 成绩/评分体系混乱（`parseFloat("A")` → NaN） | ✅ 已修复 | 数据库统一存 0–100 `score`；`normalizeScore` 兼容字母/中文/比值/百分比；报告只使用 `score` |
| `proficiencyLevel` 枚举与数字混用 | ✅ 已修复 | `mastery Float`（0–1）+ `evidenceCount`；等级仅在展示层派生 |
| `app.config.timestamp_*` 文件爆炸 | ✅ 已处理 | `predev` 执行 `clean.js` 自动清理 |
| 注册开关与邀请码 | ✅ 已明确 | 数据库邀请码表 + `pnpm codes` CLI；`ALLOW_REGISTRATION` 控制教师开放注册 |

### P1 —— 安全与工程质量

| 报告中的问题 | 状态 | 当前实现 |
| --- | --- | --- |
| JWT 存 localStorage、Token 走请求参数 | ✅ 已修复 | httpOnly + SameSite=Lax + 生产 Secure Cookie；`tokenVersion` 支持登出即失效；自定义请求头防 CSRF |
| 单进程内存限流、缺少 IP 维度 | ✅ 已修复 | PostgreSQL 固定窗口计数，手机号 + IP 双维度，多实例共享 |
| 环境变量强制必填、文档矛盾 | ✅ 已修复 | AI/OSS 密钥改为可选并按需校验；至少配置一个 AI 密钥；自动识别占位符 |
| AI 解析脆弱、无校验/超时/重试/费用控制 | ✅ 已修复 | Zod 校验、超时、指数退避重试、JSON 修复重试、输出 Token 上限、每日额度与用量表 |
| 零测试 | ✅ 已补齐 | 9 个单元 + 6 个集成测试文件（见[测试](#测试)） |
| 巨型组件与 `as any` | ✅ 大部分完成 | `DashboardShell` 139 行、`DashboardModulePage` 124 行；业务代码已无 `as any`（生成文件除外） |
| PDF 依赖完整 Chromium | △ 已减轻 | 改用 `puppeteer-core` + 本机 Edge/Chrome，不再随应用打包 Chromium；仍需要浏览器环境 |

### P2 —— 教育专业性

| 方向 | 状态 | 说明 |
| --- | --- | --- |
| 知识图谱化（学科 → 学段 → 教材 → 章节 → 知识点） | ⏳ 未开始 | `KnowledgeArea` 仍为扁平 `name + description`，尚未建立课标级层级 |
| 掌握度模型升级（IRT / 贝叶斯知识追踪） | △ 部分完成 | 已从“错一次减 0.1”改为指数滑动平均，并记录证据次数；尚未引入 IRT/BKT |
| 复习调度（遗忘曲线/间隔重复） | △ 部分完成 | 已有 `ReviewSchedule` 组件，基于成绩与错题趋势给出复习建议；未接入间隔重复算法 |
| 学情指标口径统一 | ✅ 已完成 | `src/lib/classStats.ts` 统一定义平均分、优秀率、及格率、低分率与提交覆盖率 |
| 合规与审计（PIPL、未成年人保护） | ⏳ 未开始 | 尚无监护人授权、数据删除、操作审计日志、数据导出等能力 |

## 已知限制

1. **演示登录始终可用**：`loginDemo` / `loginDemoParent` 使用固定手机号直接签发会话，生产环境必须移除或加开关。
2. **Seed 图片为占位地址**：演示作业/试卷无法重新批改，只用于展示统计与页面效果。
3. **知识体系仍是扁平结构**：错题归因与针对性出题停留在知识点名称匹配层面，尚未接入课标知识图谱。
4. **PDF 导出依赖本机浏览器**：Docker 镜像未内置 Chrome/Edge，容器部署时需另行提供 `PDF_BROWSER_PATH`。
5. **Worker 与应用同进程**：队列本身持久化且可多实例认领，但没有独立的任务服务与监控告警。
6. **合规能力缺失**：尚不具备 K12 敏感个人信息所需的监护人授权、数据删除、审计与导出流程。
7. **Docker 编排中的 Redis / MinIO 尚未接入业务**：当前限流、队列使用 PostgreSQL，文件存储使用阿里云 OSS。

## 安全设计

- **会话**：JWT 仅存于 httpOnly Cookie，JavaScript 无法读取；`SameSite=Lax`，生产环境 `Secure`；登出时递增 `tokenVersion` 使全部旧 Token 失效。
- **CSRF**：所有 tRPC 请求必须携带 `x-edureview-client: 1` 自定义请求头；跨域请求无法在未获授权的情况下通过预检。
- **密码**：bcrypt 12 轮哈希；注册要求 8–72 位、包含大小写字母与数字，且不能包含姓名。
- **权限**：`teacherProcedure` / `parentProcedure` 区分角色；教师只能访问自己班级学生，家长只能访问已绑定孩子。
- **上传安全**：客户端只能提交自己上传目录下的 OSS 对象；服务端不请求任意外部 URL；私有桶通过签名 URL 读取。
- **限流**：登录、注册、绑定、家庭邀请等敏感过程按手机号与 IP 双维度限流。
- **输入校验**：所有 tRPC 输入使用 Zod；AI 输出同样经过 Schema 校验后才入库。
- **AI 成本**：按账号每日限额，记录 Token 用量；失败调用不计入额度。
- **密钥**：`.env.example` 只包含占位符；`.env` 含真实密钥，请勿提交到版本库，并定期轮换云服务 AccessKey。

## 相关文档

- [USER_MANUAL.md](USER_MANUAL.md)：面向教师/家长的功能使用手册（部分流程可能随版本演进调整）。
- [分析.md](分析.md)：项目架构、问题分析与 P0/P1/P2 演进路线（本文“项目进展”以此为基础核对）。

## 许可证

本项目为毕业设计 / 课程项目，暂未指定开源许可证。如需用于商业或教学场景，请先联系项目作者。
