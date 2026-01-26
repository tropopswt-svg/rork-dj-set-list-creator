import { createTRPCRouter } from "./create-context";
import { scraperRouter } from "./routes/scraper";
import { gapAnalysisRouter } from "./routes/gap-analysis";

export const appRouter = createTRPCRouter({
  scraper: scraperRouter,
  gapAnalysis: gapAnalysisRouter,
});

export type AppRouter = typeof appRouter;
