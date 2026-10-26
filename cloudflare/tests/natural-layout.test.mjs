import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../动态相册.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('function packNaturalRectangles('), html.indexOf('const naturalRendered='));
const { pack, distribute } = vm.runInNewContext(`${code};({pack:packNaturalRectangles,distribute:distributeGridSizes})`);

test('different card sizes retain their full height and never overlap or escape their region', () => {
  for (const width of [88, 240, 794, 1400]) {
    const input = Array.from({ length: 35 }, (_, i) => ({ width: 90 + (i * 73) % 600, height: 20 + (i * 179) % 1800 }));
    const output = pack(input, width, 16);
    assert.equal(output.length, input.length);
    output.forEach((card, i) => {
      assert.equal(card.height, input[i].height);
      assert(card.x >= 0 && card.x + card.width <= width + .01);
      assert(card.y >= 0);
      for (const other of output.slice(0, i)) {
        assert(card.x >= other.x + other.width + 15.99 || other.x >= card.x + card.width + 15.99 || card.y >= other.y + other.height + 15.99 || other.y >= card.y + card.height + 15.99);
      }
    });
  }
});

test('packing uses available horizontal gaps without stretching short content', () => {
  const cards = pack([{width:180,height:600},{width:150,height:100},{width:150,height:80}], 400, 16);
  assert.equal(cards[1].y, 0);
  assert.equal(cards[2].y, 116);
  assert.equal(cards[2].height, 80);
  assert.equal(pack([], 400).length, 0);
  const gaps = pack([{width:180,height:600},{width:390,height:800},{width:150,height:100}], 400, 16);
  assert.equal(gaps[2].y, 0, 'a later small card can fill the gap above a wide lower card');
});

test('resizing proportions respect minimum sizes and consume the available space exactly', () => {
  for (const weights of [[1, 1, 1], [800, 10, 5], [1, 1000, .001]]) {
    const result = distribute(weights, 700, [180, 120, 110]);
    assert(Math.abs(result.reduce((sum, value) => sum + value, 0) - 700) < .001);
    assert(result.every((size, i) => size >= [180, 120, 110][i]));
  }
  assert.equal(distribute([1, 1, 1], 300, [180, 120, 110]), null);
});
