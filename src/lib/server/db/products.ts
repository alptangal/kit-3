// $lib/server/db/products.ts

import type { TranslateContent } from '$interfaces/basic';
import { TranslatableError } from '$lib/errors/translatable-error';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { Product, ProductVariant, Category, Brand } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { products as productMessages } from '../messages/db';

const cbProducts = cbData('products');
const cbVariants = cbData('product_variants');
const cbCategories = cbData('categories');
const cbBrands = cbData('brands');

const productsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`products\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;
const categoriesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`categories\``;
const brandsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`brands\``;

const adminMessages = {
	notFound: {
		vi: 'Không tìm thấy sản phẩm',
		en: 'Product not found'
	} as TranslateContent,
	queryFailed: {
		vi: 'Lấy danh sách sản phẩm thất bại',
		en: 'Failed to fetch product list'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo sản phẩm thất bại',
		en: 'Failed to create product'
	} as TranslateContent,
	updateFailed: {
		vi: 'Cập nhật sản phẩm thất bại',
		en: 'Failed to update product'
	} as TranslateContent,
	deleteFailed: {
		vi: 'Xoá sản phẩm thất bại',
		en: 'Failed to delete product'
	} as TranslateContent,
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	variantNotFound: {
		vi: 'Không tìm thấy biến thể sản phẩm',
		en: 'Product variant not found'
	} as TranslateContent,
	variantCreateFailed: {
		vi: 'Tạo biến thể thất bại',
		en: 'Failed to create variant'
	} as TranslateContent,
	variantUpdateFailed: {
		vi: 'Cập nhật biến thể thất bại',
		en: 'Failed to update variant'
	} as TranslateContent,
	variantDeleteFailed: {
		vi: 'Xoá biến thể thất bại',
		en: 'Failed to delete variant'
	} as TranslateContent,
	categoryNotFound: {
		vi: 'Không tìm thấy danh mục',
		en: 'Category not found'
	} as TranslateContent,
	categoryCreateFailed: {
		vi: 'Tạo danh mục thất bại',
		en: 'Failed to create category'
	} as TranslateContent,
	categoryUpdateFailed: {
		vi: 'Cập nhật danh mục thất bại',
		en: 'Failed to update category'
	} as TranslateContent,
	categoryDeleteFailed: {
		vi: 'Xoá danh mục thất bại',
		en: 'Failed to delete category'
	} as TranslateContent,
	brandNotFound: {
		vi: 'Không tìm thấy thương hiệu',
		en: 'Brand not found'
	} as TranslateContent,
	brandCreateFailed: {
		vi: 'Tạo thương hiệu thất bại',
		en: 'Failed to create brand'
	} as TranslateContent,
	brandUpdateFailed: {
		vi: 'Cập nhật thương hiệu thất bại',
		en: 'Failed to update brand'
	} as TranslateContent,
	brandDeleteFailed: {
		vi: 'Xoá thương hiệu thất bại',
		en: 'Failed to delete brand'
	} as TranslateContent,
	slugTaken: {
		vi: 'Slug đã được sử dụng',
		en: 'Slug is already taken'
	} as TranslateContent,
	skuTaken: {
		vi: 'SKU đã được sử dụng',
		en: 'SKU is already taken'
	} as TranslateContent
};

const PRODUCT_ADMIN_SAFE_FIELDS = [
	'name',
	'description',
	'categoryId',
	'brandId',
	'hasVariants',
	'variantAttributes',
	'imageUrl',
	'status',
	'createdBy',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

const VARIANT_ADMIN_SAFE_FIELDS = [
	'productId',
	'sku',
	'barcode',
	'attributes',
	'displayName',
	'price',
	'costPrice',
	'weight',
	'trackLot',
	'trackExpiry',
	'lowStockThreshold',
	'imageUrl',
	'status',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

const CATEGORY_ADMIN_SAFE_FIELDS = [
	'name',
	'slug',
	'parentId',
	'status',
	'createdAt',
	'updatedAt'
] as const;

const BRAND_ADMIN_SAFE_FIELDS = [
	'name',
	'slug',
	'logoUrl',
	'description',
	'status',
	'createdAt',
	'updatedAt'
] as const;

type ProductDocument = Product & { _id: string };
type VariantDocument = ProductVariant & { _id: string };
type CategoryDocument = Category & { _id: string };
type BrandDocument = Brand & { _id: string };

function sanitizeProductForAdmin(doc: ProductDocument) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of PRODUCT_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

function sanitizeVariantForAdmin(doc: VariantDocument) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of VARIANT_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

function sanitizeCategoryForAdmin(doc: CategoryDocument) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of CATEGORY_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

function sanitizeBrandForAdmin(doc: BrandDocument) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of BRAND_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

interface ProductAdminListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

interface VariantAdminListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

export interface ActorContext {
	roleName: string;
	userId: string;
	branchId?: string;
}

export class ProductAdminService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null,
		targetUserId?: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId,
			targetUserId
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	// ========== PRODUCTS ==========

	static async list(
		actor: ActorContext,
		options: { page?: number; pageSize?: number; includeDeleted?: boolean; search?: string; categoryId?: string; brandId?: string } = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ProductAdminListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'products:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			if (!actor.branchId) {
				return { success: false, messages: adminMessages.permissionDenied };
			}
			// Products don't have branchId directly; would need to join via inventory
			// For now, allow all if has products:read scope
		}

		if (!options.includeDeleted) {
			conditions.push('(deletedAt IS NULL OR deletedAt IS MISSING)');
		}

		if (options.search) {
			args.push(`%${options.search}%`);
			conditions.push(`name LIKE $${args.length}`);
		}

		if (options.categoryId) {
			args.push(options.categoryId);
			conditions.push(`categoryId = $${args.length}`);
		}

		if (options.brandId) {
			args.push(options.brandId);
			conditions.push(`brandId = $${args.length}`);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = `META().id AS _id, ${PRODUCT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

		const [countRes, dataRes] = await Promise.all([
			cbProducts.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${productsKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbProducts.document.query({
				statement: `SELECT ${selectClause} FROM ${productsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeProductForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	static async getById(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: Record<string, unknown> }> {
		const denied = await this.requirePermission(actor, 'products:read', null, documentKey);
		if (denied) return denied;

		const res = await cbProducts.document.get({ documentKey });
		if (!res.ok || !res.data) {
			return { success: false, messages: adminMessages.notFound };
		}

		return { success: true, data: sanitizeProductForAdmin({ ...res.data as Product, _id: documentKey }) };
	}

	static async create(
		actor: ActorContext,
		data: {
			name: string;
			description?: string;
			categoryId?: string;
			brandId?: string;
			hasVariants: boolean;
			variantAttributes?: Record<string, string[]>; // { size: ['S','M','L'], color: ['red','blue'] }
			imageUrl?: string;
			status?: string;
		}
	): Promise<{ success: boolean; messages: TranslateContent; documentKey?: string }> {
		const denied = await this.requirePermission(actor, 'products:create');
		if (denied) return denied;

		// Validate category exists
		if (data.categoryId) {
			const catRes = await cbCategories.document.get({ documentKey: data.categoryId });
			if (!catRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
		}

		// Validate brand exists
		if (data.brandId) {
			const brandRes = await cbBrands.document.get({ documentKey: data.brandId });
			if (!brandRes.ok) return { success: false, messages: adminMessages.brandNotFound };
		}

		const now = new Date().toISOString();
		const documentKey = `product::${crypto.randomUUID()}`;

		const productDoc: Product = {
			name: data.name.trim(),
			description: data.description ?? '',
			categoryId: data.categoryId ?? null,
			brandId: data.brandId ?? null,
			hasVariants: data.hasVariants,
			variantAttributes: data.variantAttributes ?? null,
			imageUrl: data.imageUrl ?? null,
			status: data.status ?? 'active',
			createdBy: actor.userId,
			createdAt: now,
			updatedAt: now,
			deletedAt: null
		};

		try {
			const res = await cbProducts.document.create({
				documentKey,
				content: productDoc
			});
			if (!res.ok) return { success: false, messages: adminMessages.createFailed };
			return { success: true, messages: { vi: 'Tạo sản phẩm thành công', en: 'Product created successfully' }, documentKey };
		} catch {
			return { success: false, messages: adminMessages.createFailed };
		}
	}

	static async update(
		actor: ActorContext,
		documentKey: string,
		data: {
			name?: string;
			description?: string;
			categoryId?: string | null;
			brandId?: string | null;
			hasVariants?: boolean;
			variantAttributes?: Record<string, string[]> | null;
			imageUrl?: string | null;
			status?: string;
		}
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbProducts.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(actor, 'products:update', null, documentKey);
		if (denied) return denied;

		// Validate category
		if (data.categoryId !== undefined && data.categoryId) {
			const catRes = await cbCategories.document.get({ documentKey: data.categoryId });
			if (!catRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
		}

		// Validate brand
		if (data.brandId !== undefined && data.brandId) {
			const brandRes = await cbBrands.document.get({ documentKey: data.brandId });
			if (!brandRes.ok) return { success: false, messages: adminMessages.brandNotFound };
		}

		const updatePayload: Partial<Product> = { updatedAt: new Date().toISOString() };
		if (data.name !== undefined) updatePayload.name = data.name.trim();
		if (data.description !== undefined) updatePayload.description = data.description;
		if (data.categoryId !== undefined) updatePayload.categoryId = data.categoryId;
		if (data.brandId !== undefined) updatePayload.brandId = data.brandId;
		if (data.hasVariants !== undefined) updatePayload.hasVariants = data.hasVariants;
		if (data.variantAttributes !== undefined) updatePayload.variantAttributes = data.variantAttributes;
		if (data.imageUrl !== undefined) updatePayload.imageUrl = data.imageUrl;
		if (data.status !== undefined) updatePayload.status = data.status;

		try {
			const res = await cbProducts.document.update({ documentKey, content: updatePayload as Product });
			if (!res.ok) return { success: false, messages: adminMessages.updateFailed };
			return { success: true, messages: { vi: 'Cập nhật sản phẩm thành công', en: 'Product updated successfully' } };
		} catch {
			return { success: false, messages: adminMessages.updateFailed };
		}
	}

	static async delete(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbProducts.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(actor, 'products:delete', null, documentKey);
		if (denied) return denied;

		// Check if has variants
		const variantCheck = await cbVariants.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} WHERE productId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
			args: [documentKey],
			readonly: true
		});
		if (variantCheck.ok && Number(variantCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: { vi: 'Sản phẩm có biến thể, không thể xoá', en: 'Product has variants, cannot delete' } };
		}

		try {
			const res = await cbProducts.document.update({
				documentKey,
				content: { deletedAt: new Date().toISOString(), status: 'discontinued' } as Partial<Product> as Product
			});
			if (!res.ok) return { success: false, messages: adminMessages.deleteFailed };
			return { success: true, messages: { vi: 'Xoá sản phẩm thành công', en: 'Product deleted successfully' } };
		} catch {
			return { success: false, messages: adminMessages.deleteFailed };
		}
	}

	// ========== VARIANTS ==========

	static async listVariants(
		actor: ActorContext,
		options: { page?: number; pageSize?: number; includeDeleted?: boolean; productId?: string; search?: string } = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & VariantAdminListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'products:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (!options.includeDeleted) {
			conditions.push('(deletedAt IS NULL OR deletedAt IS MISSING)');
		}

		if (options.productId) {
			args.push(options.productId);
			conditions.push(`productId = $${args.length}`);
		}

		if (options.search) {
			args.push(`%${options.search}%`);
			conditions.push(`(sku LIKE $${args.length} OR displayName LIKE $${args.length} OR barcode LIKE $${args.length})`);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = `META().id AS _id, ${VARIANT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

		const [countRes, dataRes] = await Promise.all([
			cbVariants.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbVariants.document.query({
				statement: `SELECT ${selectClause} FROM ${variantsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeVariantForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	static async getVariantById(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: Record<string, unknown> }> {
		const denied = await this.requirePermission(actor, 'products:read', null, documentKey);
		if (denied) return denied;

		const res = await cbVariants.document.get({ documentKey });
		if (!res.ok || !res.data) {
			return { success: false, messages: adminMessages.variantNotFound };
		}

		return { success: true, data: sanitizeVariantForAdmin({ ...res.data as ProductVariant, _id: documentKey }) };
	}

	static async createVariant(
		actor: ActorContext,
		data: {
			productId: string;
			sku: string;
			barcode?: string;
			attributes: Record<string, string>; // { size: 'S', color: 'red' }
			displayName: string;
			price: number;
			costPrice?: number;
			weight?: number;
			trackLot?: boolean;
			trackExpiry?: boolean;
			lowStockThreshold?: number;
			imageUrl?: string;
			status?: string;
		}
	): Promise<{ success: boolean; messages: TranslateContent; documentKey?: string }> {
		const denied = await this.requirePermission(actor, 'products:create');
		if (denied) return denied;

		// Validate product exists
		const prodRes = await cbProducts.document.get({ documentKey: data.productId });
		if (!prodRes.ok) return { success: false, messages: adminMessages.notFound };

		// Check SKU unique
		const skuCheck = await cbVariants.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} WHERE sku = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
			args: [data.sku.trim().toUpperCase()],
			readonly: true
		});
		if (skuCheck.ok && Number(skuCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: adminMessages.skuTaken };
		}

		const now = new Date().toISOString();
		const documentKey = `variant::${crypto.randomUUID()}`;

		const variantDoc: ProductVariant = {
			productId: data.productId,
			sku: data.sku.trim().toUpperCase(),
			barcode: data.barcode ?? null,
			attributes: data.attributes,
			displayName: data.displayName.trim(),
			price: data.price,
			costPrice: data.costPrice ?? null,
			weight: data.weight ?? null,
			trackLot: data.trackLot ?? false,
			trackExpiry: data.trackExpiry ?? false,
			lowStockThreshold: data.lowStockThreshold ?? null,
			imageUrl: data.imageUrl ?? null,
			status: data.status ?? 'active',
			createdAt: now,
			updatedAt: now,
			deletedAt: null
		};

		try {
			const res = await cbVariants.document.create({ documentKey, content: variantDoc });
			if (!res.ok) return { success: false, messages: adminMessages.variantCreateFailed };
			return { success: true, messages: { vi: 'Tạo biến thể thành công', en: 'Variant created successfully' }, documentKey };
		} catch {
			return { success: false, messages: adminMessages.variantCreateFailed };
		}
	}

	static async updateVariant(
		actor: ActorContext,
		documentKey: string,
		data: {
			sku?: string;
			barcode?: string | null;
			attributes?: Record<string, string>;
			displayName?: string;
			price?: number;
			costPrice?: number | null;
			weight?: number | null;
			trackLot?: boolean;
			trackExpiry?: boolean;
			lowStockThreshold?: number | null;
			imageUrl?: string | null;
			status?: string;
		}
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbVariants.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.variantNotFound };

		const denied = await this.requirePermission(actor, 'products:update', null, documentKey);
		if (denied) return denied;

		// Check SKU unique if changing
		if (data.sku !== undefined) {
			const skuCheck = await cbVariants.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} WHERE sku = $1 AND META().id != $2 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
				args: [data.sku.trim().toUpperCase(), documentKey],
				readonly: true
			});
			if (skuCheck.ok && Number(skuCheck.data?.results?.[0] ?? 0) > 0) {
				return { success: false, messages: adminMessages.skuTaken };
			}
		}

		const updatePayload: Partial<ProductVariant> = { updatedAt: new Date().toISOString() };
		if (data.sku !== undefined) updatePayload.sku = data.sku.trim().toUpperCase();
		if (data.barcode !== undefined) updatePayload.barcode = data.barcode;
		if (data.attributes !== undefined) updatePayload.attributes = data.attributes;
		if (data.displayName !== undefined) updatePayload.displayName = data.displayName.trim();
		if (data.price !== undefined) updatePayload.price = data.price;
		if (data.costPrice !== undefined) updatePayload.costPrice = data.costPrice;
		if (data.weight !== undefined) updatePayload.weight = data.weight;
		if (data.trackLot !== undefined) updatePayload.trackLot = data.trackLot;
		if (data.trackExpiry !== undefined) updatePayload.trackExpiry = data.trackExpiry;
		if (data.lowStockThreshold !== undefined) updatePayload.lowStockThreshold = data.lowStockThreshold;
		if (data.imageUrl !== undefined) updatePayload.imageUrl = data.imageUrl;
		if (data.status !== undefined) updatePayload.status = data.status;

		try {
			const res = await cbVariants.document.update({ documentKey, content: updatePayload as ProductVariant });
			if (!res.ok) return { success: false, messages: adminMessages.variantUpdateFailed };
			return { success: true, messages: { vi: 'Cập nhật biến thể thành công', en: 'Variant updated successfully' } };
		} catch {
			return { success: false, messages: adminMessages.variantUpdateFailed };
		}
	}

	static async deleteVariant(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbVariants.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.variantNotFound };

		const denied = await this.requirePermission(actor, 'products:delete', null, documentKey);
		if (denied) return denied;

		// Check if variant has inventory
		const invCheck = await cbData('inventory_stock').document.query({
			statement: `SELECT RAW COUNT(*) FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\` WHERE variantId = $1`,
			args: [documentKey],
			readonly: true
		});
		if (invCheck.ok && Number(invCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: { vi: 'Biến thể có tồn kho, không thể xoá', en: 'Variant has inventory, cannot delete' } };
		}

		try {
			const res = await cbVariants.document.update({
				documentKey,
				content: { deletedAt: new Date().toISOString(), status: 'discontinued' } as Partial<ProductVariant> as ProductVariant
			});
			if (!res.ok) return { success: false, messages: adminMessages.variantDeleteFailed };
			return { success: true, messages: { vi: 'Xoá biến thể thành công', en: 'Variant deleted successfully' } };
		} catch {
			return { success: false, messages: adminMessages.variantDeleteFailed };
		}
	}

	// ========== CATEGORIES ==========

	static async listCategories(
		actor: ActorContext,
		options: { page?: number; pageSize?: number; includeDeleted?: boolean; parentId?: string | null } = {}
	): Promise<{ success: false; messages: TranslateContent } | { success: true; categories: Record<string, unknown>[] }> {
		const denied = await this.requirePermission(actor, 'products:read');
		if (denied) return denied;

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: string[] = [];

		if (!options.includeDeleted) {
			// Categories don't have deletedAt in schema, skip
		}

		if (options.parentId !== undefined) {
			if (options.parentId) {
				args.push(options.parentId);
				conditions.push(`parentId = $${args.length}`);
			} else {
				conditions.push('(parentId IS NULL OR parentId IS MISSING)');
			}
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = `META().id AS _id, ${CATEGORY_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

		const res = await cbCategories.document.query({
			statement: `SELECT ${selectClause} FROM ${categoriesKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
			args,
			readonly: true
		});

		if (!res.ok) return { success: false, messages: adminMessages.queryFailed };

		const categories = (res.data?.results ?? []).map(sanitizeCategoryForAdmin);
		return { success: true, categories };
	}

	static async getCategoryById(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: Record<string, unknown> }> {
		const denied = await this.requirePermission(actor, 'products:read', null, documentKey);
		if (denied) return denied;

		const res = await cbCategories.document.get({ documentKey });
		if (!res.ok || !res.data) {
			return { success: false, messages: adminMessages.categoryNotFound };
		}

		return { success: true, data: sanitizeCategoryForAdmin({ ...res.data as Category, _id: documentKey }) };
	}

	static async createCategory(
		actor: ActorContext,
		data: { name: string; slug: string; parentId?: string; status?: string }
	): Promise<{ success: boolean; messages: TranslateContent; documentKey?: string }> {
		const denied = await this.requirePermission(actor, 'products:create');
		if (denied) return denied;

		// Check slug unique
		const slugCheck = await cbCategories.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${categoriesKeyspace} WHERE slug = $1`,
			args: [data.slug.trim().toLowerCase()],
			readonly: true
		});
		if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: adminMessages.slugTaken };
		}

		// Validate parent exists
		if (data.parentId) {
			const parentRes = await cbCategories.document.get({ documentKey: data.parentId });
			if (!parentRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
		}

		const now = new Date().toISOString();
		const documentKey = `category::${crypto.randomUUID()}`;

		const categoryDoc: Category = {
			name: data.name.trim(),
			slug: data.slug.trim().toLowerCase(),
			parentId: data.parentId ?? null,
			status: data.status ?? 'active',
			createdAt: now,
			updatedAt: now
		};

		try {
			const res = await cbCategories.document.create({ documentKey, content: categoryDoc });
			if (!res.ok) return { success: false, messages: adminMessages.categoryCreateFailed };
			return { success: true, messages: { vi: 'Tạo danh mục thành công', en: 'Category created successfully' }, documentKey };
		} catch {
			return { success: false, messages: adminMessages.categoryCreateFailed };
		}
	}

	static async updateCategory(
		actor: ActorContext,
		documentKey: string,
		data: { name?: string; slug?: string; parentId?: string | null; status?: string }
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbCategories.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.categoryNotFound };

		const denied = await this.requirePermission(actor, 'products:update', null, documentKey);
		if (denied) return denied;

		if (data.slug !== undefined) {
			const slugCheck = await cbCategories.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${categoriesKeyspace} WHERE slug = $1 AND META().id != $2`,
				args: [data.slug.trim().toLowerCase(), documentKey],
				readonly: true
			});
			if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
				return { success: false, messages: adminMessages.slugTaken };
			}
		}

		if (data.parentId !== undefined && data.parentId) {
			const parentRes = await cbCategories.document.get({ documentKey: data.parentId });
			if (!parentRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
			// Prevent circular reference
			if (data.parentId === documentKey) {
				return { success: false, messages: { vi: 'Danh mục không thể là cha của chính nó', en: 'Category cannot be its own parent' } };
			}
		}

		const updatePayload: Partial<Category> = { updatedAt: new Date().toISOString() };
		if (data.name !== undefined) updatePayload.name = data.name.trim();
		if (data.slug !== undefined) updatePayload.slug = data.slug.trim().toLowerCase();
		if (data.parentId !== undefined) updatePayload.parentId = data.parentId;
		if (data.status !== undefined) updatePayload.status = data.status;

		try {
			const res = await cbCategories.document.update({ documentKey, content: updatePayload as Category });
			if (!res.ok) return { success: false, messages: adminMessages.categoryUpdateFailed };
			return { success: true, messages: { vi: 'Cập nhật danh mục thành công', en: 'Category updated successfully' } };
		} catch {
			return { success: false, messages: adminMessages.categoryUpdateFailed };
		}
	}

	static async deleteCategory(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbCategories.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.categoryNotFound };

		const denied = await this.requirePermission(actor, 'products:delete', null, documentKey);
		if (denied) return denied;

		// Check if has children
		const childCheck = await cbCategories.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${categoriesKeyspace} WHERE parentId = $1`,
			args: [documentKey],
			readonly: true
		});
		if (childCheck.ok && Number(childCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: { vi: 'Danh mục có danh mục con, không thể xoá', en: 'Category has children, cannot delete' } };
		}

		// Check if used by products
		const prodCheck = await cbProducts.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${productsKeyspace} WHERE categoryId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
			args: [documentKey],
			readonly: true
		});
		if (prodCheck.ok && Number(prodCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: { vi: 'Danh mục đang được sử dụng bởi sản phẩm', en: 'Category is used by products' } };
		}

		try {
			const res = await cbCategories.document.delete({ documentKey });
			if (!res.ok) return { success: false, messages: adminMessages.categoryDeleteFailed };
			return { success: true, messages: { vi: 'Xoá danh mục thành công', en: 'Category deleted successfully' } };
		} catch {
			return { success: false, messages: adminMessages.categoryDeleteFailed };
		}
	}

	// ========== BRANDS ==========

	static async listBrands(
		actor: ActorContext,
		options: { page?: number; pageSize?: number; includeDeleted?: boolean; search?: string } = {}
	): Promise<{ success: false; messages: TranslateContent } | { success: true; brands: Record<string, unknown>[] }> {
		const denied = await this.requirePermission(actor, 'products:read');
		if (denied) return denied;

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: string[] = [];

		if (options.search) {
			args.push(`%${options.search}%`);
			conditions.push(`name LIKE $${args.length}`);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = `META().id AS _id, ${BRAND_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

		const res = await cbBrands.document.query({
			statement: `SELECT ${selectClause} FROM ${brandsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
			args,
			readonly: true
		});

		if (!res.ok) return { success: false, messages: adminMessages.queryFailed };

		const brands = (res.data?.results ?? []).map(sanitizeBrandForAdmin);
		return { success: true, brands };
	}

	static async getBrandById(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: Record<string, unknown> }> {
		const denied = await this.requirePermission(actor, 'products:read', null, documentKey);
		if (denied) return denied;

		const res = await cbBrands.document.get({ documentKey });
		if (!res.ok || !res.data) {
			return { success: false, messages: adminMessages.brandNotFound };
		}

		return { success: true, data: sanitizeBrandForAdmin({ ...res.data as Brand, _id: documentKey }) };
	}

	static async createBrand(
		actor: ActorContext,
		data: { name: string; slug: string; logoUrl?: string; description?: string; status?: string }
	): Promise<{ success: boolean; messages: TranslateContent; documentKey?: string }> {
		const denied = await this.requirePermission(actor, 'products:create');
		if (denied) return denied;

		// Check slug unique
		const slugCheck = await cbBrands.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${brandsKeyspace} WHERE slug = $1`,
			args: [data.slug.trim().toLowerCase()],
			readonly: true
		});
		if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: adminMessages.slugTaken };
		}

		const now = new Date().toISOString();
		const documentKey = `brand::${crypto.randomUUID()}`;

		const brandDoc: Brand = {
			name: data.name.trim(),
			slug: data.slug.trim().toLowerCase(),
			logoUrl: data.logoUrl ?? null,
			description: data.description ?? '',
			status: data.status ?? 'active',
			createdAt: now,
			updatedAt: now
		};

		try {
			const res = await cbBrands.document.create({ documentKey, content: brandDoc });
			if (!res.ok) return { success: false, messages: adminMessages.brandCreateFailed };
			return { success: true, messages: { vi: 'Tạo thương hiệu thành công', en: 'Brand created successfully' }, documentKey };
		} catch {
			return { success: false, messages: adminMessages.brandCreateFailed };
		}
	}

	static async updateBrand(
		actor: ActorContext,
		documentKey: string,
		data: { name?: string; slug?: string; logoUrl?: string | null; description?: string; status?: string }
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbBrands.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.brandNotFound };

		const denied = await this.requirePermission(actor, 'products:update', null, documentKey);
		if (denied) return denied;

		if (data.slug !== undefined) {
			const slugCheck = await cbBrands.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${brandsKeyspace} WHERE slug = $1 AND META().id != $2`,
				args: [data.slug.trim().toLowerCase(), documentKey],
				readonly: true
			});
			if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
				return { success: false, messages: adminMessages.slugTaken };
			}
		}

		const updatePayload: Partial<Brand> = { updatedAt: new Date().toISOString() };
		if (data.name !== undefined) updatePayload.name = data.name.trim();
		if (data.slug !== undefined) updatePayload.slug = data.slug.trim().toLowerCase();
		if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl;
		if (data.description !== undefined) updatePayload.description = data.description;
		if (data.status !== undefined) updatePayload.status = data.status;

		try {
			const res = await cbBrands.document.update({ documentKey, content: updatePayload as Brand });
			if (!res.ok) return { success: false, messages: adminMessages.brandUpdateFailed };
			return { success: true, messages: { vi: 'Cập nhật thương hiệu thành công', en: 'Brand updated successfully' } };
		} catch {
			return { success: false, messages: adminMessages.brandUpdateFailed };
		}
	}

	static async deleteBrand(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbBrands.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.brandNotFound };

		const denied = await this.requirePermission(actor, 'products:delete', null, documentKey);
		if (denied) return denied;

		// Check if used by products
		const prodCheck = await cbProducts.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${productsKeyspace} WHERE brandId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
			args: [documentKey],
			readonly: true
		});
		if (prodCheck.ok && Number(prodCheck.data?.results?.[0] ?? 0) > 0) {
			return { success: false, messages: { vi: 'Thương hiệu đang được sử dụng bởi sản phẩm', en: 'Brand is used by products' } };
		}

		try {
			const res = await cbBrands.document.delete({ documentKey });
			if (!res.ok) return { success: false, messages: adminMessages.brandDeleteFailed };
			return { success: true, messages: { vi: 'Xoá thương hiệu thành công', en: 'Brand deleted successfully' } };
		} catch {
			return { success: false, messages: adminMessages.brandDeleteFailed };
		}
	}
}