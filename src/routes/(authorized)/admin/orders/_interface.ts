// src/routes/(authorized)/admin/orders/_interface.ts
import type { TranslateContent } from '$interfaces/basic';

/**
 * 1 dòng order trong bảng quản trị
 */
export interface AdminOrderRow {
	_id?: string;
	documentKey?: string;
	orderCode?: string;
	customerId?: string;
	staffId?: string;
	branchId?: string;
	status?: string;
	items?: Array<{ variantId: string; lotId?: string; quantity: number; price: number }>;
	totalAmount?: number;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	deletedAt?: string | Date | null;
	[key: string]: unknown;
}

/** Stats response */
export interface AdminOrdersStats {
	totalOrders: number;
	todayOrders: number;
	deliveredRevenue: number;
	statusBreakdown: Record<string, number>;
}

export interface AdminCustomersStats {
	totalCustomers: number;
	todayCustomers: number;
	activeCustomers: number;
	statusBreakdown: Record<string, number>;
}

/** Lấy documentKey của 1 dòng */
export function getRowDocumentKey(row: AdminOrderRow | null | undefined): string {
	if (!row) return '';
	return row.documentKey ?? row._id ?? '';
}

/**
 * Server trả message dạng TranslateContent hoặc chuỗi thô. Chuẩn hoá về chuỗi hiển thị.
 */
export function resolveServerMessage(
	message: TranslateContent | string | undefined,
	lang: string,
	fallback: { vi: string; en: string }
): string {
	if (typeof message === 'string') return message;
	if (message) {
		const localized = message[lang as keyof typeof message];
		if (localized) return localized;
		if (message.en) return message.en;
		const first = Object.values(message)[0];
		if (first) return first;
	}
	return lang === 'vi' ? fallback.vi : fallback.en;
}

export function getStatusLabel(status?: string | null): string {
	if (!status) return '—';
	const labels: Record<string, { vi: string; en: string }> = {
		pending: { vi: 'Chờ xác nhận', en: 'Pending' },
		confirmed: { vi: 'Đã xác nhận', en: 'Confirmed' },
		shipped: { vi: 'Đang giao', en: 'Shipped' },
		delivered: { vi: 'Đã giao', en: 'Delivered' },
		cancelled: { vi: 'Đã huỷ', en: 'Cancelled' }
	};
	const l = labels[status];
	return l ? (l.vi) : status;
}

export function getStatusColor(status?: string | null): string {
	switch (status) {
		case 'pending':
			return 'warning';
		case 'confirmed':
			return 'info';
		case 'shipped':
			return 'primary';
		case 'delivered':
			return 'success';
		case 'cancelled':
			return 'error';
		default:
			return 'default';
	}
}

export function formatCurrency(amount: number, lang: string): string {
	// Symbol ghép TAY với 1 space (₫ 0) thay vì để Intl dán symbol sát số —
	// glyph ₫ trong font hệ thống rất hẹp, "₫0" bị chồng chữ khi đậm (bold).
	const formatted = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(amount);
	return `${formatted} ₫`;
}

export function formatDate(date: string | Date | null | undefined, lang: string): string {
	if (!date) return '—';
	try {
		const d = typeof date === 'string' ? new Date(date) : date;
		return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			year: 'numeric',
			month: 'short',
			day: '2-digit'
		}).format(d);
	} catch {
		return '—';
	}
}

type PageContents = Record<string, any>;

export const pageContents: PageContents = {
	title: {
		vi: 'Quản trị đơn hàng',
		en: 'Order administration'
	},
	subtitle: {
		vi: 'Quản lý đơn hàng, trạng thái và thống kê doanh thu',
		en: 'Manage orders, statuses and revenue statistics'
	},
	createOrder: {
		vi: 'Tạo đơn hàng',
		en: 'Create order'
	},
	showDeleted: {
		vi: 'Hiện đơn hàng đã xoá',
		en: 'Show deleted orders'
	},
	table: {
		orderCode: {
			vi: 'Mã đơn',
			en: 'Order code'
		},
		customer: {
			vi: 'Khách hàng',
			en: 'Customer'
		},
		status: {
			vi: 'Trạng thái',
			en: 'Status'
		},
		items: {
			vi: 'Sản phẩm',
			en: 'Items'
		},
		total: {
			vi: 'Tổng tiền',
			en: 'Total'
		},
		created: {
			vi: 'Ngày tạo',
			en: 'Created'
		},
		actions: {
			vi: 'Thao tác',
			en: 'Actions'
		},
		deletedBadge: {
			vi: 'Đã xoá',
			en: 'Deleted'
		}
	},
	stats: {
		totalOrders: {
			vi: 'Tổng đơn hàng',
			en: 'Total orders'
		},
		todayOrders: {
			vi: 'Đơn hôm nay',
			en: 'Today orders'
		},
		deliveredRevenue: {
			vi: 'Doanh thu đã giao',
			en: 'Delivered revenue'
		}
	},
	pagination: {
		prev: { vi: 'Trước', en: 'Prev' },
		next: { vi: 'Sau', en: 'Next' },
		totalCount: {
			vi: 'Tổng: {total}',
			en: 'Total: {total}'
		},
		pageSizeLabel: {
			vi: 'Hiện:',
			en: 'Show:'
		}
	},
	states: {
		loading: {
			vi: 'Đang tải danh sách đơn hàng...',
			en: 'Loading orders...'
		},
		errorTitle: {
			vi: 'Lỗi tải danh sách',
			en: 'Failed to load list'
		},
		retry: {
			vi: 'Thử lại',
			en: 'Retry'
		},
		empty: {
			vi: 'Không có đơn hàng nào',
			en: 'No orders found'
		},
		emptyDeleted: {
			vi: 'Không có đơn hàng đã xoá',
			en: 'No deleted orders'
		}
	},
	modals: {
		detailTitle: {
			vi: 'Chi tiết đơn hàng',
			en: 'Order details'
		},
		statusTitle: {
			vi: 'Đổi trạng thái',
			en: 'Change status'
		},
		deleteTitle: {
			vi: 'Xoá đơn hàng',
			en: 'Delete order'
		},
		confirm: {
			vi: 'Xác nhận',
			en: 'Confirm'
		},
		cancel: {
			vi: 'Huỷ',
			en: 'Cancel'
		},
		detailIntro: {
			vi: 'Mã đơn: {name}',
			en: 'Order: {name}'
		},
		statusIntro: {
			vi: 'Đổi trạng thái đơn {name}',
			en: 'Change status for order {name}'
		},
		deleteIntro: {
			vi: 'Xoá đơn {name}?',
			en: 'Delete order {name}?'
		},
		itemsTitle: {
			vi: 'Sản phẩm trong đơn',
			en: 'Order items'
		},
		variant: {
			vi: 'Biến thể',
			en: 'Variant'
		},
		lot: {
			vi: 'Lô',
			en: 'Lot'
		},
		qty: {
			vi: 'SL',
			en: 'Qty'
		},
		price: {
			vi: 'Đơn giá',
			en: 'Price'
		},
		subtotal: {
			vi: 'Thành tiền',
			en: 'Subtotal'
		}
	},
	toasts: {
		orderCreated: {
			vi: 'Tạo đơn hàng thành công',
			en: 'Order created successfully'
		},
		orderUpdated: {
			vi: 'Cập nhật đơn hàng thành công',
			en: 'Order updated successfully'
		},
		orderDeleted: {
			vi: 'Xoá đơn hàng thành công',
			en: 'Order deleted successfully'
		},
		statusChanged: {
			vi: 'Cập nhật trạng thái thành công',
			en: 'Status updated successfully'
		},
		actionFailed: {
			vi: 'Thao tác thất bại',
			en: 'Action failed'
		},
		requestFailed: {
			vi: 'Yêu cầu thất bại',
			en: 'Request failed'
		}
	}
} as const;