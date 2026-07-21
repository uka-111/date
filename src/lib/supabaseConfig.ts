export interface PublicEnvironment {
  readonly [name: string]: unknown;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function readSupabaseConfig(environment: PublicEnvironment): SupabaseConfig {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error('Supabase 连接信息尚未配置');
  }

  return { url, publishableKey };
}
