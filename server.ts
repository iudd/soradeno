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
  }