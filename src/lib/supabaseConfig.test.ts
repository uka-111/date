import { describe, expect, it } from 'vitest';

import { readSupabaseConfig } from './supabaseConfig';

describe('readSupabaseConfig', () => {
  it('returns the URL and publishable key from the public environment', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it('throws when the public environment is incomplete', () => {
    expect(() => readSupabaseConfig({})).toThrow('Supabase 连接信息尚未配置');
  });
});
