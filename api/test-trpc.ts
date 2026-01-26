import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Test imports
    const { appRouter } = await import('../backend/trpc/app-router');
    const { createContext } = await import('../backend/trpc/create-context');

    res.status(200).json({
      success: true,
      message: 'tRPC imports successful',
      routerKeys: Object.keys(appRouter._def.procedures || {}),
    });
  } catch (error) {
    console.error('[test-trpc] Import error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
