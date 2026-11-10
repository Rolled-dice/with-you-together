import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const lines = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: reminders } = await supabase.from('reminders').select('*').limit(3);
  console.log('Sample reminders:', JSON.stringify(reminders, null, 2));

  const { data: meds } = await supabase.from('medications').select('*').limit(3);
  console.log('Sample medications:', JSON.stringify(meds, null, 2));
}

main().catch(console.error);
