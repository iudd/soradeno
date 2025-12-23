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
    const task = feishuService.parseTaskRecord(recordId);
    
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
  // This is a placeholder implementation
  // In a real scenario, you would call an image generation API (e.g., DALL-E, Midjourney)
  console.log("Generating image for task:", task);
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock response with a placeholder image URL
  return {
    imageUrl: "https://picsum.photos/seed/" + encodeURIComponent(task.prompt) + "/1024/1024.jpg"
  };
}

// Video generation API call
async function callVideoGenerationAPI(task: any) {
  // This is a placeholder implementation
  // In a real scenario, you would call a video generation API (e.g., Sora)
  console.log("Generating video for task:", task);
  
  // Check if there's a Sora image for reference
  if (task.soraImage) {
    console.log("Using Sora image for video generation:", task.soraImage);
    // In a real implementation, you would fetch the image URL and include it in the API call
    // await feishuService.getSoraImageUrl(task.soraImage);
  }
  
  // Simulate API call (longer for video generation with image reference)
  await new Promise(resolve => setTimeout(resolve, task.soraImage ? 7000 : 5000));
  
  // Mock response with a placeholder video URL
  return {
    videoUrl: "https://example.com/videos/" + task.recordId + ".mp4"
  };
}

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Default route - serve static files
app.use(async (ctx) => {
  await send(ctx, ctx.request.url.pathname, {
    root: `${Deno.cwd()}`,
  });
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