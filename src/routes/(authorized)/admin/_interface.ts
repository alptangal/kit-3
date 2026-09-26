// src/routes/(authorized)/admin/_interface.ts
import type { TranslateContent } from '$interfaces/basic';

/**
 * 1 dòng user trong bảng quản trị — mirror SafeUserDocument (src/lib/server/db/users.ts).
 * Lưu ý kiến trúc blind-index: KHÔNG có username/email trong dữ liệu trả về.
 * `documentKey` là Couchbase META().id — service trả dưới tên `_id`, API route có thể
 * map thành `documentKey`; UI đọc cả hai cho an toàn (getRowDocumentKey).
 */
export interface AdminUserRow {
	_id?: string;
	documentKey?: string;
	firstname?: string | null;
	midname?: string | null;
	lastname?: string | null;
	description?: string | null;
	roleId?: string | null;
	statusId?: string | null;
	branchId?: string | null;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	deletedAt?: string | Date | null;
	[key: string]: unknown;
}

/** 1 role trong catalog name_roles (seed: role-owner/manager/staff/customer) */
export interface RoleOption {
	id: string;
	name?: string;
	label?: string;
	level?: number;
}

/** 1 status trong catalog user_status (seed: status-active/suspended/banned/pending_verification) */
export interface StatusOption {
	id: string;
	name?: string;
	label?: string;
	canLogin?: boolean;
}

/** 1 grant trong catalog detail_roles (roleName ↔ permissionKey + scope) */
export interface GrantOption {
	roleName?: string;
	permissionKey?: string;
	scope?: string;
	[key: string]: unknown;
}

/** data của POST /api/admin/users/list */
export interface UsersListResponse {
	users: AdminUserRow[];
	total: number;
	page: number;
	pageSize: number;
}

/** data của POST /api/admin/roles */
export interface RolesCatalogResponse {
	roles: RoleOption[];
	statuses: StatusOption[];
	grants?: GrantOption[];
}

export type AdminFormMode = 'create' | 'edit';

/** Giá trị form trong modal tạo/sửa user */
export interface AdminUserFormData {
	firstname: string;
	midname: string;
	lastname: string;
	username: string;
	email: string;
	phone: string;
	password: string;
	description: string;
	roleId: string;
	branchId: string;
}

/** Lấy documentKey của 1 dòng — ưu tiên `documentKey`, fallback `_id` (META().id) */
export function getRowDocumentKey(row: AdminUserRow | null | undefined): string {
	if (!row) return '';
	return row.documentKey ?? row._id ?? '';
}

/**
 * Server trả message dạng TranslateContent (có thể chỉ 1 key theo ngôn ngữ client
 * — xem hooks.server.ts resolveLang/localize) hoặc chuỗi thô. Chuẩn hoá về chuỗi hiển thị.
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

/** Chuẩn hoá 1 role thô từ catalog (chấp nhận id/documentKey/key/_id, label/displayName) */
export function normalizeRole(raw: Record<string, any>): RoleOption {
	return {
		id: String(raw.id ?? raw.documentKey ?? raw.key ?? raw._id ?? ''),
		name: raw.name,
		label: raw.label ?? raw.displayName ?? raw.name,
		level: raw.level
	};
}

/** Chuẩn hoá 1 status thô từ catalog */
export function normalizeStatus(raw: Record<string, any>): StatusOption {
	return {
		id: String(raw.id ?? raw.documentKey ?? raw.key ?? raw._id ?? ''),
		name: raw.name,
		label: raw.label ?? raw.displayName ?? raw.name,
		canLogin: raw.canLogin
	};
}

export const pageContents: { [k: string]: any } = {
	title: {
		vi: 'Quản trị người dùng',
		en: 'User administration'
	},
	subtitle: {
		vi: 'Quản lý tài khoản, vai trò và trạng thái trong hệ thống',
		en: 'Manage accounts, roles and statuses across the system'
	},
	createUser: {
		vi: 'Tạo người dùng',
		en: 'Create user'
	},
	showDeleted: {
		vi: 'Hiện tài khoản đã xoá',
		en: 'Show deleted accounts'
	},
	table: {
		name: {
			vi: 'Họ và tên',
			en: 'Full name'
		},
		role: {
			vi: 'Vai trò',
			en: 'Role'
		},
		status: {
			vi: 'Trạng thái',
			en: 'Status'
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
	actions: {
		edit: {
			vi: 'Sửa',
			en: 'Edit'
		},
		changeRole: {
			vi: 'Đổi vai trò',
			en: 'Change role'
		},
		changeStatus: {
			vi: 'Đổi trạng thái',
			en: 'Change status'
		},
		resetPassword: {
			vi: 'Đặt lại mật khẩu',
			en: 'Reset password'
		},
		delete: {
			vi: 'Xoá',
			en: 'Delete'
		},
		restore: {
			vi: 'Khôi phục',
			en: 'Restore'
		}
	},
	pagination: {
		prev: {
			vi: 'Trước',
			en: 'Prev'
		},
		next: {
			vi: 'Sau',
			en: 'Next'
		},
		pageInfo: {
			vi: 'Trang {page} / {total}',
			en: 'Page {page} of {total}'
		},
		totalCount: {
			vi: '{total} người dùng',
			en: '{total} users'
		},
		pageSizeLabel: {
			vi: 'Số dòng/trang',
			en: 'Rows per page'
		}
	},
	states: {
		loading: {
			vi: 'Đang tải danh sách người dùng...',
			en: 'Loading users...'
		},
		empty: {
			vi: 'Chưa có người dùng nào.',
			en: 'No users yet.'
		},
		emptyDeleted: {
			vi: 'Không có tài khoản đã xoá nào.',
			en: 'No deleted accounts.'
		},
		errorTitle: {
			vi: 'Không tải được dữ liệu',
			en: 'Failed to load data'
		},
		retry: {
			vi: 'Thử lại',
			en: 'Retry'
		}
	},
	modals: {
		roleTitle: {
			vi: 'Đổi vai trò',
			en: 'Change role'
		},
		roleIntro: {
			vi: 'Chọn vai trò mới cho {name}.',
			en: 'Choose a new role for {name}.'
		},
		statusTitle: {
			vi: 'Đổi trạng thái',
			en: 'Change status'
		},
		statusIntro: {
			vi: 'Chọn trạng thái mới cho {name}.',
			en: 'Choose a new status for {name}.'
		},
		deleteTitle: {
			vi: 'Xoá người dùng',
			en: 'Delete user'
		},
		deleteIntro: {
			vi: 'Bạn có chắc muốn xoá tài khoản của {name}? Tài khoản bị xoá vẫn có thể khôi phục sau.',
			en: 'Are you sure you want to delete {name}? Deleted accounts can be restored later.'
		},
		resetTitle: {
			vi: 'Đặt lại mật khẩu',
			en: 'Reset password'
		},
		resetIntro: {
			vi: 'Đặt lại mật khẩu cho {name}. Mật khẩu hiện tại sẽ mất hiệu lực.',
			en: 'Reset the password for {name}. The current password will stop working.'
		},
		tempPasswordTitle: {
			vi: 'Mật khẩu tạm thời',
			en: 'Temporary password'
		},
		tempPasswordNote: {
			vi: 'Ghi lại mật khẩu này và gửi cho người dùng — nó chỉ hiển thị một lần.',
			en: 'Copy this password and share it with the user — it is shown only once.'
		},
		copy: {
			vi: 'Sao chép',
			en: 'Copy'
		},
		copied: {
			vi: 'Đã sao chép',
			en: 'Copied'
		},
		closeTempPassword: {
			vi: 'Tôi đã ghi lại',
			en: 'I have saved it'
		},
		confirm: {
			vi: 'Xác nhận',
			en: 'Confirm'
		},
		cancel: {
			vi: 'Huỷ',
			en: 'Cancel'
		},
		selectPlaceholder: {
			vi: '— Chọn —',
			en: '— Select —'
		}
	},
	toasts: {
		listLoaded: {
			vi: 'Đã tải danh sách người dùng',
			en: 'User list loaded'
		},
		roleChanged: {
			vi: 'Đã đổi vai trò',
			en: 'Role changed'
		},
		statusChanged: {
			vi: 'Đã đổi trạng thái',
			en: 'Status changed'
		},
		passwordReset: {
			vi: 'Đã đặt lại mật khẩu',
			en: 'Password has been reset'
		},
		userDeleted: {
			vi: 'Đã xoá người dùng',
			en: 'User deleted'
		},
		userRestored: {
			vi: 'Đã khôi phục người dùng',
			en: 'User restored'
		},
		actionFailed: {
			vi: 'Thao tác không thành công',
			en: 'Action failed'
		},
		requestFailed: {
			vi: 'Yêu cầu thất bại',
			en: 'Request failed'
		},
		notReady: {
			vi: 'Hệ thống chưa sẵn sàng, vui lòng thử lại',
			en: 'System is not ready, please retry'
		}
	}
};
