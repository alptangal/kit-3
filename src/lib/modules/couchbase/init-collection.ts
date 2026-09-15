// $modules/couchbase/init-collections.ts

import {
	cb_organizationId,
	cb_projectId,
	cb_scopeName,
	cb_api_key_secret,
	cb_bucketId,
	cb_clusterIdManagement
} from '$env/static/private';
import { couchbase } from '$modules/couchbase';
import { encryption } from '$modules/encryption';
import { collectionSchemas, type CollectionName } from '$modules/schema';
import { cbData } from './clients';

const cbManagement = couchbase.managementData({
	apiKeySecret: cb_api_key_secret,
	organizationId: cb_organizationId
});

const collectionsApi = cbManagement.collections({
	projectId: cb_projectId,
	clusterId: cb_clusterIdManagement,
	bucketId: cb_bucketId,
	scopeName: cb_scopeName
});

export async function initAllCollections(): Promise<void> {
	const collectionSchemasHashed = await encryption.getDataHash(collectionSchemas);
	const res = await cbData('system').document.get({ documentKey: 'initApp' });
	if (res.status == 404 || res.data?.collectionSchemasHashed != collectionSchemasHashed) {
		console.log('[initCollections] Starting...');

		const existing = await collectionsApi.list();
		const existingNames = new Set(
			(existing as any)?.data?.map((c: { name: string }) => c.name) ?? []
		);

		const collectionNames = Object.keys(collectionSchemas) as CollectionName[];

		for (const name of collectionNames) {
			if (existingNames.has(name)) {
				console.log(`[initCollections] Collection "${name}" already exists — skip`);
				continue;
			}

			try {
				await collectionsApi.create({ name });
				console.log(`[initCollections] Created collection "${name}"`);
			} catch (e) {
				console.error(`[initCollections] Failed to create collection "${name}":`, e);
				throw e;
			}
		}
		console.log('[initCollections] Done creating collections');
	} else {
		console.log('[initCollections] Done created collections');
	}
}
