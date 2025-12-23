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
function log(level: string, requestId: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? ` | Data: ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] [${level}] [${requestId}] ${message}${logData}`);
}

// Read index.html content
const indexHtml = await Deno.readTextFile("./index.html");

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const requestId = crypto.randomUUID().slice(0, 8);

  // Log incoming request
  log("INFO", requestId, `${req.method} ${url.pathname}`);

  // Handle CORS
  if (req.method === "OPTIONS") {
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
        feishu_configured: feishuService.isConfigured(),
        timestamp: new Date().toISOString(),
      };
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

      log("INFO", requestId, "Chat completion request", {
        model: body.model,
        stream: body.stream,
      });

      const requestBody = {
        ...body,
        stream: body.stream !== false,
      };

      const backendUrl = `${API_BASE_URL}/chat/completions`;
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
      log("INFO", requestId, `Backend response: ${response.status} (${duration}ms)`);

      if (!response.ok) {
        const error = await response.text();
        log("ERROR", requestId, "Backend API error", { error: error.slice(0, 200) });
        return new Response(error, {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }

      if (requestBody.stream && response.body) {
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
      return new Response(JSON.stringify(data), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Models endpoint
    if (url.pathname === "/v1/models" && req.method === "GET") {
      const models = {
        object: "list",
        data: [
          { id: "sora-image", object: "model", owned_by: "sora2mb" },
          { id: "sora-image-landscape", object: "model", owned_by: "sora2mb" },
          { id: "sora-image-portrait", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-10s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-15s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-landscape-10s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-landscape-15s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-portrait-10s", object: "model", owned_by: "sora2mb" },
          { id: "sora-video-portrait-15s", object: "model", owned_by: "sora2mb" },
        ],
      };
      return new Response(JSON.stringify(models), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // ==================== Feishu API endpoints ====================

    // 获取飞书配置状态
    if (url.pathname === "/api/feishu/status" && req.method === "GET") {
      return new Response(JSON.stringify({
        configured: feishuService.isConfigured(),
        message: feishuService.isConfigured() ? "飞书已配置" : "飞书未配置"
      }), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // 获取所有记录（用于页面显示）
    if (url.pathname === "/api/feishu/records" && req.method === "GET") {
      log("INFO", requestId, "Fetching all Feishu records");

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
        const records = await feishuService.getAllRecords();
        const parsedRecords = records.map(record => feishuService.parseTaskRecord(record));

        log("INFO", requestId, `Found ${parsedRecords.length} records`);

        return new Response(JSON.stringify({
          success: true,
          count: parsedRecords.length,
          records: parsedRecords
        }), {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        log("ERROR", requestId, "Failed to fetch records", {
          error: error instanceof Error ? error.message : String(error)
        });
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "获取记录失败"
        }), {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }
    }

    // 获取待生成任务列表
    if (url.pathname === "/api/feishu/tasks" && req.method === "GET") {
      log("INFO", requestId, "Fetching Feishu pending tasks");

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

        log("INFO", requestId, `Found ${parsedTasks.length} pending tasks`);

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
        log("ERROR", requestId, "Failed to fetch tasks", {
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
      log("INFO", requestId, `Generating video for task ${recordId}`);

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

        log("INFO", requestId, `Task: ${parsedTask.prompt.slice(0, 50)}...`);

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
          await feishuService.updateTaskStatus(recordId!, "成功", videoUrl);
          log("INFO", requestId, "Video generated successfully");

          return new Response(JSON.stringify({
            success: true,
            videoUrl: videoUrl,
            task: {
              recordId: parsedTask.recordId,
              prompt: parsedTask.prompt.slice(0, 100),
              model: parsedTask.model
            }
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
        log("ERROR", requestId, "Failed to generate video", {
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

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    log("ERROR", requestId, "Server error", {
      message: error instanceof Error ? error.message : String(error),
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

console.log("=".repeat(50));
console.log("🚀 SoraDeno Server Starting");
console.log(`   Port: ${port}`);
console.log(`   Feishu: ${feishuService.isConfigured() ? "Configured" : "Not configured"}`);
console.log("=".repeat(50));

serve(handler, { port });
