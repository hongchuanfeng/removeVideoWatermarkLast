# 订阅套餐功能设置说明

## 已完成的功能

✅ 已创建订阅页面（三个套餐）
✅ 已更新导航栏（移除关于我们和联系我们，添加订阅链接）
✅ 已创建 Creem checkout API 路由
✅ 已创建 Creem webhook 回调处理
✅ 已创建用户积分管理功能
✅ 已更新首页添加订阅按钮
✅ 已添加中英文翻译

## 需要手动完成的步骤

### 1. 更新 .env.local 文件

在项目根目录下的 `.env.local` 文件中添加以下 Creem 配置：

```env
# Supabase配置（如果还没有）
NEXT_PUBLIC_SUPABASE_URL=https://qtgvnucqvwdwgbuqssqx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z3ZudWNxdndkd2didXFzc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjc2NTEsImV4cCI6MjA3OTc0MzY1MX0.OAbdpejgwv92ZrAX_jsZpJlaMWniRsX2iM3uToaaSk8

# Creem配置
CREEM_API_KEY=creem_4QGhR5aZTjFxJELOoLmQa6
CREEM_WEBHOOK_SECRET=whsec_tsf4I58EXUxebny8SvoBv
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

生产环境请更新：
```env
APP_BASE_URL=https://www.removewatermarker.com
NEXT_PUBLIC_APP_BASE_URL=https://www.removewatermarker.com
```

### 2. 在 Supabase 中创建数据库表

需要在 Supabase 数据库中创建以下表：

#### subscription_orders 表

```sql
CREATE TABLE subscription_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT,
  credits INTEGER NOT NULL,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_orders_user_id ON subscription_orders(user_id);
CREATE INDEX idx_subscription_orders_transaction_id ON subscription_orders(transaction_id);
```

#### user_credits 表

```sql
CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER DEFAULT 0,
  has_used_free_trial BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
```

### 3. 配置 Creem Webhook

1. 登录 Creem 控制台
2. 进入 Webhooks 设置
3. 添加 Webhook URL：
   - 开发环境：`http://localhost:3000/api/creem/webhook`
   - 生产环境：`https://www.removewatermarker.com/api/creem/webhook`
4. 设置 Webhook Secret：`whsec_tsf4I58EXUxebny8SvoBv`
5. 选择事件类型：
   - `subscription.paid`
   - `checkout.completed`

## 订阅套餐详情

### Basic 版本
- 价格：$39.9/月
- 积分：30个
- Product ID: `prod_N6rm4KG1ZeGvfnNOIzkjt`

### Standard 版本（最受欢迎）
- 价格：$119.9/月
- 积分：100个
- Product ID: `prod_3CQsZ5gNb1Nhkl9a3Yxhs2`

### Premium 版本
- 价格：$239.9/月
- 积分：210个
- Product ID: `prod_5h3JThYd4iw4SIDm6L5sCO`

### 测试产品
- Product ID: `prod_1l9cjsowPhSJlsfrTTXlKb`

## 功能说明

### 免费试用
- 新用户登录后可免费转换1次视频（最长1分钟）
- 超过1分钟需要付费订阅

### 积分系统
- 1美元 = 3个积分
- 1分钟视频 = 1个积分
- 积分按月自动续费

### 功能限制
- **视频转字幕**：需要登录，需要积分（新用户有1次免费机会）
- **字幕转文件**：免费，无需登录
- **文件转字幕**：免费，无需登录

## API 路由

### POST /api/creem/checkout
创建支付链接

请求体：
```json
{
  "product_id": "prod_N6rm4KG1ZeGvfnNOIzkjt",
  "user_id": "user_id",
  "email": "user@example.com"
}
```

### POST /api/creem/webhook
Creem 支付回调处理

## 文件结构

```
app/
  ├── [locale]/
  │   ├── subscription/
  │   │   └── page.tsx          # 订阅页面
  │   └── page.tsx              # 首页（已更新）
  └── api/
      └── creem/
          ├── checkout/
          │   └── route.ts      # 创建支付链接
          └── webhook/
              └── route.ts      # 支付回调处理

lib/
  ├── user-credits.ts           # 服务端积分管理
  └── user-credits-client.ts    # 客户端积分管理

components/
  └── Header.tsx                # 导航栏（已更新）
```

## 测试步骤

1. 确保 `.env.local` 文件已创建并配置正确
2. 确保 Supabase 数据库表已创建
3. 确保 Creem Webhook 已配置
4. 重启开发服务器：`npm run dev`
5. 访问订阅页面：`http://localhost:3000/en/subscription`
6. 测试订阅流程

## 注意事项

- 确保 Creem API Key 和 Webhook Secret 配置正确
- 确保 Supabase 数据库表结构正确
- 确保 Webhook URL 可以从外网访问（生产环境）
- 测试产品 ID 仅用于测试环境

