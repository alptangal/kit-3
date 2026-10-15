// tests/seed-debts-grants.mjs — seed permissions + grants cho debts trực tiếp qua Data API N1QL
// (pattern tests/seed-grants-missing.mjs — seed-data.ts chỉ chạy khi hash collectionSchemas đổi)
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const cfg = {};
for (const line of env.split('\n')) {
	const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
	if (m) cfg[m[1]] = m[2];
}

const CLUSTER = cfg.cb_clusterId;
const USERNAME = cfg.cb_username;
const PASSWORD = cfg.cb_password;
const BUCKET = cfg.cb_bucketName;
const SCOPE = cfg.cb_scopeName;

if (!CLUSTER || !USERNAME || !PASSWORD || !BUCKET || !SCOPE) {
	console.error('Missing env: cb_clusterId/cb_username/cb_password/cb_bucketName/cb_scopeName');
	process.exit(1);
}

async function n1ql(statement, args = []) {
	const res = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
		},
		body: JSON.stringify({ statement, args })
	});
	if (!res.ok) {
		throw new Error(`N1QL ${res.status}: ${await res.text()}`);
	}
	const json = await res.json();
	if (json.errors?.length) {
		throw new Error(`N1QL errors: ${JSON.stringify(json.errors)}`);
	}
	return json.results ?? [];
}

const now = new Date().toISOString();

// 1. Permissions
const permissions = [
	{ key: 'debts:read', resource: 'debts', action: 'read' },
	{ key: 'debts:manage', resource: 'debts', action: 'manage' }
];
for (const p of permissions) {
	const key = `perm-${p.key.replace(':', '-')}`;
	await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`permissions\` (KEY, VALUE) VALUES ($1, $2) RETURNING META().id`,
		[key, JSON.stringify({ ...p, description: '', createdAt: now })]
	);
	console.log('perm ok:', key);
}

// 2. Grants
const grants = [
	{ roleName: 'owner', permissionKey: 'debts:read', scope: 'all' },
	{ roleName: 'owner', permissionKey: 'debts:manage', scope: 'all' },
	{ roleName: 'manager', permissionKey: 'debts:read', scope: 'own_branch' },
	{ roleName: 'manager', permissionKey: 'debts:manage', scope: 'own_branch' },
	{ roleName: 'staff', permissionKey: 'debts:read', scope: 'own_branch' }
];
for (const g of grants) {
	const key = `grant-${g.roleName}-${g.permissionKey.replace(':', '-')}`;
	await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` (KEY, VALUE) VALUES ($1, $2) RETURNING META().id`,
		[key, JSON.stringify({ ...g, createdAt: now })]
	);
	console.log('grant ok:', key);
}

console.log('DONE — debts permissions + grants seeded');
