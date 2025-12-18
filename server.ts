import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const API_BASE_URL = Deno.env.get("API_BASE_URL") || "https://api.openai.com/v1";
const API_KEY = Deno.env.get("API_KEY");

if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

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
    // Chat completions endpoint
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const body = await req.json();

      const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("OpenAI API error:", error);
        return new Response(error, {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
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

    // Image generations endpoint (for Sora-like video generation)
    if (url.pathname === "/v1/images/generations" && req.method === "POST") {
      const body = await req.json();

      // For Sora-like functionality, you might need to use DALL-E or other image APIs
      // Since Sora API is not publicly available, using DALL-E as fallback
      const imageBody = {
        prompt: body.prompt || "A beautiful landscape",
        n: body.n || 1,
        size: body.size || "1024x1024",
        model: "dall-e-3",
      };

      const response = await fetch(`${API_BASE_URL}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(imageBody),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("OpenAI API error:", error);
        return new Response(error, {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }

      const data = await response.json();

      // Transform response to include video-like metadata if needed
      const transformedData = {
        ...data,
        note: "Using DALL-E as Sora API is not publicly available",
      };

      return new Response(JSON.stringify(transformedData), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      return new Response(JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        api_base_url: API_BASE_URL,
      }), {
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