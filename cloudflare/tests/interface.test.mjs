import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { interfaceScript, interfaceStyle, loadingMarkup } from '../src/interface.mjs';
import { adminPage, loginPage } from '../src/pages.mjs';

function browser(storageValue = '{}', blocked = false, systemLight = false) {
  const listeners = {}, timers = new Map(), classes = new Set(['is-loading']);
  let next = 0, saved = storageValue;
  const attrs = {}, loader = { classList: { add: value => classes.add(value) }, setAttribute: (key, value) => attrs[key] = value, hidden: false };
  const root = { dataset: {} }, content = { inert: true, removeAttribute() {} }, name = {};
  const document = {
    documentElement: root, body: { classList: { remove: value => classes.delete(value) } },
    querySelector: () => ({ setAttribute() {} }),
    querySelectorAll: selector => selector === '[data-startup-inert]' ? [content] : [name],
    getElementById: id => id === 'startup-screen' ? loader : null
  };
  const window = { addEventListener: (key, callback) => listeners[key] = callback };
  const localStorage = { getItem() { if (blocked) throw new Error('Blocked'); return saved; }, setItem(key, value) { if (blocked) throw new Error('Blocked'); saved = value; } };
  vm.runInNewContext(interfaceScript, { document, window, localStorage, matchMedia: query => ({ matches: query.includes('color-scheme') && systemLight, addEventListener() {} }), setTimeout: callback => { timers.set(++next, callback); return next; }, clearTimeout: id => timers.delete(id) });
  return { ui: window.MomentsUI, root, classes, loader, content, timers, name, attrs, listeners, saved: () => JSON.parse(saved) };
}

test('album and administrator share theme, accent, density and the supplied spokes loader', () => {
  const b = browser(JSON.stringify({ appearanceTheme: 'light', accent: 'rose', density: 'compact', reduceMotion: true, albumName: '  我们的   瞬间 ', token: 'must-not-be-saved' }));
  assert.equal(b.root.dataset.theme, 'light'); assert.equal(b.root.dataset.accent, 'rose');
  assert.equal(b.root.dataset.density, 'compact'); assert.equal(b.root.dataset.motion, 'reduced');
  assert.equal(b.name.textContent, '我们的 瞬间');
  b.ui.remember(b.ui.read()); assert.ok(!('token' in b.saved()));
  const album = readFileSync(new URL('../../动态相册.html', import.meta.url), 'utf8');
  assert.ok(album.includes(interfaceScript)); assert.ok(album.includes(interfaceStyle)); assert.ok(album.includes(loadingMarkup));
  const admin = adminPage({ login: 'Sg-427', displayName: '水果榨汁', role: 'owner' }, 'test-csrf', 'test-nonce');
  assert.ok(admin.includes(interfaceScript)); assert.ok(admin.includes(interfaceStyle)); assert.ok(admin.includes(loadingMarkup));
  for (const page of [admin, loginPage({}, 'test-nonce'), album]) {
    for (const [, attrs, script] of page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) if (!attrs.includes('application/json')) new vm.Script(script);
  }
});

test('loading completion reveals content, releases controls and cannot leave an invisible blocker', () => {
  const b = browser();
  b.ui.ready(); b.ui.ready();
  for (const callback of b.timers.values()) callback();
  assert.ok(!b.classes.has('is-loading')); assert.ok(b.classes.has('is-complete'));
  assert.equal(b.content.inert, false); assert.equal(b.attrs['aria-hidden'], 'true');
  assert.equal(b.loader.hidden, true);
  const slow = browser();
  [...slow.timers.values()][0]();
  for (const callback of slow.timers.values()) callback();
  assert.equal(slow.content.inert, false, 'The startup timeout also releases controls');
});

test('blocked/corrupt preferences remain usable, and system theme changes are resolved safely', () => {
  for (const b of [browser('{}', true), browser('{bad'), browser('[]')]) {
    assert.equal(b.root.dataset.theme, 'dark');
    b.ui.remember({ appearanceTheme: 'light', accent: 'invalid', density: 'invalid' });
    b.ui.ready(); for (const callback of b.timers.values()) callback(); assert.equal(b.content.inert, false);
  }
  const system = browser('{"appearanceTheme":"system"}', false, true);
  assert.equal(system.root.dataset.theme, 'light');
});
