// $modules/couchbase/seed-data.ts
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
	console.log('[seed] Starting catalog seed...');
	await seedRoles();
	await seedPermissions();
	await seedDetailRoles();
	await seedUserStatus();
	console.log('[seed] Done seeding catalog data');
}
