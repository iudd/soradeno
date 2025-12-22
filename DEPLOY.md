# Deno Deploy 部署指南

## 🚀 快速部署

### 方式一：通过 GitHub 自动部署（推荐）

1. **连接 GitHub 仓库**
   - 访问 [Deno Deploy](https://dash.deno.com/)
   - 点击 "New Project"
   - 选择 "Deploy from GitHub"
   - 授权并选择 `iudd/soradeno` 仓库
   - 选择 `main` 分支

2. **配置项目**
   - **Entry Point**: `server.ts`
   - **Production Branch**: `main`

3. **设置环境变量**
   
   在 Deno Deploy 项目设置中添加以下环境变量：

   ```
   API_BASE_URL=https://iyougame-soarmb.hf.space/v1
   API_KEY=han1234
   ```

   ⚠️ **重要**: 
   - `API_BASE_URL` 必须设置为您的 Sora2mb 后端地址
   - 默认值是 `https://iyougame-soarmb.hf.space/v1`
   - 如果使用其他后端（如 `https://whisk-2api.to2ai.workers.dev/v1`），请确保后端有可用的 Token

4. **部署完成**
   - 保存配置后，Deno Deploy 会自动部署
   - 获取您的部署 URL（如 `https://your-project.deno.dev`）
   - 访问 URL 即可使用完整的 Web 界面

### 方式二：使用 deployctl 命令行工具

```bash
# 安装 deployctl
deno install --allow-read --allow-write --allow-env --allow-net --allow-run --no-check -r -f https://deno.land/x/deploy/deployctl.ts

# 部署项目
deployctl deploy --project=soradeno server.ts

# 设置环境变量
deployctl env set API_BASE_URL https://iyougame-soarmb.hf.space/v1
deployctl env set API_KEY han1234
```

## 🔍 调试日志

新版本添加了详细的日志记录，您可以在 Deno Deploy 控制台查看：

### 日志格式
```
[时间戳] [级别] 消息 | Data: {详细信息}
```

### 日志级别
- **INFO**: 正常信息（请求、响应、配置）
- **WARN**: 警告信息（未找到路由等）
- **ERROR**: 错误信息（API 错误、服务器错误）

### 启动日志示例
```
[2025-12-22T14:39:13.000Z] [INFO] ============================================================
[2025-12-22T14:39:13.000Z] [INFO] 🚀 SoraDeno Server Starting
[2025-12-22T14:39:13.000Z] [INFO] ============================================================
[2025-12-22T14:39:13.000Z] [INFO] Server running on port 8000
[2025-12-22T14:39:13.000Z] [INFO] API Base URL: https://iyougame-soarmb.hf.space/v1
[2025-12-22T14:39:13.000Z] [INFO] API Key configured: Yes (length: 7)
[2025-12-22T14:39:13.000Z] [INFO] Environment: Deno Deploy
[2025-12-22T14:39:13.000Z] [INFO] ============================================================
```

### 请求日志示例
```
[2025-12-22T14:39:19.000Z] [INFO] [a1b2c3d4] POST /v1/chat/completions | Data: {"origin":"https://your-site.deno.dev","userAgent":"Mozilla/5.0..."}
[2025-12-22T14:39:19.000Z] [INFO] [a1b2c3d4] Chat completion request | Data: {"model":"sora-video-landscape-10s","messageCount":1,"stream":true}
[2025-12-22T14:39:19.000Z] [INFO] [a1b2c3d4] Calling backend API | Data: {"url":"https://iyougame-soarmb.hf.space/v1/chat/completions","hasApiKey":true}
[2025-12-22T14:39:20.000Z] [INFO] [a1b2c3d4] Backend response | Data: {"status":200,"statusText":"OK","duration":"1234ms","contentType":"text/event-stream"}
[2025-12-22T14:39:20.000Z] [INFO] [a1b2c3d4] Streaming response started
```

### 错误日志示例
```
[2025-12-22T14:39:19.000Z] [ERROR] [a1b2c3d4] Backend API error | Data: {"status":503,"error":"{\"error\":\"No API credentials available. Please try again later.\"}"}
```

## ❌ 常见错误及解决方案

### 错误 1: HTTP 503 - No API credentials available

**错误信息**:
```json
{
  "error": {
    "message": "上游错误 (503): {\"error\":\"No API credentials available. Please try again later.\"}",
    "type": "api_error"
  }
}
```

**原因**: 后端 Sora2mb 服务没有可用的 Sora Token

**解决方案**:
1. 检查后端服务是否正常运行
2. 确认后端有可用的 Sora Token
3. 如果使用 Hugging Face Space，检查 Space 是否在运行状态
4. 等待后端管理员添加新的 Token

### 错误 2: API_BASE_URL 配置错误

**症状**: 日志显示错误的 API 地址

**解决方案**:
1. 在 Deno Deploy 项目设置中检查环境变量
2. 确保 `API_BASE_URL` 设置为正确的后端地址
3. 正确的地址格式: `https://iyougame-soarmb.hf.space/v1`
4. 修改后需要重新部署

### 错误 3: CORS 错误

**症状**: 浏览器控制台显示跨域错误

**解决方案**:
- 本项目已正确配置 CORS，如果仍有问题，请检查：
  1. 后端服务是否支持 CORS
  2. 浏览器是否有扩展插件干扰
  3. 查看 Deno Deploy 日志确认请求是否到达

## 📊 监控和维护

### 查看日志
1. 访问 Deno Deploy 控制台
2. 选择您的项目
3. 点击 "Logs" 标签
4. 实时查看所有请求和错误日志

### 性能监控
- 每个请求都会记录响应时间
- 查看 `duration` 字段了解后端 API 性能
- 如果响应时间过长，可能是后端问题

### 更新部署
- 推送代码到 GitHub `main` 分支会自动触发部署
- 也可以在 Deno Deploy 控制台手动触发重新部署

## 🔧 高级配置

### 自定义端口（本地开发）
```bash
PORT=3000 deno run --allow-net --allow-read --allow-env server.ts
```

### 使用自定义后端
```bash
# 设置环境变量
export API_BASE_URL=https://your-custom-backend.com/v1
export API_KEY=your_api_key

# 运行服务
deno run --allow-net --allow-read --allow-env server.ts
```

## 📞 获取帮助

如果遇到问题：
1. 查看 Deno Deploy 日志
2. 检查环境变量配置
3. 确认后端服务状态
4. 提交 Issue 到 GitHub 仓库

## 🔗 相关链接

- [Deno Deploy 文档](https://deno.com/deploy/docs)
- [Sora2mb 后端项目](https://github.com/iudd/Sora2mb)
- [项目 GitHub](https://github.com/iudd/soradeno)