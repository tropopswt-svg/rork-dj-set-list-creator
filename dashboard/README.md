# DJ Setlist Dashboard

Personal dashboard for monitoring your DJ Setlist Creator app stats.

## Stats Displayed

- **Totals**: Tracks, Artists, Sets, Users
- **Engagement**: Contributions, Likes, Comments
- **Activity**: Tracks added today/this week
- **By Source**: Beatport vs SoundCloud breakdown
- **Recent Activity**: Latest tracks and users

## Local Development

1. Install dependencies:
   ```bash
   cd dashboard
   npm install
   ```

2. Create `.env.local` with your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Deploy to Vercel

1. Push this folder to a GitHub repo (or use the existing repo)

2. Go to [vercel.com](https://vercel.com) and create a new project

3. Set the **Root Directory** to `dashboard`

4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

5. Deploy!

The dashboard auto-refreshes every 60 seconds.
