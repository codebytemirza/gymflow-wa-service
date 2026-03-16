import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client with the service_role key.
 * DANGER: This bypasses all RLS policies.
 * Only use for admin operations, webhooks, and cron jobs.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
