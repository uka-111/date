import { render, screen } from '@testing-library/react';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('shows a stable error when the real default app has no Supabase environment', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  vi.resetModules();
  const { App } = await import('./App');

  expect(() => render(<App />)).not.toThrow();
  expect(await screen.findByRole('alert')).toHaveTextContent('Supabase 连接信息尚未配置');
});
