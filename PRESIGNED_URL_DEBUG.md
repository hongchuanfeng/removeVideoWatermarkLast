# 预签名 URL 上传问题调试指南

## 问题现象

`/api/video/presigned-url` 接口部署到 Vercel 后，上传文件到 COS 失败。

## 可能的原因

### 1. COS SDK 方法不存在

腾讯云 COS SDK v5 可能不支持 `getPreSignedUrl` 方法，或者方法名不同。

**解决方案：**
- 代码已更新为同时尝试 `getObjectUrl` 和 `getPreSignedUrl` 方法
- 查看 Vercel 函数日志，确认使用的是哪个方法

### 2. 预签名 URL 格式不正确

生成的预签名 URL 可能格式不正确，导致 PUT 请求失败。

**检查方法：**
1. 查看浏览器控制台的日志
2. 查看 Vercel 函数日志中的 `Presigned URL generated successfully` 日志
3. 检查 URL 是否包含正确的签名参数

### 3. CORS 配置问题

如果浏览器控制台显示 CORS 错误，需要在腾讯云 COS 控制台配置 CORS 规则。

**CORS 配置：**
1. 登录腾讯云 COS 控制台
2. 进入存储桶设置 → 跨域访问 CORS 设置
3. 添加以下规则：
   - **来源 Origin**: `*` 或你的域名（如 `https://www.removewatermarker.com`）
   - **操作 Methods**: `PUT`, `GET`, `POST`, `HEAD`
   - **Allow-Headers**: `*`
   - **Expose-Headers**: `ETag`, `x-cos-request-id`
   - **Max-Age**: `3600`

### 4. 环境变量未配置

确保在 Vercel 项目设置中配置了以下环境变量：
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`

### 5. 存储桶权限问题

确保存储桶允许 PUT 操作。

**检查方法：**
1. 登录腾讯云 COS 控制台
2. 检查存储桶的访问权限
3. 确保存储桶策略允许 PUT 操作

## 调试步骤

### 步骤 1: 查看 Vercel 函数日志

1. 登录 Vercel Dashboard
2. 进入项目 → Functions
3. 找到 `/api/video/presigned-url` 函数
4. 查看执行日志，查找：
   - `Presigned URL generated successfully` - 成功生成
   - `Error generating presigned URL` - 生成失败
   - `getObjectUrl error` 或 `getPreSignedUrl error` - 方法调用失败

### 步骤 2: 查看浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 查看以下日志：
   - `Step 1: Requesting presigned URL...`
   - `Step 1: Got presigned URL`
   - `Step 2: Uploading file to COS...`
   - `Upload response status` - 应该是 200
   - `Upload response statusText` - 应该是 "OK"

### 步骤 3: 检查网络请求

1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签
3. 找到上传到 COS 的 PUT 请求
4. 检查：
   - **Request URL**: 应该是预签名 URL
   - **Request Method**: 应该是 `PUT`
   - **Status Code**: 应该是 `200` 或 `204`
   - **Response Headers**: 查看是否有错误信息

### 步骤 4: 测试预签名 URL

如果预签名 URL 生成成功，可以手动测试：

```bash
# 使用 curl 测试
curl -X PUT "预签名URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @test-video.mp4
```

## 常见错误码

### 403 Forbidden
- **原因**: 签名无效或权限不足
- **解决**: 检查环境变量和存储桶权限

### 404 Not Found
- **原因**: 存储桶或路径不存在
- **解决**: 检查 `TENCENT_COS_BUCKET` 和 `cosKey` 是否正确

### CORS 错误
- **原因**: 未配置 CORS 或配置不正确
- **解决**: 在 COS 控制台配置 CORS 规则

## 代码已做的改进

1. ✅ 同时尝试 `getObjectUrl` 和 `getPreSignedUrl` 方法
2. ✅ 添加了详细的错误日志
3. ✅ 添加了前端上传的详细日志
4. ✅ 添加了错误响应的详细输出

## 如果问题仍然存在

1. **查看完整的错误日志**（Vercel 函数日志 + 浏览器控制台）
2. **检查 COS SDK 版本**：`npm list cos-nodejs-sdk-v5`
3. **尝试手动生成预签名 URL**：使用腾讯云控制台的 API 调试工具
4. **联系支持**：提供完整的错误日志和配置信息

