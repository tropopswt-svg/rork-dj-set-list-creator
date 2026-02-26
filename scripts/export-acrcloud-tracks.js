#!/usr/bin/env node
// Export 100 unreleased tracks from ACRCloud bucket as CSV
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  });
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('unreleased_tracks')
    .select('artist, title, acrcloud_acr_id, acrcloud_status, source_platform, times_identified, confidence_score, created_at')
    .eq('acrcloud_status', 'uploaded')
    .eq('is_active', true)
    .order('times_identified', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No uploaded tracks found in ACRCloud bucket.');
    process.exit(0);
  }

  // Build CSV
  const headers = ['Artist', 'Title', 'ACRCloud ID', 'Status', 'Source Platform', 'Times Identified', 'Confidence', 'Added'];
  const rows = data.map(t => [
    t.artist,
    t.title,
    t.acrcloud_acr_id || '',
    t.acrcloud_status,
    t.source_platform,
    t.times_identified || 0,
    t.confidence_score || '',
    t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '',
  ]);

  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');

  const outPath = path.join(__dirname, '..', 'acrcloud-unreleased-tracks.csv');
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`✓ Exported ${data.length} tracks to ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
