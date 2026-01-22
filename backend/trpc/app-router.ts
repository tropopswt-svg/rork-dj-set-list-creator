import { createTRPCRouter } from "./create-context";
import { scraperRouter } from "./routes/scraper";

export const appRouter = createTRPCRouter({
  scraper: scraperRouter,
});

export type AppRouter = typeof appRouter;
