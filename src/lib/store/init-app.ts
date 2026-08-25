// $store/init-app.ts

import { initAllCollections } from '$modules/couchbase/init-collection';
import { initAllIndexes } from '$modules/couchbase/init-indexes';
import { seedAllCatalogData } from '$modules/couchbase/seed-data';
import { initSystemVault } from './initSystemVault';

export async function initApp(): Promise<void> {
	console.log('=== App initialization started ===');

	// 1. Vault trước tiên — cần systemVault.privateKey/indexKey sẵn sàng
	//    trước khi bất kỳ route nào chạy (kể cả init collection không cần vault,
	//    nhưng đảm bảo thứ tự rõ ràng, tránh phụ thuộc ngầm)
	await initSystemVault();
	console.log('[initApp] Vault ready');

	// 2. Tạo collection (idempotent — bỏ qua nếu đã tồn tại)
	await initAllCollections();

	// 3. Tạo index (idempotent)
	await initAllIndexes();

	// 4. Seed dữ liệu catalog mặc định (idempotent)
	await seedAllCatalogData();
	console.log('=== App initialization completed ===');
}
