# Vercel 大文件上传配置说明

## 问题：403 Forbidden 错误

在 Vercel 上部署后，`/api/video/upload` 接口可能出现 403 Forbidden 错误。这通常是由以下原因引起的：

### 1. 请求体大小限制

**Vercel 默认限制：**
- **Hobby 计划**：请求体最大 4.5MB
- **Pro 计划**：可以通过配置增加（最大 50MB）

### 2. 函数执行时间限制

**Vercel 默认限制：**
- **Hobby 计划**：10 秒
- **Pro 计划**：60 秒（可配置到 300 秒）

## 解决方案

### 方案 1：在 Vercel 项目设置中配置（推荐）

**重要**：`maxRequestBodySize` 必须在 Vercel Dashboard 中配置，不能在 `vercel.json` 中设置。

1. 登录 Vercel Dashboard
2. 进入项目设置（Settings）
3. 找到 "Functions" 或 "Serverless Functions" 设置
4. 配置以下选项：
   - **Max Duration**: 设置为 `300`（5 分钟）
   - **Request Body Size Limit**: 设置为 `150MB` 或更大（需要 Pro 计划）
   
**注意**：
- 请求体大小限制只能在 Vercel Dashboard 中配置
- 需要 Pro 计划才能配置超过 4.5MB 的请求体大小
- `vercel.json` 中只能配置 `maxDuration`，不能配置 `maxRequestBodySize`

### 方案 2：使用 vercel.json 配置

项目根目录已包含 `vercel.json` 文件，配置了：

```json
{
  "functions": {
    "app/api/video/upload/route.ts": {
      "maxDuration": 300
    }
  }
}
```

**配置说明：**
- `maxDuration: 300` - 函数最大执行时间 300 秒（5 分钟）

**注意：**
- `maxDuration` 配置需要 **Pro 计划**才能生效
- `maxRequestBodySize` **不能**在 `vercel.json` 中配置，必须在 Vercel Dashboard 中设置
- Hobby 计划限制：请求体最大 4.5MB，执行时间最大 10 秒
- Pro 计划限制：请求体最大 150MB（需在 Dashboard 中配置），执行时间最大 300 秒

### 方案 3：升级到 Vercel Pro 计划

如果使用 Hobby 计划，建议升级到 Pro 计划以获得：
- 更长的函数执行时间（最多 300 秒）
- 更大的请求体限制（可配置）
- 更好的性能

### 方案 4：使用直接上传到 COS（已实现 ✅）

**当前实现方式**：前端直接上传到腾讯云 COS，后端只负责创建任务和处理逻辑。

**工作流程：**
1. 前端调用 `/api/video/presigned-url` 获取预签名 URL
2. 前端使用预签名 URL 直接上传文件到腾讯云 COS
3. 上传成功后，前端调用 `/api/video/create-task` 创建处理任务
4. 后端调用腾讯云 MPS API 开始处理视频

**优势：**
- ✅ 完全避免 Vercel 的请求体大小限制
- ✅ 文件直接上传到 COS，不经过 Vercel 服务器
- ✅ 支持任意大小的文件上传（仅受 COS 限制）
- ✅ 减少服务器负载和带宽消耗

**API 接口：**

- `POST /api/video/presigned-url` - 获取预签名 URL
  - 请求体：`{ fileName, fileSize, contentType }`
  - 响应：`{ presignedUrl, cosKey, bucket, region, expiresIn }`

- `POST /api/video/create-task` - 创建处理任务
  - 请求体：`{ cosUrl, cosKey, fileName, removalType }`
  - 响应：`{ success, recordId, taskId }`

## 当前代码已做的优化

1. ✅ **实现直接上传到 COS**（方案4）
   - 前端直接上传到腾讯云 COS，使用预签名 URL
   - 后端只负责创建任务和处理逻辑
   - 完全避免 Vercel 请求体大小限制

2. ✅ 添加了 `export const maxDuration = 300` 配置
3. ✅ 添加了 `export const runtime = 'nodejs'` 配置
4. ✅ 创建了 `/api/video/presigned-url` 接口生成预签名 URL
5. ✅ 创建了 `/api/video/create-task` 接口创建处理任务
6. ✅ 修改了前端组件实现直接上传到 COS

## 检查清单

- [ ] 确认 Vercel 项目计划（Hobby/Pro）
- [ ] 在 Vercel Dashboard 中配置 `maxDuration`（如果使用 Pro 计划）
- [ ] 检查环境变量是否正确配置
- [ ] 检查文件大小是否超过限制
- [ ] 查看 Vercel 函数日志以获取详细错误信息

## 调试建议

如果仍然遇到 403 错误：

1. **查看 Vercel 函数日志**：
   - 在 Vercel Dashboard 中查看函数执行日志
   - 查找具体的错误信息

2. **检查请求大小**：
   - 在浏览器开发者工具中查看请求的 `Content-Length` 头
   - 确认是否超过 4.5MB（Hobby）或配置的限制

3. **测试小文件**：
   - 先尝试上传小于 4MB 的文件
   - 如果小文件可以，说明是大小限制问题

4. **联系 Vercel 支持**：
   - 如果使用 Pro 计划仍然有问题，联系 Vercel 支持团队

## 相关文件

- `app/api/video/upload/route.ts` - 上传接口
- `vercel.json` - Vercel 配置文件
- `components/VideoUpload.tsx` - 前端上传组件

