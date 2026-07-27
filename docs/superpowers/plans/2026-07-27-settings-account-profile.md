# 设置与账号资料 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 简化顶部栏并新增可展开的设置面板，支持用户名、邮箱和密码管理，同时保留取消配对与退出账号功能。

**Architecture:** `AppShell` 只负责品牌、消息和设置入口；新的 `SettingsPanel` 负责折叠布局和操作弹窗；认证网关封装 Supabase Auth 与 profiles 更新，`SessionProvider` 提供当前用户资料和刷新能力。邮箱与密码使用 Supabase Auth，用户名使用 `profiles` 表和安全 RPC。

**Tech Stack:** React 19、TypeScript、Vite、Supabase Auth/Postgres、Vitest、Testing Library。

---

### Task 1: 扩展账户资料 API

**Files:**
- Modify: `src/auth/authGateway.ts`
- Modify: `src/auth/supabaseAuthGateway.ts`
- Modify: `src/app/SessionProvider.tsx`
- Modify: `src/test/fakeAuthGateway.ts`
- Modify: `src/lib/database.types.ts`
- Create: `supabase/migrations/202607270001_account_profile_settings.sql`
- Test: `src/auth/supabaseAuthGateway.test.ts`

- [ ] **Step 1: 为 AuthGateway 增加接口测试**

增加 `updateDisplayName(name)`, `updateEmail(email)`, `updatePassword(password)` 三个方法，并为网关测试准备成功和错误响应。

- [ ] **Step 2: 创建数据库迁移**

新增 `update_my_display_name(p_display_name text)` security-definer RPC：只更新 `profiles.id = auth.uid()`，复用现有 1–40 字符约束，完成后返回规范化用户名；撤销匿名执行权限，仅授权 authenticated。

- [ ] **Step 3: 实现 Supabase 网关**

用户名调用 RPC；邮箱调用 `client.auth.updateUser({ email })`；密码调用 `client.auth.updateUser({ password })`。所有错误继续经过 `stableError`，不把 Supabase 原始错误暴露给页面。

- [ ] **Step 4: 接入 SessionProvider 和 FakeAuthGateway**

在会话上下文暴露三个方法；成功修改用户名后强制 reload 账号上下文，邮箱和密码修改后显示成功状态但不伪造新的验证状态。

- [ ] **Step 5: 更新数据库类型并运行测试**

更新 `database.types.ts` 的 RPC 类型，运行 `npm test -- src/auth/supabaseAuthGateway.test.ts`，预期全部通过。

### Task 2: 重做顶部栏与设置面板布局

**Files:**
- Modify: `src/app/AppShell.tsx`
- Create: `src/features/settings/SettingsPanel.tsx`
- Modify: `src/app/BookingDataScreen.tsx`
- Modify: `src/app/CloudSetupScreen.tsx`
- Modify: `src/styles/components.css`
- Test: `src/app/AppShell.test.tsx`
- Create: `src/features/settings/SettingsPanel.test.tsx`

- [ ] **Step 1: 写设置面板行为测试**

验证默认只显示“账号资料”，点击后显示用户名、邮箱、修改密码；验证当前身份、取消配对、退出账号顺序；验证关闭设置后内容不可见。

- [ ] **Step 2: 创建 SettingsPanel**

实现右侧抽屉/移动端全宽面板，使用 `aria-expanded` 控制账号资料折叠。每个编辑项使用独立弹窗，包含输入、取消、保存、加载和错误状态。

- [ ] **Step 3: 修改 AppShell**

删除爱心图标、身份胶囊、退出账号和取消配对直出按钮；保留文字品牌名、消息按钮和带无障碍标签的设置按钮。设置面板接收当前身份、邮箱、用户名，以及三个账户更新回调和现有配对/退出回调。

- [ ] **Step 4: 从两个已配对状态接入设置**

让完整共享日历和等待配对页面都使用同一设置面板；取消配对仍使用现有确认文案和 `onLeaveCouple`，退出账号继续使用现有 `useSignOutAction`。

- [ ] **Step 5: 运行组件测试**

运行 `npm test -- src/app/AppShell.test.tsx src/features/settings/SettingsPanel.test.tsx`，预期全部通过。

### Task 3: 视觉与响应式验证

**Files:**
- Modify: `src/styles/components.css`
- Test: `src/features/settings/SettingsPanel.test.tsx`

- [ ] **Step 1: 完成桌面和手机样式**

桌面端设置面板从右侧滑入；手机端宽度接近 100%，按钮保持可点击尺寸，危险操作使用警示色。

- [ ] **Step 2: 运行完整验证**

运行 `npm test` 和 `npm run build`，预期测试全部通过且 Vite 构建退出码为 0。

- [ ] **Step 3: 运行本地 Supabase 验证**

执行 `npx supabase db reset` 和 `npx supabase test db`，确认账户资料 RPC 与既有配对/共享数据测试均通过。

- [ ] **Step 4: 浏览器验收**

验证流程：登录 -> 顶部只显示消息和设置 -> 打开设置 -> 展开账号资料 -> 修改用户名/邮箱/密码入口显示 -> 取消配对和退出账号仍可操作。检查桌面与手机宽度无溢出。

### Task 4: 提交与部署

**Files:**
- Commit all files from Tasks 1–3; do not add `.superpowers/`, `vite-*.log` or `.env*`.

- [ ] **Step 1: 查看差异并提交**

运行 `git diff --check`，确认无空白错误后提交：

```powershell
git add src supabase/migrations/202607270001_account_profile_settings.sql docs/superpowers/specs/2026-07-27-settings-account-profile-design.md docs/superpowers/plans/2026-07-27-settings-account-profile.md
git commit -m "feat: add account settings panel"
```

- [ ] **Step 2: 推送并创建 PR**

```powershell
git push -u origin codex/settings-profile
```

在 GitHub 创建到 `master` 的 PR，合并后等待 Vercel 状态为 `Ready`。

