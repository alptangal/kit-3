// $modules/couchbase/init-indexes.ts

import { cbData } from './clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { collectionSchemas, type CollectionName } from '$modules/schema';

export async function initAllIndexes(): Promise<void> {
	console.log('[initIndexes] Starting...');

	const collectionNames = Object.keys(collectionSchemas) as CollectionName[];

	for (const collectionName of collectionNames) {
		const fields = collectionSchemas[collectionName].fields as Record<
			string,
			{ searchable: boolean }
		>;
		const searchableFields = Object.entries(fields)
			.filter(([, def]) => def.searchable)
			.map(([fieldName]) => fieldName);

		if (searchableFields.length === 0) continue;

		const client = cbData(collectionName);

		for (const fieldName of searchableFields) {
			const indexName = `idx_${collectionName}_${fieldName}`;

			try {
				// CREATE INDEX IF NOT EXISTS — N1QL hỗ trợ sẵn, tự động idempotent
				const statement = `
					CREATE INDEX \`${indexName}\`
					ON \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`${collectionName}\`(\`${fieldName}\`)
				`;
				const res = await client.document.query({ statement });
				if (res.ok) {
					console.log(`[initIndexes] Created index "${indexName}"`);
				} else {
					// Nếu lỗi do index đã tồn tại, bỏ qua — không phải lỗi thật
					const msg = res.message ?? '';
					if (msg.includes('already exists') || res.status == 409) {
						console.log(`[initIndexes] Index "${indexName}" already exists — skip`);
					} else {
						throw new Error(msg);
					}
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (msg.includes('already exists')) {
					console.log(`[initIndexes] Index "${indexName}" already exists — skip`);
				} else {
					console.error(`[initIndexes] Failed to create index "${indexName}":`, e);
					throw e;
				}
			}
		}
	}

	console.log('[initIndexes] Done creating indexes');
}
