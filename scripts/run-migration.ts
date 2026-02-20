#!/usr/bin/env bun
/**
 * Run migration 002 against Supabase by testing column existence
 * and using update operations to verify they work.
 *
 * Since we can't execute DDL via the REST API, this script:
 * 1. Uses the Supabase Management API if SUPABASE_ACCESS_TOKEN is set
 * 2. Falls back to printing the SQL for manual execution
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Columns to add
const migrations = [
  { table: 'tracks', column: 'artwork_url', type: 'TEXT' },
  { table: 'tracks', column: 'spotify_preview_url', type: 'TEXT' },
  { table: 'tracks', column: 'popularity', type: 'INTEGER' },
  { table: 'tracks', column: 'album_name', type: 'TEXT' },
  { table: 'tracks', column: 'enriched_at', type: 'TIMESTAMPTZ' },
  { table: 'artists', column: 'spotify_artist_id', type: 'TEXT' },
  { table: 'artists', column: 'followers_count', type: 'INTEGER DEFAULT 0', skipIfExists: true },
  { table: 'artists', column: 'popularity', type: 'INTEGER' },
  { table: 'artists', column: 'enriched_at', type: 'TIMESTAMPTZ' },
  { table: 'sets', column: 'enriched_at', type: 'TIMESTAMPTZ' },
];

async function checkColumn(table: string, column: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).select(column).limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Migration 002: Enrichment Columns');
  console.log('='.repeat(60));

  const missing: typeof migrations = [];

  for (const m of migrations) {
    const exists = await checkColumn(m.table, m.column);
    if (exists) {
      console.log(`  OK: ${m.table}.${m.column}`);
    } else {
      console.log(`  MISSING: ${m.table}.${m.column}`);
      missing.push(m);
    }
  }

  if (missing.length === 0) {
    console.log('\nAll columns exist! Migration already applied.');
    return;
  }

  console.log(`\n${missing.length} columns need to be added.`);

  // Generate the SQL for missing columns only
  const sql = missing
    .map(m => `ALTER TABLE ${m.table} ADD COLUMN IF NOT EXISTS ${m.column} ${m.type};`)
    .join('\n');

  // Also add the indexes
  const indexSql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '002_enrichment_columns.sql'),
    'utf8'
  );
  const indexStatements = indexSql
    .split('\n')
    .filter(l => l.trim().startsWith('CREATE INDEX'))
    .join('\n');

  const fullSql = sql + '\n\n' + indexStatements;

  console.log('\n--- SQL to execute ---\n');
  console.log(fullSql);
  console.log('\n--- End SQL ---\n');

  // Copy to clipboard if pbcopy available
  try {
    const proc = Bun.spawn(['pbcopy'], { stdin: 'pipe' });
    proc.stdin.write(fullSql);
    proc.stdin.end();
    await proc.exited;
    console.log('SQL copied to clipboard!');
  } catch {}

  console.log(`\nPaste and run at:`);
  console.log(`  https://supabase.com/dashboard/project/${projectRef}/sql/new`);
}

main().catch(console.error);
