// Script to run Supabase migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://piwcpswdrrtvczodimxn.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpd2Nwc3dkcnJ0dmN6b2RpbXhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTIxMTg5NCwiZXhwIjoyMDg0Nzg3ODk0fQ.EHQhnB1tI28Mu6Foy9CYzj09IM0JMpUMjgTJdtNi5LI';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('Reading migration file...');
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '003_social_features.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by statements (simple split - handles most cases)
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement || statement.startsWith('--')) continue;

    // Skip certain statements that can't be run through the REST API
    if (statement.includes('CREATE TRIGGER') ||
        statement.includes('CREATE OR REPLACE FUNCTION') ||
        statement.includes('DROP TRIGGER') ||
        statement.includes('ALTER TABLE') && statement.includes('ENABLE ROW LEVEL SECURITY')) {
      console.log(`Statement ${i + 1}: Skipped (requires direct DB access)`);
      continue;
    }

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

      if (error) {
        // Try alternative approach
        console.log(`Statement ${i + 1}: Error - ${error.message}`);
        errorCount++;
      } else {
        console.log(`Statement ${i + 1}: Success`);
        successCount++;
      }
    } catch (e) {
      console.log(`Statement ${i + 1}: Exception - ${e.message}`);
      errorCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} succeeded, ${errorCount} errors`);
  console.log('\nNote: Triggers and functions require direct database access.');
  console.log('Please run the full migration SQL in the Supabase Dashboard SQL Editor.');
}

runMigration().catch(console.error);
