# sgzz

zz与sg的私密动态相册，以及可部署到 Cloudflare Workers 的 GitHub 白名单访问版。

## 功能

- 动态照片导入、悬停播放、双击放大播放与拖动换位。
- 圆环、爱心、螺旋、波浪、∞ 等排列，以及自定义布局。
- 独立调节照片大小和图形大小，日间与夜间模式。
- 农历生日倒计时、在一起天数、聊天名场面截图。
- 情话便利贴、恋爱条约、愿望清单与待扩展的小游戏模块。
- 随时间变化的问候与随机爱情诗词。
- Cloudflare 服务端 GitHub 登录、账号白名单和管理员后台。

## 文件结构

```text
动态相册.html                 离线源文件，可直接在浏览器打开
cloudflare/
  src/                       GitHub 登录、访问控制和管理员页面
  migrations/                D1 数据库迁移
  scripts/build.mjs          将离线相册构建为受保护的部署版本
  tests/                     权限与浏览器回归测试源码
  wrangler.jsonc             Cloudflare 部署配置
  README.md                  详细部署步骤
```

## 部署到 Cloudflare

请按 [Cloudflare 部署说明](cloudflare/README.md) 配置网址、D1 和 GitHub OAuth App。

如果在 Cloudflare Workers Builds 中连接此仓库，根目录选择 `cloudflare`。构建命令为 `npm ci && npm run build`，部署命令为 `npx wrangler deploy`。数据库迁移和 GitHub 密钥须按部署说明事先配置。

初始管理员是 GitHub 账号 **Sg-427**，管理页面显示名为 **水果榨汁**。上线后可在 `/admin` 管理其他账号的访问权限。

照片、截图、贴纸等内容目前保存在浏览器本地，可随 HTML 导出；跨设备自动同步尚未加入。GitHub 白名单保护的是 Cloudflare 部署网址。

## 本地检查

需要 Node.js 22.13 或更高版本：

```sh
cd cloudflare
npm ci
npm run check
```

仓库不包含真实 OAuth 密钥、本地会话数据库、依赖目录或构建产物。可参考 `.dev.vars.example` 在本地创建自己的 `.dev.vars`。
