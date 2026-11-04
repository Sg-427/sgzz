import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../动态相册.html', import.meta.url), 'utf8');
const sizing = html.slice(html.indexOf('function photoPreviewSize('), html.indexOf('function fitPhotoPreview('));
const fit = vm.runInNewContext(sizing + ';photoPreviewSize');

test('photo previews retain the image ratio and fit wide, tall and mobile viewports without letterboxing', () => {
  for (const [width, height] of [[4000, 1000], [1000, 4000], [1200, 1200], [200, 120]]) {
    for (const [viewportWidth, viewportHeight] of [[1280, 720], [390, 844], [844, 390]]) {
      const size = fit(width, height, viewportWidth, viewportHeight);
      const inset = viewportWidth <= 600 ? 16 : 24;
      assert.ok(size.width <= viewportWidth - inset * 2 + 0.001);
      assert.ok(size.height <= viewportHeight - inset * 2 + 0.001);
      assert.ok(Math.abs(size.width / size.height - width / height) < 1e-9);
      assert.ok(size.width <= width && size.height <= height, 'Small originals are not stretched beyond their resolution');
    }
  }
});

test('missing dimensions remain finite until image load or video metadata resolves the natural size', () => {
  for (const invalid of [undefined, 0, -1, Infinity, NaN, 'bad']) {
    const size = fit(invalid, invalid, invalid, invalid);
    assert.ok(Number.isFinite(size.width) && size.width > 0);
    assert.ok(Number.isFinite(size.height) && size.height > 0);
  }
});
