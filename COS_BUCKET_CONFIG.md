# 腾讯云 COS 存储桶配置说明

## 错误诊断

如果遇到 `getaddrinfo ENOENT` 错误，通常是存储桶名称配置不正确导致的。

## 如何获取正确的存储桶名称

### 1. 登录腾讯云控制台

1. 访问：https://console.cloud.tencent.com/cos
2. 登录您的账户

### 2. 查看存储桶列表

在 COS 控制台中，您会看到存储桶列表。存储桶名称显示在列表中。

**重要提示：**
- 存储桶名称通常**不包含 appid**
- 例如：如果存储桶显示为 `test`，那么存储桶名称就是 `test`
- **不要**使用 `test-1308733829` 这样的格式（其中 `1308733829` 是 appid）

### 3. 查看存储桶区域

点击存储桶名称进入详情，查看存储桶的**所属地域**（Region）。

常见区域代码：
- `ap-guangzhou` - 广州
- `ap-shanghai` - 上海
- `ap-beijing` - 北京
- `ap-chengdu` - 成都

## 环境变量配置

在 `.env.local` 文件中配置：

```env
# 存储桶名称（只填写存储桶名称，不包含 appid）
TENCENT_COS_BUCKET=test

# 存储桶区域（必须与存储桶实际区域一致）
TENCENT_COS_REGION=ap-guangzhou

# 腾讯云凭证
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
```

## 常见错误

### ❌ 错误配置示例

```env
# 错误：包含了 appid
TENCENT_COS_BUCKET=test-1308733829

# 错误：包含了完整域名
TENCENT_COS_BUCKET=test.cos.ap-guangzhou.myqcloud.com

# 错误：包含了协议
TENCENT_COS_BUCKET=https://test.cos.ap-guangzhou.myqcloud.com
```

### ✅ 正确配置示例

```env
# 正确：只使用存储桶名称
TENCENT_COS_BUCKET=test

# 正确：区域代码
TENCENT_COS_REGION=ap-guangzhou
```

## 验证配置

配置完成后，可以通过以下方式验证：

1. **检查存储桶是否存在**：
   - 在腾讯云控制台确认存储桶存在
   - 确认存储桶名称拼写正确

2. **检查区域是否匹配**：
   - 存储桶的所属地域必须与 `TENCENT_COS_REGION` 一致

3. **检查凭证权限**：
   - 确保 SecretId 和 SecretKey 有访问该存储桶的权限
   - 在腾讯云控制台 > 访问管理 > API密钥管理 中查看

4. **测试网络连接**：
   ```bash
   # 测试域名解析（替换为您的存储桶名称）
   nslookup test.cos.ap-guangzhou.myqcloud.com
   ```

## 如果问题仍然存在

1. **检查存储桶是否已创建**：
   - 在腾讯云控制台确认存储桶确实存在

2. **检查存储桶权限**：
   - 确保存储桶允许上传操作
   - 检查存储桶的访问策略

3. **检查网络连接**：
   - 确保服务器可以访问腾讯云服务
   - 检查防火墙设置

4. **查看详细错误日志**：
   - 检查服务器控制台的完整错误信息
   - 错误信息会显示尝试连接的域名

## 联系支持

如果以上步骤都无法解决问题，请：
1. 提供完整的错误日志
2. 提供存储桶名称和区域信息（隐藏敏感信息）
3. 联系腾讯云技术支持



