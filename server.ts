import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";

// JSONBin API configuration
const JSONBIN_API_KEY = Deno.env.get("JSONBIN_API_KEY") || "";
const JSONBIN_BIN_ID = Deno.env.get("JSONBIN_BIN_ID") || "";
const VIDEO_BIN_ID = Deno.env.get("VIDEO_BIN_ID") || "";

// JSONBin helper functions
async function readFromJsonBin(binId: string): Promise<any> {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: {
        "X-Master-Key": JSONBIN_API_KEY,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.record || {};
    }
    return {};
  } catch (error) {
    console.error("Error reading from JSONBin:", error);
    return {};
  }
}

async function writeToJsonBin(binId: string, data: any): Promise<boolean> {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY,
      },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error("Error writing to JSONBin:", error);
    return false;
  }
}

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const router = new Router();

// CORS middleware
router.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 200;
    return;
  }

  await next();
});

// Health check
router.get("/health", (ctx) => {
  ctx.response.body = { status: "ok", timestamp: new Date().toISOString() };
});

// OpenAI-compatible video generation endpoint
router.post("/v1/videos/generations", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { prompt, model = "sora", size = "1920x1080", duration = 5 } = body;

    if (!prompt) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: {
          message: "Prompt is required",
          type: "invalid_request_error",
        },
      };
      return;
    }

    // Generate video ID
    const videoId = generateId();

    // Simulate video generation (in real implementation, call actual video API)
    const videoUrl = `https://example.com/videos/${videoId}.mp4`;

    // Store video info in JSONBin
    const videos = await readFromJsonBin(VIDEO_BIN_ID);
    videos[videoId] = {
      id: videoId,
      prompt,
      model,
      size,
      duration,
      status: "completed",
      url: videoUrl,
      created_at: new Date().toISOString(),
    };
    await writeToJsonBin(VIDEO_BIN_ID, videos);

    ctx.response.body = {
      id: videoId,
      object: "video",
      created: Math.floor(Date.now() / 1000),
      model,
      data: [
        {
          url: videoUrl,
          revised_prompt: prompt,
        },
      ],
    };
  } catch (error) {
    console.error("Error generating video:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: {
        message: "Internal server error",
        type: "internal_error",
      },
    };
  }
});

// Get video status
router.get("/v1/videos/:videoId", async (ctx) => {
  try {
    const { videoId } = ctx.params;

    const videos = await readFromJsonBin(VIDEO_BIN_ID);
    const video = videos[videoId];

    if (!video) {
      ctx.response.status = 404;
      ctx.response.body = {
        error: {
          message: "Video not found",
          type: "not_found_error",
        },
      };
      return;
    }

    ctx.response.body = {
      id: video.id,
      object: "video",
      created: Math.floor(new Date(video.created_at).getTime() / 1000),
      model: video.model,
      status: video.status,
      data: [
        {
          url: video.url,
          revised_prompt: video.prompt,
        },
      ],
    };
  } catch (error) {
    console.error("Error getting video:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: {
        message: "Internal server error",
        type: "internal_error",
      },
    };
  }
});

// Configuration endpoints
router.get("/config", async (ctx) => {
  const config = await readFromJsonBin(JSONBIN_BIN_ID);
  ctx.response.body = config;
});

router.put("/config", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const success = await writeToJsonBin(JSONBIN_BIN_ID, body);
    if (success) {
      ctx.response.body = { success: true };
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to save configuration" };
    }
  } catch (error) {
    console.error("Error saving config:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

// Handle 404
app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = {
    error: {
      message: "Not found",
      type: "not_found_error",
    },
  };
});

console.log("🚀 SoraDeno server starting...");
console.log("📡 OpenAI-compatible API available at /v1/videos/generations");
console.log("🔧 Configuration endpoints at /config");

await app.listen({ port: 8000 });