# Cloudflare 私密相册部署版

本项目在现有动态相册外增加 **Cloudflare 服务端访问控制、GitHub 登录和管理员白名单**。原来的 `../动态相册.html` 继续作为离线源文件，构建时复制并加入登录状态、管理员入口与退出按钮。

初始所有者已经按当前连接的 GitHub 身份设置：

| 项目 | 值 |
| --- | --- |
| GitHub 用户名 | `Sg-427` |
| 不变的 GitHub 用户 ID | `205340307` |
| 管理页面显示名 | 水果榨汁 |

实际授权按 GitHub 返回的用户 ID 判断，账号改名后仍保留授权。以后管理员添加其他账号时，需要填写 GitHub 用户名。

## 已实现

- 未登录不能取得相册 HTML、内嵌照片或其他静态资源；`run_worker_first: true` 使每次资源请求都先经过 Worker 验证。
- GitHub OAuth 登录使用随机 `state`、浏览器绑定、PKCE 和一次性回调，仅读取公开账号身份，不请求仓库或邮箱权限。
- `/admin` 管理白名单：添加账号、撤销/恢复访问、设置/取消管理员、查看权限变更记录。
- 撤销账号后删除其现有登录会话；管理员降级会在后续请求中生效。
- 初始所有者由服务端配置固定，不能在管理页面中被删除或降级。只有所有者可以变更其他管理员。
- 登录 cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`；D1 只保存会话随机值的哈希，GitHub access token 不写入数据库。
- 管理操作同时验证同源 `Origin` 和 CSRF token；私密响应禁用浏览器/共享缓存。

## 第一次部署

保留整个 `moments-album` 目录结构：本目录的构建会读取上一层的 `动态相册.html`。

### 1. 安装依赖

在本目录运行：

```sh
npm ci
```

### 2. 登录 Cloudflare 并创建 D1 数据库

```sh
npx wrangler login
npx wrangler d1 create moments-access
```

把命令返回的 `database_id` 填入 `wrangler.jsonc`，替换全零占位值。保留绑定名 `DB`。

### 3. 确定唯一的网址

把 `wrangler.jsonc` 中的 `SITE_URL` 改为最终网址，例如：

```json
"SITE_URL": "https://moments-private-album.你的子域.workers.dev"
```

也可以使用自定义域名。网址只填来源地址，不带子路径；代码会拒绝其他来源地址，防止出现未经配置的入口。

如果后来更换域名，需要同时更新 `SITE_URL` 和 GitHub OAuth 回调地址，再部署。

### 4. 创建 GitHub OAuth App

打开 [GitHub Developer settings](https://github.com/settings/developers)，进入 **OAuth Apps → New OAuth App**：

- Application name：例如「瞬间 · 私密相册」。
- Homepage URL：填写上述 `SITE_URL`。
- Authorization callback URL：填写 `SITE_URL/auth/callback`，例如 `https://你的网址/auth/callback`。

记录 Client ID，并生成 Client Secret。Client Secret 只放在 Cloudflare 的秘密变量中，不要提交到仓库或写进 HTML。

### 5. 初始化数据库并第一次上传

```sh
npm run db:remote
npm run deploy
```

这一步上传 Worker 和 `dist/` 中的相册。GitHub 密钥还未配置时，只会显示尚未完成配置的登录页，相册内容仍受保护。

### 6. 设置 GitHub 密钥

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

按命令提示分别输入两个值。保存秘密变量后，用最终网址打开并选择 GitHub 登录。`Sg-427` 登录后可进入 `/admin`，也可点击相册操作栏中的「管理员」。

之后管理员只需在网页里输入 GitHub 用户名，即可授权其他人访问，无需再次改代码。第一次登录所用 GitHub 账号应确实是 `Sg-427`；GitHub 的个人显示名可以不同。

## 后续更新

修改上一层的 `动态相册.html` 后，在本目录重新运行：

```sh
npm run deploy
```

如果使用 GitHub 仓库接入 Cloudflare Workers Builds，请把整个 `moments-album` 放入仓库，根目录选择 `cloudflare`；构建命令为 `npm ci && npm run build`，部署命令为 `npx wrangler deploy`。D1 迁移和 GitHub 秘密变量仍须事先配置。请使用 Workers 项目，避免把 `dist/` 另行发布为公开 Pages 静态站点。

## 本地开发与校验

```sh
npm run check
npm run db:local
```

把 `.dev.vars.example` 复制成 `.dev.vars`，填入用于本地开发的 GitHub OAuth App 信息；本地回调地址是 `http://localhost:8787/auth/callback`。

```sh
npm run dev
```

生产网址与本地网址建议分别使用不同 OAuth App。`.dev.vars` 已被 Git 忽略。

`npm test` 使用真实 SQLite 执行迁移和查询，模拟 GitHub 网络响应，检查未授权资源访问、OAuth 状态及 PKCE、权限升级、CSRF、会话撤销和所有者保护。它不会代替最终使用真实 GitHub OAuth App 的上线登录验证。

## 数据与导出

这一版新增的是访问权限管理。相册照片、聊天截图、便利贴、条约和愿望仍沿用原来的浏览器本地保存与 HTML 导出方式；D1 保存的是访问名单、登录会话和权限记录。获准的不同设备之间目前通过导出/重新打开相册传递内容，不会自动同步照片和文字。

网站权限保护部署的网址。已经获准并下载的离线 HTML 可以在本地打开，不受这个网址的登录限制；不要把私密导出文件发布到公开仓库或其他公开静态地址。

## 实现参考

- [GitHub OAuth web application flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub 用户 ID 与账号身份](https://docs.github.com/en/rest/users/users#get-a-user-using-their-id)
- [Cloudflare Worker 先行处理静态资源](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Cloudflare D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)
