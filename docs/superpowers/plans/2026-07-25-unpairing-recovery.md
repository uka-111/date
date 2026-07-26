# 取消配对与旧内容恢复实现计划

> 执行方式：在 `date-booking-app` 工作树中按步骤实施，每一步完成后运行对应测试。

## 1. 数据库迁移与安全规则

文件：`supabase/migrations/202607250001_unpairing_recovery.sql`

- 为 `public.couple_members` 增加 `left_at timestamptz`，默认 `NULL`。
- 删除“用户 ID 全局唯一”的旧约束，增加只针对 `left_at IS NULL` 的唯一索引。
- 更新 `current_couple_id()` 及相关 RLS 判断，只把 `left_at IS NULL` 的成员视为有效成员。
- 调整空配对清理逻辑：取消配对不删除 `couples`，避免共享数据级联删除。
- 新增 `leave_current_couple()` RPC，仅把当前用户的有效成员记录设置为 `left_at = now()`。
- 修改 `redeem_couple_invite()`：
  - 当前用户与邀请创建者曾经属于同一个已结束 couple 时，恢复该 couple 的双方成员记录；
  - 否则创建新的 couple；
  - 继续阻止已有有效配对的用户加入其他空间。
- 为新 RPC 和恢复路径补充权限、重复调用和非法状态测试。

## 2. 类型与认证网关

文件：

- `src/lib/database.types.ts`
- `src/auth/authGateway.ts`
- `src/auth/supabaseAuthGateway.ts`

- 根据迁移结果更新 Supabase 类型。
- 在 `AuthGateway` 增加 `leaveCurrentCouple(): Promise<void>`。
- Supabase 网关调用 `leave_current_couple`，统一转换数据库错误为页面可读错误。
- 为网关增加成功、RPC 错误和重复调用测试。

## 3. 会话状态与页面入口

文件：

- `src/app/SessionProvider.tsx`
- `src/app/App.tsx`
- `src/features/session/PairingScreen.tsx`

- 在会话上下文暴露 `leaveCurrentCouple`。
- 操作成功后强制重新加载账号上下文，使页面立即回到配对入口。
- 在已配对页面的配对管理区域加入危险操作按钮。
- 增加二次确认弹窗、提交中状态、失败提示和键盘/移动端可操作性。
- 重新配对成功后继续沿用现有会话恢复流程，自动加载旧 couple 的内容。
- 更新前端单元测试，覆盖确认取消、成功退出、失败重试和恢复旧关系提示。

## 4. 共享数据访问验证

文件：

- `supabase/tests/shared_booking_data.test.sql`
- 相关预约、照片和日记 repository 测试

- 验证退出后旧 couple 数据仍在数据库中。
- 验证退出后旧 couple 数据对双方不可读。
- 验证原来的两个人重新配对后恢复读取权限。
- 验证与新对象配对时不能读取旧 couple 数据。

## 5. 本地与部署验证

- 运行数据库测试和前端测试。
- 运行普通 Vercel 构建及 GitHub Pages 构建。
- 本地执行迁移并手动完成：配对 -> 创建内容 -> 取消配对 -> 重新配对 -> 查看旧内容。
- 迁移通过后推送 Supabase 远程数据库。
- 提交分支并创建 PR，合并后重新部署 Vercel。
- 在电脑和手机 VPN 环境分别验证登录、取消配对、重新配对和旧内容恢复。

## 风险控制

- 迁移前不删除任何历史表或照片对象。
- 先在本地数据库跑完整测试，再推送远程迁移。
- 不把 Supabase service-role key、数据库密码或访问令牌写入代码和提交。
