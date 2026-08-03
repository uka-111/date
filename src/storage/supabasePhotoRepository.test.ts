import { expect, it } from 'vitest';
import { normalizeImageType } from './supabasePhotoRepository';

it('normalizes mobile image MIME types before cloud upload validation', () => {
  expect(normalizeImageType('image/jpg')).toBe('image/jpeg');
  expect(normalizeImageType('image/jpeg')).toBe('image/jpeg');
  expect(normalizeImageType('image/png')).toBe('image/png');
  expect(normalizeImageType('image/gif')).toBe('image/gif');
  expect(normalizeImageType('', 'mobile-photo.JPG')).toBe('image/jpeg');
  expect(normalizeImageType('', 'animation.gif')).toBe('image/gif');
});
