// Seed grants + permissions CHO TÍNH NĂNG MỚI (transfers/returns) vào DB đang chạy
// (idempotent — UPSERT). DB không tự re-seed → chạy script này 1 lần sau khi
// thêm permission keys mới vào seed-data.ts.
// Copy pattern tests/seed-grants-missing.mjs.
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
	const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
	if (m) env[m[1]] = m[2].trim();
}
const CLUSTER = env.cb_clusterId;
const USER = env.cb_username;
const PASS = env.cb_password;
const BUCKET = env.cb_bucketName;
const SCOPE = env.cb_scopeName;
const BASIC = Buffer.from(`${USER}:${PASS}`).toString('base64');

const now = new Date().toISOString();

// 1. Permission docs (collection `permissions`) — key: perm-<resource>-<action>
const permissions = [
	['transfers:read', 'stock_transfers', 'read'],
	['transfers:manage', 'stock_transfers', 'manage'],
	['returns:read', 'order_returns', 'read'],
	['returns:manage', 'order_returns', 'manage']
];

// 2. Grants (collection `detail_roles`) — key: grant-<role>-<resource>-<action>
const grants = [
	['owner', 'transfers:read', 'all'],
	['owner', 'transfers:manage', 'all'],
	['owner', 'returns:read', 'all'],
	['owner', 'returns:manage', 'all'],
	['manager', 'transfers:read', 'own_branch'],
	['manager', 'transfers:manage', 'own_branch'],
	['manager', 'returns:read', 'own_branch'],
	['manager', 'returns:manage', 'own_branch'],
	['staff', 'transfers:read', 'own_branch'],
	['staff', 'returns:read', 'own_branch']
];

let done = 0;
const total = permissions.length + grants.length;

async function upsert(collection, key, doc) {
	const r = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
		method: 'POST',
		headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			statement: `UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`${collection}\` (KEY, VALUE) VALUES ('${key}', ${doc}) RETURNING META().id`
		})
	});
	const j = await r.json().catch(() => ({}));
	if (r.status === 200 && (!j.errors || !j.errors.length)) {
		done++;
		console.log('OK', `${collection}/${key}`);
	} else {
		console.log('FAIL', `${collection}/${key}`, JSON.stringify(j.errors ?? j).slice(0, 200));
	}
}

for (const [key, resource, action] of permissions) {
	const doc = JSON.stringify({ key, resource, action, description: '', createdAt: now });
	await upsert('permissions', `perm-${key.replace(':', '-')}`, doc);
}

for (const [roleName, permissionKey, scopeName] of grants) {
	const key = `grant-${roleName}-${permissionKey.replace(':', '-')}`;
	const doc = JSON.stringify({ roleName, permissionKey, scope: scopeName, createdAt: now });
	await upsert('detail_roles', key, doc);
}

console.log(`Done: ${done}/${total}`);
