import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(path.join(root, '..', '动态相册.html'), 'utf8');
const client = await readFile(path.join(root, 'src', 'auth-client.js'), 'utf8');
if (source.includes('id="cloud-auth-controls"')) throw new Error('The local source already has cloud controls. Use the original local HTML.');
const controls = `<div id="cloud-auth-controls" hidden><span id="cloud-account-label" class="profile-account"></span><a class="quiet" role="menuitem" id="cloud-admin-link" href="/admin" hidden><svg><use href="#i-settings"/></svg>管理员</a><button class="quiet" role="menuitem" id="cloud-logout" type="button">退出登录</button></div>`;
const anchor = '<!-- cloud-account-slot -->';
if (!source.includes(anchor) || !source.includes('</body>')) throw new Error('Album structure changed; review the build injection points.');
let html = source.replace(anchor, controls);
html = html.replace('</body>', `<script data-cloudflare-auth>\n${client.replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist', 'index.html'), html);
console.log(`Built protected album (${Buffer.byteLength(html)} bytes). Only dist/ is deployed as assets.`);
