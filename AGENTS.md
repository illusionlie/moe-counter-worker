# AGENTS.md

> 面向 AI 助手的项目导航文档。读这一份，就能知道这个仓库在做什么、怎么跑、代码长什么样、改哪里。

## 项目简介

**moe-counter-worker** 是 [Moe-Counter](https://github.com/journey-ad/Moe-Counter) 的 [Cloudflare Workers](https://workers.cloudflare.com/) 分叉，对外提供一张可嵌入到 README / 个人主页的 SVG 计数器图片。

核心行为：每次有人访问 `/@:id`（或别名 `/get/@:id`），后端在 D1 里把该计数器 `+1`，然后用请求里指定的主题把数字拼成一张 SVG 返回。`/record/@:id` 只读不增计数，返回 JSON。`/@demo` 是主题预览，直接渲染 `0123456789` 且不写库。

## 技术栈

| 维度 | 选型 | 备注 |
|---|---|---|
| 运行时 | Cloudflare Workers（Service Worker 全局） | `compatibility_date = "2026-05-14"` |
| 数据库 | Cloudflare D1（SQLite over HTTP） | binding 名 `DB`，单表 `view (id TEXT PK, num INTEGER)` |
| 路由 | [itty-router](https://github.com/kwhitley/itty-router) v5 | 用 `before` / `finally` 钩子挂中间件 |
| 构建 | webpack 5（ESM output） | 入口 `src/main.js` → `dist/worker.js`；`wrangler.toml` 的 `[build]` 指向 `npm run build` |
| 静态资源 | `./public` 目录（`[assets]`） | 仅 `index.html` + `robots.txt` |
| 配置 | `config.yml`（YAML） | webpack 用 `yamljs` 把 `.yml` 当 JSON 模块加载 |
| Lint / Format | ESLint 9 + Prettier 3 | `eslint.config.mjs` 里 service-worker globals + `no-console` warn，`src/logger.js` 豁免 console |

无 TypeScript，无测试框架。代码风格是 ESM + JSDoc 注释。

## 目录结构

```
moe-counter-worker/
├── src/                  # Worker 源码（webpack 入口）
│   ├── main.js           # 路由表 + fetch handler，应用唯一入口
│   ├── middlewares.js    # 请求追踪 / 响应日志 / id 校验（itty before/finally）
│   ├── db.js             # D1 读写：getNum / setNum（upsert）
│   ├── utils.js          # SVG 拼装：getCountImage（核心渲染）
│   ├── errors.js         # AppError 体系 + 全局 handleError
│   └── logger.js         # 零依赖结构化 JSON logger（唯一 console 出口）
├── themes/               # 数字主题资源 + 注册表
│   ├── index.js          # 对外 barrel，re-export registry
│   ├── registry.js       # 校验、resolve、getTheme、random 主题
│   ├── data.js           # 聚合所有主题 import（构建时静态分析）
│   └── <theme>/          # 每个主题一个目录：0~9.{gif|png} + index.js
├── public/               # 静态站点（index.html / robots.txt）
├── migrations/           # （预留，当前为空）
├── schema.sql            # D1 建表语句（view 表）
├── config.yml            # 运行期配置：length / theme
├── wrangler.toml         # CF Workers 部署配置（D1 binding、路由、构建）
├── webpack.config.js     # 构建配置（assets inline、yml→json、html/txt as source）
├── eslint.config.mjs     # Lint 规则
└── .prettierrc           # 格式化
```

## 架构总览

请求生命周期（`/@:id` 为例）：

```
fetch(req, env)
  └─ router.fetch(req, env)
       │
       ├─ [before]  withRequestTracing     ← 生成 requestId、挂 req.logger、记入口日志
       │
       ├─ [route]   GET /@:id  validateId → counterHandler
       │               │
       │               ├─ resolveThemeId(theme, config.theme)   ← registry 校验/兜底
       │               ├─ getNum(DB, id)  → +1  → setNum(DB, id, n)   ← D1 upsert
       │               └─ getCountImage({ count, theme, padding, ... })  ← 拼 SVG
       │
       └─ [finally] withResponseLogging    ← 记状态码 + 耗时
  │
  └─ .catch(handleError)   ← 任何抛错都走统一错误处理器
```

设计要点：

- **分层**：`main`（路由编排）→ `middlewares`（横切）→ `db` / `utils` / `themes`（领域）→ `errors` / `logger`（基础设施）。每层单向依赖，没有反向引用。
- **零外部运行期依赖**：除 `itty-router` 外全部自研。logger、errors、SVG 拼装都不引第三方包，适配 Workers 冷启动与体积约束。
- **构建期 vs 运行期分离**：主题图片在构建期被 webpack `inline` 进 bundle（`asset/inline`），运行期 `getTheme()` 只是查表；`config.yml` 同理在构建期解析成 JSON。所以改 `config.yml` 或 `themes/` 内容需要重新 `npm run build` / `npm run deploy`。
- **错误兜底**：`AppError` 体系区分业务错误（4xx，`warn`）与系统错误（5xx，`error` 带堆栈），统一由 `handleError` 序列化成 `{ error: { code, message } }` JSON 响应；`src/main.js` 的 `fetch` 顶层包了 `.catch` 兜路由外的 logger 缺失。

## 构建与部署

```bash
npm run build     # webpack 打包到 dist/worker.js
npm run dev       # wrangler dev 本地起
npm run deploy    # wrangler deploy 上线
npm run initdb    # wrangler d1 execute count --local --file=./schema.sql （本地建表）
npm run lint      # eslint src/
npm run lint:fix
npm run prettier  # 格式化全仓
```

部署前必做的事：

1. 在 Cloudflare D1 创建数据库，把 `wrangler.toml` 里的 `database_id` 换成自己的。
2. 远端数据库首次部署需手动执行 `schema.sql`：`wrangler d1 execute <db-name> --remote --file=./schema.sql`（`npm run initdb` 只建本地库）。

## 常见改动地图

| 想改什么 | 改哪里 | 需要注意 |
|---|---|---|
| 新增一条路由 | `src/main.js` 的 `router` | handler 签名是 `(req, env, ctx)`；要日志就用 `req.logger` |
| 换默认主题 / 默认长度 | `config.yml` | 改完要重新 build，YAML 在构建期被 inline |
| 新增主题 | `themes/<新主题>/` + 在 `themes/data.js` 加 import | 目录必须含 `0..9` 图片 + `index.js`，`registry.js` 会校验 |
| 改 SVG 渲染逻辑 | `src/utils.js` 的 `getCountImage` | 注意 `align` 的 center/bottom 目前未生效 |
| 改 ID 合法字符 / 长度 | `src/middlewares.js` 的 `validateId` 正则 | 别忘了 `@` 是命名约定的一部分 |
| 改数据库表结构 | `schema.sql` + `src/db.js` | D1 是 SQLite 子集，没有触发器/存储过程；改完要写迁移（`migrations/` 留着就是给这个用的） |
| 调日志级别 | `src/logger.js` 的 `setLogLevel`，或在入口调用 | 生产默认 `info` |
| 加新错误类型 | `src/errors.js` 继承 `AppError` | 别忘了在 `handleError` 里被覆盖到（基类 instanceof 已够用） |

## 约定与坑

- **改 `config.yml` / `themes/` 内容后必须重新 build**：两者都在构建期被 webpack inline，运行期只是查表，热改文件不生效。
- **`npm run initdb` 只建本地库**：远端要单独 `wrangler d1 execute ... --remote --file=./schema.sql`。
- **`getNum`+`setNum` 非原子**：高并发计数会丢更新，强一致场景需要改 SQL（见 `db.js` 注释）。
- **`getCountImage` 的 `align` center/bottom 是空操作**：`yOffset` 算出来恒为 0，修渲染时别被它误导。
- **`no-console` 默认 warn**：只有 `src/logger.js` 豁免；其他地方要打日志一律走 `req.logger`。
- **ID 最多 32 字符**：`validateId` 的 `{1,32}` 量词，超长直接 400。
- **`/@demo` 永久缓存**：被 `Cache-Control: public, max-age=31536000` 钉死，改了 demo 行为要记得刷 CDN。

---

<!-- TRELLIS:START -->

# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:

- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
