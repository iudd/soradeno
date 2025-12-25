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
    // Priority 1: OpenAI chat completions format (Requested by user)
    console.log("Trying OpenAI chat completions format (Priority 1)...");
    
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
    
    let response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(chatRequestBody)
    });
    
    // Priority 2: Sora API format (Fallback)
    if (!response.ok) {
      console.log(`Chat format failed (HTTP ${response.status}), trying Sora API format (Priority 2)...`);
      
      const soraRequestBody = {
        prompt: task.prompt,
        ...(task.soraImage && { image_url: task.soraImage }),
        ...(task.model && { model: task.model })
      };
      
      console.log("Sora API request body:", JSON.stringify(soraRequestBody, null, 2));
      
      response = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify(soraRequestBody)
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