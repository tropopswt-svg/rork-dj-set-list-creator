import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    name: 'DJ Set List Creator API',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      import: 'POST /api/import',
    },
  });
}
