# Supabase 配置说明

本项目使用 Supabase 管理邮箱账号和双人配对。浏览器只需要两个公开变量：项目 URL 和 publishable key。

## 本地环境变量

在项目根目录创建 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`.env.local` 已被 Git 忽略。不要把数据库密码、Supabase access token、secret key 或 service role key 写入这个文件、前端代码或 Git。

## 当前项目

- Project ref: `agakrexkrsqjxqsotzxd`
- 本地 Site URL: `http://127.0.0.1:5173`
- Redirect URLs:
  - `http://127.0.0.1:5173/**`
  - `http://localhost:5173/**`

邮件验证应保持开启。两位用户各自验证邮箱后，第一人创建空间，第二人使用一次性邀请码加入。

## Vercel 部署

部署后，Vercel 环境变量只允许使用以下两个浏览器公开变量：

```dotenv
VITE_SUPABASE_URL=https://agakrexkrsqjxqsotzxd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的 publishable key
```

不要在 Vercel、Git 或浏览器中添加 Supabase access token、数据库密码、secret key 或 service role key。

拿到最终 Vercel HTTPS 网址后，在 Supabase Dashboard 的 Authentication -> URL Configuration 中，把 Site URL 更新为该网址，并将 `<最终网址>/**` 加入 Redirect URLs，同时保留上面的本地地址。

## 数据库迁移

账号与配对结构在 `supabase/migrations/202607210001_auth_pairing.sql` 中，共享日历结构在 `supabase/migrations/202607210002_shared_booking_data.sql` 中。部署前先运行：

```powershell
npx supabase db push --dry-run
```

确认仅列出预期迁移后，再运行：

```powershell
npx supabase db push
```

本地连接缓存位于 `supabase/.temp/`，该目录已被 Git 忽略。
