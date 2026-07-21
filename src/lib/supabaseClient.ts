import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BrowserAuthStorage } from '../auth/browserAuthStorage';
import type { Database } from './database.types';
import { readSupabaseConfig, type PublicEnvironment } from './supabaseConfig';

export function createSupabaseBrowserClient(
  environment: PublicEnvironment = import.meta.env,
  storage = new BrowserAuthStorage(),
): SupabaseClient<Database> {
  const { url, publishableKey } = readSupabaseConfig(environment);
  return createClient<Database>(url, publishableKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

interface SupabaseBrowserRuntime {
  client: SupabaseClient<Database>;
  storage: BrowserAuthStorage;
}

let browserRuntime: SupabaseBrowserRuntime | null = null;

export function getSupabaseBrowserRuntime(): SupabaseBrowserRuntime {
  if (!browserRuntime) {
    const storage = new BrowserAuthStorage();
    browserRuntime = {
      storage,
      client: createSupabaseBrowserClient(import.meta.env, storage),
    };
  }
  return browserRuntime;
}
