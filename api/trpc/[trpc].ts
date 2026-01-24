// Vercel Serverless Function for tRPC
// This handles all /api/trpc/* routes

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../backend/trpc/app-router.js';
import { createContext } from '../../backend/trpc/create-context.js';

export const config = {
  runtime: 'nodejs20.x',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Convert Vercel request to fetch Request
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = new URL(req.url!, `${protocol}://${host}`);
    
    // Create fetch-compatible request
    const body = req.method !== 'GET' && req.method !== 'HEAD' && req.body 
      ? JSON.stringify(req.body) 
      : undefined;
      
    const fetchRequest = new Request(url.toString(), {
      method: req.method!,
      headers: req.headers as HeadersInit,
      body,
    });

    // Handle with tRPC
    const response = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req: fetchRequest,
      router: appRouter,
      createContext,
    });

    // Send response
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const responseBody = await response.text();
    res.send(responseBody);
  } catch (error: any) {
    console.error('tRPC handler error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }
}
