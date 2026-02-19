import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: allSets, error } = await supabase
    .from('sets')
    .select('id, title, dj_name, venue, event_name, event_date, youtube_url, soundcloud_url')
    .order('event_date', { ascending: false });

  if (error) { console.error(error); return; }

  const noYT = allSets?.filter(s => !s.youtube_url) || [];
  const hasYT = allSets?.filter(s => !!s.youtube_url) || [];

  console.log('Total sets:', allSets?.length);
  console.log('With YouTube URL:', hasYT.length);
  console.log('Without YouTube URL:', noYT.length);
  console.log('');

  if (hasYT.length > 0) {
    console.log('=== Sample sets WITH YouTube ===');
    hasYT.slice(0, 5).forEach(s => {
      console.log(`  ${s.dj_name} | ${s.youtube_url}`);
    });
    console.log('');
  }

  console.log('=== All sets WITHOUT YouTube (for searching) ===');
  noYT.forEach((s, i) => {
    console.log(`${i + 1}. ${s.dj_name} | ${s.event_name || ''} | ${s.venue || ''} | ${s.event_date || 'no date'}`);
  });
}

main();
