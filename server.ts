import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const API_BASE_URL = Deno.env.get("API_BASE_URL") || "https://iyougame-soarmb.hf.space/v1";
const API_KEY = Deno.env.get("API_KEY") || "han1234";

// Read index.html content
const indexHtml = await Deno.readTextFile("./index.html");

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

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
      return new Response(JSON.stringify({
        status: "ok",
        api_base: API_BASE_URL,
        timestamp: new Date().toISOString(),
      }), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Chat completions endpoint - proxy to Sora2mb API
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const body = await req.json();

      // Ensure stream is enabled for Sora2mb
      const requestBody = {
        ...body,
        stream: body.stream !== false, // Default to true
      };

      const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Sora2mb API error:", error);
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
      return new Response(JSON.stringify(models), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error("Server error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message
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
console.log(`Server running on port ${port}`);
console.log(`API Base URL: ${API_BASE_URL}`);
console.log(`API Key configured: ${API_KEY ? "Yes" : "No"}`);

serve(handler, { port });
