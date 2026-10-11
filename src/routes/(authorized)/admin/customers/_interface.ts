// src/routes/(authorized)/admin/customers/_interface.ts
import type { TranslateContent } from '$interfaces/basic';

/**
 * 1 dòng customer trong bảng quản trị
 * Mirror SafeUserDocument nhưng chỉ cho role-customer
 */
export interface AdminCustomerRow {
	_id?: string;
	documentKey?: string;
	firstname?: string | null;
	midname?: string | null;
	lastname?: string | null;
	description?: string | null;
	roleId?: string;
	statusId?: string;
	branchId?: string | null;
	emailEncrypted?: string;
	phoneEncrypted?: string;
	profileEncrypted?: string;
	authMethod?: string;
	mfaEnabled?: boolean;
	lastLoginAt?: string | null;
	remember?: boolean;
	customerTierEncrypted?: string;
	loyaltyPoints?: number;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	deletedAt?: string | Date | null;
	[key: string]: unknown;
}

/** Stats response */
export interface AdminCustomersStats {
	totalCustomers: number;
	todayCustomers: number;
	activeCustomers: number;
	statusBreakdown: Record<string, number>;
}

/** Lấy documentKey của 1 dòng */
export function getRowDocumentKey(row: AdminCustomerRow | null | undefined): string {
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

export function getStatusLabel(statusId?: string | null): string {
	if (!statusId) return '—';
	const labels: Record<string, { vi: string; en: string }> = {
		'status-active': { vi: 'Hoạt động', en: 'Active' },
		'status-suspended': { vi: 'Đã tạm khóa', en: 'Suspended' },
		'status-banned': { vi: 'Đã cấm', en: 'Banned' },
		'status-pending_verification': { vi: 'Chờ xác thực', en: 'Pending verification' }
	};
	const l = labels[statusId];
	return l ? l.vi : statusId;
}

export function getStatusColor(statusId?: string | null): string {
	switch (statusId) {
		case 'status-active':
			return 'success';
		case 'status-pending_verification':
			return 'warning';
		case 'status-suspended':
			return 'warning';
		case 'status-banned':
			return 'error';
		default:
			return 'default';
	}
}

export function getRowName(row: AdminCustomerRow | null | undefined): string {
	if (!row) return '—';
	return [row.lastname, row.midname, row.firstname].filter(Boolean).join(' ') || '—';
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
		vi: 'Quản trị khách hàng',
		en: 'Customer administration'
	},
	subtitle: {
		vi: 'Quản lý thông tin khách hàng và trạng thái tài khoản',
		en: 'Manage customer information and account statuses'
	},
	showDeleted: {
		vi: 'Hiện khách hàng đã xoá',
		en: 'Show deleted customers'
	},
	table: {
		name: {
			vi: 'Họ và tên',
			en: 'Full name'
		},
		status: {
			vi: 'Trạng thái',
			en: 'Status'
		},
		tier: {
			vi: 'Hạng',
			en: 'Tier'
		},
		loyalty: {
			vi: 'Điểm thưởng',
			en: 'Loyalty'
		},
		created: {
			vi: 'Ngày tạo',
			en: 'Created'
		},
		lastLogin: {
			vi: 'Đăng nhập cuối',
			en: 'Last login'
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
		totalCustomers: {
			vi: 'Tổng khách hàng',
			en: 'Total customers'
		},
		todayCustomers: {
			vi: 'Khách mới hôm nay',
			en: 'New today'
		},
		activeCustomers: {
			vi: 'Khách hoạt động',
			en: 'Active customers'
		}
	},
	filters: {
		searchPlaceholder: {
			vi: 'Tìm khách hàng (tên, mô tả)…',
			en: 'Search customers (name, description)…'
		},
		allStatuses: {
			vi: 'Tất cả trạng thái',
			en: 'All Statuses'
		}
	},
	pagination: {
		prev: { vi: 'Trước', en: 'Prev' },
		next: { vi: 'Sau', en: 'Next' },
		pageInfo: {
			vi: 'Trang {page} / {total}',
			en: 'Page {page} / {total}'
		},
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
			vi: 'Đang tải danh sách khách hàng...',
			en: 'Loading customers...'
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
			vi: 'Không có khách hàng nào',
			en: 'No customers found'
		},
		emptyDeleted: {
			vi: 'Không có khách hàng đã xoá',
			en: 'No deleted customers'
		}
	},
	modals: {
		detailTitle: {
			vi: 'Chi tiết khách hàng',
			en: 'Customer details'
		},
		statusTitle: {
			vi: 'Đổi trạng thái',
			en: 'Change status'
		},
		deleteTitle: {
			vi: 'Xoá khách hàng',
			en: 'Delete customer'
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
			vi: 'Khách hàng: {name}',
			en: 'Customer: {name}'
		},
		statusIntro: {
			vi: 'Đổi trạng thái khách {name}',
			en: 'Change status for customer {name}'
		},
		deleteIntro: {
			vi: 'Xoá khách {name}?',
			en: 'Delete customer {name}?'
		},
		authMethod: {
			vi: 'Phương thức xác thực',
			en: 'Auth method'
		},
		mfaOn: {
			vi: 'Bật',
			en: 'On'
		},
		mfaOff: {
			vi: 'Tắt',
			en: 'Off'
		}
	},
	toasts: {
		customerUpdated: {
			vi: 'Cập nhật khách hàng thành công',
			en: 'Customer updated successfully'
		},
		customerDeleted: {
			vi: 'Xoá khách hàng thành công',
			en: 'Customer deleted successfully'
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