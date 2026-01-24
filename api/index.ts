/**
 * Vercel serverless function entry point
 * This file is required for Vercel to recognize the API route
 */

import app from "../backend/hono";

// Vercel serverless function handler
// Hono works with Vercel's Node.js runtime using the handle function
export default app;
