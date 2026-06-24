/**
 * Run Supabase migrations against the new project.
 * Uses pg directly with Supabase's postgres connection.
 * Run: node scripts/run-supabase-migrations.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = process.env.SUPABASE_PROJECT_ID || 'yqkdmchatsqykvmfmraj';
const migrationsDir = path.resolve(__dirname, '../artifacts/sync-check/supabase/migrations');

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

// Read all migration files in order
const files = fs.readdirSync(migrationsDir).sort();
let combinedSQL = '';
for (const f of files) {
  combinedSQL += `\n-- === ${f} ===\n`;
  combinedSQL += fs.readFileSync(path.join(migrationsDir, f), 'utf8') + '\n';
}

console.log(`📄 Loaded ${files.length} migration files (${combinedSQL.length} chars)`);
console.log(`🔗 Target: ${projectRef}`);

// Use Supabase REST API to execute SQL
// The correct endpoint is POST /rest/v1/rpc with service role
// But for DDL we need the pg connection string

// Supabase session pooler (port 5432):
// postgresql://postgres.[ref]:[db-password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
// 
// Without the DB password we can't use direct postgres.
// Instead use the Supabase "unsafe" SQL endpoint via REST if available,
// or use the management API with a personal access token.

// Try: POST to the Supabase project database API
// This is the internal pg-meta API that supabase CLI uses
// endpoint: https://[ref].supabase.co/pg/query  (requires service_role)

async function runSQL(sql, label) {
  // Use the Supabase pg API  
  const res = await fetch(`https://${projectRef}.supabase.co/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (res.status >= 400) {
    console.error(`❌ [${label}] HTTP ${res.status}: ${body.slice(0, 300)}`);
    return false;
  }
  console.log(`✅ [${label}] OK`);
  return true;
}

// Try a simple test query first
const testOk = await runSQL('SELECT 1 as test', 'connectivity-test');
if (!testOk) {
  console.log('\n⚠️  Direct pg API not accessible. Trying alternative...');
  
  // Try REST via rpc
  const res2 = await fetch(`https://${projectRef}.supabase.co/rest/v1/modules?select=id&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });
  console.log('REST test status:', res2.status, (await res2.text()).slice(0, 200));
}
