# 保活功能设置说明

## 已完成的功能

✅ 已创建 system_logs 日志记录表
✅ 已创建定时任务 API 路由

## 数据库表结构

### system_logs 表

```sql
CREATE TABLE system_logs (
  id BIGSERIAL PRIMARY KEY,                    -- 自增主键
  log_time TIMESTAMP WITH TIME ZONE NOT NULL,  -- 时间戳
  log_data TEXT NOT NULL,                      -- 日志内容
  created_at TIMESTAMP WITH TIME ZONE NOT NULL -- 创建时间
);
```

**字段说明：**
- `id`: BIGSERIAL 自增主键
- `log_time`: 日志时间戳（操作数据时间节点）
- `log_data`: 日志内容（操作数据时间节点添加了log数据）
- `created_at`: 记录创建时间

## 定时任务配置

### 使用外部 Cron 服务

推荐使用以下服务定期调用 API：

#### 1. 使用外部 Cron 服务

推荐使用以下服务定期调用 API：
- **cron-job.org**: https://cron-job.org/
- **EasyCron**: https://www.easycron.com/
- **Uptime Robot**: https://uptimerobot.com/

配置示例：
- **URL**: `https://www.removewatermarker.com/api/cron/keepalive`
- **频率**: 每5分钟
- **方法**: GET 或 POST
- **Headers** (可选): `Authorization: Bearer YOUR_CRON_SECRET`

#### 2. 使用 Supabase Edge Functions + pg_cron

可以在 Supabase 中配置 pg_cron 扩展来定期执行：

```sql
-- 在 Supabase SQL Editor 中执行
SELECT cron.schedule(
  'keep-alive-job',
  '*/5 * * * *', -- 每5分钟
  $$
  INSERT INTO system_logs (log_time, log_data, created_at)
  VALUES (NOW(), 'Keep-alive heartbeat from pg_cron', NOW());
  $$
);
```

## 环境变量配置

在 `.env.local` 文件中添加（可选，用于安全验证）：

```env
CRON_SECRET=your-secret-key-here
```

如果设置了 `CRON_SECRET`，API 会验证请求头中的 `Authorization: Bearer YOUR_CRON_SECRET`。

## API 路由

### GET/POST /api/cron/keepalive

插入一条保活日志记录。

**请求头**（如果设置了 CRON_SECRET）：
```
Authorization: Bearer YOUR_CRON_SECRET
```

**响应**：
```json
{
  "success": true,
  "message": "Keep-alive log inserted successfully",
  "log": {
    "id": 1,
    "log_time": "2024-01-01T00:00:00Z",
    "log_data": "Keep-alive heartbeat at 2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 功能特点

- ✅ 每次调用都直接插入数据库，不使用缓存
- ✅ 自动添加时间戳参数
- ✅ 支持安全验证（可选）
- ✅ 完整的错误处理
- ✅ 返回插入的日志记录

## 测试方法

### 手动测试

```bash
# 使用 curl 测试
curl -X GET https://www.removewatermarker.com/api/cron/keepalive

# 或使用 POST
curl -X POST https://www.removewatermarker.com/api/cron/keepalive

# 如果设置了 CRON_SECRET
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://www.removewatermarker.com/api/cron/keepalive
```

### 本地测试

```bash
# 启动开发服务器
npm run dev

# 在另一个终端测试
curl http://localhost:3000/api/cron/keepalive
```

## 注意事项

1. **数据库表**: 确保已在 Supabase 中执行 `supabase_schema.sql` 创建 `system_logs` 表
2. **定时任务**: 需要使用外部 cron 服务（如 cron-job.org、EasyCron 等）来定期调用 API
3. **日志清理**: 建议定期清理旧日志，避免表过大
4. **安全**: 生产环境建议设置 `CRON_SECRET` 防止未授权访问

## 日志清理建议

可以定期清理旧日志（例如保留最近30天）：

```sql
-- 删除30天前的日志
DELETE FROM system_logs 
WHERE created_at < NOW() - INTERVAL '30 days';
```

## 文件结构

```
app/
  └── api/
      └── cron/
          └── keepalive/
              └── route.ts      # 保活定时任务API

supabase_schema.sql              # 已更新，包含 system_logs 表
```

