import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { FeishuService } from "./feishu.ts";

let API_BASE_URL = Deno.env.get("API_BASE_URL") || "https://iyougame-soarmb.hf.space/v1";
API_BASE_URL = API_BASE_URL.replace(/\/$/, "");
if (!API_BASE_URL.endsWith("/v1")) API_BASE_URL = `${API_BASE_URL}/v1`;

const API_KEY = Deno.env.get("API_KEY") || "han1234";
const feishuService = new FeishuService();

function log(level: string, id: string, msg: string, data?: any) {
  console.log(`[${new Date().toISOString()}] [${level}] [${id}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}`);
}

const indexHtml = await Deno.readTextFile("./index.html");
let feishuJs = "";
try { feishuJs = await Deno.readTextFile("./feishu-frontend.js"); } catch (e) { console.log("feishu-frontend.js not found"); }

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
    });
  }

  try {
    // 静态文件
    if (url.pathname === "/" && req.method === "GET") {
      return new Response(indexHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    
    if (url.pathname === "/feishu-frontend.js" && req.method === "GET") {
      return new Response(feishuJs, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
    }

    // Health
    if (url.pathname === "/health" && req.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", feishu_configured: feishuService.isConfigured(), timestamp: new Date().toISOString() }), {
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    // Chat completions
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const body = await req.json();
      log("INFO", id, "Chat completion", { model: body.model });
      
      const res = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
        body: JSON.stringify({ ...body, stream: body.stream !== false }),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(err, { status: res.status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }

      if (body.stream !== false && res.body) {
        return new Response(res.body, { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      }

      return new Response(JSON.stringify(await res.json()), { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
    }

    // Models
    if (url.pathname === "/v1/models" && req.method === "GET") {
      const models = { object: "list", data: [
        { id: "sora-image", object: "model", owned_by: "sora2mb" },
        { id: "sora-image-landscape", object: "model", owned_by: "sora2mb" },
        { id: "sora-image-portrait", object: "model", owned_by: "sora2mb" },
        { id: "sora-video-10s", object: "model", owned_by: "sora2mb" },
        { id: "sora-video-15s", object: "model", owned_by: "sora2mb" },
        { id: "sora-video-landscape-10s", object: "model", owned_by: "sora2mb" },
        { id: "sora-video-landscape-15s", object: "model", owned_by: "sora2mb" },
        { id: "sora-video-portrait-10s", object: "model", owned_by: "sora2mb" },
        { id: "sora-video-portrait-15s", object: "model", owned_by: "sora2mb" },
      ]};
      return new Response(JSON.stringify(models), { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
    }

    // Feishu status
    if (url.pathname === "/api/feishu/status" && req.method === "GET") {
      return new Response(JSON.stringify({ configured: feishuService.isConfigured(), message: feishuService.isConfigured() ? "飞书已配置" : "飞书未配置" }), {
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    // Feishu records
    if (url.pathname === "/api/feishu/records" && req.method === "GET") {
      log("INFO", id, "Fetching Feishu records");
      if (!feishuService.isConfigured()) {
        return new Response(JSON.stringify({ error: "飞书未配置" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }
      try {
        const records = await feishuService.getAllRecords();
        const parsed = records.map(r => feishuService.parseTaskRecord(r));
        log("INFO", id, `Found ${parsed.length} records`);
        return new Response(JSON.stringify({ success: true, count: parsed.length, records: parsed }), { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      } catch (e) {
        log("ERROR", id, "Fetch records failed", { error: e instanceof Error ? e.message : String(e) });
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "获取失败" }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }
    }

    // Feishu tasks (pending only)
    if (url.pathname === "/api/feishu/tasks" && req.method === "GET") {
      log("INFO", id, "Fetching pending tasks");
      if (!feishuService.isConfigured()) {
        return new Response(JSON.stringify({ error: "飞书未配置" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }
      try {
        const tasks = await feishuService.getPendingTasks();
        const parsed = tasks.map(t => feishuService.parseTaskRecord(t));
        return new Response(JSON.stringify({ tasks: parsed, count: parsed.length }), { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "获取失败" }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }
    }

    // Generate video
    if (url.pathname.startsWith("/api/feishu/generate/") && req.method === "POST") {
      const recordId = url.pathname.split("/").pop()!;
      log("INFO", id, `Generating video for ${recordId}`);

      if (!feishuService.isConfigured()) {
        return new Response(JSON.stringify({ error: "飞书未配置" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }

      try {
        const task = await feishuService.getTask(recordId);
        const parsed = feishuService.parseTaskRecord(task);
        log("INFO", id, `Task: ${parsed.prompt.slice(0, 50)}...`);

        await feishuService.updateTaskStatus(recordId, "生成中");

        const res = await fetch(`${API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
          body: JSON.stringify({ model: parsed.model, messages: [{ role: "user", content: parsed.prompt }], stream: true }),
        });

        if (!res.ok) {
          const err = await res.text();
          await feishuService.updateTaskStatus(recordId, "失败", undefined, err);
          throw new Error(err);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '', videoUrl = null;

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
                  const match = content.match(/https?:\/\/[^\s\)]+/);
                  if (match) videoUrl = match[0];
                }
              } catch (e) {}
            }
          }
        }

        if (videoUrl) {
          await feishuService.updateTaskStatus(recordId, "成功", videoUrl);
          log("INFO", id, "Video generated", { videoUrl });
          return new Response(JSON.stringify({ success: true, videoUrl, task: { recordId, prompt: parsed.prompt.slice(0, 100), model: parsed.model } }), {
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          });
        } else {
          await feishuService.updateTaskStatus(recordId, "失败", undefined, "未能提取视频URL");
          throw new Error("未能提取视频URL");
        }
      } catch (e) {
        log("ERROR", id, "Generate failed", { error: e instanceof Error ? e.message : String(e) });
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "生成失败" }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });

  } catch (e) {
    log("ERROR", id, "Server error", { error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
  }
}

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`🚀 SoraDeno Server on port ${port} | Feishu: ${feishuService.isConfigured() ? "Yes" : "No"}`);
serve(handler, { port });
