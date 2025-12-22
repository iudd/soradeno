import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Ensure API_BASE_URL always ends with /v1
let API_BASE_URL = Deno.env.get("API_BASE_URL") || "https://iyougame-soarmb.hf.space/v1";
// Remove trailing slash if present
API_BASE_URL = API_BASE_URL.replace(/\/$/, "");
// Ensure /v1 suffix
if (!API_BASE_URL.endsWith("/v1")) {
  API_BASE_URL = `${API_BASE_URL}/v1`;
}

const API_KEY = Deno.env.get("API_KEY") || "han1234";

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
