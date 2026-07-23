import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

function resolveBuildConfig(mode: string) {
  if (typeof viteConfig !== 'function') {
    throw new Error('Vite configuration must be a function');
  }

  return viteConfig({
    command: 'build',
    mode,
    isSsrBuild: false,
    isPreview: false,
  });
}

describe('deployment asset paths', () => {
  it('uses the domain root for Vercel production builds', () => {
    expect(resolveBuildConfig('production').base).toBe('/');
  });

  it('uses the repository path for GitHub Pages builds', () => {
    expect(resolveBuildConfig('github-pages').base).toBe('/date/');
  });
});
