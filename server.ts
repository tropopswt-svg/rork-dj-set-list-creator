/**
 * Standalone server to run the Hono backend
 * Run with: bun run server.ts
 * 
 * Also works with Vercel serverless functions
 */

import app from "./backend/hono";

// Vercel serverless function handler
export default app;

// For local development with Bun
if (typeof Bun !== "undefined") {
  const port = Number(process.env.PORT) || 3001;
  
  console.log(`🚀 Starting backend server on port ${port}...`);
  console.log(`📍 API endpoint: http://localhost:${port}/api/trpc`);
  console.log(`📍 Health check: http://localhost:${port}/`);

  Bun.serve({
    fetch: app.fetch,
    port: Number(port),
  });

  console.log(`✅ Backend server running at http://localhost:${port}`);
}
