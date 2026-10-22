import { loginPage, deniedPage, adminPage, messagePage } from './pages.mjs';

const SESSION_COOKIE = '__Host-moments_session';
const FLOW_COOKIE = '__Host-moments_oauth';
const SESSION_SECONDS = 8 * 3600;
const FLOW_SECONDS = 10 * 60;
const encoder = new TextEncoder();
const validId = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);
const validLogin = value => typeof value === 'string' && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value);
const nowSeconds = () => Math.floor(Date.now() / 1000);

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function token(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function pkceChallenge(verifier) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function cookie(request, name) {
  const matches = (request.headers.get('Cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

function setCookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
}

const clearCookie = name => setCookie(name, '', 0);
const safeReturn = value => ['/', '/admin', '/index.html'].includes(value) ? value : '/';

function configFor(env) {
  let site;
  try { site = new URL(env.SITE_URL); } catch { throw new HttpError(503, 'NOT_CONFIGURED', '站点尚未完成部署配置。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  if ((site.protocol !== 'https:' && !(local && site.protocol === 'http:')) || site.username || site.password || site.search || site.hash || site.pathname !== '/' || !validId(String(env.OWNER_GITHUB_ID || '')) || !env.DB || !env.ASSETS) {
    throw new HttpError(503, 'NOT_CONFIGURED', '站点尚未完成部署配置。');
  }
  return { origin: site.origin, ownerId: String(env.OWNER_GITHUB_ID), callback: site.origin + '/auth/callback', oauthReady: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && !String(env.GITHUB_CLIENT_ID).startsWith('replace-') && !String(env.GITHUB_CLIENT_SECRET).startsWith('replace-')) };
}

function protectedResponse(response, nonce = '', album = false) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Vary', 'Cookie');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Content-Security-Policy', album
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https://api.mymemory.translated.net; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"
    : `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function html(body, nonce, status = 200) {
  return protectedResponse(new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }), nonce);
}

function json(data, status = 200) {
  return protectedResponse(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
}

function redirect(location, cookies = [], status = 303) {
  const headers = new Headers({ Location: location });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return protectedResponse(new Response(null, { status, headers }));
}

async function getUser(env, config, id) {
  const row = await env.DB.prepare('SELECT * FROM allowed_users WHERE github_id = ?').bind(id).first();
  if (id === config.ownerId) {
    return { githubId: id, login: row?.login || env.OWNER_GITHUB_LOGIN || 'owner', displayName: env.OWNER_DISPLAY_NAME || row?.display_name || row?.login || '站点所有者', role: 'owner', active: true, isOwner: true };
  }
  if (!row || !row.active) return null;
  return { githubId: row.github_id, login: row.login, displayName: row.display_name, role: row.role, active: true, isOwner: false };
}

async function authenticate(request, env, config) {
  const raw = cookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(await sha256(raw), nowSeconds()).first();
  if (!session) return null;
  const user = await getUser(env, config, session.github_id);
  if (!user) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.token_hash).run();
    return null;
  }
  return { user, csrf: session.csrf_token, sessionHash: session.token_hash };
}

function requireAdmin(auth) {
  if (!['owner', 'admin'].includes(auth.user.role)) throw new HttpError(403, 'ADMIN_REQUIRED', '这个操作仅限管理员。');
}

function requireOwner(auth) {
  if (auth.user.role !== 'owner') throw new HttpError(403, 'OWNER_REQUIRED', '只有站点所有者可以更改管理员权限。');
}

function checkMutation(request, config, auth) {
  if (request.headers.get('Origin') !== config.origin) throw new HttpError(403, 'ORIGIN_REJECTED', '请求来源不匹配，请重新打开本站。');
  const supplied = request.headers.get('X-CSRF-Token') || '';
  let difference = supplied.length ^ auth.csrf.length;
  for (let i = 0; i < auth.csrf.length; i++) difference |= (supplied.charCodeAt(i) || 0) ^ auth.csrf.charCodeAt(i);
  if (difference) throw new HttpError(403, 'CSRF_REJECTED', '页面已失效，请刷新后重试。');
}

async function readJSON(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'JSON_REQUIRED', '请使用 JSON 请求。');
  if (Number(request.headers.get('Content-Length')) > 4096) throw new HttpError(413, 'BODY_TOO_LARGE', '提交内容过长。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON', '提交内容为空。');
  const chunks = []; let bytes = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 4096) { await reader.cancel(); throw new HttpError(413, 'BODY_TOO_LARGE', '提交内容过长。'); } chunks.push(value); }
  const combined = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(combined)); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; } catch { throw new HttpError(400, 'INVALID_JSON', '提交格式不正确。'); }
}

function auditStatement(env, actor, action, target, detail = '') {
  return env.DB.prepare('INSERT INTO access_audit (actor_id, action, target_id, target_login, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(actor.githubId, action, target.githubId, target.login, detail, nowSeconds());
}

async function prune(env) {
  const time = nowSeconds();
  await env.DB.batch([env.DB.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').bind(time), env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(time)]);
}

export function createWorker({ fetchImpl = (...args) => fetch(...args) } = {}) {
  async function githubFetch(url, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try { return await fetchImpl(url, { ...options, redirect: 'error', signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }

  async function githubUser(path, accessToken = '') {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Moments-Private-Album', 'X-GitHub-Api-Version': '2026-03-10' };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    const response = await githubFetch('https://api.github.com' + path, { headers });
    if (response.status === 404) throw new HttpError(400, 'GITHUB_USER_NOT_FOUND', '没有找到这个 GitHub 用户名，请核对后再试。');
    if (!response.ok) throw new HttpError(502, 'GITHUB_UNAVAILABLE', '暂时无法核对 GitHub 账号，请稍后重试。');
    const profile = await response.json(), id = String(profile.id || '');
    if (!validId(id) || !validLogin(profile.login) || profile.type !== 'User') throw new HttpError(400, 'INVALID_GITHUB_USER', '请选择一个有效的个人 GitHub 账号。');
    return { githubId: id, login: profile.login, displayName: String(profile.name || profile.login).slice(0, 100) };
  }

  async function beginOAuth(request, env, config) {
    if (!config.oauthReady) throw new HttpError(503, 'NOT_CONFIGURED', 'GitHub 登录尚未配置。');
    const url = new URL(request.url), state = token(), browser = token(), verifier = token();
    await prune(env);
    await env.DB.prepare('INSERT INTO oauth_states (state_hash, browser_hash, code_verifier, return_to, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256(state), await sha256(browser), verifier, safeReturn(url.searchParams.get('returnTo')), nowSeconds() + FLOW_SECONDS).run();
    const destination = new URL('https://github.com/login/oauth/authorize');
    destination.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: config.callback, scope: '', state, code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256', allow_signup: 'false', prompt: 'select_account' }).toString();
    return redirect(destination.href, [setCookie(FLOW_COOKIE, browser, FLOW_SECONDS)]);
  }

  async function finishOAuth(request, env, config, nonce) {
    const url = new URL(request.url), state = url.searchParams.get('state'), code = url.searchParams.get('code'), browser = cookie(request, FLOW_COOKIE);
    const failed = reason => redirect('/login?reason=' + reason, [clearCookie(FLOW_COOKIE)]);
    if (!config.oauthReady || !browser || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return failed('state');
    const flow = await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING code_verifier, return_to').bind(await sha256(state), await sha256(browser), nowSeconds()).first();
    if (!flow || url.searchParams.has('error') || !code || code.length > 512) return failed('state');
    try {
      const response = await githubFetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: config.callback, code_verifier: flow.code_verifier }).toString() });
      if (!response.ok) return failed('provider');
      const tokens = await response.json();
      if (tokens.error || typeof tokens.access_token !== 'string' || !tokens.access_token || String(tokens.token_type).toLowerCase() !== 'bearer') return failed('provider');
      const profile = await githubUser('/user', tokens.access_token), allowed = await getUser(env, config, profile.githubId);
      if (!allowed) {
        const denied = html(deniedPage(profile.login, nonce), nonce, 403);
        denied.headers.append('Set-Cookie', clearCookie(FLOW_COOKIE)); denied.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
        return denied;
      }
      const raw = token(), csrf = token(), time = nowSeconds();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO allowed_users (github_id, login, display_name, role, active, added_by, added_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login, display_name=excluded.display_name, last_login_at=excluded.last_login_at`).bind(profile.githubId, profile.login, profile.displayName, allowed.role === 'owner' ? 'admin' : allowed.role, config.ownerId, time, time, time),
        env.DB.prepare('INSERT INTO sessions (token_hash, github_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256(raw), profile.githubId, csrf, time, time + SESSION_SECONDS)
      ]);
      // The GitHub access token is intentionally never stored in D1 or returned to the browser.
      return redirect(safeReturn(flow.return_to), [clearCookie(FLOW_COOKIE), setCookie(SESSION_COOKIE, raw, SESSION_SECONDS)]);
    } catch { return failed('provider'); }
  }

  async function adminAPI(request, env, config, auth, url) {
    requireAdmin(auth);
    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      const result = await env.DB.prepare('SELECT * FROM allowed_users ORDER BY added_at, github_id').all();
      const owner = await getUser(env, config, config.ownerId);
      const users = [owner, ...result.results.filter(row => row.github_id !== config.ownerId).map(row => ({ githubId: row.github_id, login: row.login, displayName: row.display_name, role: row.role, active: !!row.active, isOwner: false }))];
      return json({ users });
    }
    if (url.pathname === '/api/admin/audit' && request.method === 'GET') {
      const result = await env.DB.prepare('SELECT actor_id, action, target_id, target_login, detail, created_at FROM access_audit ORDER BY id DESC LIMIT 50').all();
      return json({ events: result.results.map(row => ({ actorId: row.actor_id, action: row.action, targetId: row.target_id, targetLogin: row.target_login, detail: row.detail, createdAt: row.created_at })) });
    }
    checkMutation(request, config, auth);
    if (url.pathname === '/api/admin/users' && request.method === 'POST') {
      const body = await readJSON(request), username = typeof body.username === 'string' ? body.username.trim() : '', role = body.role || 'member';
      if (!validLogin(username)) throw new HttpError(400, 'INVALID_USERNAME', '请输入 GitHub 用户名，例如 Sg-427；邮箱和显示名不能代替用户名。');
      if (!['admin', 'member'].includes(role)) throw new HttpError(400, 'INVALID_ROLE', '权限只能是管理员或允许访问。');
      if (role === 'admin') requireOwner(auth);
      const profile = await githubUser('/users/' + encodeURIComponent(username));
      if (profile.githubId === config.ownerId) throw new HttpError(409, 'OWNER_PROTECTED', '初始管理员已受保护，无需重复添加。');
      const old = await env.DB.prepare('SELECT * FROM allowed_users WHERE github_id = ?').bind(profile.githubId).first();
      if (old?.role === 'admin') requireOwner(auth);
      const time = nowSeconds();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO allowed_users (github_id, login, display_name, role, active, added_by, added_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET login=excluded.login, display_name=excluded.display_name, role=excluded.role, active=1, updated_at=excluded.updated_at`).bind(profile.githubId, profile.login, profile.displayName, role, auth.user.githubId, time, time),
        auditStatement(env, auth.user, 'allow', profile, role === 'admin' ? '管理员' : '允许访问')
      ]);
      return json({ user: { ...profile, role, active: true } }, old ? 200 : 201);
    }
    const match = url.pathname.match(/^\/api\/admin\/users\/([1-9]\d{0,19})$/);
    if (!match || !['PATCH', 'DELETE'].includes(request.method)) throw new HttpError(404, 'NOT_FOUND', '没有找到这个操作。');
    const targetId = match[1];
    if (targetId === config.ownerId) throw new HttpError(409, 'OWNER_PROTECTED', '不能撤销或降级初始管理员。');
    const target = await env.DB.prepare('SELECT * FROM allowed_users WHERE github_id = ?').bind(targetId).first();
    if (!target) throw new HttpError(404, 'NOT_FOUND', '这个账号尚未加入白名单。');
    if (target.role === 'admin' || request.method === 'PATCH') requireOwner(auth);
    const actorTarget = { githubId: target.github_id, login: target.login };
    if (request.method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('UPDATE allowed_users SET active = 0, updated_at = ? WHERE github_id = ?').bind(nowSeconds(), targetId),
        env.DB.prepare('DELETE FROM sessions WHERE github_id = ?').bind(targetId),
        auditStatement(env, auth.user, 'revoke', actorTarget)
      ]);
      return json({ revoked: true });
    }
    const body = await readJSON(request);
    if (!['admin', 'member'].includes(body.role)) throw new HttpError(400, 'INVALID_ROLE', '请选择有效的权限。');
    await env.DB.batch([
      env.DB.prepare('UPDATE allowed_users SET role = ?, updated_at = ? WHERE github_id = ?').bind(body.role, nowSeconds(), targetId),
      auditStatement(env, auth.user, 'role', actorTarget, body.role === 'admin' ? '管理员' : '允许访问')
    ]);
    return json({ updated: true });
  }

  return {
    async fetch(request, env, ctx = {}) {
      const nonce = token(18), url = new URL(request.url);
      try {
        const config = configFor(env);
        if (url.origin !== config.origin) throw new HttpError(421, 'WRONG_HOST', '请使用已配置的站点网址。');
        if (url.pathname === '/login' && ['GET', 'HEAD'].includes(request.method)) {
          const auth = await authenticate(request, env, config);
          if (auth) return redirect(safeReturn(url.searchParams.get('returnTo')));
          return html(loginPage({ reason: url.searchParams.get('reason') || '', returnTo: safeReturn(url.searchParams.get('returnTo')), configured: config.oauthReady }, nonce), nonce);
        }
        if (url.pathname === '/auth/github' && request.method === 'GET') return await beginOAuth(request, env, config);
        if (url.pathname === '/auth/callback' && request.method === 'GET') return await finishOAuth(request, env, config, nonce);
        const auth = await authenticate(request, env, config);
        if (!auth) {
          if (url.pathname.startsWith('/api/') || (url.pathname === '/auth/logout' && request.method === 'POST')) {
            const response = json({ error: '请先使用获准的 GitHub 账号登录。', code: 'UNAUTHENTICATED' }, 401);
            response.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE)); return response;
          }
          return redirect('/login?returnTo=' + encodeURIComponent(safeReturn(url.pathname)), [clearCookie(SESSION_COOKIE)]);
        }
        if (url.pathname === '/api/auth/me' && request.method === 'GET') return json({ user: auth.user, csrfToken: auth.csrf });
        if (url.pathname === '/auth/logout' && request.method === 'POST') {
          checkMutation(request, config, auth);
          await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(auth.sessionHash).run();
          const response = json({ loggedOut: true });
          response.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE)); response.headers.append('Set-Cookie', clearCookie(FLOW_COOKIE));
          return response;
        }
        if (url.pathname === '/admin' && ['GET', 'HEAD'].includes(request.method)) { requireAdmin(auth); return html(adminPage(auth.user, auth.csrf, nonce), nonce); }
        if (url.pathname.startsWith('/api/admin/')) return await adminAPI(request, env, config, auth, url);
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) throw new HttpError(404, 'NOT_FOUND', '没有找到这个页面。');
        if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支持这个请求方法。');
        const assetURL = new URL(request.url);
        if (assetURL.pathname === '/index.html' || assetURL.pathname === '/动态相册.html' || assetURL.pathname.toLowerCase() === '/%e5%8a%a8%e6%80%81%e7%9b%b8%e5%86%8c.html') assetURL.pathname = '/';
        return protectedResponse(await env.ASSETS.fetch(new Request(assetURL, { method: request.method, headers: request.headers })), nonce, true);
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 503;
        const message = error instanceof HttpError ? error.message : '站点服务暂不可用，请稍后重试或联系管理员检查部署配置。';
        if (url.pathname.startsWith('/api/') || url.pathname === '/auth/logout') return json({ error: message, code: error instanceof HttpError ? error.code : 'SERVICE_UNAVAILABLE' }, status);
        return html(messagePage(status === 403 ? '暂不能进入这里' : '暂时无法打开', message, nonce), nonce, status);
      }
    }
  };
}

export default createWorker();
