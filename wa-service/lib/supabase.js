// ============================================================
// wa-service/lib/supabase.js
// Supabase admin client (service-role) for wa-service
// ============================================================
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default supabase;
