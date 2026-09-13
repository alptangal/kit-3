// $modules/couchbase/seed-data.ts
//
import { email_owner, password_owner, username_owner } from '$env/static/private';
import { encryption } from '$modules/encryption';
import { collectionSchemas } from '$modules/schema';
import { systemVault } from '$store/initSystemVault';
import { cbData } from './clients';

const cbRoles = cbData('name_roles');
const cbPermissions = cbData('permissions');
const cbDetailRoles = cbData('detail_roles');
const cbUserStatus = cbData('user_status');

async function seedIfNotExists(
	client: ReturnType<typeof cbData>,
	documentKey: string,
	content: Record<string, any>
): Promise<void> {
	const existing = await client.document.get({ documentKey }).catch(() => null);
	if (existing?.ok) {
		console.log(`[seed] "${documentKey}" already exists — skip`);
		return;
	}
	const res = await client.document.create({ documentKey, content });
	if (!res.ok) {
		throw new Error(`[seed] Failed to create "${documentKey}": ${res.message}`);
	}
	console.log(`[seed] Created "${documentKey}"`);
}

export async function seedRoles(): Promise<void> {
	const now = new Date().toISOString();
	const roles = [
		{ key: 'role-owner', name: 'owner', displayName: 'Chủ cửa hàng', level: 100 },
		{ key: 'role-manager', name: 'manager', displayName: 'Quản lý', level: 50 },
		{ key: 'role-staff', name: 'staff', displayName: 'Nhân viên', level: 10 },
		{ key: 'role-customer', name: 'customer', displayName: 'Khách hàng', level: 0 }
	];

	for (const r of roles) {
		await seedIfNotExists(cbRoles, r.key, {
			name: r.name,
			displayName: r.displayName,
			description: '',
			level: r.level,
			isSystem: true,
			createdAt: now,
			updatedAt: now
		});
	}
}

export async function seedPermissions(): Promise<void> {
	const now = new Date().toISOString();
	const permissions = [
		{ key: 'products:create', resource: 'products', action: 'create' },
		{ key: 'products:read', resource: 'products', action: 'read' },
		{ key: 'products:update', resource: 'products', action: 'update' },
		{ key: 'products:delete', resource: 'products', action: 'delete' },

		{ key: 'orders:create', resource: 'orders', action: 'create' },
		{ key: 'orders:read', resource: 'orders', action: 'read' },
		{ key: 'orders:update', resource: 'orders', action: 'update' },
		{ key: 'orders:refund', resource: 'orders', action: 'refund' },

		{ key: 'inventory:view', resource: 'inventory', action: 'read' },
		{ key: 'inventory:adjust', resource: 'inventory', action: 'update' },

		{ key: 'purchase_orders:create', resource: 'purchase_orders', action: 'create' },
		{ key: 'purchase_orders:approve', resource: 'purchase_orders', action: 'approve' },

		{ key: 'stock_transfers:create', resource: 'stock_transfers', action: 'create' },
		{ key: 'stock_transfers:approve', resource: 'stock_transfers', action: 'approve' },

		{ key: 'stock_takes:perform', resource: 'stock_takes', action: 'create' },

		{ key: 'suppliers:manage', resource: 'suppliers', action: 'manage' },
		{ key: 'users:manage', resource: 'users', action: 'manage' },
		{ key: 'reports:view', resource: 'reports', action: 'read' }
	];

	for (const p of permissions) {
		await seedIfNotExists(cbPermissions, `perm-${p.key.replace(':', '-')}`, {
			...p,
			description: '',
			createdAt: now
		});
	}
}

export async function seedDetailRoles(): Promise<void> {
	const now = new Date().toISOString();
	const grants: { roleName: string; permissionKey: string; scope: string }[] = [
		// Owner — toàn quyền
		...[
			'products:create',
			'products:read',
			'products:update',
			'products:delete',
			'orders:create',
			'orders:read',
			'orders:update',
			'orders:refund',
			'inventory:view',
			'inventory:adjust',
			'purchase_orders:create',
			'purchase_orders:approve',
			'stock_transfers:create',
			'stock_transfers:approve',
			'stock_takes:perform',
			'suppliers:manage',
			'users:manage',
			'reports:view'
		].map((key) => ({ roleName: 'owner', permissionKey: key, scope: 'all' })),

		// Manager — quản lý trong phạm vi chi nhánh mình
		{ roleName: 'manager', permissionKey: 'products:create', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'products:read', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'products:update', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'orders:read', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'orders:refund', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'inventory:view', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'inventory:adjust', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'purchase_orders:create', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'purchase_orders:approve', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'stock_transfers:create', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'stock_takes:perform', scope: 'own_branch' },
		{ roleName: 'manager', permissionKey: 'reports:view', scope: 'own_branch' },
		// Manager cũng cần quản lý user trong chi nhánh mình (vd khoá/mở tài khoản staff) —
		// thiếu grant này thì UserAdminService.setStatus/setRole/delete/list sẽ luôn từ chối manager.
		{ roleName: 'manager', permissionKey: 'users:manage', scope: 'own_branch' },

		// Staff — thao tác cơ bản, phạm vi hẹp
		{ roleName: 'staff', permissionKey: 'products:read', scope: 'own_branch' },
		{ roleName: 'staff', permissionKey: 'orders:create', scope: 'own_records' },
		{ roleName: 'staff', permissionKey: 'orders:read', scope: 'own_branch' },
		{ roleName: 'staff', permissionKey: 'inventory:view', scope: 'own_branch' },
		{ roleName: 'staff', permissionKey: 'stock_takes:perform', scope: 'own_branch' },

		// Customer — chỉ tạo/xem đơn của chính mình
		{ roleName: 'customer', permissionKey: 'orders:create', scope: 'own_records' },
		{ roleName: 'customer', permissionKey: 'orders:read', scope: 'own_records' }
	];

	for (const g of grants) {
		const key = `grant-${g.roleName}-${g.permissionKey.replace(':', '-')}`;
		await seedIfNotExists(cbDetailRoles, key, { ...g, createdAt: now });
	}
}

export async function seedUserStatus(): Promise<void> {
	const now = new Date().toISOString();
	const statuses = [
		{ key: 'status-active', name: 'active', canLogin: true },
		{ key: 'status-suspended', name: 'suspended', canLogin: false },
		{ key: 'status-banned', name: 'banned', canLogin: false },
		{ key: 'status-pending_verification', name: 'pending_verification', canLogin: false }
	];

	for (const s of statuses) {
		await seedIfNotExists(cbUserStatus, s.key, {
			name: s.name,
			description: '',
			canLogin: s.canLogin,
			createdAt: now,
			updatedAt: now
		});
	}
}

export async function seedAllCatalogData(): Promise<void> {
	const collectionSchemasHashed = await encryption.getDataHash(collectionSchemas);
	const res = await cbData('system').document.get({ documentKey: 'initApp' });
	if (res.status == 404 || res.data?.initApp?.collectionSchemasHashed != collectionSchemasHashed) {
		console.log('[seed] Starting catalog seed...');
		await seedRoles();
		await seedPermissions();
		await seedDetailRoles();
		await seedUserStatus();
		await createAdminAccount({
			username: username_owner,
			password: password_owner,
			email: email_owner
		});
		const initAppContent = {
			initApp: {
				status: 'success',
				collectionSchemasHashed,
				createdAt: new Date().toISOString()
			}
		};
		if (res.status == 404) {
			await cbData('system').document.create({
				documentKey: 'initApp',
				content: initAppContent
			});
		} else {
			await cbData('system').document.update({
				documentKey: 'initApp',
				content: initAppContent
			});
		}

		console.log('[seed] Done seeding catalog data');
	} else {
		console.log('[seed] Catalog already up to date — skip');
	}
}

export async function createAdminAccount(data: {
	username: string;
	password: string;
	email: string;
}) {
	const collectionName = 'users';
	const { username, email, password } = data;
	const documentKey = `${collectionName}-${username}`;
	// SỬA: trước đây `if (!systemVault.indexKey) return;` âm thầm bỏ qua việc tạo admin,
	// nhưng seedAllCatalogData() vẫn ghi initApp = success ngay sau đó -> lần chạy sau
	// hệ thống nghĩ đã seed xong, admin account vĩnh viễn không được tạo và không tự retry.
	// Nay throw để lỗi này không bị nuốt âm thầm.
	if (!systemVault.indexKey) {
		throw new Error('[seed] Cannot create admin account: systemVault.indexKey chưa được khởi tạo');
	}
	const cbUser = cbData(collectionName);
	const normalizedEmail = email.trim().toLowerCase();
	const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);
	const existing = await cbUser.document.get({ documentKey });
	if (existing.ok && existing.data) {
		console.log(`[seed] "${collectionName}-administrator" already exists — skip`);
		return;
	}
	const { dek, storageRecord } = await encryption.setupVault(password);
	const emailEncrypted = JSON.stringify(await encryption.encryptData(dek, normalizedEmail));

	const normalizedUsername = username.trim().toLowerCase();
	const usernameBlindIndex = await encryption.hmacBlindIndex(
		systemVault.indexKey,
		normalizedUsername
	);
	// Admin account bootstrap không thu thập số điện thoại — dùng chuỗi rỗng nhất quán
	// cho cả blind index lẫn giá trị mã hoá, để field vẫn hợp lệ theo schema (required)
	// mà không phải bịa số điện thoại giả.
	const phoneBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, '');
	const phoneEncrypted = JSON.stringify(await encryption.encryptData(dek, ''));
	const profileEncrypted = JSON.stringify(await encryption.encryptData(dek, JSON.stringify({})));

	const userDoc = {
		firstname: 'Administrator',
		lastname: null,
		midname: null,
		description: '',
		// Đồng bộ với schema mới: roleId/statusId trỏ tới catalog thay vì hardcode string
		statusId: 'status-active',
		roleId: 'role-owner',

		emailBlindIndex,
		emailEncrypted,
		phoneBlindIndex,
		phoneEncrypted,
		usernameBlindIndex,
		profileEncrypted,

		vaultSaltB64: storageRecord.saltB64,
		vaultDekIvB64: storageRecord.dekIvB64,
		vaultWrappedDekB64: storageRecord.wrappedDekB64,

		authMethod: 'password' as const,
		webauthnCredentials: [],
		webauthnUserHandle: crypto.randomUUID(),

		mfaEnabled: false,
		lastLoginAt: null,
		lastLoginIp: null,
		remember: false,

		// branchId / customerTierEncrypted CỐ Ý bỏ trống — owner không gắn với 1 chi nhánh
		// cụ thể và không phải customer, nên 2 field này giờ là optional trong schema
		// (xem ghi chú trong collectionSchemas.users).

		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null
	};
	const rs = await cbUser.document.create({
		documentKey,
		content: userDoc
	});
	if (rs.ok) {
		console.log(`[seed] "${collectionName}-administrator" created succesful`);
	} else {
		// SỬA: trước đây chỉ log, không throw -> seedAllCatalogData vẫn ghi initApp=success
		// dù tạo admin thất bại. Nay throw để dừng seeding và giữ trạng thái có thể retry.
		throw new Error(
			`[seed] "${collectionName}-administrator" create failed: ${rs.message ?? rs.status}`
		);
	}
}
