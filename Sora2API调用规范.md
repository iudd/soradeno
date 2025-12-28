# Sora2API 调用与数据流处理规范

## 1. 基础信息

- **接口地址**: `https://您的域名/v1/chat/completions`
- **认证方式**: `Authorization: Bearer YOUR_API_KEY`
- **请求格式**: `Content-Type: application/json`

---

## 2. 请求示例 (Stream 模式)

```json
{
  "model": "sora-video-10s",
  "messages": [{"role": "user", "content": "一只在钢琴上跳舞的猫"}],
  "stream": true
}
```

---

## 3. 数据流 (SSE) 输出格式说明

API 会返回多个数据块（Chunks），每个块以 `data: ` 开头。

### A. 过程状态块 (进度提示)

主要通过 `reasoning_content` 字段输出，建议实时展示给用户。

```json
data: {
  "choices": [{
    "delta": {
      "reasoning_content": "**Video Generation Progress**: 40% (processing)\n"
    }
  }]
}
```

### B. 无水印处理块 (特殊状态)

如果开启了无水印模式，`delta` 中会包含 `wm` 对象。

- **stage**: 当前阶段 (`waiting`, `published`, `ready`)
- **can_cancel**: 是否可以跳过等待（若为 `true`，前端可显示"取消等待"按钮）

```json
data: {
  "choices": [{
    "delta": {
      "reasoning_content": "正在解析无水印视频...",
      "wm": { 
        "stage": "waiting", 
        "attempt": 3, 
        "can_cancel": true, 
        "task_id": "s_xxxx" 
      }
    }
  }]
}
```

### C. 最终结果块 (关键数据)

当生成结束时，`content` 会包含 Markdown 格式的播放器，`output` 会包含纯链接。

**⚠️ 注意：调用方必须捕获此块中的 URL。**

```json
data: {
  "choices": [{
    "delta": {
      "content": "```html\n<video src='https://video-url.mp4' controls></video>\n```",
      "output": [{
        "url": "https://video-url.mp4",
        "type": "video",
        "task_id": "s_xxxx"
      }]
    },
    "finish_reason": "STOP"
  }]
}
```

### D. 结束标志

```
data: [DONE]
```

---

## 4. 调用方逻辑处理建议

1. **监听数据流**：解析每一行 `data: ` 后的 JSON。

2. **更新 UI**：
   - 将 `reasoning_content` 累加显示在"状态栏"或"思考区"。
   - 检查 `wm.can_cancel`，若为 `true` 则允许用户发送取消请求（`/v1/tasks/{id}/watermark/cancel`）。

3. **获取结果**：
   - 寻找 `choices[0].delta.output[0].url`。
   - 一旦获取到该 URL，即为最终视频地址，可直接用于下载或播放。

4. **异常处理**：
   - 若收到 `{"error": {...}}` 格式的数据，应立即停止加载并提示错误。

---

## 5. 常见错误代码

| 状态码 | 说明 |
|--------|------|
| **400** | 提示词违规或参数错误 |
| **401** | API Key 无效 |
| **429** | 账号并发已满或额度不足 |
| **500** | 上游 Sora 服务异常 |

---

## 6. 前端处理示例代码

### JavaScript SSE 处理逻辑

```javascript
async function streamGeneration(model, messages, streamOutput, resultDiv, type, prompt) {
    console.log('🚀 开始调用 API');
    
    const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let mediaUrl = null;
    let reasoningContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta;

                    // 1. 处理进度状态
                    if (delta?.reasoning_content) {
                        reasoningContent += delta.reasoning_content;
                        streamOutput.textContent = reasoningContent;
                        console.log('💭 进度:', delta.reasoning_content);
                    }

                    // 2. 处理无水印状态
                    if (delta?.wm) {
                        console.log('🔗 无水印状态:', delta.wm);
                        if (delta.wm.stage === 'waiting') {
                            streamOutput.textContent += `\n⏳ 正在解析无水印... (${delta.wm.attempt})\n`;
                        }
                    }

                    // 3. 获取最终 URL (关键!)
                    if (delta?.output?.[0]?.url) {
                        mediaUrl = delta.output[0].url;
                        console.log('✨ 最终URL:', mediaUrl);
                    }

                    // 4. 检查完成状态
                    if (json.choices?.[0]?.finish_reason === 'STOP') {
                        console.log('🎬 生成完成');
                    }

                } catch (e) {
                    console.error('解析错误:', e);
                }
            }
        }
    }

    // 显示结果
    if (mediaUrl) {
        resultDiv.innerHTML = `<video src="${mediaUrl}" controls></video>`;
    }
}
```

---

## 7. 重要提示

⚠️ **务必处理 `data: [DONE]` 之前的最后一个有效 `content` 或 `output` 字段，因为那是最终的视频地址。**

⚠️ **如果只看 `reasoning_content`，将无法获得最终结果。**

⚠️ **`output[0].url` 是最可靠的最终结果来源，优先使用此字段。**

---

## 8. 调试建议

1. **开启控制台日志**：在关键位置添加 `console.log` 输出，便于追踪数据流。
2. **显示原始数据**：在解析失败时，将原始 JSON 输出到界面或控制台。
3. **分阶段验证**：
   - 先验证能否收到 `reasoning_content`
   - 再验证能否收到 `output` 字段
   - 最后验证 URL 是否可访问

---

## 9. 完整流程图

```
用户发起请求
    ↓
发送 POST /v1/chat/completions (stream: true)
    ↓
接收 SSE 数据流
    ↓
┌─────────────────────────────────────┐
│ 1. reasoning_content (进度提示)      │
│    → 显示在状态栏                    │
├─────────────────────────────────────┤
│ 2. wm 对象 (无水印状态)              │
│    → 显示等待提示 / 取消按钮         │
├─────────────────────────────────────┤
│ 3. output[0].url (最终结果) ⭐       │
│    → 保存 URL，准备渲染              │
├─────────────────────────────────────┤
│ 4. finish_reason: "STOP"            │
│    → 标记生成完成                    │
└─────────────────────────────────────┘
    ↓
收到 data: [DONE]
    ↓
使用 mediaUrl 渲染视频/图片
    ↓
完成
```

---

**文档版本**: v1.0  
**更新日期**: 2025-12-28  
**适用范围**: Sora2API 所有调用方
