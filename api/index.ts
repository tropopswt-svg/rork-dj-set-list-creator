/**
 * Vercel serverless function entry point
 * Hono works with Vercel with zero configuration
 * Just export the app directly
 */

import app from "../backend/hono.js";

// Export the Hono app directly - Vercel handles the conversion automatically
export default app;
