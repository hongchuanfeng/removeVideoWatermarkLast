# Google 登录设置说明

## 已完成的功能

✅ 已安装 Supabase 客户端库
✅ 已创建 Supabase 客户端配置
✅ 已在导航栏添加 Google 登录按钮
✅ 已添加认证回调路由
✅ 已添加中英文翻译

## 需要手动完成的步骤

### 1. 创建 .env.local 文件

在项目根目录下创建 `.env.local` 文件，并添加以下内容：

```env
NEXT_PUBLIC_SUPABASE_URL=https://qtgvnucqvwdwgbuqssqx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z3ZudWNxdndkd2didXFzc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjc2NTEsImV4cCI6MjA3OTc0MzY1MX0.OAbdpejgwv92ZrAX_jsZpJlaMWniRsX2iM3uToaaSk8
```

### 2. 在 Supabase 控制台配置 Google OAuth

1. 登录 Supabase 控制台：https://supabase.com/dashboard
2. 选择你的项目
3. 进入 Authentication > Providers
4. 启用 Google 提供商
5. 配置 Google OAuth 凭据：
   - Client ID（从 Google Cloud Console 获取）
   - Client Secret（从 Google Cloud Console 获取）
6. 添加重定向 URL：`http://localhost:3000/auth/callback`（开发环境）
7. 添加重定向 URL：`https://www.removewatermarker.com/auth/callback`（生产环境）

### 3. 在 Google Cloud Console 配置

1. 访问 Google Cloud Console：https://console.cloud.google.com
2. 创建或选择项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID
5. 添加授权的重定向 URI：
   - `https://qtgvnucqvwdwgbuqssqx.supabase.co/auth/v1/callback`

## 功能说明

- **登录按钮位置**：导航栏右侧，语言选择器旁边
- **登录状态显示**：登录后显示用户邮箱和退出按钮
- **响应式设计**：移动端和桌面端都支持
- **多语言支持**：支持英文和中文

## 文件结构

```
lib/supabase/
  ├── client.ts          # 客户端 Supabase 实例
  ├── server.ts          # 服务端 Supabase 实例
  └── middleware.ts      # 中间件认证处理

app/auth/callback/
  └── route.ts           # OAuth 回调处理

components/
  └── AuthButton.tsx     # Google 登录按钮组件
```

## 测试步骤

1. 确保 `.env.local` 文件已创建并配置正确
2. 重启开发服务器：`npm run dev`
3. 点击导航栏右侧的 "Sign in with Google" 按钮
4. 完成 Google 登录流程
5. 验证登录后显示用户信息和退出按钮

## 注意事项

- 确保 Supabase 项目已启用 Google 提供商
- 确保 Google Cloud Console 中的重定向 URI 配置正确
- 生产环境需要更新重定向 URL
- `.env.local` 文件不应提交到 Git（已在 .gitignore 中）

