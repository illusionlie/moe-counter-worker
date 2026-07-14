# moe-counter

基于 [Cloudflare Workers](https://workers.cloudflare.com/) 的 [Moe-Counter](https://github.com/journey-ad/Moe-Counter) 萌萌计数器的 [分叉](https://github.com/lxchapu/moe-counter) 的分叉。

![Moe Counter](https://count.illusionlie.com/@github@moe-counter)

<details>
<summary>More theme</summary>

**asoul**

![asoul](https://count.illusionlie.com/@demo?theme=asoul)

**moebooru**

![moebooru](https://count.illusionlie.com/@demo?theme=moebooru)

**rule34**

![rule34](https://count.illusionlie.com/@demo?theme=rule34)

**gelbooru**

![gelbooru](https://count.illusionlie.com/@demo?theme=gelbooru)

</details>

## Demo

<https://count.illusionlie.com>

## Usage

**自己部署**

本项目通过 GitHub Actions 部署到 Cloudflare Workers。所有敏感配置（API Token、D1 Database ID、Worker 名称等）都通过 GitHub 仓库机密注入，`wrangler.toml` 已从仓库中移除并加入 `.gitignore`，部署时由 `wrangler.toml.example` 模板渲染生成。

### 1. Fork 仓库

Fork 本仓库到你自己的 GitHub 账号。

### 2. 在 Cloudflare 准备资源

- 在 [Cloudflare D1](https://developers.cloudflare.com/d1/) 创建一个数据库，记下 **Database ID**。
- 在 Cloudflare 控制台 [创建 API Token](https://dash.cloudflare.com/profile/api-tokens)，推荐直接使用 **「Edit Cloudflare Workers」** 模板（已包含 Workers Scripts:Edit、D1:Edit 等权限）。若自动获取 Account ID 失败，可在该 Token 上额外加 **Account Settings:Read** 权限，或在下一步直接配置 `CF_ACCOUNT_ID`。

### 3. 配置 GitHub 仓库机密

进入你 Fork 后的仓库 → **Settings → Secrets and variables → Actions → New repository secret**，按下表添加：

| Secret 名 | 必填 | 说明 |
|---|:---:|---|
| `CF_API_TOKEN` | ✅ | 上一步创建的 Cloudflare API Token，用于部署 Worker 和自动获取 Account ID |
| `WORKER_NAME` | ✅ | Worker 名称，例如 `moe-counter` |
| `CF_D1_DATABASE_ID` | ✅ | Cloudflare D1 数据库 ID |
| `CF_ACCOUNT_ID` | ⬜ | 你的 Cloudflare Account ID。留空则由 Action 通过 API Token 自动获取 |
| `CUSTOM_DOMAIN` | ⬜ | 自定义域名，例如 `counter.example.com` |

### 4. 触发部署

仓库 **Actions** 标签页 → 左侧选择 **「Deploy Worker」** 工作流 → 右上角 **Run workflow** → 选择要部署的分支 → 点击 **Run workflow**。

部署 Action 在发布 Worker 前会自动执行 `schema.sql`（`CREATE TABLE IF NOT EXISTS`，幂等安全），因此**无需手动初始化远程 D1 数据库**。若想提前或单独建表，可用本地 wrangler CLI：

```sh
npx wrangler d1 execute DB --remote --file=./schema.sql
```

> `DB` 是 `wrangler.toml` 里的 D1 binding 名，不是数据库名。

部署完成后 Worker 即上线。若配置了 `CUSTOM_DOMAIN`，该域名需托管在同一 Cloudflare 账号下，部署会自动创建自定义域名路由。

---

**本地运行**

如果想在本地跑起来：先复制 `wrangler.toml.example` 为 `wrangler.toml` 并填入真实值，然后：

```sh
npm install
npm run initdb   # 初始化本地 D1 数据库
npm run dev      # wrangler dev 本地起服务
npm run test     # 运行测试（node --test，零额外依赖）
```

## Configuration

`config.yml`

```yml
length: 7

theme: 'moebooru'
```

## Credits

- [A-SOUL](https://space.bilibili.com/703007996)
- [Moebooru](https://github.com/moebooru/moebooru)
- [Rule 34](https://rule34.xxx/) **❗NSFW❗**
- [Gelbooru](https://gelbooru.com/) **❗NSFW❗**

## License

[MIT License](./LICENSE)
