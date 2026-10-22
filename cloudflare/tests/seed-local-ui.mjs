// Local-only browser test fixture. Never part of migrations or the Worker bundle.
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const now = Math.floor(Date.now() / 1000), expires = now + 1800;
const owner = randomBytes(32).toString('base64url'), member = randomBytes(32).toString('base64url');
const csrf = randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const sql = `INSERT OR REPLACE INTO allowed_users (github_id,login,display_name,role,active,added_by,added_at,updated_at) VALUES ('205340307','Sg-427','水果榨汁','admin',1,'205340307',${now},${now});
INSERT OR REPLACE INTO allowed_users (github_id,login,display_name,role,active,added_by,added_at,updated_at) VALUES ('9000000301','local-ui-member','本地测试账号','member',1,'205340307',${now},${now});
INSERT OR REPLACE INTO sessions (token_hash,github_id,csrf_token,created_at,expires_at) VALUES ('${hash(owner)}','205340307','${csrf}',${now},${expires});
INSERT OR REPLACE INTO sessions (token_hash,github_id,csrf_token,created_at,expires_at) VALUES ('${hash(member)}','9000000301','${csrf}',${now},${expires});`;
await mkdir(new URL('../.wrangler/', import.meta.url), { recursive: true });
await writeFile(new URL('../.wrangler/local-ui-seed.sql', import.meta.url), sql);
await writeFile(new URL('../.wrangler/local-ui-session.json', import.meta.url), JSON.stringify({ owner, member }));
console.log('Local-only test fixtures prepared.');
