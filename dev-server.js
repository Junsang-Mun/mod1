#!/usr/bin/env bun

// Development server using Bun.serve()
const server = Bun.serve({
  port: 8000,
  development: true,
  
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Serve index.html for root path
    if (path === "/" || path === "/index.html") {
      return new Response(Bun.file("index.html"));
    }
    
    // Serve static files
    try {
      const file = Bun.file(path.slice(1)); // Remove leading slash
      if (await file.exists()) {
        return new Response(file);
      }
    } catch (error) {
      console.error(`Error serving file ${path}:`, error);
    }
    
    // 404 for not found
    return new Response("Not Found", { status: 404 });
  },
  
  error(error) {
    console.error("Server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

console.log(`🚀 Development server running at http://localhost:${server.port}`);
console.log(`📁 Serving files from: ${process.cwd()}`);
console.log(`🔄 Hot reload enabled`);
console.log(`Press Ctrl+C to stop the server`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  server.stop();
  process.exit(0);
}); 