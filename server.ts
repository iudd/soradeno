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
                
                // 改进URL提取逻辑
                if (content) {
                  // 更精确的URL匹配：http或https开头，包含域名和路径
                  const urlPatterns = [
                    /https?:\/\/[^\s<>"']+/g,  // 基本URL模式
                    /(?:https?:\/\/)?[^\s<>"']*\.(?:mp4|webm|mov|avi)[^\s<>"']*/gi,  // 视频文件扩展名
                    /(?:https?:\/\/)?[^\s<>"']*(?:video|media|cdn)[^\s<>"']*\.(?:mp4|webm|mov|avi)[^\s<>"']*/gi  // 包含video/media/cdn关键词的URL
                  ];
                  
                  for (const pattern of urlPatterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                      for (const match of matches) {
                        // 确保是完整的URL
                        let fullUrl = match;
                        if (!fullUrl.startsWith('http')) {
                          fullUrl = 'https://' + fullUrl;
                        }
                        // 检查是否看起来像视频URL
                        if (fullUrl.match(/\.(mp4|webm|mov|avi)(\?|$)/i) || 
                            fullUrl.includes('video') || 
                            fullUrl.includes('media') ||
                            fullUrl.includes('cdn')) {
                          videoUrl = fullUrl;
                          log("INFO", id, "Found video URL", { videoUrl });
                          break;
                        }
                      }
                      if (videoUrl) break;
                    }
                  }
                }
              } catch (e) {
                log("DEBUG", id, "Parse error", { data: data.slice(0, 100) });
              }
            }
          }
        }