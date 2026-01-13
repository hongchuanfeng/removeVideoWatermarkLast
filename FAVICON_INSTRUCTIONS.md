# Favicon 生成说明

## 方法1：使用在线工具（推荐）

1. 访问 https://favicon.io/ 或 https://realfavicongenerator.net/
2. 上传一个 512x512 像素的 PNG 图片
3. 生成 favicon.ico 文件
4. 将生成的 favicon.ico 文件放在 `public/` 目录下

## 方法2：使用 ImageMagick

```bash
convert icon.png -resize 32x32 favicon.ico
```

## 方法3：使用在线转换工具

1. 准备一个 32x32 或 16x16 的图标图片
2. 访问 https://convertio.co/png-ico/ 或类似工具
3. 转换为 .ico 格式
4. 保存到 `public/favicon.ico`

## 当前状态

项目已包含：
- `public/icon.svg` - SVG 格式图标（Next.js 会自动使用）
- `app/favicon.ico` - 占位文件（需要替换为真实图标）

Next.js 14 会自动从以下位置查找图标：
- `app/icon.png` 或 `app/icon.jpg`
- `app/favicon.ico`
- `public/favicon.ico`

建议：创建一个 32x32 的 favicon.ico 文件放在 `public/` 目录下。

