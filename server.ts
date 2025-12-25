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
    // Prepare request body for Sora API using chat completions format
    const messages = [];

    if (task.soraImage) {
      // If there's an image, include it in the message
      messages.push({
        role: "user",
        content: [
          { type: "text", text: task.prompt },
          { type: "image_url", image_url: { url: task.soraImage } }
        ]
      });
    } else {
      // Text-only message
      messages.push({
        role: "user",
        content: task.prompt
      });
    }

    const requestBody = {
      model: task.model || "sora-video-landscape-10s",
      messages: messages,
      stream: true
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
    let buffer = '', videoUrl = null, allContent = '';

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
            
            // More flexible URL extraction logic
            if (content) {
              // Look for various URL patterns
              const urlPatterns = [
                // Standard video URLs
                /https?:\/\/[^\s<>"']*\.(?:mp4|webm|mov|avi|m3u8|ts)[^\s<>"']*/gi,
                // URLs containing video keywords
                /https?:\/\/[^\s<>"']*(?:video|media|cdn|storage)[^\s<>"']*\.(?:mp4|webm|mov|avi|m3u8|ts)[^\s<>"']*/gi,
                // Any HTTPS URL that might be a video
                /https?:\/\/[^\s<>"']+/g,
                // Relative URLs that might be videos
                /(?:^|[^a-zA-Z0-9])(\/[^\s<>"']*\.(?:mp4|webm|mov|avi)[^\s<>"']*)/g
              ];
              
              for (const pattern of urlPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                  for (const match of matches) {
                    let fullUrl = match.trim();
                    // Remove any leading non-URL characters
                    fullUrl = fullUrl.replace(/^[^a-zA-Z0-9]*https?:\/\//, (prefix) => {
                      return prefix.replace(/[^https?:/]/g, '');
                    });
                    
                    // Ensure it starts with http
                    if (!fullUrl.startsWith('http')) {
                      if (fullUrl.startsWith('//')) {
                        fullUrl = 'https:' + fullUrl;
                      } else if (fullUrl.startsWith('/')) {
                        fullUrl = 'https://' + API_BASE.split('://')[1].split('/')[0] + fullUrl;
                      } else {
                        fullUrl = 'https://' + fullUrl;
                      }
                    }
                    
                    // Check if it looks like a video URL
                    if (fullUrl.match(/\.(mp4|webm|mov|avi|m3u8|ts)(\?|$)/i) || 
                        fullUrl.includes('video') || 
                        fullUrl.includes('media') ||
                        fullUrl.includes('cdn') ||
                        fullUrl.includes('storage')) {
                      videoUrl = fullUrl;
                      console.log("Found potential video URL:", videoUrl);
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
    
    // If no video URL found, log the entire response for debugging
    if (!videoUrl) {
      console.error("No video URL found in response. Full response content:");
      console.error(allContent.slice(-1000)); // Last 1000 chars
      
      // Try one more time with a broader pattern on the full content
      const broadPattern = /https?:\/\/[^\s<>"']*\.(?:mp4|webm|mov|avi|m3u8|ts)[^\s<>"']*/gi;
      const broadMatches = allContent.match(broadPattern);
      if (broadMatches && broadMatches.length > 0) {
        videoUrl = broadMatches[0];
        console.log("Found video URL with broad pattern:", videoUrl);
      }
    }
    
    if (!videoUrl) {
      console.error("Available URL patterns found in response:");
      const allUrls = allContent.match(/https?:\/\/[^\s<>"']+/g) || [];
      console.error(allUrls.slice(-5)); // Last 5 URLs found
      
      throw new Error(`API响应中未找到视频URL。响应内容预览: ${allContent.slice(-200)}`);
    }
    
    console.log("Final video URL:", videoUrl);
    return { videoUrl };
    
  } catch (error) {
    console.error("Video generation API error:", error);
    throw error;
  }
}