import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { FeishuService } from "./feishu.ts";

// Ensure API_BASE_URL always ends with /v1
let API_BASE_URL = Deno.env.get("API_BASE_URL") || "https://iyougame-soarmb.hf.space/v1";
// Remove trailing slash if present
API_BASE_URL = API_BASE_URL.replace(/\/$/, "");
// Ensure /v1 suffix
if (!API_BASE_URL.endsWith("/v1")) {
  API_BASE_URL = `${API_BASE_URL}/v1`;
}

const API_KEY = Deno.env.get("API_KEY") || "han1234";

// Initialize Feishu service
const feishuService = new FeishuService();

// Logging helper
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? ` | Data: ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${logData}`);
}

// Read index.html content
const indexHtml = await Deno.readTextFile("./index.html");

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const requestId = crypto.randomUUID().slice(0, 8);

  // Log incoming request
  log("INFO", `[${requestId}] ${req.method} ${url.pathname}`, {
    origin: req.headers.get("origin"),
    userAgent: req.headers.get("user-agent")?.slice(0, 50),
  });

  // Handle CORS
  if (req.method === "OPTIONS") {
    log("INFO", `[${requestId}] CORS preflight request`);
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Serve index.html for root path
    if (url.pathname === "/" && req.method === "GET") {
      log("INFO", `[${requestId}] Serving index.html`);
      return new Response(indexHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      const healthData = {
        status: "ok",
        api_base: API_BASE_URL,
        api_key_configured: !!API_KEY,
        timestamp: new Date().toISOString(),
      };
      log("INFO", `[${requestId}] Health check`, healthData);
      return new Response(JSON.stringify(healthData), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Chat completions endpoint - proxy to Sora2mb API
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const body = await req.json();

      // Log request details
      log("INFO", `[${requestId}] Chat completion request`, {
        model: body.model,
        messageCount: body.messages?.length,
        stream: body.stream,
      });

      // Ensure stream is enabled for Sora2mb
      const requestBody = {
        ...body,
        stream: body.stream !== false, // Default to true
      };

      const backendUrl = `${API_BASE_URL}/chat/completions`;
      log("INFO", `[${requestId}] Calling backend API`, {
        url: backendUrl,
        hasApiKey: !!API_KEY,
      });

      const startTime = Date.now();
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      const duration = Date.now() - startTime;
      log("INFO", `[${requestId}] Backend response`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        contentType: response.headers.get("content-type"),
      });

      if (!response.ok) {
        const error = await response.text();
        log("ERROR", `[${requestId}] Backend API error`, {
          status: response.status,
          error: error.slice(0, 500),
        });
        return new Response(error, {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }

      // Handle streaming response
      if (requestBody.stream && response.body) {
        log("INFO", `[${requestId}] Streaming response started`);
        return new Response(response.body, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      const data = await response.json();
      log("INFO", `[${requestId}] Non-streaming response completed`);
      return new Response(JSON.stringify(data), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Models endpoint
    if (url.pathname === "/v1/models" && req.method === "GET") {
      log("INFO", `[${requestId}] Models list requested`);
      const models = {
        object: "list",
        data: [
          // Image models
          { id: "sora-image", object: "model", owned_by: "sora2mb" },
          { id: "sora-image-landscape", object: "model", owned_by: "sora2mb" },
          { id: "sora-image-portrait", object: "model", owned_by: "sora2mb" },
          // Video models
          { id: "sora-video-10s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-15s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-landscape-10s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-landscape-15s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-portrait-10s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-portrait-15s", object: "model", owned_by: "sora2mb" },
        ],
      };
      log("INFO", `[${requestId}] Returning ${models.data.length} models`);
      return new Response(JSON.stringify(models), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Feishu API endpoints
    // 获取飞书配置状态
    if (url.pathname === "/api/feishu/status" && req.method === "GET") {
      log("INFO", `[${requestId}] Feishu status check`);
      return new Response(JSON.stringify({
        configured: feishuService.isConfigured(),
        message: feishuService.isConfigured() ? "飞书已配置" : "飞书未配置，请设置环境变量"
      }), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // 获取待生成任务列表
    if (url.pathname === "/api/feishu/tasks" && req.method === "GET") {
      log("INFO", `[${requestId}] Fetching Feishu tasks`);

      if (!feishuService.isConfigured()) {
        return new Response(JSON.stringify({
          error: "飞书未配置"
        }), {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }

      try {
        const tasks = await feishuService.getPendingTasks();
        const parsedTasks = tasks.map(task => feishuService.parseTaskRecord(task));

        log("INFO", `[${requestId}] Found ${parsedTasks.length} pending tasks`);

        return new Response(JSON.stringify({
          tasks: parsedTasks,
          count: parsedTasks.length
        }), {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        log("ERROR", `[${requestId}] Failed to fetch tasks`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "获取任务失败"
        }), {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }
    }

    // 生成单个视频
    if (url.pathname.startsWith("/api/feishu/generate/") && req.method === "POST") {
      const recordId = url.pathname.split("/").pop();
      log("INFO", `[${requestId}] Generating video for task ${recordId}`);

      if (!feishuService.isConfigured()) {
        return new Response(JSON.stringify({
          error: "飞书未配置"
        }), {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }

      try {
        // 获取任务详情
        const task = await feishuService.getTask(recordId!);
        const parsedTask = feishuService.parseTaskRecord(task);

        // 更新状态为"生成中"
        await feishuService.updateTaskStatus(recordId!, "生成中");

        // 调用 Sora API 生成视频
        const messages = [{ role: "user", content: parsedTask.prompt }];
        const response = await fetch(`${API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: parsedTask.model,
            messages: messages,
            stream: true
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          await feishuService.updateTaskStatus(recordId!, "失败", undefined, error);
          throw new Error(error);
        }

        // 解析流式响应获取视频 URL
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let videoUrl = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content || '';

                if (content) {
                  const urlMatch = content.match(/https?:\/\/[^\s\)]+/);
                  if (urlMatch) {
                    videoUrl = urlMatch[0];
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }

        if (videoUrl) {
          // 更新状态为"成功"
          await feishuService.updateTaskStatus(recordId!, "成功", videoUrl);

          log("INFO", `[${requestId}] Video generated successfully`, { videoUrl });

          return new Response(JSON.stringify({
            success: true,
            videoUrl: videoUrl,
            task: parsedTask
          }), {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          });
        } else {
          await feishuService.updateTaskStatus(recordId!, "失败", undefined, "未能提取视频URL");
          throw new Error("未能提取视频URL");
        }
      } catch (error) {
        log("ERROR", `[${requestId}] Failed to generate video`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "生成失败"
        }), {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }
    }

    log("WARN", `[${requestId}] Route not found: ${url.pathname}`);
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    log("ERROR", `[${requestId}] Server error`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    });
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }
}

const port = parseInt(Deno.env.get("PORT") || "8000");
const rawApiUrl = Deno.env.get("API_BASE_URL");

log("INFO", "=".repeat(60));
log("INFO", "🚀 SoraDeno Server Starting");
log("INFO", "=".repeat(60));
log("INFO", `Server running on port ${port}`);
log("INFO", `API Base URL (raw): ${rawApiUrl || "not set (using default)"}`);
log("INFO", `API Base URL (processed): ${API_BASE_URL}`);
log("INFO", `API Key configured: ${API_KEY ? "Yes (length: " + API_KEY.length + ")" : "No"}`);
log("INFO", `Environment: ${Deno.env.get("DENO_DEPLOYMENT_ID") ? "Deno Deploy" : "Local"}`);

// Validate URL
if (!API_BASE_URL.endsWith("/v1")) {
  log("WARN", "⚠️  API_BASE_URL does not end with /v1, this may cause issues!");
}
if (!API_BASE_URL.startsWith("http")) {
  log("ERROR", "❌ API_BASE_URL does not start with http/https!");
}

log("INFO", "=".repeat(60));

serve(handler, { port });
