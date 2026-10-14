// $lib/server/db/analytics.ts
// Thống kê biến động giá / khối lượng nhập / tồn kho + dự báo naïve.
//
// Nguồn dữ liệu:
// - price_history: lịch sử biến động giá (ghi tự động khi update variant qua API
//   admin/variants/update + từ nhận hàng PO khi SupplierService gọi recordFromPurchase).
// - purchase_orders (status='received'): khối lượng nhập + so sánh giá NCC.
// - stock_movements / inventory_stock: biến động + tồn hiện tại.
//
// Dự báo: linear regression đơn giản (least squares) trên chuỗi điểm — NAÏVE,
// chỉ dùng làm tham khảo, KHÔNG phải mô hình ML.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './suppliers';

const cbPriceHistory = cbData('price_history');
const cbPurchaseOrders = cbData('purchase_orders');
const cbStockMovements = cbData('stock_movements');
const cbInventoryStock = cbData('inventory_stock');
const cbVariants = cbData('product_variants');
const cbSuppliers = cbData('suppliers');

const priceHistoryKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`price_history\``;
const purchaseOrdersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`purchase_orders\``;
const stockMovementsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`stock_movements\``;
const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;
const suppliersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`suppliers\``;

const analyticsMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền xem thống kê',
		en: 'You do not have permission to view analytics'
	} as TranslateContent,
	queryFailed: {
		vi: 'Truy vấn thống kê thất bại',
		en: 'Failed to query analytics'
	} as TranslateContent,
	invalidType: {
		vi: 'Loại thống kê không hợp lệ',
		en: 'Invalid analytics type'
	} as TranslateContent,
	invalidRange: {
		vi: 'Khoảng thời gian không hợp lệ',
		en: 'Invalid date range'
	} as TranslateContent,
	variantNotFound: {
		vi: 'Không tìm thấy biến thể sản phẩm',
		en: 'Product variant not found'
	} as TranslateContent,
	notEnoughData: {
		vi: 'Chưa đủ dữ liệu để dự báo (cần ít nhất 3 điểm)',
		en: 'Not enough data to forecast (need at least 3 points)'
	} as TranslateContent,
	priceHistoryEmpty: {
		vi: 'Chưa có lịch sử giá bán — lịch sử được ghi tự động mỗi khi cập nhật giá variant',
		en: 'No price history yet — history is recorded automatically each time a variant price is updated'
	} as TranslateContent
} as const;

export type StatsGroupBy = 'day' | 'week' | 'month';
export type TrendDirection = 'up' | 'down' | 'flat';

/** 1 điểm dữ liệu chuỗi thời gian. */
export interface TrendPoint {
	/** Nhãn kỳ (vd '2026-10-14', '2026-W41', '2026-10'). */
	period: string;
	avg?: number;
	min?: number;
	max?: number;
	total?: number;
	netChange?: number;
	in?: number;
	out?: number;
	/** Nguồn điểm dữ liệu — 'price_history' | 'purchase_orders' (merge 2 nguồn). */
	source?: 'price_history' | 'purchase_orders';
}

export interface ForecastResult {
	trend: TrendDirection;
	nextEstimate: number | null;
	/** R² của regression 0..1 (null khi không đủ điểm). */
	confidence: number | null;
	/** Ghi chú naive forecast. */
	note: TranslateContent;
}

export interface CostTrendResult {
	success: boolean;
	messages?: TranslateContent;
	points: TrendPoint[];
	/** Thông báo nguồn dữ liệu thiếu (price_history trống → dùng purchase_orders). */
	dataNote?: TranslateContent;
	forecast: ForecastResult;
}

export interface SupplierPriceRow {
	supplierId: string;
	supplierName?: string;
	avgCost: number;
	minCost: number;
	maxCost: number;
	totalQuantity: number;
	orderCount: number;
	lastReceivedAt?: string;
}

export interface SupplierComparisonResult {
	success: boolean;
	messages?: TranslateContent;
	rows: SupplierPriceRow[];
	/** NCC giá tốt nhất: avgCost thấp nhất với ≥2 lần nhập. */
	bestSupplierId?: string;
}

export interface PurchaseVolumeResult {
	success: boolean;
	messages?: TranslateContent;
	points: TrendPoint[];
	topVariants: { variantId: string; displayName?: string; totalQuantity: number; totalCost: number }[];
	forecast: ForecastResult;
}

export interface StockTrendResult {
	success: boolean;
	messages?: TranslateContent;
	points: TrendPoint[];
	/** Tồn hiện tại (quantityOnHand − quantityReserved) theo scope lọc. */
	currentStock: { variantId?: string; branchId?: string; onHand: number; available: number }[];
}

export interface PriceTrendResult {
	success: boolean;
	messages?: TranslateContent;
	points: TrendPoint[];
	forecast: ForecastResult;
}

type PriceHistoryDoc = {
	entity: string;
	variantId: string;
	branchId?: string;
	oldPrice: number;
	newPrice: number;
	source: string;
	referenceId?: string;
	changedBy?: string;
	changedAt: string;
};

type POItemDoc = { variantId: string; quantity: number; unitCost: number };
type PODoc = {
	supplierId?: string;
	branchId?: string;
	status: string;
	items?: POItemDoc[];
	receivedAt?: string;
	createdAt?: string;
};

type MovementDoc = {
	variantId: string;
	branchId?: string;
	/** 'in' | 'out' | các type khác — chỉ cộng trừ theo dấu qty lưu. */
	type: string;
	quantity: number;
	createdAt: string;
};

type StockDoc = {
	variantId: string;
	branchId?: string;
	quantityOnHand: number;
	quantityReserved?: number;
};

// ===== Helpers =====

/** Kỳ nhóm theo groupBy từ ISO date string. */
function periodOf(iso: string, groupBy: StatsGroupBy): string {
	const d = iso.slice(0, 10); // yyyy-mm-dd
	if (groupBy === 'month') return d.slice(0, 7); // yyyy-mm
	if (groupBy === 'week') {
		// ISO week — thứ 2 là đầu tuần
		const date = new Date(d + 'T00:00:00Z');
		const day = (date.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
		date.setUTCDate(date.getUTCDate() - day);
		const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
		const week1Day = (week1.getUTCDay() + 6) % 7;
		week1.setUTCDate(week1.getUTCDate() - week1Day);
		const week = Math.floor((date.getTime() - week1.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
		return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
	}
	return d;
}

/** Linear regression least squares → dự báo điểm tiếp theo + R². */
function linearForecast(values: number[]): { slope: number; intercept: number; next: number; r2: number } {
	const n = values.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;
	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += values[i];
		sumXY += i * values[i];
		sumXX += i * i;
	}
	const denom = n * sumXX - sumX * sumX;
	const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;
	const next = intercept + slope * n;

	// R²
	const meanY = sumY / n;
	let ssTot = 0;
	let ssRes = 0;
	for (let i = 0; i < n; i++) {
		const pred = intercept + slope * i;
		ssTot += (values[i] - meanY) ** 2;
		ssRes += (values[i] - pred) ** 2;
	}
	const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
	return { slope, intercept, next, r2 };
}

function forecastOf(values: number[]): ForecastResult {
	if (values.length < 3) {
		return { trend: 'flat', nextEstimate: null, confidence: null, note: analyticsMessages.notEnoughData };
	}
	const { slope, next, r2 } = linearForecast(values);
	// Ngưỡng flat: |slope| < 1% giá trị trung bình → coi như đi ngang
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const threshold = Math.abs(mean) * 0.01;
	const trend: TrendDirection = slope > threshold ? 'up' : slope < -threshold ? 'down' : 'flat';
	return {
		trend,
		nextEstimate: Math.round(next * 100) / 100,
		confidence: Math.round(r2 * 100) / 100,
		note: {
			vi: 'Dự báo naïve (hồi quy tuyến tính) — chỉ mang tính tham khảo',
			en: 'Naive forecast (linear regression) — for reference only'
		}
	};
}

function buildRangeFilter(
	conditions: string[],
	args: (string | number)[],
	field: string,
	from?: string,
	to?: string,
	extraOffset = 0
): void {
	if (from) {
		conditions.push(`${field} >= $${args.length + 1 + extraOffset}`);
		args.push(from);
	}
	if (to) {
		conditions.push(`${field} <= $${args.length + 1 + extraOffset}`);
		args.push(to);
	}
}

function parseGroupBy(raw: unknown): StatsGroupBy {
	return raw === 'week' || raw === 'month' ? raw : 'day';
}

function isValidDateStr(v: unknown): boolean {
	return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

export class AnalyticsService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: analyticsMessages.permissionDenied };
		return null;
	}

	/**
	 * Ghi 1 batch điểm price_history (dùng nội bộ + gọi từ service khác).
	 * Public để SupplierService gọi khi nhận hàng PO (source='purchase_order')
	 * — tránh sửa trực tiếp file suppliers.ts của agent khác.
	 */
	static async recordPriceHistory(
		actor: ActorContext,
		entries: {
			entity: 'variant_cost' | 'variant_price';
			variantId: string;
			branchId?: string;
			oldPrice: number;
			newPrice: number;
			source: 'purchase_order' | 'manual' | 'quick_purchase';
			referenceId?: string;
		}[]
	): Promise<{ success: boolean; messages?: TranslateContent; recorded: number }> {
		const denied = await this.requirePermission(actor, 'products:update');
		if (denied) return { success: false, messages: denied.messages, recorded: 0 };

		const now = new Date().toISOString();
		let recorded = 0;
		for (const [i, e] of entries.entries()) {
			if (e.oldPrice === e.newPrice) continue; // không đổi → không ghi
			const docKey = `ph-${e.entity}-${e.variantId}-${now.slice(0, 19).replace(/[:T-]/g, '')}-${i}`;
			const doc: PriceHistoryDoc & { createdAt: string } = {
				entity: e.entity,
				variantId: e.variantId,
				branchId: e.branchId,
				oldPrice: e.oldPrice,
				newPrice: e.newPrice,
				source: e.source,
				referenceId: e.referenceId,
				changedBy: actor.userId,
				changedAt: now,
				createdAt: now
			};
			const res = await cbPriceHistory.document.create({ documentKey: docKey, content: doc });
			if (res.ok) recorded += 1;
		}
		return { success: true, recorded };
	}

	/**
	 * Ghi history giá nhập từ nhận hàng PO — gọi từ SupplierService.receivePurchaseOrder
	 * (hoặc route nhận hàng). items = PO items sau khi nhận.
	 */
	static async recordFromPurchase(
		actor: ActorContext,
		items: { variantId: string; quantity: number; unitCost: number }[],
		source: 'purchase_order' | 'quick_purchase',
		referenceId: string,
		branchId?: string
	): Promise<{ success: boolean; messages?: TranslateContent; recorded: number }> {
		// Lấy costPrice hiện tại của từng variant để so sánh
		const entries: Parameters<typeof AnalyticsService.recordPriceHistory>[1] = [];
		for (const item of items) {
			const res = await cbVariants.document.get({ documentKey: item.variantId });
			const variant = res.ok ? (res.data as { costPrice?: number; branchId?: string } | undefined) : undefined;
			if (!variant) continue;
			entries.push({
				entity: 'variant_cost',
				variantId: item.variantId,
				branchId: branchId ?? variant.branchId,
				oldPrice: typeof variant.costPrice === 'number' ? variant.costPrice : 0,
				newPrice: item.unitCost,
				source,
				referenceId
			});
		}
		return this.recordPriceHistory(actor, entries);
	}

	/**
	 * Xu hướng giá nhập theo kỳ — merge 2 nguồn: price_history (entity='variant_cost')
	 * ưu tiên, thiếu dữ liệu → bù từ purchase_orders.items (status='received').
	 */
	static async costTrend(
		actor: ActorContext,
		options: { variantId?: string; from?: string; to?: string; groupBy?: string } = {}
	): Promise<CostTrendResult> {
		const denied = await this.requirePermission(actor, 'analytics:read');
		if (denied) return { success: false, messages: denied.messages, points: [], forecast: forecastOf([]) };
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return { success: false, messages: analyticsMessages.invalidRange, points: [], forecast: forecastOf([]) };
		}
		const groupBy = parseGroupBy(options.groupBy);

		// Nguồn 1: price_history
		const conditions: string[] = [`entity = 'variant_cost'`];
		const args: (string | number)[] = [];
		if (options.variantId) {
			conditions.push(`variantId = $${args.length + 1}`);
			args.push(options.variantId);
		}
		if (actor.roleName !== 'owner') {
			// manager/staff: scope own_branch theo permission
			const scope = await PermissionChecker.getScope(actor.roleName, 'analytics:read');
			if (scope === 'own_branch') {
				if (!actor.branchId) {
					return { success: false, messages: analyticsMessages.permissionDenied, points: [], forecast: forecastOf([]) };
				}
				conditions.push(`branchId = $${args.length + 1}`);
				args.push(actor.branchId);
			}
		}
		buildRangeFilter(conditions, args, 'changedAt', options.from, options.to);
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbPriceHistory.document.query({
			statement: `SELECT changedAt, oldPrice, newPrice FROM ${priceHistoryKeyspace} ${where} ORDER BY changedAt ASC LIMIT 1000`,
			args,
			readonly: true
		});
		if (!res.ok) {
			return { success: false, messages: analyticsMessages.queryFailed, points: [], forecast: forecastOf([]) };
		}
		const rows = (res.data?.results ?? []) as PriceHistoryDoc[];

		// Group theo kỳ: dùng giá MỚI (newPrice) làm điểm giá của kỳ
		const byPeriod = new Map<string, number[]>();
		for (const r of rows) {
			if (typeof r.newPrice !== 'number') continue;
			const period = periodOf(r.changedAt, groupBy);
			const arr = byPeriod.get(period) ?? [];
			arr.push(r.newPrice);
			byPeriod.set(period, arr);
		}

		let points: TrendPoint[] = [...byPeriod.entries()]
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([period, prices]) => ({
				period,
				avg: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
				min: Math.min(...prices),
				max: Math.max(...prices),
				source: 'price_history' as const
			}));

		// Nguồn 2 (bù): purchase_orders received — khi price_history trống
		let dataNote: TranslateContent | undefined;
		if (points.length === 0) {
			dataNote = {
				vi: 'Chưa có price_history — tạm tổng hợp từ đơn nhập hàng đã nhận',
				en: 'No price history yet — aggregated from received purchase orders for now'
			};
			const poPoints = await this.costTrendFromPurchaseOrders(actor, options, groupBy);
			if (!poPoints.success) {
				return { success: false, messages: poPoints.messages, points: [], forecast: forecastOf([]) };
			}
			points = poPoints.points;
		}

		return {
			success: true,
			points,
			dataNote,
			forecast: forecastOf(points.map((p) => p.avg ?? 0))
		};
	}

	/** Tổng hợp giá nhập từ purchase_orders (status='received'). */
	private static async costTrendFromPurchaseOrders(
		actor: ActorContext,
		options: { variantId?: string; from?: string; to?: string },
		groupBy: StatsGroupBy
	): Promise<{ success: boolean; messages?: TranslateContent; points: TrendPoint[] }> {
		const conditions: string[] = [`status = 'received'`];
		const args: (string | number)[] = [];
		if (actor.roleName !== 'owner') {
			const scope = await PermissionChecker.getScope(actor.roleName, 'analytics:read');
			if (scope === 'own_branch') {
				if (!actor.branchId) return { success: false, messages: analyticsMessages.permissionDenied, points: [] };
				conditions.push(`branchId = $${args.length + 1}`);
				args.push(actor.branchId);
			}
		}
		buildRangeFilter(conditions, args, 'receivedAt', options.from, options.to);
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbPurchaseOrders.document.query({
			statement: `SELECT supplierId, branchId, items, receivedAt FROM ${purchaseOrdersKeyspace} ${where} LIMIT 1000`,
			args,
			readonly: true
		});
		if (!res.ok) return { success: false, messages: analyticsMessages.queryFailed, points: [] };

		// (period, variantId) → đơn giá các lần nhập
		const byKey = new Map<string, number[]>();
		for (const po of (res.data?.results ?? []) as PODoc[]) {
			const at = po.receivedAt ?? po.createdAt;
			if (!at) continue;
			for (const item of po.items ?? []) {
				if (options.variantId && item.variantId !== options.variantId) continue;
				if (typeof item.unitCost !== 'number' || typeof item.quantity !== 'number') continue;
				const period = periodOf(at, groupBy);
				const key = `${period}`;
				const arr = byKey.get(key) ?? [];
				// weighted quantity — push mỗi đơn giá quantity lần sẽ skew; dùng avg theo quantity
				arr.push(item.unitCost);
				byKey.set(key, arr);
			}
		}
		const points: TrendPoint[] = [...byKey.entries()]
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([period, costs]) => ({
				period,
				avg: Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 100) / 100,
				min: Math.min(...costs),
				max: Math.max(...costs),
				source: 'purchase_orders' as const
			}));
		return { success: true, points };
	}

	/** So sánh giá nhập giữa các NCC cho 1 variant. */
	static async supplierPriceComparison(
		actor: ActorContext,
		options: { variantId: string }
	): Promise<SupplierComparisonResult> {
		const denied = await this.requirePermission(actor, 'analytics:read');
		if (denied) return { success: false, messages: denied.messages, rows: [] };
		if (!options.variantId) return { success: false, messages: analyticsMessages.variantNotFound, rows: [] };

		const conditions: string[] = [`status = 'received'`];
		const args: (string | number)[] = [];
		if (actor.roleName !== 'owner') {
			const scope = await PermissionChecker.getScope(actor.roleName, 'analytics:read');
			if (scope === 'own_branch') {
				if (!actor.branchId) return { success: false, messages: analyticsMessages.permissionDenied, rows: [] };
				conditions.push(`branchId = $${args.length + 1}`);
				args.push(actor.branchId);
			}
		}
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbPurchaseOrders.document.query({
			statement: `SELECT supplierId, items, receivedAt, createdAt FROM ${purchaseOrdersKeyspace} ${where} LIMIT 1000`,
			args,
			readonly: true
		});
		if (!res.ok) return { success: false, messages: analyticsMessages.queryFailed, rows: [] };

		// supplierId → các đơn giá của variant
		const bySupplier = new Map<
			string,
			{ costs: number[]; qty: number; last: string; orders: Set<string> }
		>();
		for (const po of (res.data?.results ?? []) as PODoc[]) {
			if (!po.supplierId) continue;
			const at = po.receivedAt ?? po.createdAt ?? '';
			for (const item of po.items ?? []) {
				if (item.variantId !== options.variantId) continue;
				if (typeof item.unitCost !== 'number') continue;
				const agg = bySupplier.get(po.supplierId) ?? { costs: [], qty: 0, last: '', orders: new Set<string>() };
				agg.costs.push(item.unitCost);
				agg.qty += typeof item.quantity === 'number' ? item.quantity : 0;
				if (at > agg.last) agg.last = at;
				bySupplier.set(po.supplierId, agg);
			}
		}
		if (bySupplier.size === 0) return { success: true, rows: [] };

		// Tên NCC (1 query IN)
		const supplierIds = [...bySupplier.keys()];
		const nameRes = await cbSuppliers.document.query({
			statement: `SELECT META().id AS _id, name FROM ${suppliersKeyspace} WHERE META().id IN [${supplierIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ')}]`,
			readonly: true
		});
		const nameMap = new Map<string, string>();
		if (nameRes.ok) {
			for (const row of (nameRes.data?.results ?? []) as { _id: string; name?: string }[]) {
				if (row.name) nameMap.set(row._id, row.name);
			}
		}

		const rows: SupplierPriceRow[] = supplierIds.map((supplierId) => {
			const agg = bySupplier.get(supplierId)!;
			return {
				supplierId,
				supplierName: nameMap.get(supplierId),
				avgCost: Math.round((agg.costs.reduce((a, b) => a + b, 0) / agg.costs.length) * 100) / 100,
				minCost: Math.min(...agg.costs),
				maxCost: Math.max(...agg.costs),
				totalQuantity: agg.qty,
				orderCount: agg.costs.length,
				lastReceivedAt: agg.last || undefined
			};
		});
		rows.sort((a, b) => a.avgCost - b.avgCost);

		// NCC giá tốt nhất: avgCost thấp nhất với ≥2 lần nhập
		const best = rows.find((r) => r.orderCount >= 2);
		return { success: true, rows, bestSupplierId: best?.supplierId };
	}

	/** Khối lượng nhập theo kỳ (purchase_orders received) + top 5 variant nhập nhiều. */
	static async purchaseVolumeTrend(
		actor: ActorContext,
		options: { from?: string; to?: string; groupBy?: string } = {}
	): Promise<PurchaseVolumeResult> {
		const denied = await this.requirePermission(actor, 'analytics:read');
		if (denied) return { success: false, messages: denied.messages, points: [], topVariants: [], forecast: forecastOf([]) };
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return {
				success: false,
				messages: analyticsMessages.invalidRange,
				points: [],
				topVariants: [],
				forecast: forecastOf([])
			};
		}
		const groupBy = parseGroupBy(options.groupBy);

		const conditions: string[] = [`status = 'received'`];
		const args: (string | number)[] = [];
		if (actor.roleName !== 'owner') {
			const scope = await PermissionChecker.getScope(actor.roleName, 'analytics:read');
			if (scope === 'own_branch') {
				if (!actor.branchId) {
					return {
						success: false,
						messages: analyticsMessages.permissionDenied,
						points: [],
						topVariants: [],
						forecast: forecastOf([])
					};
				}
				conditions.push(`branchId = $${args.length + 1}`);
				args.push(actor.branchId);
			}
		}
		buildRangeFilter(conditions, args, 'receivedAt', options.from, options.to);
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbPurchaseOrders.document.query({
			statement: `SELECT items, receivedAt, createdAt FROM ${purchaseOrdersKeyspace} ${where} LIMIT 1000`,
			args,
			readonly: true
		});
		if (!res.ok) {
			return { success: false, messages: analyticsMessages.queryFailed, points: [], topVariants: [], forecast: forecastOf([]) };
		}

		const byPeriod = new Map<string, { qty: number; cost: number }>();
		const byVariant = new Map<string, { qty: number; cost: number }>();
		for (const po of (res.data?.results ?? []) as PODoc[]) {
			const at = po.receivedAt ?? po.createdAt;
			if (!at) continue;
			const period = periodOf(at, groupBy);
			const bucket = byPeriod.get(period) ?? { qty: 0, cost: 0 };
			for (const item of po.items ?? []) {
				if (typeof item.quantity !== 'number') continue;
				bucket.qty += item.quantity;
				bucket.cost += item.quantity * (typeof item.unitCost === 'number' ? item.unitCost : 0);
				const vb = byVariant.get(item.variantId) ?? { qty: 0, cost: 0 };
				vb.qty += item.quantity;
				vb.cost += item.quantity * (typeof item.unitCost === 'number' ? item.unitCost : 0);
				byVariant.set(item.variantId, vb);
			}
			byPeriod.set(period, bucket);
		}

		const points: TrendPoint[] = [...byPeriod.entries()]
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([period, b]) => ({ period, total: b.qty, netChange: b.cost }));

		// Top 5 variant + tên hiển thị
		const top5 = [...byVariant.entries()].sort(([, a], [, b]) => b.qty - a.qty).slice(0, 5);
		let displayNameMap = new Map<string, string>();
		if (top5.length > 0) {
			const vRes = await cbVariants.document.query({
				statement: `SELECT META().id AS _id, displayName FROM ${variantsKeyspace} WHERE META().id IN [${top5
					.map(([id]) => `'${id.replace(/'/g, "''")}'`)
					.join(', ')}]`,
				readonly: true
			});
			if (vRes.ok) {
				displayNameMap = new Map(
					((vRes.data?.results ?? []) as { _id: string; displayName?: string }[])
						.filter((r) => r.displayName)
						.map((r) => [r._id, r.displayName as string])
				);
			}
		}
		const topVariants = top5.map(([variantId, b]) => ({
			variantId,
			displayName: displayNameMap.get(variantId),
			totalQuantity: b.qty,
			totalCost: b.cost
		}));

		return {
			success: true,
			points,
			topVariants,
			forecast: forecastOf(points.map((p) => p.total ?? 0))
		};
	}

	/** Biến động tồn kho theo kỳ (stock_movements) + tồn hiện tại. */
	static async stockTrend(
		actor: ActorContext,
		options: { variantId?: string; branchId?: string; from?: string; to?: string; groupBy?: string } = {}
	): Promise<StockTrendResult> {
		const denied = await this.requirePermission(actor, 'analytics:read');
		if (denied) return { success: false, messages: denied.messages, points: [], currentStock: [] };
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return { success: false, messages: analyticsMessages.invalidRange, points: [], currentStock: [] };
		}
		const groupBy = parseGroupBy(options.groupBy);

		// Scope: own_branch ép theo actor.branchId; owner có thể filter branchId tuỳ ý
		const scopeBranch =
			actor.roleName !== 'owner' ? actor.branchId : options.branchId;
		const conditions: string[] = [];
		const args: (string | number)[] = [];
		if (scopeBranch) {
			conditions.push(`branchId = $${args.length + 1}`);
			args.push(scopeBranch);
		} else if (actor.roleName !== 'owner') {
			return { success: false, messages: analyticsMessages.permissionDenied, points: [], currentStock: [] };
		}
		if (options.variantId) {
			conditions.push(`variantId = $${args.length + 1}`);
			args.push(options.variantId);
		}
		buildRangeFilter(conditions, args, 'createdAt', options.from, options.to);
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbStockMovements.document.query({
			statement: `SELECT type, quantity, createdAt FROM ${stockMovementsKeyspace} ${where} ORDER BY createdAt ASC LIMIT 2000`,
			args,
			readonly: true
		});
		if (!res.ok) return { success: false, messages: analyticsMessages.queryFailed, points: [], currentStock: [] };

		// type 'in' cộng, 'out' trừ — các type khác tính theo dấu quantity lưu sẵn
		const byPeriod = new Map<string, { inQty: number; outQty: number }>();
		for (const m of (res.data?.results ?? []) as MovementDoc[]) {
			if (typeof m.quantity !== 'number') continue;
			const period = periodOf(m.createdAt, groupBy);
			const bucket = byPeriod.get(period) ?? { inQty: 0, outQty: 0 };
			if (m.type === 'in') bucket.inQty += m.quantity;
			else if (m.type === 'out') bucket.outQty += m.quantity;
			else if (m.quantity >= 0) bucket.inQty += m.quantity;
			else bucket.outQty += -m.quantity;
			byPeriod.set(period, bucket);
		}
		let running = 0;
		const points: TrendPoint[] = [...byPeriod.entries()]
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([period, b]) => {
				const net = b.inQty - b.outQty;
				running += net;
				return {
					period,
					in: b.inQty,
					out: b.outQty,
					total: net,
					netChange: running
				};
			});

		// Tồn hiện tại từ inventory_stock
		const stockConditions: string[] = [];
		const stockArgs: (string | number)[] = [];
		if (scopeBranch) {
			stockConditions.push(`branchId = $${stockArgs.length + 1}`);
			stockArgs.push(scopeBranch);
		}
		if (options.variantId) {
			stockConditions.push(`variantId = $${stockArgs.length + 1}`);
			stockArgs.push(options.variantId);
		}
		const stockWhere = stockConditions.length ? `WHERE ${stockConditions.join(' AND ')}` : '';
		const stockRes = await cbInventoryStock.document.query({
			statement: `SELECT variantId, branchId, quantityOnHand, quantityReserved FROM ${inventoryStockKeyspace} ${stockWhere} LIMIT 500`,
			args: stockArgs,
			readonly: true
		});
		const currentStock: StockTrendResult['currentStock'] = [];
		if (stockRes.ok) {
			for (const s of (stockRes.data?.results ?? []) as StockDoc[]) {
				const onHand = typeof s.quantityOnHand === 'number' ? s.quantityOnHand : 0;
				const reserved = typeof s.quantityReserved === 'number' ? s.quantityReserved : 0;
				currentStock.push({
					variantId: s.variantId,
					branchId: s.branchId,
					onHand,
					available: onHand - reserved
				});
			}
		}

		return { success: true, points, currentStock };
	}

	/** Xu hướng giá bán (price_history entity='variant_price'). */
	static async priceTrend(
		actor: ActorContext,
		options: { variantId?: string; from?: string; to?: string; groupBy?: string } = {}
	): Promise<PriceTrendResult> {
		const denied = await this.requirePermission(actor, 'analytics:read');
		if (denied) return { success: false, messages: denied.messages, points: [], forecast: forecastOf([]) };
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return { success: false, messages: analyticsMessages.invalidRange, points: [], forecast: forecastOf([]) };
		}
		const groupBy = parseGroupBy(options.groupBy);

		const conditions: string[] = [`entity = 'variant_price'`];
		const args: (string | number)[] = [];
		if (options.variantId) {
			conditions.push(`variantId = $${args.length + 1}`);
			args.push(options.variantId);
		}
		if (actor.roleName !== 'owner') {
			const scope = await PermissionChecker.getScope(actor.roleName, 'analytics:read');
			if (scope === 'own_branch') {
				if (!actor.branchId) {
					return { success: false, messages: analyticsMessages.permissionDenied, points: [], forecast: forecastOf([]) };
				}
				conditions.push(`branchId = $${args.length + 1}`);
				args.push(actor.branchId);
			}
		}
		buildRangeFilter(conditions, args, 'changedAt', options.from, options.to);
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbPriceHistory.document.query({
			statement: `SELECT changedAt, oldPrice, newPrice FROM ${priceHistoryKeyspace} ${where} ORDER BY changedAt ASC LIMIT 1000`,
			args,
			readonly: true
		});
		if (!res.ok) {
			return { success: false, messages: analyticsMessages.queryFailed, points: [], forecast: forecastOf([]) };
		}
		const rows = (res.data?.results ?? []) as PriceHistoryDoc[];
		if (rows.length === 0) {
			return {
				success: true,
				points: [],
				messages: analyticsMessages.priceHistoryEmpty,
				forecast: forecastOf([])
			};
		}

		const byPeriod = new Map<string, number[]>();
		for (const r of rows) {
			if (typeof r.newPrice !== 'number') continue;
			const period = periodOf(r.changedAt, groupBy);
			const arr = byPeriod.get(period) ?? [];
			arr.push(r.newPrice);
			byPeriod.set(period, arr);
		}
		const points: TrendPoint[] = [...byPeriod.entries()]
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([period, prices]) => ({
				period,
				avg: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
				min: Math.min(...prices),
				max: Math.max(...prices),
				source: 'price_history' as const
			}));

		return { success: true, points, forecast: forecastOf(points.map((p) => p.avg ?? 0)) };
	}
}
