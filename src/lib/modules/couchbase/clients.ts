// $modules/couchbase/clients.ts
import { couchbase } from '$modules/couchbase';
import {
	cb_clusterId,
	cb_username,
	cb_password,
	cb_bucketName,
	cb_scopeName
} from '$env/static/private';
import {
	cb_clusterId_vault,
	cb_username_vault,
	cb_password_vault,
	cb_bucketName_vault,
	cb_scopeName_vault
} from '$env/static/private';

const cb = couchbase();

// ===== Client cho cluster DATA =====
export const cbData = (collectionName: string) => {
	return cb.dataApi({
		clusterId: cb_clusterId,
		username: cb_username,
		password: cb_password,
		bucketName: cb_bucketName,
		scopeName: cb_scopeName,
		collectionName
	});
};

// ===== Client cho cluster VAULT — dùng credential HOÀN TOÀN KHÁC =====
export const cbVault = (collectionName: string) =>
	cb.dataApi({
		clusterId: cb_clusterId_vault,
		username: cb_username_vault,
		password: cb_password_vault,
		bucketName: cb_bucketName_vault,
		scopeName: cb_scopeName_vault,
		collectionName
	});
