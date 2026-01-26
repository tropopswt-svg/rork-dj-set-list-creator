// tRPC API endpoint for Vercel Serverless Functions
// Uses dynamic imports to load TypeScript backend

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Dynamic import tRPC dependencies
    const { fetchRequestHandler } = await import('@trpc/server/adapters/fetch');
    const { appRouter } = await import('../backend/trpc/app-router.js');
    const { createContext } = await import('../backend/trpc/create-context.js');

    // Convert Vercel request to Fetch API Request for tRPC
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${protocol}://${host}${req.url}`;

    // Build headers
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    });

    // Get body for POST requests
    let body;
    if (req.method === 'POST' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // Create a Fetch API Request
    const fetchRequest = new Request(url, {
      method: req.method || 'GET',
      headers,
      body: body,
    });

    const response = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req: fetchRequest,
      router: appRouter,
      createContext,
    });

    // Get response body
    const responseBody = await response.text();

    // Set response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send response
    res.status(response.status).send(responseBody);
  } catch (error) {
    console.error('[tRPC] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
