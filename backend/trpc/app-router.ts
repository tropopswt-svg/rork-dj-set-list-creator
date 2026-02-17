import { createTRPCRouter } from "./create-context";
import { scraperRouter } from "./routes/scraper";
import { gapAnalysisRouter } from "./routes/gap-analysis";
import { artistsRouter } from "./routes/artists";

export const appRouter = createTRPCRouter({
  scraper: scraperRouter,
  gapAnalysis: gapAnalysisRouter,
  artists: artistsRouter,
});

export type AppRouter = typeof appRouter;
