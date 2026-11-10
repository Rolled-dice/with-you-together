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
  console.log('=== Checking Reminders and Notifications in Supabase ===');

  // 1. Reminders
  const { data: reminders, error: rErr } = await supabase.from('reminders').select('*').limit(10);
  console.log('\nReminders count:', reminders?.length, rErr ? rErr.message : '');
  reminders?.forEach(r => console.log(`Reminder: "${r.title || r.name}" | Time: ${r.time} | Active: ${r.is_active || r.active}`));

  // 2. Notifications table
  const { data: notifications, error: nErr } = await supabase.from('notifications').select('*').limit(10);
  console.log('\nNotifications count:', notifications?.length, nErr ? nErr.message : '');
  notifications?.forEach(n => console.log(`Notification: "${n.title}" | "${n.body || n.content}" | Read: ${n.read || n.is_read}`));

  // 3. Web push subscriptions
  const { data: subs, error: sErr } = await supabase.from('web_push_subscriptions').select('*').limit(10);
  console.log('\nWeb push subscriptions count:', subs?.length, sErr ? sErr.message : '');

  // 4. Medications
  const { data: meds, error: mErr } = await supabase.from('medications').select('*').limit(10);
  console.log('\nMedications count:', meds?.length, mErr ? mErr.message : '');
  meds?.forEach(m => console.log(`Medication: "${m.name}" | Dosage: "${m.dosage}" | Frequency: "${m.frequency}" | Schedules: ${JSON.stringify(m.schedules || m.times)}`));

  // 5. Medication doses
  const { data: doses, error: dErr } = await supabase.from('medication_doses').select('*').limit(10);
  console.log('\nMedication doses count:', doses?.length, dErr ? dErr.message : '');
}

main().catch(console.error);
