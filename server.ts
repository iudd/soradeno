import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { FeishuService } from "./feishu.ts";

const app = new Application();
const router = new Router();

// Enable CORS
app.use(oakCors({
  origin: true,
}));

// Initialize Feishu service
const feishuService = new FeishuService();

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Server error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// Logger middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url}`);
  await next();
});

// API Routes

// Get all records
router.get("/api/feishu/records", async (ctx) => {
  try {
    if (!feishuService.isConfigured()) {
      ctx.response.status = 503;
      ctx.response.body = { error: "飞书服务未配置" };
      return;
    }
    
    const records = await feishuService.getAllRecords();
    const parsedRecords = records.map(record => feishuService.parseTaskRecord(record));
    
    ctx.response.body = { records: parsedRecords };
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// Get pending tasks
router.get("/api/feishu/tasks", async (ctx) => {
  try {
    if (!feishuService.isConfigured()) {
      ctx.response.status = 503;
      ctx.response.body = { error: "飞书服务未配置" };
      return;
    }
    
    const tasks = await feishuService.getPendingTasks();
    const parsedTasks = tasks.map(task => feishuService.parseTaskRecord(task));
    
    ctx.response.body = { tasks: parsedTasks };
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// Get a single task
router.get("/api/feishu/tasks/:recordId", async (ctx) => {
  try {
    const { recordId } = ctx.params;
    if (!recordId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "缺少记录ID" };
      return;
    }
    
    const task = await feishuService.getTask(recordId);
    const parsedTask = feishuService.parseTaskRecord(task);
    
    ctx.response.body = { task: parsedTask };
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// Get Sora image URL
router.get("/api/feishu/image/:imageToken", async (ctx) => {
  try {
    const { imageToken } = ctx.params;
    if (!imageToken) {
      ctx.response.status = 400;
      ctx.response.body = { error: "缺少图片Token" };
      return;
    }
    
    const imageUrl = await feishuService.getSoraImageUrl(imageToken);
    
    ctx.response.body = { imageUrl: imageUrl };
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// Generate a single task
router.post("/api/feishu/generate/:recordId", async (ctx) => {
  try {
    const { recordId } = ctx.params;
    if (!recordId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "缺少记录ID" };
      return;
    }
    
    // Get the task details
    const taskRecord = await feishuService.getTask(recordId);
    const task = feishuService.parseTaskRecord(taskRecord);
    
    // Update status to "生成中"
    await feishuService.updateTaskStatus(recordId, "生成中");
    
    // Call the appropriate API based on the generation type
    let response, mediaUrl;
    const generationType = task.generationType || "视频生成";
    
    if (generationType === "图片生成") {
      // Call image generation API
      response = await callImageGenerationAPI(task);
      mediaUrl = response.imageUrl;
    } else {
      // Call video generation API (default)
      response = await callVideoGenerationAPI(task);
      mediaUrl = response.videoUrl;
    }
    
    // Update the task with the result
    if (mediaUrl) {
      if (generationType === "图片生成") {
        await feishuService.updateTaskStatus(recordId, "成功", undefined, mediaUrl);
      } else {
        await feishuService.updateTaskStatus(recordId, "成功", mediaUrl, undefined);
      }
    } else {
      await feishuService.updateTaskStatus(recordId, "失败", undefined, undefined, "生成失败：未返回媒体URL");
    }
    
    // Return the result
    ctx.response.body = {
      success: true,
      generationType: generationType,
      ...(mediaUrl && { [generationType === "图片生成" ? "imageUrl" : "videoUrl"]: mediaUrl })
    };
  } catch (err) {
    console.error("Generation error:", err);
    
    // Update the task status to failed
    try {
      await feishuService.updateTaskStatus(ctx.params.recordId, "失败", undefined, undefined, err.message);
    } catch (updateErr) {
      console.error("Failed to update task status:", updateErr);
    }
    
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// Check Feishu status
router.get("/api/feishu/status", async (ctx) => {
  ctx.response.body = {
    configured: feishuService.isConfigured(),
    configStatus: feishuService.getConfigStatus()
  };
});

// Image generation API call
async function callImageGenerationAPI(task: any) {
  // Get API configuration from environment variables
  const API_BASE = Deno.env.get("API_BASE_URL") || "https://api.example.com";
  const API_KEY = Deno.env.get("API_KEY");
  
  if (!API_KEY) {
    throw new Error("API_KEY环境变量未设置");
  }
  
  console.log("Generating image for task:", task);
  console.log("Using API endpoint:", API_BASE);
  
  try {
    // Prepare request body for Image Generation API
    const requestBody = {
      model: task.model || "dall-e-3",
      prompt: task.prompt,
      size: "1024x1024"
    };
    
    console.log("API request body:", JSON.stringify(requestBody, null, 2));
    
    // Call image generation API
    const response = await fetch(`${API_BASE}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API call failed:", response.status, errorText);
      throw new Error(`API调用失败: HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extract image URL from response
    const imageUrl = data.data?.[0]?.url || data.url;
    
    if (!imageUrl) {
      console.error("API response:", JSON.stringify(data, null, 2));
      throw new Error("API响应中未找到图片URL");
    }
    
    console.log("Generated image URL:", imageUrl);
    
    return { imageUrl };
    
  } catch (error) {
    console.error("Image generation API error:", error);
    throw error;
  }
}

// Video generation API call
async function callVideoGenerationAPI(task: any) {
  // Get API configuration from environment variables
  const API_BASE = Deno.env.get("API_BASE_URL") || "https://api.example.com";
  const API_KEY = Deno.env.get("API_KEY");
  
  if (!API_KEY) {
    throw new Error("API_KEY环境变量未设置");
  }
  
  console.log("Generating video for task:", task);
  console.log("Using API endpoint:", API_BASE);
  
  try {
    // Prepare request body for Sora API
    const requestBody = {
      model: task.model || "sora-video-landscape-10s",
      prompt: task.prompt,
      ...(task.soraImage && { 
        image_url: task.soraImage 
      })
    };
    
    console.log("API request body:", JSON.stringify(requestBody, null, 2));
    
    // Call the video generation API
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API call failed:", response.status, errorText);
      throw new Error(`API调用失败: HTTP ${response.status}: ${errorText}`);
    }
    
    // Process the streaming response to extract video URL
    const reader = response.body!.getReader();
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
            
            // URL extraction logic for video URLs
            if (content) {
              const urlPatterns = [
                /https?:\/\/[^\s<>"']+/g,
                /(?:https?:\/\/)?[^\s<>"']*\.(?:mp4|webm|mov|avi)[^\s<>"']*/gi,
                /(?:https?:\/\/)?[^\s<>"']*(?:video|media|cdn)[^\s<>"']*\.(?:mp4|webm|mov|avi)[^\s<>"']*/gi
              ];
              
              for (const pattern of urlPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                  for (const match of matches) {
                    let fullUrl = match;
                    if (!fullUrl.startsWith('http')) {
                      fullUrl = 'https://' + fullUrl;
                    }
                    if (fullUrl.match(/\.(mp4|webm|mov|avi)(\?|$)/i) || 
                        fullUrl.includes('video') || 
                        fullUrl.includes('media') ||
                        fullUrl.includes('cdn')) {
                      videoUrl = fullUrl;
                      console.log("Found video URL:", videoUrl);
                      break;
                    }
                  }
                  if (videoUrl) break;
                }
              }
            }
          } catch (e) {
            console.error("Parse error:", { data: data.slice(0, 100) });
          }
        }
      }
    }
    
    if (!videoUrl) {
      throw new Error("API响应中未找到视频URL");
    }
    
    return { videoUrl };
    
  } catch (error) {
    console.error("Video generation API error:", error);
    throw error;
  }
}

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Default route - serve index.html with API_BASE injection
app.use(async (ctx) => {
  const { pathname } = ctx.request.url;
  
  // Inject API_BASE into index.html
  if (pathname === "/" || pathname === "") {
    let indexHtml = await Deno.readTextFile(`${Deno.cwd()}/index.html`);
    
    // Replace API_BASE with environment variable or fallback to current origin
    const apiUrl = Deno.env.get("API_BASE_URL") || `https://${ctx.request.url.host}`;
    indexHtml = indexHtml.replace(
      "const API_BASE = window.location.origin;",
      `const API_BASE = "${apiUrl}";`
    );
    
    ctx.response.body = indexHtml;
    ctx.response.type = "text/html";
  } else {
    // Serve other static files normally
    await send(ctx, pathname, {
      root: `${Deno.cwd()}`,
    });
  }
});

// Start the server
const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server running on http://localhost:${port}`);

await app.listen({ port });

// Helper function to serve static files
async function send(ctx, pathname, options) {
  const filePath = pathname === "/" ? "/index.html" : pathname;
  
  try {
    const fullPath = options.root + filePath;
    const fileInfo = await Deno.stat(fullPath);
    
    if (fileInfo.isDirectory) {
      // If it's a directory, try to serve index.html
      const indexPath = fullPath.endsWith("/") ? fullPath + "index.html" : fullPath + "/index.html";
      await sendFile(ctx, indexPath, { ...options, isIndexPath: true });
    } else {
      // It's a file, serve it directly
      await sendFile(ctx, fullPath, options);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      // Default to index.html for SPA routing
      await sendFile(ctx, options.root + "/index.html", { ...options, isIndexPath: true });
    } else {
      throw e;
    }
  }
}

// Function to send a file
async function sendFile(ctx, filePath, options) {
  const fileInfo = await Deno.stat(filePath);
  const file = await Deno.open(filePath);
  
  ctx.response.body = file.readable;
  
  // Set MIME type based on file extension
  const ext = filePath.split('.').pop();
  const types = {
    "html": "text/html",
    "js": "application/javascript",
    "css": "text/css",
    "json": "application/json",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "ico": "image/x-icon"
  };
  
  ctx.response.type = types[ext] || "application/octet-stream";
  ctx.response.headers.set("Content-Length", fileInfo.size.toString());
  
  // Add cache control for static assets
  if (ext !== "html") {
    ctx.response.headers.set("Cache-Control", "max-age=3600");
  }
}

// Function to get MIME type based on file extension
function getType(pathname) {
  const ext = pathname.split('.').pop();
  const types = {
    "html": "text/html",
    "js": "application/javascript",
    "css": "text/css",
    "json": "application/json",
    "png": "image/png",
    "jpg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "ico": "image/x-icon"
  };
  return types[ext] || "application/octet-stream";
}