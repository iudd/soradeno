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
  console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
  await next();
});

// API Routes

// Health check endpoint
router.get("/health", async (ctx) => {
  ctx.response.body = { status: "ok", timestamp: new Date().toISOString() };
});

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
    console.error("获取记录失败:", err);
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
    console.error("获取待生成任务失败:", err);
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
    console.error("获取任务失败:", err);
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
    console.error("获取图片URL失败:", err);
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

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Default route - serve index.html with API_BASE injection
app.use(async (ctx) => {
  const { pathname } = ctx.request.url;
  
  // Inject API_BASE into index.html
  if (pathname === "/" || pathname === "") {
    try {
      let indexHtml = await Deno.readTextFile(`${Deno.cwd()}/index.html`);
      
      // Replace API_BASE with current server origin (for API calls to this server)
      const currentOrigin = `https://${ctx.request.url.host}`;
      console.log(`Injecting API_BASE: ${currentOrigin}`);
      
      // Match the exact line with indentation from HTML
      indexHtml = indexHtml.replace(
        /        const API_BASE = window\.location\.origin;/g,
        `        const API_BASE = "${currentOrigin}";`
      );
      
      ctx.response.body = indexHtml;
      ctx.response.type = "text/html";
    } catch (error) {
      console.error("Error reading index.html:", error);
      ctx.response.status = 404;
      ctx.response.body = "index.html not found";
    }
  } else {
    // Serve other static files normally
    try {
      await send(ctx, pathname, {
        root: `${Deno.cwd()}`,
      });
    } catch (error) {
      console.error("Error serving static file:", error);
      ctx.response.status = 404;
      ctx.response.body = "File not found";
    }
  }
});

// Start the server
const port = parseInt(Deno.env.get("PORT") || "8000");
const API_BASE_URL = Deno.env.get("API_BASE_URL");
const API_KEY = Deno.env.get("API_KEY");

console.log(`Server running on http://localhost:${port}`);
console.log("API Configuration:");
console.log(`  - API_BASE_URL: ${API_BASE_URL || "未设置"}`);
console.log(`  - API_KEY: ${API_KEY ? API_KEY.slice(0, 10) + "..." : "未设置"}`);

await app.listen({ port });

// Helper function to serve static files
async function send(ctx: any, pathname: string, options: any) {
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
async function sendFile(ctx: any, filePath: string, options: any) {
  const fileInfo = await Deno.stat(filePath);
  const file = await Deno.open(filePath);
  
  ctx.response.body = file.readable;
  
  // Set MIME type based on file extension
  const ext = filePath.split('.').pop();
  const types: Record<string, string> = {
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
  
  ctx.response.type = types[ext!] || "application/octet-stream";
  ctx.response.headers.set("Content-Length", fileInfo.size.toString());
  
  // Add cache control for static assets
  if (ext !== "html") {
    ctx.response.headers.set("Cache-Control", "max-age=3600");
  }
}

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
    // Try different API formats - first try the direct Sora API format
    console.log("Trying Sora API format...");
    
    const soraRequestBody = {
      prompt: task.prompt,
      ...(task.soraImage && { image_url: task.soraImage }),
      ...(task.model && { model: task.model })
    };
    
    console.log("Sora API request body:", JSON.stringify(soraRequestBody, null, 2));
    
    let response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(soraRequestBody)
    });
    
    // If Sora API format fails, try OpenAI chat completions format
    if (!response.ok) {
      console.log("Sora API format failed, trying OpenAI chat format...");
      
      const messages = [];
      if (task.soraImage) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: task.prompt },
            { type: "image_url", image_url: { url: task.soraImage } }
          ]
        });
      } else {
        messages.push({
          role: "user",
          content: task.prompt
        });
      }

      const chatRequestBody = {
        model: task.model || "sora-video-landscape-10s",
        messages: messages,
        stream: true
      };

      console.log("Chat API request body:", JSON.stringify(chatRequestBody, null, 2));
      
      response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify(chatRequestBody)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API call failed:", response.status, errorText);
      throw new Error(`API调用失败: HTTP ${response.status}: ${errorText}`);
    }

    // Try to parse as JSON first (for direct API responses)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      console.log("JSON response:", data);
      
      // Check for direct video URL in JSON response
      const videoUrl = data.video_url || data.url || data.video || data.result;
      if (videoUrl) {
        console.log("Found video URL in JSON response:", videoUrl);
        return { videoUrl };
      }
    }

    // If not JSON or no URL found, process as streaming response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '', videoUrl = null, allContent = '';

    console.log("Processing streaming response...");

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
            allContent += content;
            
            console.log("Received content chunk:", content);
            
            // Extract URLs from content
            if (content) {
              const urls = content.match(/https?:\/\/[^\s<>"']+/g);
              if (urls) {
                for (const url of urls) {
                  if (url.match(/\.(mp4|webm|mov|avi|m3u8|ts)(\?|$)/i) || 
                      url.includes('video') || 
                      url.includes('media') ||
                      url.includes('cdn')) {
                    videoUrl = url;
                    console.log("Found video URL:", videoUrl);
                    break;
                  }
                }
              }
            }
          } catch (e) {
            // If not valid JSON, treat as plain text
            allContent += line;
            console.log("Received plain text:", line);
            
            const urls = line.match(/https?:\/\/[^\s<>"']+/g);
            if (urls) {
              for (const url of urls) {
                if (url.match(/\.(mp4|webm|mov|avi|m3u8|ts)(\?|$)/i) || 
                    url.includes('video') || 
                    url.includes('media') ||
                    url.includes('cdn')) {
                  videoUrl = url;
                  console.log("Found video URL in plain text:", videoUrl);
                  break;
                }
              }
            }
          }
        } else if (line.trim()) {
          // Handle non-SSE responses
          allContent += line;
          console.log("Received line:", line);
          
          const urls = line.match(/https?:\/\/[^\s<>"']+/g);
          if (urls) {
            for (const url of urls) {
              if (url.match(/\.(mp4|webm|mov|avi|m3u8|ts)(\?|$)/i) || 
                  url.includes('video') || 
                  url.includes('media') ||
                  url.includes('cdn')) {
                videoUrl = url;
                console.log("Found video URL in line:", videoUrl);
                break;
              }
            }
          }
        }
      }
      
      if (videoUrl) break;
    }

    // Final check on all collected content
    if (!videoUrl) {
      console.error("No video URL found. Full response content:");
      console.error(allContent.slice(-1000));
      
      // Try to find any video URL in the entire content
      const allUrls = allContent.match(/https?:\/\/[^\s<>"']*\.(?:mp4|webm|mov|avi|m3u8|ts)[^\s<>"']*/gi);
      if (allUrls && allUrls.length > 0) {
        videoUrl = allUrls[0];
        console.log("Found video URL with final search:", videoUrl);
      }
    }
    
    if (!videoUrl) {
      throw new Error(`API响应中未找到视频URL。响应内容: ${allContent.slice(-500)}`);
    }
    
    console.log("Final video URL:", videoUrl);
    return { videoUrl };
    
  } catch (error) {
    console.error("Video generation API error:", error);
    throw error;
  }
}