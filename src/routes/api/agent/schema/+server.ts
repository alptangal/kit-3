// src/routes/api/agent/schema/+server.ts
// GET — REST catalog cho AI agent/LLM hiểu cấu trúc hệ thống.
// KHÔNG encrypt (agent đọc raw JSON), auth bắt buộc (hooks) + chỉ roleName='owner'.
// Sinh collections từ collectionSchemas (tự động theo schema, không hardcode field).

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAgentActor, agentUnauthorized } from '$lib/server/agent-auth';
import { collectionSchemas } from '$modules/schema';
import type { CollectionName } from '$modules/schema';
// SỬA:KHÔNG được `await import('$env/static/private')` (namespace import) — Rollup phải
// materialize TOÀN BỘ module env (~400 biến máy, gồm CLAUDE_CODE_EXECPATH/USERPROFILE/ProgramData...)
// thành object namespace trong chunk → @vercel/nft coi các chuỗi path đó là file references
// và quét cả cây C:\Users, C:\WINDOWS, C:\ProgramData khi build adapter → EPERM (adguard.db).
// Chỉ dùng named import để Vite inline ĐÚNG các biến được dùng.
import { cb_bucketName, cb_scopeName } from '$env/static/private';

const RESERVED_WORDS = ['key', 'scope', 'value'];

const RELATIONSHIPS = [
	{ from: 'products', to: 'product_variants', via: 'product_variants.productId = products (META().id)', note: '1 sản phẩm nhiều biến thể' },
	{ from: 'product_variants', to: 'inventory_stock', via: 'inventory_stock.variantId = product_variants (META().id)', note: 'tồn tổng theo chi nhánh' },
	{ from: 'product_variants', to: 'inventory_lots', via: 'inventory_lots.variantId = product_variants (META().id)', note: 'tồn theo lô' },
	{ from: 'inventory_lots', to: 'stock_movements', via: 'stock_movements.lotId = inventory_lots (META().id)', note: 'lịch sử di chuyển từng lô' },
	{ from: 'product_variants', to: 'stock_movements', via: 'stock_movements.variantId = product_variants (META().id)', note: 'lịch sử di chuyển theo biến thể' },
	{ from: 'purchase_orders', to: 'suppliers', via: 'purchase_orders.supplierId = suppliers (META().id)', note: 'đơn nhập thuộc NCC' },
	{ from: 'orders', to: 'payments', via: 'payments.orderId = orders (META().id)', note: '1 đơn nhiều thanh toán' },
	{ from: 'price_history', to: 'product_variants', via: 'price_history.variantId = product_variants (META().id)', note: 'lịch sử giá nhập/bán' },
	{ from: 'operating_expenses', to: 'name_branches', via: 'operating_expenses.branchId = name_branches (META().id)', note: 'chi phí theo chi nhánh' },
	{ from: 'cameras', to: 'name_branches', via: 'cameras.branchId = name_branches (META().id)', note: 'camera theo chi nhánh' }
] as const;

const PERMISSION_KEYS = [
	// users
	'users:manage',
	// catalog
	'products:create', 'products:read', 'products:update', 'products:delete',
	'inventory:view', 'inventory:adjust',
	// orders
	'orders:create', 'orders:read', 'orders:update', 'orders:refund', 'orders:delete',
	// purchasing
	'suppliers:read', 'suppliers:manage', 'purchase_orders:create', 'purchase_orders:approve',
	'purchases:read', 'purchases:manage',
	// warehouse ops
	'stock_transfers:create', 'stock_transfers:approve', 'stock_takes:perform', 'reports:view',
	// payments & fulfillment
	'payments:read', 'payments:manage', 'shipments:read', 'shipments:manage',
	'fulfillment:read', 'fulfillment:manage',
	// content & marketing
	'blog:read', 'blog:manage', 'campaigns:read', 'campaigns:manage', 'social:read', 'social:manage',
	// comms
	'notifications:read', 'notifications:manage', 'email_logs:read', 'email_logs:manage',
	// ops
	'expenses:read', 'expenses:manage', 'cameras:read', 'cameras:manage',
	// analytics
	'analytics:read'
] as const;

const PERMISSION_NOTES: Record<string, string> = {
	'users:manage': 'Tạo/sửa/khoá/xoá người dùng + xem danh sách',
	'products:create': 'Tạo sản phẩm/biến thể/thương hiệu/danh mục',
	'products:read': 'Xem sản phẩm, biến thể, tồn kho',
	'products:update': 'Sửa sản phẩm/biến thể (ghi price_history khi đổi giá)',
	'products:delete': 'Xoá mềm sản phẩm/biến thể',
	'inventory:view': 'Xem tồn kho',
	'inventory:adjust': 'Điều chỉnh tồn (stock movement)',
	'orders:create': 'Tạo đơn hàng (POS/storefront)',
	'orders:read': 'Xem đơn hàng',
	'orders:update': 'Cập nhật trạng thái đơn',
	'orders:refund': 'Hoàn đơn',
	'orders:delete': 'Xoá đơn',
	'suppliers:read': 'Xem NCC + đơn nhập',
	'suppliers:manage': 'Quản lý NCC + trạng thái đơn nhập',
	'purchase_orders:create': 'Tạo đơn nhập',
	'purchase_orders:approve': 'Duyệt đơn nhập',
	'purchases:read': 'Xem nhập hàng đa kiểu',
	'purchases:manage': 'Quản lý nhập hàng đa kiểu',
	'stock_transfers:create': 'Chuyển kho giữa chi nhánh',
	'stock_transfers:approve': 'Duyệt chuyển kho',
	'stock_takes:perform': 'Kiểm kê',
	'reports:view': 'Xem báo cáo',
	'payments:read': 'Xem thanh toán',
	'payments:manage': 'Xử lý thanh toán',
	'shipments:read': 'Xem vận đơn',
	'shipments:manage': 'Cập nhật vận đơn',
	'fulfillment:read': 'Xem xử lý đơn',
	'fulfillment:manage': 'Điều phối xử lý đơn',
	'blog:read': 'Đọc bài viết',
	'blog:manage': 'Soạn/quản lý bài viết',
	'campaigns:read': 'Xem chiến dịch marketing',
	'campaigns:manage': 'Quản lý chiến dịch',
	'social:read': 'Xem tài khoản + bài social',
	'social:manage': 'Đăng/quản lý social',
	'notifications:read': 'Xem thông báo',
	'notifications:manage': 'Gửi thông báo',
	'email_logs:read': 'Xem log email',
	'email_logs:manage': 'Quản lý log email',
	'expenses:read': 'Xem chi phí vận hành',
	'expenses:manage': 'Quản lý chi phí vận hành',
	'cameras:read': 'Xem camera',
	'cameras:manage': 'Quản lý camera',
	'analytics:read': 'Xem thống kê biến động giá/khối lượng/tồn kho'
};

export const GET: RequestHandler = async (event) => {
	try {
		// Session HOẶC Bearer sk-... (Secret Key API) — pattern requireAgentActor
		const actor = await requireAgentActor(event);
		if (!actor) {
			return agentUnauthorized(event);
		}
		if (actor.roleName !== 'owner') {
			return json(
				{
					ok: false,
					message: {
						vi: 'Chỉ owner mới được truy cập catalog schema',
						en: 'Only owner can access the schema catalog'
					}
				},
				{ status: 403 }
			);
		}

		const collections = (Object.keys(collectionSchemas) as CollectionName[]).map((name) => ({
			name,
			keyspace: `${cb_bucketName}.${cb_scopeName}.${name}`,
			fields: Object.entries(collectionSchemas[name].fields).map(([fieldName, def]) => ({
				name: fieldName,
				type: def.type,
				searchable: def.searchable,
				sortable: def.sortable,
				selectable: def.selectable
			}))
		}));

		return json({
			generatedAt: new Date().toISOString(),
			bucket: cb_bucketName,
			scope: cb_scopeName,
			keyspaceFormat: '`<bucket>`.`<scope>`.`<collection>`',
			collections,
			relationships: RELATIONSHIPS,
			permissions: PERMISSION_KEYS.map((key) => ({ key, note: PERMISSION_NOTES[key] ?? '' })),
			conventions: {
				keyspace: 'Truy vấn dùng `bucket`.`scope`.`collection` (backtick bắt buộc khi có ký tự đặc biệt)',
				reservedWords: RESERVED_WORDS,
				blindIndex:
					'Email/phone KHÔNG query được trực tiếp — hệ thống lưu HMAC blind index (vd phoneBlindIndex). Không có key → không search chính xác, chỉ được search các field đánh dấu searchable:true.',
				legacyDocs:
					'Document import từ MongoDB cũ có field bọc lớp { value: X } — legacyId là ID nguồn trong hệ cũ.',
				date: 'ISO 8601 string (vd 2026-10-14T02:30:00.000Z)',
				softDelete: 'Nhiều collection dùng deletedAt (IS NULL / IS MISSING khi còn hoạt động)',
				encryption:
					'API admin mã hoá RSA — endpoint này là NGOẠI LỆ trả raw JSON cho agent đọc.'
			},
			queryExamples: [
				`SELECT * FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`products\` WHERE status='active' LIMIT 20`,
				`SELECT p.name, v.sku, v.price FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\` v JOIN \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`products\` p ON v.productId = META(p).id WHERE v.status='active' LIMIT 20`,
				`SELECT status, COUNT(*) AS cnt FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\` GROUP BY status`,
				`SELECT SUM(totalCost) AS total FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`purchase_orders\` WHERE status='received'`
			]
		});
	} catch (e) {
		console.error('[GET /api/agent/schema]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
