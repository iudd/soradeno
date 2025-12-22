# SoraDeno

🎬 AI 驱动的视频与图片生成平台 - 基于 Sora2mb API 的 OpenAI 兼容代理服务

## ✨ 功能特性

### 🎨 核心功能
- **🎬 视频生成**
  - 文生视频 - 根据文本描述生成视频
  - 图生视频 - 基于上传的图片生成视频
  - 多种尺寸和时长选项（10s/15s，横屏/竖屏）
  
- **🖼️ 图片生成**
  - 文生图 - 根据文本描述生成图片
  - 图生图 - 基于上传的图片进行创意变换
  - 多种尺寸支持（默认/横屏/竖屏）

### ⚡ 高级功能
- **🔄 Remix** - 基于已有视频继续创作
- **🎞️ 分镜视频** - 创建多段分镜视频
- **📚 历史记录** - 自动保存生成历史，支持查看和下载
- **🌊 流式响应** - 实时显示生成进度

### 🎯 技术特性
- OpenAI 兼容 API 格式
- 基于 Deno Deploy 部署
- 代理 Sora2mb 后端服务
- 现代化响应式 UI 设计
- 本地历史记录存储

## 🚀 快速开始

### 环境要求
- Deno 1.x+
- 可访问的 Sora2mb 后端服务

### 本地运行

```bash
# 克隆项目
git clone https://github.com/iudd/soradeno.git
cd soradeno

# 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件设置 API_BASE_URL 和 API_KEY

# 运行服务
deno run --allow-net --allow-read --allow-env server.ts

# 访问 http://localhost:8000
```

### Deno Deploy 部署

```bash
# 使用 deployctl 部署
deployctl deploy --project=soradeno server.ts

# 设置环境变量
# API_BASE_URL: Sora2mb 后端地址（默认: https://iyougame-soarmb.hf.space/v1）
# API_KEY: Sora2mb API 密钥（默认: han1234）
```

## 📖 使用说明

### Web 界面

访问部署的服务地址，即可使用完整的 Web 界面：

1. **视频生成**
   - 选择模型（时长和尺寸）
   - 选择生成方式（文生视频/图生视频）
   - 输入提示词
   - 如果是图生视频，上传参考图片
   - 点击生成按钮

2. **图片生成**
   - 选择模型（尺寸）
   - 选择生成方式（文生图/图生图）
   - 输入提示词
   - 如果是图生图，上传参考图片
   - 点击生成按钮

3. **Remix 视频**
   - 输入 Sora 视频分享链接或 ID
   - 输入创作提示词（如：改成水墨画风格）
   - 点击开始 Remix

4. **分镜视频**
   - 按格式输入分镜脚本：
     ```
     [5.0s]猫猫从飞机上跳伞
     [5.0s]猫猫降落
     [10.0s]猫猫在田野奔跑
     ```
   - 点击生成分镜

5. **历史记录**
   - 查看所有生成历史
   - 下载或删除记录
   - 清空所有历史

## 🔌 API 端点

### Chat Completions（兼容 OpenAI 格式）

```bash
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "sora-video-landscape-10s",
  "messages": [
    {
      "role": "user",
      "content": "一只小猫在草地上奔跑"
    }
  ],
  "stream": true
}
```

### 可用模型列表

```bash
GET /v1/models
```

### 健康检查

```bash
GET /health
```

## 🎨 支持的模型

### 视频模型
- `sora-video-10s` - 默认 10秒（360×360）
- `sora-video-15s` - 默认 15秒（360×360）
- `sora-video-landscape-10s` - 横屏 10秒（540×360）
- `sora-video-landscape-15s` - 横屏 15秒（540×360）
- `sora-video-portrait-10s` - 竖屏 10秒（360×540）
- `sora-video-portrait-15s` - 竖屏 15秒（360×540）

### 图片模型
- `sora-image` - 默认（360×360）
- `sora-image-landscape` - 横屏（540×360）
- `sora-image-portrait` - 竖屏（360×540）

## 📝 API 调用示例

### 文生视频

```bash
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-video-landscape-10s",
    "messages": [{"role": "user", "content": "一只小猫在草地上奔跑"}],
    "stream": true
  }'
```

### 图生视频

```bash
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-video-landscape-10s",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "这只猫在跳舞"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
      ]
    }],
    "stream": true
  }'
```

### Remix 视频

```bash
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-video-landscape-10s",
    "messages": [{
      "role": "user",
      "content": "https://sora.chatgpt.com/p/xxx 改成水墨画风格"
    }]
  }'
```

### 分镜视频

```bash
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-video-landscape-10s",
    "messages": [{
      "role": "user",
      "content": "[5.0s]猫猫从飞机上跳伞 [5.0s]猫猫降落 [10.0s]猫猫在田野奔跑"
    }]
  }'
```

## ⚙️ 配置

### 环境变量

- `API_BASE_URL` - Sora2mb 后端 API 地址（默认: https://iyougame-soarmb.hf.space/v1）
- `API_KEY` - Sora2mb API 密钥（默认: han1234）
- `PORT` - 服务端口（默认: 8000）

### .env 文件示例

```env
API_BASE_URL=https://iyougame-soarmb.hf.space/v1
API_KEY=your_api_key_here
PORT=8000
```

## ⚠️ 注意事项

- 此代理服务需要后端 Sora2mb 有可用的 Sora Token
- 如果出现 503 错误，说明后端暂无可用凭证
- API Key 由服务端配置，客户端调用时无需提供
- 建议使用流式模式（`stream: true`）以获得更好的用户体验
- 历史记录存储在浏览器本地，清除浏览器数据会丢失历史

## 🔗 相关链接

- [Sora2mb 后端项目](https://github.com/iudd/Sora2mb)
- [Deno 官方文档](https://deno.land/)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)

## 📄 许可证

MIT License

## 🙏 致谢

- [Sora2mb](https://github.com/iudd/Sora2mb) - 提供后端 API 服务
- [Deno](https://deno.land/) - 现代化的 JavaScript/TypeScript 运行时

## 📞 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。