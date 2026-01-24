# Supabase Deployment Guide (Alternative)

Supabase Edge Functions can run your Hono backend, but requires some adaptation. **Vercel is recommended instead** for easier setup.

If you still want to use Supabase, here's how:

## Why Vercel is Better for Your Use Case

- ✅ Zero code changes needed
- ✅ Native Hono support
- ✅ Simpler deployment
- ✅ Better for tRPC

Supabase is better for:
- Database + Auth needs
- Real-time features
- PostgreSQL requirements

## If You Still Want Supabase

### Step 1: Install Supabase CLI

```bash
brew install supabase/tap/supabase
```

### Step 2: Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Sign in
3. Create new project
4. Note your project URL and anon key

### Step 3: Adapt Your Code

Supabase Edge Functions use Deno, so you'd need to:
- Convert Bun-specific code to Deno
- Adapt imports
- Modify server.ts

This requires significant code changes.

## Recommendation

**Use Vercel instead** - it's the perfect fit for your Hono + tRPC backend with zero code changes needed.
