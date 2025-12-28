# 飞书字段更新说明

## 新增字段

根据视频生成流程的输出，我们新增了以下飞书多维表格字段：

### 1. 无水印视频URL
- **字段名**: `无水印视频URL`
- **字段类型**: URL
- **说明**: 存储从 `oscdn2.dyysy.com` 或 `qushuiyin.me` 获取的无水印视频链接
- **填充时机**: 当检测到 Watermark-free URL 时自动填充

### 2. 视频URL（更新逻辑）
- **字段名**: `视频URL`
- **字段类型**: URL
- **说明**: 优先使用 Google Drive URL，如果没有则使用普通视频URL
- **填充优先级**:
  1. Google Drive URL（如果存在）
  2. 普通视频URL（如果没有Google Drive URL）

## 视频生成流程输出格式

根据上游API的输出格式，系统会识别以下几种URL：

```
1. **Video Generation Progress**: 9% (running)
2. **Video Generation Progress**: 18% (running)
3. **Video Generation Progress**: 27% (running)
...
4. **Video Generation Completed**
   Watermark-free mode enabled. Waiting for watermark-free output...

5. Video published successfully. Post ID: p_abc123
   Now caching watermark-free video...

6. Watermark-free file not ready, waiting... (attempt 1)
7. Watermark-free file not ready, waiting... (attempt 2)
...

8. Watermark-free URL is ready (checked 5 times).
   📹 **Watermark-free URL**: https://oscdn2.dyysy.com/MP4/p_abc123.mp4
   Now caching watermark-free video...

9. Uploading watermark-free video to Google Drive...

10. ✅ Video uploaded to Google Drive successfully!
    🔗 **Google Drive URL**: https://drive.google.com/file/d/1abc.../view
```

## URL提取逻辑

系统会从流式输出中提取以下URL：

### 1. 无水印视频URL (Watermark-free URL)
- **识别条件**: URL包含 `oscdn2.dyysy.com` 或 `qushuiyin.me` 且以 `.mp4` 结尾
- **示例**: `https://oscdn2.dyysy.com/MP4/p_abc123.mp4`
- **填充字段**: `无水印视频URL`

### 2. Google Drive URL
- **识别条件**: URL包含 `drive.google.com`
- **示例**: `https://drive.google.com/file/d/1abc.../view`
- **填充字段**: `视频URL`（优先级最高）

### 3. 普通视频URL
- **识别条件**: 其他视频URL（包含 `.mp4`、`.webm` 等扩展名，或包含 `video`、`media`、`cdn` 关键词）
- **填充字段**: `视频URL`（如果没有Google Drive URL）

## 字段更新策略

当视频生成成功时，系统会按以下策略更新飞书字段：

```typescript
// 优先使用 Google Drive URL 填充视频URL字段
if (googleDriveUrl) {
    fields["视频URL"] = {
        link: googleDriveUrl,
        text: "查看视频",
    };
} else if (videoUrl) {
    fields["视频URL"] = {
        link: videoUrl,
        text: "查看视频",
    };
}

// 如果有无水印URL，填充到专门的字段
if (watermarkFreeUrl) {
    fields["无水印视频URL"] = {
        link: watermarkFreeUrl,
        text: "无水印视频",
    };
}
```

## 批量处理说明

### 顺序执行
批量生成视频时，系统会**顺序处理**每个任务：
- 等待当前任务完全完成（成功或失败）
- 更新飞书状态
- 再开始处理下一个任务

### 使用方法

```bash
# 批量生成待处理的任务（顺序执行）
POST /api/feishu/generate/batch
{
  "limit": 10  // 最多处理10个任务
}
```

### 处理流程

```
1. 获取待生成任务列表
   ↓
2. 对于每个任务（顺序执行）:
   a. 更新状态为"生成中"
   b. 调用视频生成API
   c. 提取所有URL（videoUrl, watermarkFreeUrl, googleDriveUrl）
   d. 更新飞书字段：
      - 无水印视频URL: watermarkFreeUrl
      - 视频URL: googleDriveUrl（优先）或 videoUrl
   e. 更新状态为"成功"或"失败"
   ↓
3. 继续下一个任务
```

## 飞书表格字段配置

请确保在飞书多维表格中添加以下字段：

| 字段名 | 字段类型 | 说明 | 必填 |
|--------|---------|------|------|
| 无水印视频URL | URL | 无水印视频链接 | ❌ |
| 视频URL | URL | 视频链接（优先Google Drive） | ❌ |
| 生成状态 | 单选 | 待生成/生成中/成功/失败 | ✅ |
| 是否已生成 | 复选框 | 标记是否已生成 | ✅ |
| 生成时间 | 日期时间 | 生成完成时间 | ❌ |
| 错误信息 | 多行文本 | 失败时的错误信息 | ❌ |

## 示例输出

成功生成后，飞书表格会显示：

| 提示词 | 生成状态 | 无水印视频URL | 视频URL | 生成时间 |
|--------|---------|--------------|---------|---------|
| 一只小猫在草地上奔跑 | 🟢 成功 | [无水印视频](https://oscdn2.dyysy.com/MP4/p_abc123.mp4) | [查看视频](https://drive.google.com/file/d/1abc.../view) | 2025-12-28 10:30 |
