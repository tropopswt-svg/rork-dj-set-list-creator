// Vercel Serverless Function for tRPC
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../backend/trpc/app-router';
import { createContext } from '../../backend/trpc/create-context';

export const config = {
  maxDuration: 60,
};

export default async function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  });
}
