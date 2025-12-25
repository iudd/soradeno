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