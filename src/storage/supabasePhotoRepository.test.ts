import { expect, it } from 'vitest';
import { normalizeImageType } from './supabasePhotoRepository';

it('normalizes a camera JPG MIME type before cloud upload validation', () => {
  expect(normalizeImageType('image/jpg')).toBe('image/jpeg');
  expect(normalizeImageType('image/jpeg')).toBe('image/jpeg');
  expect(normalizeImageType('image/png')).toBe('image/png');
});
