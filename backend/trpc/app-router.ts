import { createTRPCRouter } from "./create-context.js";
import { scraperRouter } from "./routes/scraper.js";
import { gapAnalysisRouter } from "./routes/gap-analysis.js";

export const appRouter = createTRPCRouter({
  scraper: scraperRouter,
  gapAnalysis: gapAnalysisRouter,
});

export type AppRouter = typeof appRouter;
