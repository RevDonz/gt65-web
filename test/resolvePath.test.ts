import { describe, expect, it } from 'vitest';
import { resolveAssetPath } from '../electron/lib/resolvePath';

const ROOT = '/app/dist';

describe('resolveAssetPath', () => {
  it('memetakan akar ke index.html', () => {
    expect(resolveAssetPath('app://gt65/', ROOT)).toBe('/app/dist/index.html');
  });

  it('memetakan halaman biasa', () => {
    expect(resolveAssetPath('app://gt65/lighting.html', ROOT)).toBe('/app/dist/lighting.html');
  });

  it('membuang query dan fragment', () => {
    expect(resolveAssetPath('app://gt65/assets/x.js?v=1#a', ROOT)).toBe('/app/dist/assets/x.js');
  });

  it('menolak host lain', () => {
    expect(resolveAssetPath('app://jahat/index.html', ROOT)).toBeNull();
  });

  it('menolak skema lain', () => {
    expect(resolveAssetPath('http://gt65/index.html', ROOT)).toBeNull();
  });

  it('menolak traversal ter-encode', () => {
    expect(resolveAssetPath('app://gt65/..%2f..%2fetc/passwd', ROOT)).toBeNull();
    expect(resolveAssetPath('app://gt65/%2e%2e%2f%2e%2e%2fetc/passwd', ROOT)).toBeNull();
    expect(resolveAssetPath('app://gt65/foo/..%2f..%2f..%2fetc/passwd', ROOT)).toBeNull();
  });

  it('menolak byte nol', () => {
    expect(resolveAssetPath('app://gt65/index.html%00.png', ROOT)).toBeNull();
  });

  it('menolak persen-encoding rusak', () => {
    expect(resolveAssetPath('app://gt65/%zz', ROOT)).toBeNull();
  });

  it('menolak URL tak valid', () => {
    expect(resolveAssetPath('bukan url', ROOT)).toBeNull();
  });
});
