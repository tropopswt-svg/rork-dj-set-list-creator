/**
 * Standalone server to run the Hono backend
 * Run with: bun run server.ts
 */

import { serve } from "bun";
import app from "./backend/hono";

const port = process.env.PORT || 3000;

console.log(`🚀 Starting backend server on port ${port}...`);
console.log(`📍 API endpoint: http://localhost:${port}/api/trpc`);
console.log(`📍 Health check: http://localhost:${port}/`);

serve({
  fetch: app.fetch,
  port: Number(port),
});

console.log(`✅ Backend server running at http://localhost:${port}`);
