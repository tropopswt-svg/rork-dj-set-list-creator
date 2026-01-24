/**
 * Vercel serverless function entry point
 * This file is required for Vercel to recognize the API route
 */

import app from "../backend/hono";

// Vercel serverless function handler
export default async function handler(req: Request): Promise<Response> {
  return app.fetch(req);
}
