/**
 * Vercel serverless function entry point
 * This file is required for Vercel to recognize the API route
 */

import app from "../backend/hono";

// Vercel serverless function handler
// Convert Vercel's Node.js request/response to Fetch API for Hono
export default async function handler(req: any, res: any) {
  try {
    // Convert Vercel request to Fetch API Request
    const url = new URL(req.url || `https://${req.headers.host}${req.url}`);
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : String(value));
      }
    });

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Call Hono app
    const response = await app.fetch(request);

    // Convert Fetch Response back to Vercel format
    const body = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    res.status(response.status).set(responseHeaders).send(body);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
