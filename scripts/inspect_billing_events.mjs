import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, eqIdx).trim()] = val;
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase
    .from('billing_events')
    .select('*')
    .eq('user_id', '3ba897f6-0ccb-4a21-ad26-7a685320d835')
    .order('created_at', { ascending: false });
  console.log('Billing events count:', data?.length);
  for (const b of data || []) {
    console.log(b.id, b.event_type, b.environment, b.amount_cents, b.currency, b.created_at, b.status);
  }
}

check().catch(console.error);
