/**
 * Vercel serverless function entry point
 * This file is required for Vercel to recognize the API route
 */

import app from "../backend/hono";

// Vercel serverless function handler
// Convert Vercel's Node.js request/response to Fetch API for Hono
export default async function handler(req: any, res: any) {
  try {
    // Get the full URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost';
    const path = req.url || '/';
    const url = `${protocol}://${host}${path}`;

    // Convert headers
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value && key !== 'host') {
        headers.set(key, Array.isArray(value) ? value[0] : String(value));
      }
    });

    // Handle request body
    let body: string | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        // If body is already a string, use it; otherwise stringify
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    // Create Fetch API Request
    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    // Call Hono app
    const response = await app.fetch(request);

    // Convert Fetch Response back to Vercel format
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Set headers
    res.set(responseHeaders);

    // Get response body
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      res.status(response.status).json(json);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
