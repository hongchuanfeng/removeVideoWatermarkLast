# 腾讯云视频智能擦除和图片水印移除功能设置说明

## 已完成的功能

### 视频功能
✅ 已创建视频上传API路由 (`/api/video/upload`)
✅ 已创建进度查询API路由 (`/api/video/progress`)
✅ 已创建视频上传组件 (`components/VideoUpload.tsx`)
✅ 已更新首页集成上传功能
✅ 已更新数据库schema添加进度和任务ID字段
✅ 已添加中英文翻译

### 图片水印移除功能
✅ 已创建图片上传API路由 (`/api/image/upload`)
✅ 已创建图片水印移除API路由 (`/api/image/remove-watermark`)
✅ 已实现腾讯云CI API调用进行水印移除
✅ 已实现矩形区域选择功能
✅ 已添加多语言支持
✅ 已集成积分扣除系统

## 需要配置的环境变量

在 `.env.local` 文件中添加以下配置（基于你提供的配置）：

```env


# 腾讯云CI水印移除模板ID（可选，默认使用 'removesub'）
TENCENT_REMOVE_WATERMARK_TEMPLATE_ID=removesub

# Supabase配置（请替换为实际值）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 需要安装的依赖

```bash
npm install tencentcloud-sdk-nodejs cos-nodejs-sdk-v5
```

## 功能说明

### 1. 视频上传流程

1. 用户选择视频文件
2. 选择去除类型（水印/Logo/字幕）
3. 上传到腾讯云COS存储桶
4. 调用腾讯云MPS视频智能擦除API
5. 创建转换记录到数据库

### 2. 进度跟踪

- 每2秒自动查询处理进度
- 实时更新进度条（0-100%）
- 显示处理状态（上传中/处理中/完成/失败）

### 3. 积分扣除

- 处理完成后自动扣除积分
- 1分钟视频 = 1积分
- 不足1分钟按1分钟计算（向上取整）

### 4. 自动下载

- 处理完成后自动下载结果文件
- 文件格式：MP4

### 5. 图片水印移除流程

1. 用户选择图片文件
2. 在图片上拖拽选择水印区域（矩形选择）
3. 上传图片到腾讯云COS存储桶
4. 调用腾讯云CI图片处理API进行水印移除
5. 显示处理结果并提供下载
6. 扣除1积分

### 6. 图片水印移除特性

- **矩形区域选择**：支持鼠标拖拽选择任意矩形区域
- **腾讯云CI集成**：使用Cloud Infinite进行AI水印移除
- **实时显示**：处理完成后直接在页面显示结果
- **下载功能**：支持下载处理后的图片
- **积分系统**：每张图片扣除1积分

## API路由说明

### 视频处理API

#### POST /api/video/upload

上传视频并开始处理

**请求体：**
- `file`: 视频文件
- `type`: 去除类型 ('watermark' | 'logo' | 'subtitle')

**响应：**
```json
{
  "success": true,
  "recordId": "uuid",
  "taskId": "tencent_task_id"
}
```

#### GET /api/video/progress

查询处理进度

**查询参数：**
- `recordId`: 记录ID

**响应：**
```json
{
  "status": "processing",
  "progress": 50,
  "resultUrl": "https://..."
}
```

### 图片水印移除API

#### POST /api/image/upload

上传图片到腾讯云COS

**请求体：**
- `file`: 图片文件 (FormData)

**响应：**
```json
{
  "url": "https://cos-url-to-uploaded-image"
}
```

#### POST /api/image/remove-watermark

处理图片水印移除

**请求体：**
```json
{
  "imageUrl": "https://cos-url-to-image",
  "regions": [
    {
      "x": 100,
      "y": 50,
      "w": 200,
      "h": 100
    }
  ]
}
```

**响应：**
```json
{
  "processedImageUrl": "https://cos-url-to-processed-image",
  "creditsRemaining": 99
}
```

## 数据库字段说明

### conversion_records 表新增字段

- `progress`: 处理进度 (0-100)
- `task_id`: 腾讯云任务ID
- `video_duration`: 视频时长（秒）

## 注意事项

### 视频处理注意事项

1. **腾讯云API配置**：
   - 需要在腾讯云控制台创建MPS工作流模板
   - 配置智能擦除参数
   - 确保COS存储桶有读写权限

2. **API调用**：
   - 根据实际腾讯云API文档调整API调用方式
   - 当前实现可能需要根据实际API文档进行调整

3. **视频时长获取**：
   - 需要在上传时获取视频时长
   - 可以使用 `ffmpeg` 或腾讯云API获取

4. **错误处理**：
   - 添加了基本的错误处理
   - 建议添加更详细的错误日志

### 图片水印移除注意事项

1. **腾讯云CI配置**：
   - 确保腾讯云账号已开通CI服务
   - COS存储桶需要有CI处理权限
   - 水印移除模板ID默认为'removesub'

2. **图片格式支持**：
   - 支持常见图片格式（JPEG、PNG等）
   - 文件大小限制：10MB
   - 建议图片分辨率不超过4096x4096

3. **区域选择**：
   - 支持多个矩形区域选择
   - 区域坐标基于图片像素坐标系
   - 建议选择区域包含完整的水印内容

4. **API调用频率**：
   - CI处理可能需要几秒到几十秒
   - 前端会显示处理状态和进度

5. **积分扣除**：
   - 无论处理成功与否，积分都会在开始处理时扣除
   - 如果处理失败，会记录错误状态

## 待完善功能

- [ ] 获取视频时长（用于计算积分）
- [ ] 根据实际腾讯云API文档调整API调用
- [ ] 添加文件大小限制
- [ ] 添加视频格式验证
- [ ] 优化进度查询逻辑

