# 个人中心功能设置说明

## 已完成的功能

✅ 已创建个人中心页面（/profile）
✅ 已创建查询订单的API路由
✅ 已创建查询转换记录的API路由
✅ 已创建查询积分的API路由
✅ 已更新AuthButton组件添加个人中心链接
✅ 已添加中英文翻译

## 功能说明

### 个人中心页面包含三个标签页：

1. **我的积分**
   - 显示当前积分余额
   - 显示免费试用状态

2. **我的订单**
   - 显示所有订阅订单记录
   - 显示交易ID、产品ID、积分数量、日期和状态

3. **我的转换记录**
   - 显示所有视频转换记录
   - 显示转换类型、文件名、状态和日期

## 需要手动完成的步骤

### 1. 在 Supabase 中创建 conversion_records 表

需要在 Supabase 数据库中创建转换记录表：

```sql
CREATE TABLE conversion_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'video_to_subtitle', 'subtitle_to_file', 'file_to_subtitle'
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  original_file_url TEXT,
  result_file_url TEXT,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversion_records_user_id ON conversion_records(user_id);
CREATE INDEX idx_conversion_records_status ON conversion_records(status);
CREATE INDEX idx_conversion_records_created_at ON conversion_records(created_at DESC);
```

### 2. 确保已有以下表

#### subscription_orders 表（订阅订单）
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

#### user_credits 表（用户积分）
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

## API 路由

### GET /api/profile/orders
获取当前用户的所有订单记录

**认证要求**：需要登录

**响应**：
```json
{
  "orders": [
    {
      "id": "uuid",
      "transaction_id": "tran_xxx",
      "product_id": "prod_xxx",
      "credits": 30,
      "created_at": "2024-01-01T00:00:00Z",
      "event_type": "subscription.paid"
    }
  ]
}
```

### GET /api/profile/conversions
获取当前用户的所有转换记录

**认证要求**：需要登录

**响应**：
```json
{
  "conversions": [
    {
      "id": "uuid",
      "type": "video_to_subtitle",
      "file_name": "video.mp4",
      "status": "completed",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/profile/credits
获取当前用户的积分信息

**认证要求**：需要登录

**响应**：
```json
{
  "credits": 100,
  "has_used_free_trial": false
}
```

## 文件结构

```
app/
  ├── [locale]/
  │   └── profile/
  │       └── page.tsx          # 个人中心页面
  └── api/
      └── profile/
          ├── orders/
          │   └── route.ts       # 查询订单API
          ├── conversions/
          │   └── route.ts       # 查询转换记录API
          └── credits/
              └── route.ts       # 查询积分API

components/
  └── AuthButton.tsx             # 已更新，添加个人中心链接
```

## 使用说明

1. 用户登录后，点击导航栏右侧的用户头像或邮箱，即可进入个人中心
2. 在个人中心可以查看：
   - 当前积分余额和免费试用状态
   - 所有订阅订单记录
   - 所有视频转换记录

## 注意事项

- 所有API路由都需要用户登录才能访问
- 如果 `conversion_records` 表不存在，转换记录API会返回空数组
- 确保 Supabase 数据库表已正确创建
- 个人中心链接已集成到 AuthButton 组件中

