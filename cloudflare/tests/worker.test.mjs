import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createWorker } from '../src/worker.mjs';

const ORIGIN = 'https://album.example';
const OWNER = { id: 205340307, login: 'Sg-427', name: '水果榨汁', type: 'User' };
const profiles = {
  owner: OWNER,
  member: { id: 301, login: 'allowed-user', name: 'Allowed Person', type: 'User' },
  admin: { id: 302, login: 'other-admin', name: 'Other Admin', type: 'User' },
  friend: { id: 303, login: 'another-friend', name: 'Friend', type: 'User' },
  stranger: { id: 399, login: 'uninvited-user', name: 'Stranger', type: 'User' },
  renamed: { id: 301, login: 'new-user-name', name: 'Renamed', type: 'User' },
  recycled: { id: 999, login: 'allowed-user', name: 'Different Person', type: 'User' }
};

function d1(sqlite) {
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
}

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_access_control.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const calls = [], assetCalls = [];
  const env = {
    SITE_URL: ORIGIN,
    OWNER_GITHUB_ID: String(OWNER.id), OWNER_GITHUB_LOGIN: OWNER.login, OWNER_DISPLAY_NAME: OWNER.name,
    GITHUB_CLIENT_ID: 'test-client-id', GITHUB_CLIENT_SECRET: 'test-client-secret',
    DB: d1(sqlite),
    ASSETS: { async fetch(request) { assetCalls.push(request.url); return new Response('<!doctype html><h1>PRIVATE ALBUM</h1>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public,max-age=86400' } }); } }
  };
  const worker = createWorker({ fetchImpl: async (input, options = {}) => {
    const url = new URL(input); calls.push({ url: url.href, options });
    if (url.href === 'https://github.com/login/oauth/access_token') {
      const body = new URLSearchParams(options.body), code = body.get('code');
      if (!profiles[code]) return Response.json({ error: 'bad_verification_code' });
      return Response.json({ access_token: 'test-github-token-' + code, token_type: 'bearer' });
    }
    if (url.href === 'https://api.github.com/user') {
      const code = options.headers.Authorization?.replace('Bearer test-github-token-', '');
      return profiles[code] ? Response.json(profiles[code]) : Response.json({}, { status: 401 });
    }
    if (url.pathname.startsWith('/users/')) {
      const login = decodeURIComponent(url.pathname.slice('/users/'.length));
      const profile = Object.values(profiles).find(profile => profile.login.toLowerCase() === login.toLowerCase());
      return profile ? Response.json(profile) : Response.json({}, { status: 404 });
    }
    throw new Error('Unexpected network URL');
  } });
  const send = (path, options = {}) => worker.fetch(new Request(ORIGIN + path, options), env);
  async function begin(returnTo = '/') {
    const response = await send('/auth/github?returnTo=' + encodeURIComponent(returnTo));
    assert.equal(response.status, 303);
    const destination = new URL(response.headers.get('Location'));
    const flowCookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-moments_oauth=')).split(';')[0];
    return { destination, flowCookie, state: destination.searchParams.get('state') };
  }
  async function finish(start, code) {
    const response = await send('/auth/callback?state=' + encodeURIComponent(start.state) + '&code=' + encodeURIComponent(code), { headers: { Cookie: start.flowCookie } });
    const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-moments_session=') && !value.includes('Max-Age=0'))?.split(';')[0];
    return { response, sessionCookie };
  }
  async function login(code = 'owner') {
    const start = await begin(), auth = await finish(start, code);
    if (auth.sessionCookie) { const response = await send('/api/auth/me', { headers: { Cookie: auth.sessionCookie } }); auth.identity = await response.json(); }
    return auth;
  }
  async function api(auth, path, method = 'GET', body, headers = {}) {
    return send(path, { method, headers: { Cookie: auth.sessionCookie || '', Origin: ORIGIN, 'X-CSRF-Token': auth.identity?.csrfToken || '', 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  const add = (auth, username = 'allowed-user', role = 'member') => api(auth, '/api/admin/users', 'POST', { username, role });
  return { sqlite, env, calls, assetCalls, send, begin, finish, login, api, add, worker };
}

test('all album URLs and direct asset paths require a real server session', async t => {
  const f = fixture(t);
  for (const path of ['/', '/index.html', '/动态相册.html', '/private.jpg', '/admin']) {
    const response = await f.send(path, { headers: { 'X-GitHub-Login': OWNER.login } });
    assert.equal(response.status, 303); assert.ok(response.headers.get('Location').startsWith('/login'));
    assert.ok(!(await response.text()).includes('PRIVATE ALBUM'));
  }
  const forged = await f.send('/', { headers: { Cookie: '__Host-moments_session=' + 'a'.repeat(43) } });
  assert.equal(forged.status, 303); assert.equal(f.assetCalls.length, 0);
  const login = await f.send('/login'); assert.equal(login.status, 200);
  const body = await login.text(); assert.ok(body.includes('使用 GitHub 登录')); assert.ok(!body.includes('钟桢')); assert.ok(!body.includes('test-client-secret'));
});

test('OAuth uses state, browser binding, PKCE, canonical redirect, and one-time consumption', async t => {
  const f = fixture(t), start = await f.begin('https://evil.example');
  assert.equal(start.destination.origin, 'https://github.com');
  assert.equal(start.destination.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(start.destination.searchParams.get('redirect_uri'), ORIGIN + '/auth/callback');
  assert.equal(start.destination.searchParams.get('scope'), '');
  const wrongBrowser = await f.send('/auth/callback?state=' + start.state + '&code=owner', { headers: { Cookie: '__Host-moments_oauth=' + 'b'.repeat(43) } });
  assert.equal(wrongBrowser.headers.get('Location'), '/login?reason=state'); assert.equal(f.calls.length, 0);
  const auth = await f.finish(start, 'owner'); assert.equal(auth.response.status, 303); assert.equal(auth.response.headers.get('Location'), '/');
  const exchange = new URLSearchParams(f.calls[0].options.body);
  assert.equal(createHash('sha256').update(exchange.get('code_verifier')).digest('base64url'), start.destination.searchParams.get('code_challenge'));
  assert.equal(exchange.get('redirect_uri'), ORIGIN + '/auth/callback');
  const repeat = await f.finish(start, 'owner'); assert.equal(repeat.response.headers.get('Location'), '/login?reason=state');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
  for (const value of auth.response.headers.getSetCookie()) { assert.ok(value.includes('HttpOnly')); assert.ok(value.includes('Secure')); assert.ok(value.includes('SameSite=Lax')); }
});

test('unlisted GitHub identities receive no session and no album bytes', async t => {
  const f = fixture(t), stranger = await f.login('stranger');
  assert.equal(stranger.response.status, 403); assert.equal(stranger.sessionCookie, undefined);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0); assert.equal(f.assetCalls.length, 0);
});

test('configured owner can manage accounts, while the owner cannot be removed or downgraded', async t => {
  const f = fixture(t), owner = await f.login(); assert.equal(owner.identity.user.role, 'owner');
  assert.equal(owner.identity.user.displayName, '水果榨汁');
  const added = await f.add(owner); assert.equal(added.status, 201);
  const list = await f.api(owner, '/api/admin/users'); const data = await list.json();
  assert.equal(data.users.length, 2); assert.equal(data.users[0].isOwner, true);
  for (const [method, body] of [['DELETE', undefined], ['PATCH', { role: 'member' }]]) {
    const response = await f.api(owner, '/api/admin/users/' + OWNER.id, method, body); assert.equal(response.status, 409);
  }
  assert.equal((await f.api(owner, '/api/auth/me')).status, 200);
  const audit = await (await f.api(owner, '/api/admin/audit')).json(); assert.equal(audit.events[0].targetLogin, 'allowed-user');
});

test('CSRF, cross-origin requests, GET mutations, invalid usernames, and oversized input are rejected', async t => {
  const f = fixture(t), owner = await f.login();
  const missing = await f.api(owner, '/api/admin/users', 'POST', { username: 'allowed-user' }, { 'X-CSRF-Token': '' }); assert.equal(missing.status, 403);
  const external = await f.api(owner, '/api/admin/users', 'POST', { username: 'allowed-user' }, { Origin: 'https://evil.example' }); assert.equal(external.status, 403);
  const email = await f.add(owner, '3205819496@qq.com'); assert.equal(email.status, 400);
  const chinese = await f.add(owner, '水果榨汁'); assert.equal(chinese.status, 400);
  const huge = await f.add(owner, 'a'.repeat(5000)); assert.equal(huge.status, 413);
  const get = await f.api(owner, '/api/admin/users/301', 'GET'); assert.equal(get.status, 404);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM allowed_users').get().n, 1);
});

test('members can load the album but cannot use admin pages or admin APIs', async t => {
  const f = fixture(t), owner = await f.login(); await f.add(owner);
  const member = await f.login('member'); assert.equal(member.identity.user.role, 'member');
  const album = await f.send('/', { headers: { Cookie: member.sessionCookie } }); assert.equal(album.status, 200); assert.ok((await album.text()).includes('PRIVATE ALBUM'));
  assert.equal(album.headers.get('Cache-Control'), 'private, no-store, max-age=0'); assert.equal(album.headers.get('X-Frame-Options'), 'DENY');
  assert.equal((await f.api(member, '/api/admin/users')).status, 403);
  assert.equal((await f.send('/admin', { headers: { Cookie: member.sessionCookie } })).status, 403);
  assert.equal((await f.add(member, 'another-friend', 'admin')).status, 403);
});

test('secondary admins cannot grant admin privileges or alter other admins', async t => {
  const f = fixture(t), owner = await f.login(); await f.add(owner, 'other-admin', 'admin');
  const admin = await f.login('admin'); assert.equal((await f.add(admin, 'another-friend')).status, 201);
  assert.equal((await f.add(admin, 'allowed-user', 'admin')).status, 403);
  assert.equal((await f.api(admin, '/api/admin/users/' + OWNER.id, 'DELETE')).status, 409);
  assert.equal((await f.api(admin, '/api/admin/users/303', 'PATCH', { role: 'admin' })).status, 403);
  await f.api(owner, '/api/admin/users/302', 'PATCH', { role: 'member' });
  assert.equal((await f.api(admin, '/api/admin/users')).status, 403, 'Role changes apply to an existing session');
});

test('revoking access invalidates existing sessions and rejects fresh OAuth logins', async t => {
  const f = fixture(t), owner = await f.login(); await f.add(owner); const member = await f.login('member');
  assert.equal((await f.api(owner, '/api/admin/users/301', 'DELETE')).status, 200);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE github_id=?').get('301').n, 0);
  assert.equal((await f.send('/', { headers: { Cookie: member.sessionCookie } })).status, 303);
  assert.equal((await f.login('member')).response.status, 403);
  await f.add(owner); assert.equal((await f.login('member')).response.status, 303);
});

test('allowlisting uses immutable IDs rather than mutable or recycled GitHub usernames', async t => {
  const f = fixture(t), owner = await f.login(); await f.add(owner);
  const renamed = await f.login('renamed'); assert.equal(renamed.identity.user.githubId, '301'); assert.equal(renamed.identity.user.login, 'new-user-name');
  const recycled = await f.login('recycled'); assert.equal(recycled.response.status, 403);
});

test('only session hashes are stored; session and OAuth expiry are enforced; logout revokes the token', async t => {
  const f = fixture(t), owner = await f.login();
  const row = f.sqlite.prepare('SELECT * FROM sessions').get(), raw = owner.sessionCookie.split('=')[1];
  assert.equal(row.token_hash, createHash('sha256').update(raw).digest('hex')); assert.ok(!JSON.stringify(row).includes('test-github-token'));
  const response = await f.api(owner, '/auth/logout', 'POST'); assert.equal(response.status, 200); assert.equal((await response.json()).loggedOut, true);
  assert.equal((await f.api(owner, '/api/auth/me')).status, 401);
  const next = await f.login(); f.sqlite.prepare('UPDATE sessions SET expires_at=0').run(); assert.equal((await f.api(next, '/api/auth/me')).status, 401);
  const start = await f.begin(); f.sqlite.prepare('UPDATE oauth_states SET expires_at=0').run(); assert.equal((await f.finish(start, 'owner')).response.headers.get('Location'), '/login?reason=state');
});

test('missing owner configuration, a failed database, and unconfigured alternate hostnames fail closed', async t => {
  const f = fixture(t); const noOwner = { ...f.env, OWNER_GITHUB_ID: '' };
  assert.equal((await f.worker.fetch(new Request(ORIGIN + '/'), noOwner)).status, 503);
  assert.equal((await f.worker.fetch(new Request('https://other.example/'), f.env)).status, 421);
  const owner = await f.login(); f.env.DB = { prepare() { throw new Error('Database unavailable'); } };
  const response = await f.send('/', { headers: { Cookie: owner.sessionCookie } }); assert.equal(response.status, 503); assert.equal(f.assetCalls.length, 0);
  assert.ok(!(await response.text()).includes('Database unavailable'));
});

test('build output carries protected controls without exposing backend source or secrets', () => {
  const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.equal(JSON.parse(config).assets.run_worker_first, true);
  const builder = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.ok(builder.includes("'dist', 'index.html'"));
  const client = readFileSync(new URL('../src/auth-client.js', import.meta.url), 'utf8');
  assert.ok(client.includes("location.protocol === 'file:'"));
  assert.ok(!client.includes('test-client-secret'));
});
