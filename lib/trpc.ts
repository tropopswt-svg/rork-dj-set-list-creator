import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // In React Native/Expo, environment variables are available at build time
  // Make sure to restart Expo after changing .env file
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.warn("EXPO_PUBLIC_RORK_API_BASE_URL is not set, using localhost fallback");
    return "http://localhost:3001";
  }

  return url;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: (url, options) => {
        // Add better error handling for network issues
        return fetch(url, options).catch((error) => {
          console.error("tRPC fetch error:", error);
          throw error;
        });
      },
    }),
  ],
});
