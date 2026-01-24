import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from '../../backend/trpc/app-router.js';
import { createContext } from '../../backend/trpc/create-context.js';

// Create tRPC handler
const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract the tRPC path from the URL
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/trpc/', '');

  // Create a mock request object for tRPC
  const mockReq = {
    method: req.method,
    headers: req.headers,
    query: { ...req.query, trpc: path },
    body: req.body,
  };

  // Create a mock response object
  let statusCode = 200;
  let responseBody: any;
  const mockRes = {
    status: (code: number) => {
      statusCode = code;
      return mockRes;
    },
    json: (body: any) => {
      responseBody = body;
      return mockRes;
    },
    setHeader: (key: string, value: string) => {
      res.setHeader(key, value);
      return mockRes;
    },
    end: () => {
      return mockRes;
    },
  };

  try {
    // Handle the request using the standalone adapter approach
    // For Vercel, we need to manually process the tRPC request
    const { resolveHTTPResponse } = await import('@trpc/server/http');
    
    const httpResponse = await resolveHTTPResponse({
      router: appRouter,
      req: {
        method: req.method!,
        headers: req.headers as Record<string, string>,
        query: url.searchParams,
        body: req.body,
      },
      path,
      createContext: async () => createContext({ req: mockReq as any, res: mockRes as any }),
    });

    // Set response headers
    if (httpResponse.headers) {
      for (const [key, value] of Object.entries(httpResponse.headers)) {
        if (value) {
          res.setHeader(key, value);
        }
      }
    }

    // Send response
    res.status(httpResponse.status);
    if (httpResponse.body) {
      res.send(httpResponse.body);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('tRPC handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
