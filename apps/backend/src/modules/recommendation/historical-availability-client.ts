import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from 'node:process';

let client: SupabaseClient | undefined;

export const getHistoricalAvailabilityClient = (): SupabaseClient | null => {
  if (client) {
    return client;
  }

  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    client = createClient(supabaseUrl, serviceRoleKey);
    return client;
  } catch {
    return null;
  }
};