import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const html = readFileSync(new URL('../../动态相册.html', import.meta.url), 'utf8');
const library = html.match(/const LOVE_POEMS=(\[[\s\S]*?\n\]);/)[1];
const selector = html.slice(html.indexOf('const POETRY_STORAGE_KEY='), html.indexOf('function todayInChina('));
const memoryStorage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
};
function load(storage = memoryStorage(), crypto = webcrypto) {
  const context = vm.createContext({ localStorage: storage, crypto });
  return vm.runInContext(`const LOVE_POEMS=${library};${selector};({quotes:LOVE_POEMS,draw:drawLoveQuote,current:currentLoveQuote,key:POETRY_STORAGE_KEY})`, context);
}

test('the quote library has over 120 distinct entries with named sources', () => {
  const { quotes } = load();
  assert.ok(quotes.length >= 120);
  assert.equal(new Set(quotes.map(row => row[0])).size, quotes.length);
  assert.ok(quotes.every(row => row.length === 2 && row[0].length > 0 && row[1].length > 0));
});

test('a full shuffle cycle has no repeated quote, including across page reloads', () => {
  const storage = memoryStorage();
  let app = load(storage), previous = '', seen = new Set();
  const count = app.quotes.length;
  for (let i = 0; i < count * 3; i++) {
    if (i % 9 === 0) app = load(storage);
    const text = app.draw()[0];
    assert.notEqual(text, previous);
    assert.ok(!seen.has(text), 'a quote repeated before the cycle was exhausted');
    seen.add(text); previous = text;
    if (seen.size === count) seen = new Set();
  }
});

test('quotes remain stable during the reading interval and rotate after two minutes', () => {
  const app = load(), first = app.current(new Date(1000))[0];
  assert.equal(app.current(new Date(120999))[0], first);
  assert.notEqual(app.current(new Date(121000))[0], first);
});

test('blocked storage, corrupt saved data, and missing crypto do not break selection', () => {
  const cases = [
    { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } },
    { getItem() { return '{invalid'; }, setItem() { throw new Error('quota'); } },
    { getItem() { return JSON.stringify({ fingerprint:'old', remaining:[-1,999999] }); }, setItem() { throw new Error('quota'); } },
  ];
  for (const storage of cases) {
    const app = load(storage, null), seen = new Set();
    for (let i = 0; i < app.quotes.length; i++) seen.add(app.draw()[0]);
    assert.equal(seen.size, app.quotes.length);
  }
});
