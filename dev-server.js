#!/usr/bin/env bun

// Development server using Bun.serve() with TypeScript support
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
    
    // Serve static files with TypeScript support
    try {
      let filePath = path.slice(1); // Remove leading slash
      
          // Handle TypeScript files
    if (filePath.endsWith('.ts')) {
      // For TypeScript files, we'll serve them as JavaScript
      // Bun will automatically transpile them
      const tsFile = Bun.file(filePath);
      if (await tsFile.exists()) {
        try {
          // Read and transpile TypeScript to JavaScript
          const content = await tsFile.text();
          
          // Use Bun's built-in TypeScript support
          const transpiled = await Bun.build({
            entrypoints: [filePath],
            target: "browser",
            format: "esm",
            sourcemap: "none"
          });
          
          if (transpiled.success) {
            const output = await transpiled.outputs[0].text();
            return new Response(output, {
              headers: {
                "Content-Type": "application/javascript",
                "Cache-Control": "no-cache"
              }
            });
          } else {
            throw new Error("Build failed");
          }
        } catch (error) {
          console.error(`Error transpiling ${filePath}:`, error);
          return new Response(`Error transpiling TypeScript: ${error.message}`, { status: 500 });
        }
      }
    }
      
      // Handle regular files
      const file = Bun.file(filePath);
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
console.log(`⚡ TypeScript support enabled`);
console.log(`Press Ctrl+C to stop the server`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  server.stop();
  process.exit(0);
}); 