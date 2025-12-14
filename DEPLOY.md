# 部署到 Deno Deploy

## 1. 安装 Deno CLI (如果还没有)
```bash
# 使用官方安装脚本
curl -fsSL https://deno.land/install.sh | sh

# 或者使用 Homebrew (macOS)
brew install deno
```

## 2. 安装 Deno Deploy CLI
```bash
deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts
```

## 3. 登录 Deno Deploy
```bash
deployctl login
```

## 4. 部署项目
```bash
deployctl deploy --project=soradeno server.ts
```

## 5. 设置环境变量

在 Deno Deploy 控制台中设置以下环境变量：

### JSONBin 配置
- `JSONBIN_API_KEY`: 你的 JSONBin API Key (从 https://jsonbin.io/app/keys 获取)
- `JSONBIN_BIN_ID`: 配置存储的 Bin ID
- `VIDEO_BIN_ID`: 视频URL存储的 Bin ID

### 如何获取 JSONBin 配置

1. 访问 https://jsonbin.io/
2. 注册/登录账户
3. 创建两个新的 Bin（一个用于配置，一个用于视频）
4. 复制 Bin ID (URL 中的 ID 部分)
5. 在 Account -> API Keys 中获取 Master Key

## 6. 访问应用

部署完成后，你会获得一个 URL，如：
```
https://soradeno-xxx.deno.dev/
```

## 本地开发

```bash
# 设置环境变量
export JSONBIN_API_KEY=你的API_KEY
export JSONBIN_BIN_ID=你的配置BIN_ID
export VIDEO_BIN_ID=你的视频BIN_ID

# 运行服务器
deno run --allow-net --allow-env server.ts
```

访问 http://localhost:8000 查看前端界面。

## API 使用

### 生成视频
```bash
curl -X POST https://your-domain.deno.dev/v1/videos/generations \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "model": "sora",
    "size": "1920x1080",
    "duration": 5
  }'
```

### 获取视频状态
```bash
curl https://your-domain.deno.dev/v1/videos/{video_id}
```