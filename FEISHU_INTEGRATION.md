# 飞书多维表格集成方案

## 📊 多维表格设计

### 表格结构

| 字段名 | 字段类型 | 说明 | 必填 |
|--------|---------|------|------|
| 任务ID | 自动编号 | 自动生成的唯一ID | ✅ |
| 提示词 | 多行文本 | 视频生成的提示词 | ✅ |
| 角色 | 单选 | 视频角色（可选） | ❌ |
| 模型 | 单选 | 视频模型 | ✅ |
| 是否已生成 | 复选框 | 标记是否已生成 | ✅ |
| 生成状态 | 单选 | 待生成/生成中/成功/失败 | ✅ |
| 生成时间 | 日期时间 | 视频生成完成时间 | ❌ |
| 视频URL | URL | 生成的视频链接 | ❌ |
| 错误信息 | 多行文本 | 生成失败时的错误信息 | ❌ |
| 创建时间 | 创建时间 | 记录创建时间 | ✅ |
| 更新时间 | 最后编辑时间 | 记录更新时间 | ✅ |

### 字段详细说明

#### 1. 提示词（多行文本）
- 描述要生成的视频内容
- 示例：`一只小猫在草地上奔跑`

#### 2. 角色（单选）
- 选项：
  - 无角色
  - 角色1
  - 角色2
  - 角色3
  - ...（根据实际需求添加）

#### 3. 模型（单选）
- 选项：
  - `sora-video-10s` - 默认 10秒
  - `sora-video-15s` - 默认 15秒
  - `sora-video-landscape-10s` - 横屏 10秒
  - `sora-video-landscape-15s` - 横屏 15秒
  - `sora-video-portrait-10s` - 竖屏 10秒
  - `sora-video-portrait-15s` - 竖屏 15秒

#### 4. 生成状态（单选）
- 选项：
  - 🟡 待生成
  - 🔵 生成中
  - 🟢 成功
  - 🔴 失败

## 🔑 飞书 API 配置

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 `App ID` 和 `App Secret`

### 2. 配置权限

需要开通以下权限：
- `bitable:app` - 查看、编辑多维表格
- `bitable:app:readonly` - 查看多维表格

### 3. 获取表格信息

- **App Token**: 多维表格的唯一标识
- **Table ID**: 数据表的唯一标识

获取方式：
1. 打开多维表格
2. 查看 URL：`https://xxx.feishu.cn/base/[app_token]?table=[table_id]`

## 🔧 环境变量配置

在 Deno Deploy 或 `.env` 文件中添加：

```env
# 飞书应用配置
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx

# 多维表格配置
FEISHU_APP_TOKEN=bascnxxxxxxxxxxxxxx
FEISHU_TABLE_ID=tblxxxxxxxxxxxxxx
```

## 📡 API 端点设计

### 1. 获取待生成任务列表
```
GET /api/feishu/tasks?status=pending
```

响应：
```json
{
  "tasks": [
    {
      "record_id": "recxxxxxx",
      "prompt": "一只小猫在草地上奔跑",
      "character": "角色1",
      "model": "sora-video-landscape-10s",
      "status": "待生成"
    }
  ]
}
```

### 2. 更新任务状态
```
POST /api/feishu/tasks/{record_id}/status
```

请求：
```json
{
  "status": "生成中",
  "video_url": "https://...",
  "error": "错误信息"
}
```

### 3. 批量生成视频
```
POST /api/feishu/generate/batch
```

请求：
```json
{
  "limit": 10,  // 最多生成数量
  "auto": true  // 是否自动模式
}
```

### 4. 手动生成单个视频
```
POST /api/feishu/generate/single
```

请求：
```json
{
  "record_id": "recxxxxxx"
}
```

## 🎯 功能实现

### 1. 自动批量生成
- 定时任务（可选）
- 从表格获取所有"待生成"状态的记录
- 逐个生成视频
- 更新生成状态和结果

### 2. 手动生成单条
- 选择特定记录
- 立即生成视频
- 实时更新状态

### 3. 状态同步
- 生成前：更新为"生成中"
- 生成成功：更新为"成功"，填写视频URL和生成时间
- 生成失败：更新为"失败"，填写错误信息

## 🔄 工作流程

```
1. 用户在飞书表格中添加任务
   ↓
2. 设置提示词、角色、模型
   ↓
3. 状态默认为"待生成"
   ↓
4. 系统获取待生成任务
   ↓
5. 调用 Sora API 生成视频
   ↓
6. 更新状态为"生成中"
   ↓
7. 生成完成后更新：
   - 状态 → "成功"
   - 视频URL
   - 生成时间
   ↓
8. 用户在表格中查看结果
```

## 📝 使用示例

### 在飞书表格中添加任务

| 提示词 | 角色 | 模型 | 生成状态 |
|--------|------|------|---------|
| 一只小猫在草地上奔跑 | 无角色 | sora-video-landscape-10s | 🟡 待生成 |
| 日落时分的海滩 | 角色1 | sora-video-landscape-15s | 🟡 待生成 |
| 城市夜景延时摄影 | 无角色 | sora-video-portrait-10s | 🟡 待生成 |

### 生成完成后

| 提示词 | 角色 | 模型 | 生成状态 | 生成时间 | 视频URL |
|--------|------|------|---------|---------|---------|
| 一只小猫在草地上奔跑 | 无角色 | sora-video-landscape-10s | 🟢 成功 | 2025-12-22 23:00 | [查看视频](https://...) |
| 日落时分的海滩 | 角色1 | sora-video-landscape-15s | 🟢 成功 | 2025-12-22 23:05 | [查看视频](https://...) |
| 城市夜景延时摄影 | 无角色 | sora-video-portrait-10s | 🔴 失败 | 2025-12-22 23:10 | - |

## 🛡️ 错误处理

### 常见错误

1. **认证失败**
   - 检查 App ID 和 App Secret
   - 确认应用权限

2. **表格访问失败**
   - 检查 App Token 和 Table ID
   - 确认应用已添加到表格

3. **生成失败**
   - 记录错误信息到表格
   - 状态更新为"失败"
   - 可重新生成

## 🔐 安全建议

1. **不要在前端暴露**
   - App Secret 必须在后端使用
   - 使用环境变量存储敏感信息

2. **访问控制**
   - 限制 API 访问频率
   - 添加身份验证

3. **数据验证**
   - 验证提示词长度
   - 检查模型是否有效

## 📚 相关文档

- [飞书开放平台文档](https://open.feishu.cn/document/home/index)
- [多维表格 API](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/list)
- [飞书认证指南](https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal)
