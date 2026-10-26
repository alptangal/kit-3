<!-- src/routes/(authorized)/admin/suppliers/+page.svelte -->
<script lang="ts">
	import { flushSync, tick } from 'svelte';
	import { Button, DataTable, Pagination, AlertDialog, Badge, Spinner } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { EmailInput, ImageUpload, Input, Label, PhoneInput, Select, Switch, TextField, Textarea, AddressInput } from '$components/form';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import type { Size } from '$components/interface';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { onMount } from 'svelte';	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';
	import { recordSearchKeyword, saveDataTablePrefs, getSearchKeywords, userPrefs, saveDraftPref, clearDraftPref, readDraftPref } from '$store/user-prefs.svelte';
	import { createCloseGuard } from '$modules/close-guard.svelte';

	interface SupplierRow {
		_id?: string;
		name?: string;
		contactPerson?: string | null;
		address?: string | null;
		phones?: string[] | null;
		emails?: string[] | null;
		addresses?: SupplierAddressEntry[] | null;
		images?: string[] | null;
		note?: string | null;
		status?: string;
		createdBy?: string | null;
		createdAt?: string | null;
		updatedBy?: string | null;
		updatedAt?: string | null;
	}

	interface SupplierAddressEntry {
		label?: string;
		address: string;
		ward?: string;
		province?: string;
		district?: string;
		country?: string;
		// Địa giới hệ MỚI (34 tỉnh 2 cấp, sáp nhập 2025) — song song hệ cũ
		newProvince?: string;
		newWard?: string;
	}

	// Entry lịch sử — khớp SupplierHistoryEntry (src/lib/server/db/suppliers.ts)
	interface HistoryEntry {
		_id: string;
		type: 'update' | 'restore';
		actorId?: string;
		actorName?: string;
		createdAt?: string;
		changes: { field: string; before: string | null; after: string | null }[];
	}

	// 6 field social dạng TAG multi-value (mảng string)
	type SocialFieldKey = 'zalo' | 'telegram' | 'discord' | 'facebook' | 'instagram' | 'website';
	const SOCIAL_FIELDS: SocialFieldKey[] = ['zalo', 'telegram', 'discord', 'facebook', 'instagram', 'website'];

	interface PurchaseOrderRow {
		_id?: string;
		poCode?: string;
		supplierId?: string;
		branchId?: string;
		status?: string;
		totalCost?: number;
		expectedAt?: string | null;
		receivedAt?: string | null;
		createdAt?: string | null;
	}

	interface POItem {
		variantId: string;
		quantity: number;
		unitCost: number;
		lotNumber?: string;
		expiresAt?: string;
	}

	interface BranchOption {
		_id: string;
		name?: string;
		isWarehouse?: boolean;
	}

	interface VariantOption {
		_id: string;
		sku?: string;
		displayName?: string;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA cho mọi fetchSecure trên trang ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Nhà cung cấp', en: 'Suppliers' },
		subtitle: {
			vi: 'Quản lý nhà cung cấp và đơn mua hàng (purchase orders)',
			en: 'Manage suppliers and purchase orders'
		},
		tabs: {
			suppliers: { vi: 'Nhà cung cấp', en: 'Suppliers' },
			purchaseOrders: { vi: 'Đơn mua hàng', en: 'Purchase orders' }
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			allSuppliers: { vi: 'Tất cả nhà cung cấp', en: 'All suppliers' }
		},
		// Batch10 (m06635-3): setting modal (filter + sort) từ nút tune header/FAB
		settings: {
			title: { vi: 'Cài đặt danh sách', en: 'List settings' },
			filterStatus: { vi: 'Trạng thái', en: 'Status' },
			sortBy: { vi: 'Sắp xếp theo', en: 'Sort by' },
			sortDirection: { vi: 'Chiều sắp xếp', en: 'Sort direction' },
			asc: { vi: 'Tăng dần', en: 'Ascending' },
			desc: { vi: 'Giảm dần', en: 'Descending' },
			apply: { vi: 'Áp dụng', en: 'Apply' },
			reset: { vi: 'Đặt lại', en: 'Reset' }
		},
		supplierTable: {
			name: { vi: 'Tên', en: 'Name' },
			contact: { vi: 'Người liên hệ', en: 'Contact' },
			address: { vi: 'Địa chỉ', en: 'Address' },
			status: { vi: 'Trạng thái', en: 'Status' },
			createdAt: { vi: 'Tạo lúc', en: 'Created' },
			updatedAt: { vi: 'Cập nhật', en: 'Updated' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		poTable: {
			code: { vi: 'Mã PO', en: 'PO code' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			status: { vi: 'Trạng thái', en: 'Status' },
			totalCost: { vi: 'Tổng chi phí', en: 'Total cost' },
			expectedAt: { vi: 'Dự kiến nhận', en: 'Expected' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		poStatuses: {
			draft: { vi: 'Nháp', en: 'Draft' },
			ordered: { vi: 'Đã đặt', en: 'Ordered' },
			partially_received: { vi: 'Nhận một phần', en: 'Partially received' },
			received: { vi: 'Đã nhận', en: 'Received' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' }
		},
		actions: {
			createSupplier: { vi: 'Tạo nhà cung cấp', en: 'Create supplier' },
			createPO: { vi: 'Tạo đơn mua', en: 'Create PO' },
			updateStatus: { vi: 'Cập nhật trạng thái', en: 'Update status' },
			edit: { vi: 'Sửa', en: 'Edit' },
			search: { vi: 'Tìm kiếm', en: 'Search' },
			filter: { vi: 'Lọc trạng thái', en: 'Filter status' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitleSuppliers: { vi: 'Không tải được nhà cung cấp', en: 'Failed to load suppliers' },
			errorTitlePOs: { vi: 'Không tải được đơn mua hàng', en: 'Failed to load purchase orders' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			emptySuppliers: { vi: 'Chưa có nhà cung cấp nào', en: 'No suppliers yet' },
			emptyPOs: { vi: 'Chưa có đơn mua hàng nào', en: 'No purchase orders yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCountSuppliers: { vi: '{total} nhà cung cấp', en: '{total} suppliers' },
			totalCountPOs: { vi: '{total} đơn mua hàng', en: '{total} purchase orders' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		supplierModal: {
			title: { vi: 'Tạo nhà cung cấp', en: 'Create supplier' },
			titleEdit: { vi: 'Sửa nhà cung cấp', en: 'Edit supplier' },
			name: { vi: 'Tên nhà cung cấp', en: 'Supplier name' },
			contact: { vi: 'Người liên hệ (tuỳ chọn)', en: 'Contact person (optional)' },
			address: { vi: 'Địa chỉ (tuỳ chọn)', en: 'Address (optional)' },
			addressPlaceholder: { vi: 'Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành...', en: 'House number, street, ward, district, province...' },
			addresses: { vi: 'Danh sách địa chỉ', en: 'Addresses' },
			addAddress: { vi: 'Thêm địa chỉ', en: 'Add address' },
			removeAddress: { vi: 'Xoá địa chỉ', en: 'Remove address' },
			addressLabelPlaceholder: { vi: 'Nhãn (vd: Kho, Văn phòng...)', en: 'Label (e.g. Warehouse, Office...)' },
			wardPlaceholder: { vi: 'Chọn phường/xã', en: 'Select ward' },
			images: { vi: 'Hình ảnh', en: 'Images' },
			note: { vi: 'Ghi chú', en: 'Note' },
			notePlaceholder: { vi: 'Ghi chú về nhà cung cấp...', en: 'Notes about this supplier...' },
			phonePlaceholder: { vi: 'Số điện thoại', en: 'Phone number' },
			phones: { vi: 'Số điện thoại', en: 'Phone numbers' },
			addPhone: { vi: 'Thêm số điện thoại', en: 'Add phone number' },
			removePhone: { vi: 'Xoá số điện thoại', en: 'Remove phone number' },
			emailPlaceholder: { vi: 'Email', en: 'Email' },
			emails: { vi: 'Email', en: 'Emails' },
			addEmail: { vi: 'Thêm email', en: 'Add email' },
			removeEmail: { vi: 'Xoá email', en: 'Remove email' },
			// Batch10 (m06635-6c): cảnh báo text khi phone/email trùng trong danh sách
			dupPhone: { vi: 'Số điện thoại đã tồn tại trong danh sách', en: 'This phone number already exists in the list' },
			dupEmail: { vi: 'Email đã tồn tại trong danh sách', en: 'This email already exists in the list' },
			social: { vi: 'Mạng xã hội', en: 'Social networks' },
			zalo: { vi: 'Zalo', en: 'Zalo' },
			zaloPlaceholder: { vi: 'Số Zalo hoặc link zalo.me/...', en: 'Zalo number or zalo.me/... link' },
			zaloInvalid: { vi: 'Zalo phải là số điện thoại hoặc link zalo.me', en: 'Zalo must be a phone number or zalo.me link' },
			telegram: { vi: 'Telegram', en: 'Telegram' },
			telegramPlaceholder: { vi: '@username hoặc link t.me/...', en: '@username or t.me/... link' },
			telegramInvalid: { vi: 'Telegram phải là @username hoặc link t.me', en: 'Telegram must be @username or t.me link' },
			discord: { vi: 'Discord', en: 'Discord' },
			discordPlaceholder: { vi: 'Tên người dùng Discord', en: 'Discord username' },
			discordInvalid: { vi: 'Discord chỉ nhận tên người dùng (2-32 ký tự)', en: 'Discord accepts username only (2-32 chars)' },
			facebook: { vi: 'Facebook', en: 'Facebook' },
			facebookPlaceholder: { vi: 'Link facebook.com/...', en: 'facebook.com/... link' },
			facebookInvalid: { vi: 'Facebook phải là link facebook.com hoặc fb.com', en: 'Facebook must be a facebook.com or fb.com link' },
			instagram: { vi: 'Instagram', en: 'Instagram' },
			instagramPlaceholder: { vi: '@username hoặc link instagram.com/...', en: '@username or instagram.com/... link' },
			instagramInvalid: { vi: 'Instagram phải là @username hoặc link instagram.com', en: 'Instagram must be @username or instagram.com link' },
			website: { vi: 'Website', en: 'Website' },
			websitePlaceholder: { vi: 'Link trang web (https://...)', en: 'Website link (https://...)' },
			websiteInvalid: { vi: 'Website phải là link http(s) hợp lệ', en: 'Website must be a valid http(s) link' },
			socialAdd: { vi: 'Thêm giá trị…', en: 'Add value…' },
			socialDuplicate: { vi: 'Giá trị đã tồn tại', en: 'Value already exists' },
			socialInvalidTag: { vi: 'Giá trị không hợp lệ', en: 'Invalid value' },
			socialOpen: { vi: 'Mở link', en: 'Open link' },
			socialRemove: { vi: 'Xoá', en: 'Remove' },
			socialEdit: { vi: 'Sửa', en: 'Edit' },
			status: { vi: 'Trạng thái', en: 'Status' },
			statusActive: { vi: 'Đang hoạt động', en: 'Active' },
			statusInactive: { vi: 'Ngừng hoạt động', en: 'Inactive' },
			submit: { vi: 'Tạo', en: 'Create' },
			save: { vi: 'Lưu thay đổi', en: 'Save changes' },
			duplicateWarn: { vi: 'Có giá trị trùng lặp', en: 'Duplicate value' },
			// Batch 11: field passive metadata (cuối form, edit mode)
			passiveCreatedAt: { vi: 'Tạo lúc', en: 'Created' },
			passiveUpdatedAt: { vi: 'Cập nhật lần cuối', en: 'Last updated' }
		},
		history: {
			viewHistory: { vi: 'Lịch sử', en: 'History' }
		},
		historyModal: {
			title: { vi: 'Lịch sử thay đổi', en: 'Change history' },
			empty: { vi: 'Chưa có thay đổi nào được ghi nhận', en: 'No changes recorded yet' },
			loading: { vi: 'Đang tải lịch sử…', en: 'Loading history…' },
			update: { vi: 'Cập nhật', en: 'Updated' },
			restore: { vi: 'Khôi phục', en: 'Restored' },
			by: { vi: 'bởi', en: 'by' },
			unknownActor: { vi: 'Không rõ', en: 'Unknown' },
			noChanges: { vi: 'Không có trường nào thay đổi', en: 'No fields changed' },
			restoreBtn: { vi: 'Khôi phục', en: 'Restore' },
			confirmTitle: { vi: 'Khôi phục dữ liệu?', en: 'Restore data?' },
			confirmDesc: {
				vi: 'Các trường trong lần thay đổi này sẽ quay về giá trị trước đó. Hành động này sẽ được ghi vào lịch sử.',
				en: 'The fields in this change will be reverted to their previous values. This action will be recorded in history.'
			},
			confirmYes: { vi: 'Khôi phục', en: 'Restore' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			viewHistory: { vi: 'Lịch sử', en: 'History' },
			fieldLabels: {
				name: { vi: 'Tên', en: 'Name' },
				contactPerson: { vi: 'Người liên hệ', en: 'Contact person' },
				address: { vi: 'Địa chỉ', en: 'Address' },
				ward: { vi: 'Phường/xã', en: 'Ward' },
				district: { vi: 'Quận/huyện', en: 'District' },
				province: { vi: 'Tỉnh/thành', en: 'Province' },
				country: { vi: 'Quốc gia', en: 'Country' },
				phones: { vi: 'Số điện thoại', en: 'Phone numbers' },
				emails: { vi: 'Email', en: 'Emails' },
				addresses: { vi: 'Danh sách địa chỉ', en: 'Addresses' },
				zalo: { vi: 'Zalo', en: 'Zalo' },
				facebook: { vi: 'Facebook', en: 'Facebook' },
				telegram: { vi: 'Telegram', en: 'Telegram' },
				discord: { vi: 'Discord', en: 'Discord' },
				instagram: { vi: 'Instagram', en: 'Instagram' },
				website: { vi: 'Website', en: 'Website' },
				avatarUrl: { vi: 'Ảnh đại diện', en: 'Avatar' },
				images: { vi: 'Hình ảnh', en: 'Images' },
				note: { vi: 'Ghi chú', en: 'Note' },
				status: { vi: 'Trạng thái', en: 'Status' }
			}
		},
		poModal: {
			title: { vi: 'Tạo đơn mua hàng', en: 'Create purchase order' },
			code: { vi: 'Mã PO', en: 'PO code' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			supplierPlaceholder: { vi: 'Chọn nhà cung cấp', en: 'Select a supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			expectedAt: { vi: 'Ngày dự kiến nhận', en: 'Expected at' },
			items: { vi: 'Các mặt hàng', en: 'Items' },
			itemVariant: { vi: 'Sản phẩm', en: 'Variant' },
			itemVariantPlaceholder: { vi: 'Chọn sản phẩm', en: 'Select a variant' },
			itemQuantity: { vi: 'Số lượng', en: 'Quantity' },
			itemUnitCost: { vi: 'Đơn giá', en: 'Unit cost' },
			itemLot: { vi: 'Số lô (tuỳ chọn)', en: 'Lot number (optional)' },
			itemExpires: { vi: 'Hết hạn (tuỳ chọn)', en: 'Expires at (optional)' },
			addItem: { vi: 'Thêm dòng', en: 'Add item' },
			removeItem: { vi: 'Bỏ dòng', en: 'Remove' },
			totalCost: { vi: 'Tổng chi phí (tự tính)', en: 'Total cost (auto)' },
			submit: { vi: 'Tạo đơn mua', en: 'Create PO' }
		},
		statusModal: {
			title: { vi: 'Cập nhật trạng thái PO', en: 'Update PO status' },
			status: { vi: 'Trạng thái mới', en: 'New status' },
			confirm: { vi: 'Cập nhật', en: 'Update' }
		},
		toasts: {
			supplierCreated: { vi: 'Đã tạo nhà cung cấp', en: 'Supplier created' },
			supplierFailed: { vi: 'Tạo nhà cung cấp không thành công', en: 'Failed to create supplier' },
			supplierUpdated: { vi: 'Đã cập nhật nhà cung cấp', en: 'Supplier updated' },
			supplierUpdateFailed: { vi: 'Cập nhật nhà cung cấp không thành công', en: 'Failed to update supplier' },
			urlCopied: { vi: 'Đã copy URL ảnh', en: 'Image URL copied' },
			draftRestored: { vi: 'Đã phục hồi bản nháp chưa lưu', en: 'Draft restored' },
			restored: { vi: 'Đã khôi phục dữ liệu nhà cung cấp', en: 'Supplier data restored' },
			draftSaved: { vi: 'Bản nháp đã lưu tự động', en: 'Draft saved' },
			bulkDeleted: { vi: 'Đã xoá {count} nhà cung cấp', en: 'Deleted {count} suppliers' },
			bulkDeleteFailed: { vi: 'Xoá hàng loạt không thành công', en: 'Bulk delete failed' },
			bulkCopied: { vi: 'Đã copy {count} dòng', en: 'Copied {count} rows' },
			poCreated: { vi: 'Đã tạo đơn mua hàng', en: 'Purchase order created' },
			poFailed: { vi: 'Tạo đơn mua không thành công', en: 'Failed to create purchase order' },
			statusUpdated: { vi: 'Đã cập nhật trạng thái', en: 'Status updated' },
			statusFailed: { vi: 'Cập nhật trạng thái không thành công', en: 'Failed to update status' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		dirty: {
			title: { vi: 'Bỏ thay đổi?', en: 'Discard changes?' },
			desc: {
				vi: 'Form của bạn có thay đổi chưa lưu. Nếu bỏ bây giờ, các thay đổi này sẽ mất.',
				en: 'Your form has unsaved changes. If you discard now, these changes will be lost.'
			},
			continueEdit: { vi: 'Tiếp tục chỉnh sửa', en: 'Keep editing' },
			discard: { vi: 'Bỏ thay đổi', en: 'Discard' }
		},
		bulk: {
			title: { vi: 'Xoá nhà cung cấp đã chọn?', en: 'Delete selected suppliers?' },
			desc: {
				vi: 'Các nhà cung cấp đã chọn sẽ bị xoá vĩnh viễn khỏi hệ thống.',
				en: 'The selected suppliers will be permanently removed.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			copy: { vi: 'Copy', en: 'Copy' },
			delete: { vi: 'Xoá', en: 'Delete' },
			selected: { vi: 'Đã chọn {count}', en: '{count} selected' }
		},
		suggest: {
			title: { vi: 'Từ khoá đã tìm', en: 'Recent searches' }
		},
		form: {
			requireName: { vi: 'Vui lòng nhập tên nhà cung cấp', en: 'Please enter a supplier name' },
			invalidPhone: { vi: 'Số điện thoại không hợp lệ', en: 'Invalid phone number' },
			invalidEmail: { vi: 'Email không hợp lệ', en: 'Invalid email' },
			invalidZalo: { vi: 'Zalo phải là số điện thoại hoặc link zalo.me', en: 'Zalo must be a phone number or zalo.me link' },
			invalidTelegram: { vi: 'Telegram phải là @username hoặc link t.me', en: 'Telegram must be @username or t.me link' },
			invalidDiscord: { vi: 'Discord chỉ nhận tên người dùng (2-32 ký tự)', en: 'Discord accepts username only (2-32 chars)' },
			invalidFacebook: { vi: 'Facebook phải là link facebook.com hoặc fb.com', en: 'Facebook must be a facebook.com or fb.com link' },
			invalidInstagram: { vi: 'Instagram phải là @username hoặc link instagram.com', en: 'Instagram must be an @username or instagram.com link' },
			invalidWebsite: { vi: 'Website phải là link http(s) hợp lệ', en: 'Website must be a valid http(s) link' },
			requireCode: { vi: 'Vui lòng nhập mã PO', en: 'Please enter a PO code' },
			requireSupplier: { vi: 'Vui lòng chọn nhà cung cấp', en: 'Please select a supplier' },
			requireBranch: { vi: 'Vui lòng chọn chi nhánh', en: 'Please select a branch' },
			requireItems: { vi: 'Vui lòng thêm ít nhất một mặt hàng', en: 'Please add at least one item' },
			requireItem: { vi: 'Mỗi dòng cần sản phẩm, số lượng và đơn giá hợp lệ', en: 'Each item needs a variant, valid quantity and unit cost' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string (route phase 4 chưa có trong RouteId)

	// BẪY: form state/draft có thể chứa null/undefined (Input unmount emit
	// undefined qua bind; JSON.stringify draft biến thành null) → .trim() trực
	// tiếp nổ "can't access property trim ... is undefined" (console prod).
	// Mọi site .trim() trên form state đi qua helper này.
	const str = (v: unknown): string => (typeof v === 'string' ? v : '');

	// Hiển thị giá trị before/after trong timeline: snapshot là JSON string
	// (snapshotValue — JSON.stringify) → parse mảng/phần tử phức hợp ra gọn;
	// rỗng → '—' (giá trị bị xoá/trống).
	function snapshotDisplay(raw: string | null | undefined): string {
		if (raw === null || raw === undefined || raw === '') return '—';
		if (raw.startsWith('[') || raw.startsWith('{')) {
			try {
				const parsed: unknown = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					if (parsed.length === 0) return '—';
					return parsed
						.map((item) => {
							if (typeof item === 'string') return item;
							if (item && typeof item === 'object' && 'address' in (item as object)) {
								return str((item as { address?: unknown }).address) || '—';
							}
							return String(item);
						})
						.filter((s) => s && s !== '—')
						.join(', ');
				}
				if (parsed && typeof parsed === 'object') return str(JSON.stringify(parsed)) || raw;
			} catch {
				/* không phải JSON → trả raw */
			}
		}
		return raw;
	}

	const SUPPLIER_STATUSES = ['active', 'inactive'] as const;
	const PO_STATUSES = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const;

	// ── Options cho Select component filter (yêu cầu batch 3: tái sử dụng Select
	// thay select native cho cả 4 filter). Value '' = tất cả (giữ parity select cũ).
	const supplierStatusOptions = $derived(
		SUPPLIER_STATUSES.map((s) => ({
			value: s,
			label: s === 'active' ? pageContents.supplierModal.statusActive[lang] : pageContents.supplierModal.statusInactive[lang]
		}))
	);
	const poStatusOptions = $derived(PO_STATUSES.map((s) => ({ value: s, label: poStatusLabel(s) })));

	function poStatusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.poStatuses;
		const label = pageContents.poStatuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function poStatusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'received':
				return 'success';
			case 'ordered':
			case 'partially_received':
				return 'warning';
			case 'cancelled':
				return 'danger';
			default:
				return 'default';
		}
	}

	// ── Tab + trạng thái danh sách ──
	let activeTab = $state<'suppliers' | 'purchase-orders'>('suppliers');

	let suppliers = $state<SupplierRow[]>([]);
	let suppliersTotal = $state(0);
	let suppliersPage = $state(1);
	let suppliersLoading = $state(false);
	let suppliersError = $state<string | undefined>(undefined);
	let suppliersLoadedOnce = $state(false);
	// Deep-link (batch 11, 5f): ?supplier=<id> mở modal edit đúng NCC — chỉ consume 1 lần/lần load trang.
	let deepLinkConsumed = $state(false);

	let pos = $state<PurchaseOrderRow[]>([]);
	let posTotal = $state(0);
	let posPage = $state(1);
	let posLoading = $state(false);
	let posError = $state<string | undefined>(undefined);
	let posLoadedOnce = $state(false);

	let pageSize = $state(20);
	let supplierStatusFilter = $state('');
	let poStatusFilter = $state('');
	let poBranchFilter = $state('');
	let poSupplierFilter = $state('');

	// ── Search server + sort server (pattern purchases) ──
	const PREFS_KEY = '/admin/suppliers';
	let searchQuery = $state<string | undefined>('');
	let searching = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout>;
	let searchArmed = false;
	let suggestOpen = $state(false);
	let searchFocused = $state(false);
	// Mobile caption (yêu cầu 2c): search icon → text field; filter status vào
	// popover từ nút tune; create → icon button. isMobile từ client store.
	const isMobile = $derived(client.browser?.isMobile ?? false);
	let mobileSearchOpen = $state(false);
	// Batch10 (m06635-2,3): setting modal (filter + sort) — mở từ nút tune header
	// datatable VÀ nút setting FAB thay popover gắn caption. mobileFilterOpen BỎ
	// (popover caption xoá hẳn — modal thay thế).
	let settingModalDisplay = $state(false);
	// Draft sort trong setting modal (apply mới ghi vào sortField/sortDirection).
	// Mở modal → seed draft từ state hiện tại ($effect 1 lần khi display bật).
	let settingSortField = $state('');
	let settingSortDirection = $state<'asc' | 'desc'>('desc');
	$effect(() => {
		if (settingModalDisplay) {
			settingSortField = sortField;
			settingSortDirection = sortDirection;
		}
	});
	// Options sort từ supplierColumns sortable (mirror header sort).
	const settingSortOptions = $derived(
		supplierColumns
			.filter((c) => c.sortable)
			.map((c) => ({ value: c.id, label: c.label }))
	);
	// bind:this Input component → instance { configs } (export { configs } cuối
	// Input/Main.svelte) — focus() qua instance.configs.focus().
	let mobileSearchInputInstance = $state<{ configs: { focus: () => void } } | undefined>(undefined);
	let sortField = $state('');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	let branches = $state<BranchOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);

	// Options Select filter PO (bắt buộc value string — lọc row thiếu _id)
	const poBranchOptions = $derived(branches.map((b) => ({ value: b._id, label: b.name ?? b._id })));
	const poSupplierOptions = $derived(
		suppliers
			.filter((s): s is SupplierRow & { _id: string } => typeof s._id === 'string')
			.map((s) => ({ value: s._id, label: s.name ?? s._id }))
	);
	// ── Sticky at-bottom (pattern purchases: cuộn tới đáy bảng → bỏ padding
	// caption/pagination + inset để tối đa không gian row; rời đáy → trả lại) ──
	let wrapEl = $state<HTMLElement | undefined>(undefined);
	let tableScrolled = $state(false);
	let wrapAtBottom = $state(false);
	let paginationPopped = $state(false);
	let scrollRaf = 0;
	// Batch8 mục 1: scroll-ACTIVE theo HÀNH ĐỘNG cuộn (không phải vị trí) —
	// đang cuộn = co padding-block các thành phần cố định, dừng 200ms = trả lại
	// như ban đầu (kể cả khi đang ở giữa trang).
	// Batch9-fix (user m05997): iOS Safari momentum + rubber-band ở đáy tiếp tục
	// bắn scroll event 4-5 GIÂY sau khi user đã buông ngón (mỗi bounce reset
	// timer) → tab-strip/pagination/breadcrumb kẹt ẩn "vĩnh viễn" theo cảm nhận.
	// FIX: bỏ qua event khi (a) scrollTop KHÔNG đổi so với event trước, hoặc
	// (b) VƯỢT biên (rubber-band: top<0 hoặc top>maxScroll — giá trị đàn hồi
	// đổi liên tục khi bounce) — chỉ cú kéo thật trong biên mới prolong ẩn.
	let scrollActive = $state(false);
	let scrollActiveTimer: ReturnType<typeof setTimeout>;
	let lastActiveScrollTop = -1;
	function markScrollActive(scrollTop: number, maxScroll: number) {
		const rubber = scrollTop < 0 || scrollTop > maxScroll;
		if (!rubber && scrollTop !== lastActiveScrollTop) {
			scrollActive = true;
		}
		lastActiveScrollTop = scrollTop;
		clearTimeout(scrollActiveTimer);
		scrollActiveTimer = setTimeout(() => {
			scrollActive = false;
			lastActiveScrollTop = -1;
		}, 200);
	}
	function onTableScroll() {
		const el = wrapEl;
		if (!el) return;
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			markScrollActive(el.scrollTop, el.scrollHeight - el.clientHeight);
			const scrollTop = el.scrollTop;
			// BẪY: nếu nội dung vừa màn (scrollHeight ≈ clientHeight) thì atBottom
			// luôn true → kẹt trạng thái thu padding vĩnh viễn. Chỉ coi là "đáy"
			// khi wrap thực sự scrollable.
			const scrollable = el.scrollHeight > el.clientHeight + 4;
			const atBottom = scrollable && scrollTop + el.clientHeight >= el.scrollHeight - 4;
			tableScrolled = scrollTop > 8;
			wrapAtBottom = atBottom;
			if (atBottom && !paginationPopped) {
				paginationPopped = true;
				setTimeout(() => (paginationPopped = false), 450);
			} else if (!atBottom) {
				paginationPopped = false;
			}
		});
	}

	// Safari iOS ≤15.3 bỏ rule có :has() + 100dvh → layout fullheight chết →
	// .admin-table-wrap KHÔNG scroll được (scrollH ≈ clientH), cả trang cuộn
	// bên trong root Container (div.w-full.h-full.overflow-auto, +layout.svelte:178)
	// chứ KHÔNG phải window → onscroll wrap không bắn, window.scrollY luôn 0.
	// Fallback: khi wrap không scrollable, tìm ancestor scroll container thật.
	function findScrollContainer(): HTMLElement | undefined {
		let el = wrapEl?.parentElement;
		while (el && el !== document.body) {
			const ov = getComputedStyle(el).overflowY;
			if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
			el = el.parentElement;
		}
		return undefined;
	}
	function onWindowScroll() {
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const el = wrapEl;
			if (!el || el.scrollHeight > el.clientHeight + 4) return; // wrap tự cuộn — bỏ qua
			// scroll container thật: window hoặc ancestor overflow:auto (root Container)
			const sc = findScrollContainer();
			const top = sc ? sc.scrollTop : window.scrollY;
			const viewH = sc ? sc.clientHeight : window.innerHeight;
			const totalH = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
			markScrollActive(top, totalH - viewH);
			tableScrolled = top > 8;
			wrapAtBottom = top + viewH >= totalH - 4;
			if (wrapAtBottom && !paginationPopped) {
				paginationPopped = true;
				setTimeout(() => (paginationPopped = false), 450);
			} else if (!wrapAtBottom) {
				paginationPopped = false;
			}
		});
	}

	// ── Modal tạo/sửa nhà cung cấp ──
	let supplierModalDisplay = $state(false);
	let supplierSubmitting = $state(false);
	let supplierError = $state<string | undefined>(undefined);
	// Ref Modal.Container.Body (element DOM) — dùng cho scroll-to-invalid khi submit
	let supplierModalBodyEl = $state<HTMLElement | undefined>(undefined);
	// 'create' | 'edit' — cùng 1 form; edit prefill từ row + Lưu qua /suppliers/update
	let supplierEditMode = $state<'create' | 'edit'>('create');
	let supplierEditId = $state<string | null>(null);
	// Form đầy đủ: phones/emails (multiple), addresses (multiple block), social
	// (zalo/telegram/discord/facebook), images (multiple + avatarUrl con trỏ), note.
	// NOTE: address/province/district CẤP 1 lấy từ entry đầu của addresses
	// (bỏ field address đơn — yêu cầu user 1g) — giữ key trong form để payload ổn định.
	let supplierForm = $state<{
		name: string;
		contactPerson: string;
		address: string;
		phones: string[];
		emails: string[];
		addresses: SupplierAddressEntry[];
		zalo: string[];
		telegram: string[];
		discord: string[];
		facebook: string[];
		instagram: string[];
		website: string[];
		images: string[];
		avatarUrl: string;
		note: string;
		status: string;
	}>({
		name: '',
		contactPerson: '',
		address: '',
		phones: [],
		emails: [],
		addresses: [],
		zalo: [],
		telegram: [],
		discord: [],
		facebook: [],
		instagram: [],
		website: [],
		images: [],
		avatarUrl: '',
		note: '',
		status: 'active'
	});
	// breakdown cho từng entry addresses (AddressInput bind 2 chiều từng phần tử)
	let supplierAddressBreakdowns = $state<{ province: string; district: string; ward?: string }[]>([]);
	// breakdown hệ MỚI (34 tỉnh 2 cấp) cho từng entry — gen 2 chiều với breakdown cũ qua mapping
	let supplierNewAddressBreakdowns = $state<{ province: string; ward: string }[]>([]);
	// ImageUpload defer ref — gọi uploadPending() khi submit, seedFromImages() khi mở modal
	let supplierImageUpload = $state<{
		uploadPending: () => Promise<string[] | string | undefined>;
		seedFromImages: (urls: string[]) => void;
		hasDeferPending: boolean;
	} | undefined>(undefined);

	// ── Draft DB (yêu cầu 1k: reload page → resume) — field `drafts` trong
	// user-prefs (server cap 5 form × 20KB). Tách khỏi datatable.filters vì
	// filters cap value 100 chars — draft form JSON dài hơn nhiều.
	const DRAFT_FORM_KEY = 'suppliers:create';
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	let draftHydrated = $state(false); // $state BẮT BUỘC — không track thì $effect draft không re-run

	function saveDraftDebounced() {
		if (supplierEditMode !== 'create' || !draftHydrated) return;
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			// Lọc null/undefined trong mảng (Input unmount emit undefined qua bind —
			// JSON.stringify biến thành null, resume sau đó sẽ nổ .trim())
			const f = supplierForm;
			const clean = {
				...f,
				phones: f.phones.filter((p): p is string => typeof p === 'string'),
				emails: f.emails.filter((e): e is string => typeof e === 'string'),
				images: f.images.filter((i): i is string => typeof i === 'string')
			};
			saveDraftPref(DRAFT_FORM_KEY, JSON.stringify(clean));
		}, 500);
	}

	function clearDraft() {
		clearDraftPref(DRAFT_FORM_KEY);
	}

	// ── History timeline (batch 6: xem + khôi phục từng entry) ──
	// Backend: POST /suppliers/history {supplierId} → {entries}; POST /suppliers/restore
	// {supplierId, historyId} → {supplier}. Entry shape từ suppliers.ts SupplierHistoryEntry.
	let historyDisplay = $state(false);
	let historyLoading = $state(false);
	let historyEntries = $state<HistoryEntry[]>([]);
	let historySupplier: { _id: string; name?: string } | null = $state(null);
	let restoreBusy = $state<string | null>(null); // historyId đang restore
	let historyConfirmDisplay = $state(false);
	let historyPendingRestore: HistoryEntry | null = $state(null);

	function openHistoryModal(row: SupplierRow) {
		historySupplier = { _id: str(row._id), name: str(row.name) };
		historyEntries = [];
		historyDisplay = true;
		void loadHistory();
	}

	// Footer form modal: nhớ row đang edit để mở history không cần tham số.
	let historySupplierRow = $state<SupplierRow | undefined>(undefined);
	// Field passive (batch 11): metadata created/updated hiển thị cuối form modal —
	// chỉ edit mode có dữ liệu (create chưa có gì để hiển thị).
	let supplierPassive = $state<{ createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string } | null>(null);
	function openHistoryFromFooter() {
		if (!historySupplierRow) return;
		openHistoryModal(historySupplierRow);
	}

	async function loadHistory(opts?: { keepOnFail?: boolean }) {
		if (!historySupplier || !encryptionKeys) return;
		historyLoading = true;
		try {
			const res = await encryption.fetchSecure(
				'/api/admin/suppliers/history',
				{
					method: 'POST',
					// BẪY: fetchSecure tự mã hoá body — truyền OBJECT (không stringify,
					// stringify trước sẽ encrypt chuỗi JSON → server 400)
					body: { supplierId: historySupplier._id }
				},
				encryptionKeys
			);
			historyEntries = ((res.data as { entries?: HistoryEntry[] } | undefined)?.entries ?? []) as HistoryEntry[];
		} catch {
			// keepOnFail (restore-refresh): giữ entries cũ — đừng xoá dữ liệu
			// đang xem chỉ vì 1 lần fetch fail (network flapping tới Capella)
			if (!opts?.keepOnFail) historyEntries = [];
		} finally {
			historyLoading = false;
		}
	}

	// Restore: gọi endpoint rồi refresh bảng + danh sách history (entry 'restore' mới xuất hiện)
	async function performRestore(entry: HistoryEntry) {
		if (!historySupplier || !encryptionKeys || restoreBusy) return;
		restoreBusy = entry._id;
		try {
			const res = await encryption.fetchSecure(
				'/api/admin/suppliers/restore',
				{
					method: 'POST',
					body: { supplierId: historySupplier._id, historyId: entry._id }
				},
				encryptionKeys
			);
			if (!res.ok) {
				showToast(resolveServerMessage(res.message, lang, pageContents.toasts.saveFailed[lang]), 'error');
				return;
			}
			showToast(pageContents.toasts.restored[lang], 'success');
			historyConfirmDisplay = false;
			historyPendingRestore = null;
			await Promise.all([loadSuppliers(), loadHistory({ keepOnFail: true })]);
		} catch {
			showToast(pageContents.toasts.saveFailed[lang], 'error');
		} finally {
			// NHỊP chờ: showToast trước, reset busy sau — nút confirm không kẹt
			restoreBusy = null;
		}
	}

	// ── Dirty-guard (pattern brands: createCloseGuard + AlertDialog) ──
	let dirtyCloseDisplay = $state(false);
	const closeGuard = createCloseGuard({
		form: () => supplierForm,
		openConfirm: () => (dirtyCloseDisplay = true),
		close: () => {
			supplierModalDisplay = false;
			dirtyCloseDisplay = false;
			// Deep-link (5f): đóng modal → gỡ ?supplier khỏi URL (share link
			// chỉ hợp khi modal đang mở)
			cleanSupplierParam();
		}
	});

	// Deep-link (batch 11, 5f): gỡ ?supplier= khỏi URL giữ nguyên query khác
	function cleanSupplierParam() {
		if (page.url.searchParams.has('supplier')) {
			page.url.searchParams.delete('supplier');
			history.replaceState(history.state, '', page.url);
		}
	}

	// ── Bulk selection (yêu cầu 2: STT hover → checkbox, copy/delete hàng loạt) ──
	let selectedIds = $state<string[]>([]);
	// select-all 'filtered': DataTable đọc flag này (allPageSelected) — true khi
	// user đã chọn select-all toàn bộ kết quả filter (qua fetch ids).
	let allFilteredSelected = $state(false);
	let selectAllBusy = $state(false);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);

	// Select-all đa trang: fetch TẤT CẢ suppliers khớp filter hiện tại (page 1,
	// pageSize = total) rồi gán ids — mirror body loadSuppliers.
	async function selectAllFilteredSuppliers() {
		if (!encryptionKeys || selectAllBusy) return;
		selectAllBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/list',
				{
					method: 'POST',
					body: {
						page: 1,
						pageSize: Math.max(suppliersTotal, 1),
						status: supplierStatusFilter || undefined,
						search: searchQuery?.trim() || undefined,
						sortField: sortField || undefined,
						sortDirection
					}
				},
				encryptionKeys
			);
			if (!response.ok) return;
			const data = response.data as { items?: Array<{ _id?: unknown }> } | undefined;
			selectedIds = (data?.items ?? [])
				.map((s) => s._id)
				.filter((id): id is string => typeof id === 'string');
			allFilteredSelected = selectedIds.length > 0;
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/suppliers] select-all filtered failed:', err);
		} finally {
			selectAllBusy = false;
		}
	}

	// clearSelection theo 2 chiều (bulk-bar close / bulk delete): DataTable
	// selected set + page selectedIds + flag all-filtered.
	function clearSuppliersSelection() {
		selectedIds = [];
		allFilteredSelected = false;
	}

	// Bulk count hiển thị: khi select-all toàn bộ kết quả filter → hiện TOTAL
	// (fetch ids bị thiếu 1 số row → count thật lệch; user chốt hiển thị total).
	const bulkDisplayCount = $derived(allFilteredSelected && suppliersTotal > selectedIds.length ? suppliersTotal : selectedIds.length);

	// ── Modal tạo PO ──
	let poModalDisplay = $state(false);
	let poSubmitting = $state(false);
	let poError = $state<string | undefined>(undefined);
	let poForm = $state<{
		poCode: string;
		supplierId: string;
		branchId: string;
		expectedAt: string;
		items: POItem[];
	}>({
		poCode: '',
		supplierId: '',
		branchId: '',
		expectedAt: '',
		items: []
	});
	const poTotalCost = $derived(
		poForm.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0)
	);
	// Dirty-guard PO (chuẩn chung — mirror closeGuard NCC + quickDirty purchases):
	// snapshot JSON so với baseline → attemptClose hỏi discard khi dirty.
	let dirtyPOCloseDisplay = $state(false);
	const poDirty = $derived(poForm.poCode !== '' || poForm.supplierId !== '' || poForm.branchId !== '' || poForm.expectedAt !== '' || poForm.items.some((it) => it.variantId !== '' || it.lotNumber));
	const poCloseGuard = createCloseGuard({
		form: () => poForm,
		openConfirm: () => (dirtyPOCloseDisplay = true),
		close: () => {
			poModalDisplay = false;
			dirtyPOCloseDisplay = false;
		}
	});
	// Select component (chuẩn chung): option objects thay select native.
	const poSupplierModalOptions = $derived(
		poSupplierOptions.length > 0
			? poSupplierOptions
			: suppliers
				.filter((s): s is SupplierRow & { _id: string } => typeof s._id === 'string')
				.map((s) => ({ value: s._id, label: s.name ?? s._id }))
	);
	const poBranchModalOptions = $derived(branches.map((b) => ({ value: b._id, label: b.name ?? b._id })));
	const poVariantModalOptions = $derived(
		variantOptions.map((v) => ({ value: v._id, label: v.sku ? `${v.sku} — ${v.displayName ?? ''}` : (v.displayName ?? v._id) }))
	);

	// ── Modal cập nhật trạng thái PO ──
	let statusModalDisplay = $state(false);
	let statusRow = $state<PurchaseOrderRow | null>(null);
	let newStatus = $state('');
	let statusBusy = $state(false);
	let statusError = $state<string | undefined>(undefined);

	// ── Derived ──
	const totalPages = $derived(
		activeTab === 'suppliers'
			? Math.max(1, Math.ceil(suppliersTotal / pageSize))
			: Math.max(1, Math.ceil(posTotal / pageSize))
	);
	const currentPage = $derived(activeTab === 'suppliers' ? suppliersPage : posPage);

	// Bind 2 chiều cho Pagination element: đồng bộ theo tab đang mở.
	// Pattern customers: effect armed-guard theo dõi page → refetch (tránh trùng onMount).
	let currentPagingPage = $state(1);
	let pagingArmed = false;
	$effect(() => {
		void currentPagingPage;
		if (!pagingArmed) {
			pagingArmed = true;
			return;
		}
		void refreshPaging();
	});
	async function refreshPaging() {
		if (activeTab === 'suppliers') {
			if (suppliersPage === currentPagingPage) return;
			suppliersPage = currentPagingPage;
			await loadSuppliers();
		} else {
			if (posPage === currentPagingPage) return;
			posPage = currentPagingPage;
			await loadPOs();
		}
	}
	const totalCountText = $derived(
		activeTab === 'suppliers'
			? pageContents.pagination.totalCountSuppliers[lang].replace('{total}', String(suppliersTotal))
			: pageContents.pagination.totalCountPOs[lang].replace('{total}', String(posTotal))
	);

	// ── Search debounce 300ms (pattern purchases): effect + armed-guard —
	// lần chạy đầu (init) không fetch; các lần sau searching=true → skeleton,
	// reset page=1 rồi load. Chỉ áp dụng cho tab suppliers.
	let cardFieldIds = $state<string[]>(['name', 'status', 'contact', 'address']);

	$effect(() => {
		void searchQuery;
		if (activeTab !== 'suppliers') return;
		if (!searchArmed) {
			searchArmed = true;
			return;
		}
		clearTimeout(searchDebounce);
		searching = true;
		searchDebounce = setTimeout(() => {
			suppliersPage = 1;
			currentPagingPage = 1;
			void loadSuppliers();
		}, 300);
	});

	// BẪY: card mode mobile unmount Input trong caption → emit undefined qua
	// bind:value. Guard mọi chỗ đọc searchQuery bằng (searchQuery ?? '').
	function saveSearchKeyword() {
		const kw = (searchQuery ?? '').trim();
		if (kw) recordSearchKeyword(PREFS_KEY, kw);
	}

	function mergeIconClasses(
		styles: ReadonlyArray<string | undefined> | undefined,
		extra: string
	): string[] {
		return [...(styles ?? []).filter((c): c is string => typeof c === 'string'), extra];
	}

	// ── Sort server handler (DataTable onSortChange) — persist prefs + reload ──
	function onSupplierSortChange(columnId: string, order: 'asc' | 'desc' | null) {
		if (!order || !columnId) {
			sortField = '';
			sortDirection = 'desc';
		} else {
			sortField = columnId;
			sortDirection = order;
		}
		saveDataTablePrefs(PREFS_KEY, {
			sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
			cardFields: cardFieldIds
		});
		searching = true; // skeleton cả khi sort lại
		suppliersPage = 1;
		currentPagingPage = 1;
		void loadSuppliers();
	}

	// ── Filter tab suppliers: persist filters + searching skeleton ──
	async function onSupplierFilterChange() {
		saveDataTablePrefs(PREFS_KEY, {
			filters: { status: supplierStatusFilter || null },
			cardFields: cardFieldIds
		});
		suppliersPage = 1;
		currentPagingPage = 1;
		await loadSuppliers();
	}

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	function getSupplierLabel(supplierId?: string | null): string {
		if (!supplierId) return '—';
		const supplier = suppliers.find((s) => s._id === supplierId);
		return supplier?.name ?? supplierId;
	}

	function getVariantLabel(variantId?: string | null): string {
		if (!variantId) return '—';
		const variant = variantOptions.find((v) => v._id === variantId);
		if (!variant) return variantId;
		return variant.sku ? `${variant.sku} — ${variant.displayName ?? ''}` : (variant.displayName ?? variantId);
	}

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDate(raw?: string | Date | null) {
		return formatDateShared(raw, lang);
	}

	function formatMoney(value?: number): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value ?? 0);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadBranches() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/branches',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				branches = (response.data as BranchOption[] | undefined) ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/suppliers] load branches failed:', err);
		}
	}

	async function loadVariantOptions() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				variantOptions = (response.data as { items?: VariantOption[] } | undefined)?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/suppliers] load variants failed:', err);
		}
	}

	async function loadSuppliers() {
		if (!encryptionKeys) return;
		suppliersLoading = true;
		suppliersError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/list',
				{
					method: 'POST',
					body: {
						page: suppliersPage,
						pageSize,
						status: supplierStatusFilter || undefined,
						search: (searchQuery ?? '').trim() || undefined,
						sortField: sortField || undefined,
						sortDirection: sortField ? sortDirection : undefined
					}
				},
				encryptionKeys
			);
			suppliersLoading = false;
			searching = false;
			if (response.ok) {
				const data = response.data as
					| { items?: SupplierRow[]; total?: number; page?: number }
					| undefined;
				suppliers = data?.items ?? [];
				if (typeof data?.total === 'number') suppliersTotal = data.total;
				// Selection là id THẬT (getRowId _id) — giữ qua refetch; nhưng nếu
				// select-all filtered và total thay đổi (row mới/xóa) → drop flag để
				// user chọn lại (tránh bulk delete nhầm id ngoài tập filter mới).
				if (allFilteredSelected && selectedIds.length !== suppliersTotal) {
					allFilteredSelected = false;
				}
				if (typeof data?.page === 'number') suppliersPage = data.page;
				suppliersLoadedOnce = true;
				// Deep-link (batch 11, 5f): URL ?supplier=<id> → tự mở modal edit
				// đúng NCC một lần sau khi dữ liệu sẵn sàng.
				if (!deepLinkConsumed) {
					deepLinkConsumed = true;
					const linkId = page.url.searchParams.get('supplier');
					if (linkId) {
						const row = suppliers.find((s) => s._id === linkId) as SupplierRow | undefined;
						if (row) openSupplierEditModal(row as unknown as Record<string, unknown>);
						// id không còn tồn tại → dọn param tránh mở lại vòng sau
						else cleanSupplierParam();
					}
				}
			} else {
				suppliersError = resolveServerMessage(response.message, lang, pageContents.states.errorTitleSuppliers);
			}
		} catch (err) {
			suppliersLoading = false;
			searching = false;
			suppliersError = resolveServerMessage(undefined, lang, pageContents.states.errorTitleSuppliers);
			if (import.meta.env.DEV) console.error('[admin/suppliers] load suppliers failed:', err);
		}
	}

	async function loadPOs() {
		if (!encryptionKeys) return;
		posLoading = true;
		posError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/list',
				{
					method: 'POST',
					body: {
						page: posPage,
						pageSize,
						status: poStatusFilter || undefined,
						branchId: poBranchFilter || undefined,
						supplierId: poSupplierFilter || undefined
					}
				},
				encryptionKeys
			);
			posLoading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: PurchaseOrderRow[]; total?: number; page?: number }
					| undefined;
				pos = data?.items ?? [];
				if (typeof data?.total === 'number') posTotal = data.total;
				if (typeof data?.page === 'number') posPage = data.page;
				posLoadedOnce = true;
			} else {
				posError = resolveServerMessage(response.message, lang, pageContents.states.errorTitlePOs);
			}
		} catch (err) {
			posLoading = false;
			posError = resolveServerMessage(undefined, lang, pageContents.states.errorTitlePOs);
			if (import.meta.env.DEV) console.error('[admin/suppliers] load POs failed:', err);
		}
	}

	function switchTab(tab: 'suppliers' | 'purchase-orders') {
		if (activeTab === tab) return;
		activeTab = tab;
		// Đồng bộ paginator sang state page của tab mới (không refetch —
		// refreshPaging đã guard cùng-value)
		currentPagingPage = tab === 'suppliers' ? suppliersPage : posPage;
		if (tab === 'suppliers' && !suppliersLoadedOnce) void loadSuppliers();
		if (tab === 'purchase-orders' && !posLoadedOnce) void loadPOs();
	}

	async function refresh() {
		if (activeTab === 'suppliers') await loadSuppliers();
		else await loadPOs();
	}

	// ── Phân trang / filter ──
	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		suppliersPage = 1;
		posPage = 1;
		currentPagingPage = 1;
		if (activeTab === 'suppliers') await loadSuppliers();
		else await loadPOs();
	}

	async function onFilterChange() {
		if (activeTab === 'suppliers') {
			await onSupplierFilterChange();
			return;
		}
		posPage = 1;
		await refresh();
	}

	// ---------- DataTable columns ----------
	const suppliersAny = $derived(suppliers as unknown as Record<string, unknown>[]);
	const supplierColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'name',
			label: pageContents.supplierTable.name[lang],
			sortable: true,
			width: '220px',
			accessor: (row) => (row as unknown as SupplierRow).name ?? '—'
		},
		{
			id: 'contact',
			label: pageContents.supplierTable.contact[lang],
			sortable: true,
			accessor: (row) => {
				const r = row as unknown as SupplierRow;
				return r.contactPerson || r.phones?.[0] || '—';
			}
		},
		{
			id: 'address',
			label: pageContents.supplierTable.address[lang],
			accessor: (row) => {
				const r = row as unknown as SupplierRow;
				return r.address || r.addresses?.[0]?.address || '—';
			},
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.supplierTable.status[lang],
			sortable: true,
			accessor: (row) => {
				const status = (row as unknown as SupplierRow).status;
				return status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (status ?? '—');
			},
			status: (_value, row) =>
				(row as unknown as SupplierRow).status === 'active' ? 'success' : 'default'
		},
		{
			id: 'createdAt',
			label: pageContents.supplierTable.createdAt[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as SupplierRow).createdAt),
			noHighlight: true
		},
		{
			id: 'updatedAt',
			label: pageContents.supplierTable.updatedAt[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as SupplierRow & { updatedAt?: string | null }).updatedAt),
			noHighlight: true
		}
	]);

	const posAny = $derived(pos as unknown as Record<string, unknown>[]);
	const poColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'code',
			label: pageContents.poTable.code[lang],
			sortable: true,
			accessor: (row) => (row as unknown as PurchaseOrderRow).poCode ?? '—'
		},
		{
			id: 'supplier',
			label: pageContents.poTable.supplier[lang],
			sortable: true,
			accessor: (row) => getSupplierLabel((row as unknown as PurchaseOrderRow).supplierId),
			noHighlight: true
		},
		{
			id: 'branch',
			label: pageContents.poTable.branch[lang],
			accessor: (row) => getBranchLabel((row as unknown as PurchaseOrderRow).branchId),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.poTable.status[lang],
			sortable: true,
			accessor: (row) => poStatusLabel((row as unknown as PurchaseOrderRow).status),
			status: (_value, row) => poStatusColor((row as unknown as PurchaseOrderRow).status)
		},
		{
			id: 'totalCost',
			label: pageContents.poTable.totalCost[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PurchaseOrderRow).totalCost),
			noHighlight: true
		},
		{
			id: 'expectedAt',
			label: pageContents.poTable.expectedAt[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as PurchaseOrderRow).expectedAt),
			noHighlight: true
		}
	]);

	// ── Modal tạo/sửa nhà cung cấp ──
	function emptySupplierForm() {
		return {
			name: '',
			contactPerson: '',
			address: '',
			phones: [] as string[],
			emails: [] as string[],
			addresses: [] as SupplierAddressEntry[],
			zalo: [] as string[],
			telegram: [] as string[],
			discord: [] as string[],
			facebook: [] as string[],
			instagram: [] as string[],
			website: [] as string[],
			images: [] as string[],
			avatarUrl: '',
			note: '',
			status: 'active'
		};
	}

	function openSupplierModal() {
		supplierEditMode = 'create';
		supplierEditId = null;
		supplierPassive = null;
		// Draft create có dữ liệu → resume; rỗng → form sạch
		const raw = readDraftPref(DRAFT_FORM_KEY);
		let resumed = false;
		if (typeof raw === 'string' && raw) {
			try {
				const saved = JSON.parse(raw) as Partial<typeof supplierForm>;
				if (saved && typeof saved === 'object' && saved.name) {
					// BẪY: mảng từ draft JSON có thể chứa null (Input unmount emit
					// undefined qua bind → JSON.stringify biến thành null) → x.trim() nổ
					const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
					const socialArr = (v: unknown) => {
						// Draft cũ (batch ≤6): social là string đơn → bọc thành mảng 1 phần tử
						if (typeof v === 'string' && v.trim()) return [v.trim()];
						return arr(v);
					};
					supplierForm = {
						...emptySupplierForm(),
						...saved,
						phones: arr(saved.phones),
						emails: arr(saved.emails),
						addresses: Array.isArray(saved.addresses) ? saved.addresses : [],
						zalo: socialArr(saved.zalo),
						telegram: socialArr(saved.telegram),
						discord: socialArr(saved.discord),
						facebook: socialArr(saved.facebook),
						instagram: socialArr(saved.instagram),
						website: socialArr(saved.website),
						images: arr(saved.images),
						avatarUrl: saved.avatarUrl ?? '',
						note: saved.note ?? '',
						status: saved.status ?? 'active'
					};
					resumed = true;
				}
			} catch {
				clearDraftPref(DRAFT_FORM_KEY);
			}
		}
		if (!resumed) supplierForm = emptySupplierForm();
		supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.province ?? '',
			district: a.district ?? '',
			ward: a.ward
		}));
		supplierNewAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.newProvince ?? '',
			ward: a.newWard ?? ''
		}));
		supplierError = undefined;
		supplierModalDisplay = true;
		void seedImagesAfterMount();
		if (resumed) showToast(pageContents.toasts.draftRestored[lang], 'success');
		closeGuard.markClean();
	}

	// Defer seed: khi modal mở, component ImageUpload MỚI mount (nằm trong
	// {#if supplierModalDisplay}) — ref còn undefined ngay sau set display=true.
	// KHÔNG dùng $effect (track supplierForm.images sâu + mutate deferEntries
	// trong child → effect_update_depth_exceeded). Gọi qua awaitTick sau khi
	// set display: component đã mount, ref sẵn sàng, chạy 1 lần duy nhất.
	// Entries từ images đã lưu (resume draft / edit row): chỉ seed URL thật —
	// file local draft KHÔNG sống sót qua reload (blob URL chết).
	async function seedImagesAfterMount() {
		await tick();
		if (supplierModalDisplay && supplierImageUpload) {
			supplierImageUpload.seedFromImages(supplierForm.images);
		}
	}

	// ── Edit: prefill form từ row của bảng (dùng chung form với create) ──
	function openSupplierEditModal(row: Record<string, unknown>) {
		const r = row as unknown as SupplierRow;
		supplierEditMode = 'edit';
		supplierEditId = r._id ?? null;
		// Deep-link (5f): giữ ?supplier=<id> trên URL để chia sẻ link đúng NCC
		if (r._id && page.url.searchParams.get('supplier') !== r._id) {
			page.url.searchParams.set('supplier', r._id);
			history.replaceState(history.state, '', page.url);
		}
		historySupplierRow = r;
		supplierPassive = {
			createdBy: r.createdBy ?? undefined,
			createdAt: r.createdAt ?? undefined,
			updatedBy: r.updatedBy ?? undefined,
			updatedAt: r.updatedAt ?? undefined
		};
		const addr0 = r.addresses?.[0];
		supplierForm = {
			name: r.name ?? '',
			contactPerson: r.contactPerson ?? '',
			// cấp 1 = entry đầu của addresses (bỏ field đơn)
			address: addr0?.address ?? r.address ?? '',
			phones: [...(r.phones ?? [])],
			emails: [...(r.emails ?? [])],
			addresses: (r.addresses ?? []).map((a) => ({ ...a })),
			// Social: doc cũ lưu string đơn → bọc mảng; doc mới là mảng
			zalo: toSocialArray((r as Record<string, unknown>).zalo),
			telegram: toSocialArray((r as Record<string, unknown>).telegram),
			discord: toSocialArray((r as Record<string, unknown>).discord),
			facebook: toSocialArray((r as Record<string, unknown>).facebook),
			instagram: toSocialArray((r as Record<string, unknown>).instagram),
			website: toSocialArray((r as Record<string, unknown>).website),
			images: [...(r.images ?? [])],
			avatarUrl: (r as Record<string, unknown>).avatarUrl as string | undefined ?? r.images?.[0] ?? '',
			note: (r as Record<string, unknown>).note as string | undefined ?? '',
			status: r.status ?? 'active'
		};
		supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.province ?? '',
			district: a.district ?? '',
			ward: a.ward
		}));
		supplierNewAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.newProvince ?? '',
			ward: a.newWard ?? ''
		}));
		supplierError = undefined;
		supplierModalDisplay = true;
		void seedImagesAfterMount();
		closeGuard.markClean();
	}

	// ── Validate social theo từng mạng + phone/email (regex thuần trang tự giữ) ──
	const PHONE_RE = /^(\+?84|0)(\d{8,10})$/;
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ZALO_RE = /^(\+?84|0)\d{8,10}$|^https?:\/\/(zalo\.me\/\S+)$/i;
	const TELEGRAM_RE = /^@[A-Za-z0-9_]{4,32}$|^https?:\/\/(t\.me\/\S+)$/i;
	const DISCORD_RE = /^[A-Za-z0-9._]{2,32}$/;
	const FACEBOOK_RE = /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/\S+$/i;
	const INSTAGRAM_RE = /^@[A-Za-z0-9._]{1,30}$|^https?:\/\/(www\.)?instagram\.com\/\S+$/i;
	const WEBSITE_RE = /^https?:\/\/\S+\.\S+$/i;

	// Social giá trị từ server: doc cũ = string đơn, doc mới = mảng → chuẩn hoá
	// thành mảng string sạch (dùng cho prefill edit + validate + payload).
	function toSocialArray(v: unknown): string[] {
		if (typeof v === 'string') {
			const s = v.trim();
			return s ? [s] : [];
		}
		if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim());
		return [];
	}

	// Mỗi social entry hợp lệ? (validate từng tag khi add + khi submit)
	function socialEntryInvalid(field: SocialFieldKey, value: string): boolean {
		const s = value.trim();
		if (!s) return true;
		switch (field) {
			case 'zalo':
				return !ZALO_RE.test(s);
			case 'telegram':
				return !TELEGRAM_RE.test(s);
			case 'discord':
				return !DISCORD_RE.test(s);
			case 'facebook':
				return !FACEBOOK_RE.test(s);
			case 'instagram':
				return !INSTAGRAM_RE.test(s);
			case 'website':
				return !WEBSITE_RE.test(s);
		}
	}

	// ── Social tags: add/edit/remove (multi-value, cấm trùng) ──
	const socialDraftInputs = $state<Record<SocialFieldKey, string>>({
		zalo: '', telegram: '', discord: '', facebook: '', instagram: '', website: ''
	});
	const socialTagErrors = $state<Record<SocialFieldKey, 'socialDuplicate' | 'socialInvalidTag' | null>>({
		zalo: null, telegram: null, discord: null, facebook: null, instagram: null, website: null
	});
	let editingSocial = $state<{ field: SocialFieldKey; index: number; value: string } | null>(null);

	function addSocialTag(field: SocialFieldKey) {
		const value = socialDraftInputs[field].trim();
		if (!value) return;
		if (socialEntryInvalid(field, value)) {
			socialTagErrors[field] = 'socialInvalidTag';
			return;
		}
		// Cấm trùng (case-insensitive) trong cùng field
		if (supplierForm[field].some((v) => v.trim().toLowerCase() === value.toLowerCase())) {
			socialTagErrors[field] = 'socialDuplicate';
			return;
		}
		socialTagErrors[field] = null;
		supplierForm[field] = [...supplierForm[field], value];
		socialDraftInputs[field] = '';
	}

	function removeSocialTag(field: SocialFieldKey, index: number) {
		supplierForm[field] = supplierForm[field].filter((_, i) => i !== index);
		if (editingSocial?.field === field && editingSocial.index === index) editingSocial = null;
	}

	function startSocialEdit(field: SocialFieldKey, index: number) {
		editingSocial = { field, index, value: supplierForm[field][index] };
	}

	// Commit edit inline: giá trị rỗng → xoá tag; trùng/hợp lệ check như add.
	// BẪY: onblur + Enter kích đôi (Enter → commit → editingSocial=null → blur
	// không còn target) — commit kiểm tra editingSocial trước khi chạy.
	function commitSocialEdit() {
		const edit = editingSocial;
		if (!edit) return;
		editingSocial = null;
		const value = edit.value.trim();
		const others = supplierForm[edit.field].filter((_, i) => i !== edit.index);
		if (!value) {
			removeSocialTag(edit.field, edit.index);
			return;
		}
		if (socialEntryInvalid(edit.field, value)) return; // giữ giá trị cũ
		if (others.some((v) => v.trim().toLowerCase() === value.toLowerCase())) return; // trùng → giữ cũ
		const next = [...supplierForm[edit.field]];
		next[edit.index] = value;
		supplierForm[edit.field] = next;
	}

	// Tag link → href mở tab mới. @username (telegram/instagram) đổi thành URL;
	// zalo SĐT không có link → chỉ link khi là http(s).
	function socialTagHref(field: SocialFieldKey, value: string): string {
		const s = value.trim();
		if (/^https?:\/\//i.test(s)) return s;
		// Batch 11 (5d): mọi network có thể build URL trang — nút open-tab hiện
		// cho mọi giá trị hợp lệ, không chỉ giá trị dạng link sẵn.
		if (field === 'telegram' && s.startsWith('@')) return `https://t.me/${s.slice(1)}`;
		if (field === 'instagram' && s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
		if (field === 'zalo' && /^(\+?84|0)\d{8,10}$/.test(s)) return `https://zalo.me/${s.replace(/^\+?84/, '0')}`;
		if (field === 'facebook') return `https://facebook.com/${s.replace(/^@/, '')}`;
		if (field === 'website') return /^https?:/i.test(s) ? s : `https://${s}`;
		return '';
	}

	function validateSupplierForm(): string | undefined {
		if (!str(supplierForm.name).trim()) {
			return pageContents.form.requireName[lang];
		}
		const t = supplierForm;
		if (t.phones.some((p) => str(p).trim() && !PHONE_RE.test(str(p).trim()))) return pageContents.form.invalidPhone[lang];
		if (t.emails.some((e) => str(e).trim() && !EMAIL_RE.test(str(e).trim()))) return pageContents.form.invalidEmail[lang];
		for (const f of SOCIAL_FIELDS) {
			if (t[f].some((v) => socialEntryInvalid(f, v))) {
				return pageContents.form[`invalid${f[0].toUpperCase()}${f.slice(1)}` as keyof typeof pageContents.form][lang];
			}
		}
		return undefined;
	}

	// Map lỗi validate → CSS selector field tương ứng trong modal (scroll-to-invalid
	// yêu cầu 4f: submit khi invalid → cuộn tới field đầu tiên từ trên xuống).
	// Thứ tự khớp thứ tự check trong validateSupplierForm (name → phone → email → social).
	const FIELD_SELECTORS = {
		requireName: '[data-field="supplier-name"]',
		invalidPhone: '[data-field="supplier-phones"]',
		invalidEmail: '[data-field="supplier-emails"]',
		invalidZalo: '[data-field="social-zalo"]',
		invalidTelegram: '[data-field="social-telegram"]',
		invalidDiscord: '[data-field="social-discord"]',
		invalidFacebook: '[data-field="social-facebook"]',
		invalidInstagram: '[data-field="social-instagram"]',
		invalidWebsite: '[data-field="social-website"]'
	} as const;

	// Scroll tới field invalid đầu tiên (trong .modal-body-root overflow container)
	// root hoá tham số — dùng chung cho modal NCC + PO.
	function scrollToInvalidField(selector: string, rootEl?: HTMLElement | null) {
		const root = rootEl ?? supplierModalBodyEl;
		if (!root) return;
		const el = root.querySelector<HTMLElement>(selector);
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		// Flash viền để user dễ định vị
		el.classList.add('field-flash');
		setTimeout(() => el.classList.remove('field-flash'), 1600);
	}

	// Batch10 (m06635-5b): focus input của row VỪA THÊM (cuối cùng) trong block.
	// Gọi sau flushSync mount row — phần thân focus nằm trong cùng user gesture
	// (iOS Safari chỉ mở keyboard khi focus trong gesture).
	// fieldSelector: khối bọc row (vd '[data-field="supplier-phones"]');
	// rowClass: class row bên trong (address-entry) khi không có data-field riêng.
	function focusLastFieldRow(rootEl: HTMLElement | null | undefined, fieldSelector?: string, rowClass?: string) {
		if (!rootEl) return;
		const scope = fieldSelector ? rootEl.querySelector<HTMLElement>(fieldSelector) : rootEl;
		if (!scope) return;
		const rows = scope.querySelectorAll<HTMLElement>(rowClass ? `.${rowClass}` : '.field-row');
		const last = rows[rows.length - 1];
		last?.querySelector<HTMLInputElement>('input')?.focus();
	}

	// Map lỗi validate PO → selector (thứ tự khớp validatePOForm:
	// code → supplier → branch → items).
	const FIELD_SELECTORS_PO = {
		requireCode: '[data-field="po-code"]',
		requireSupplier: '[data-field="po-supplier"]',
		requireBranch: '[data-field="po-branch"]',
		requireItems: '[data-field="po-items"]',
		requireItem: '[data-field="po-items"]'
	} as const;
	let poModalBodyEl = $state<HTMLElement | undefined>(undefined);

	// ── STT tag + cảnh báo trùng: trả map value→số lần xuất hiện (>=2 = dup) ──
	function countDuplicates(values: string[]): Map<string, number> {
		const counts = new Map<string, number>();
		for (const v of values) {
			const key = str(v).trim().toLowerCase();
			if (!key) continue;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	}

	const phoneDupCounts = $derived(countDuplicates(supplierForm.phones));
	const emailDupCounts = $derived(countDuplicates(supplierForm.emails));
	const addressDupCounts = $derived(countDuplicates(supplierForm.addresses.map((a) => a.address ?? '')));
	const hasDuplicates = $derived(
		[...phoneDupCounts.values(), ...emailDupCounts.values(), ...addressDupCounts.values()].some((n) => n >= 2)
	);
	// Batch10 (m06635-5c): form invalid → nút submit disable (validate toàn form
	// + trùng phone/email/address). Tên trống + row rỗng là trạng thái khởi tạo
	// create — vẫn tính invalid (user phải điền tối thiểu tên).
	const supplierFormInvalid = $derived(!!validateSupplierForm() || hasDuplicates);

	function buildSupplierPayload() {
		const t = supplierForm;
		// breakdown từng entry (bind 2 chiều với AddressInput) merge lại vào addresses
		// — cả hệ cũ (province/district/ward) lẫn hệ mới (newProvince/newWard)
		const entries = t.addresses.map((a, i) => {
			const bd = supplierAddressBreakdowns[i];
			const nbd = supplierNewAddressBreakdowns[i];
			return {
				label: str(a.label).trim() || undefined,
				address: str(a.address).trim(),
				ward: (str(bd?.ward) || str(a.ward)).trim() || undefined,
				province: (str(bd?.province) || str(a.province)).trim() || undefined,
				district: (str(bd?.district) || str(a.district)).trim() || undefined,
				newProvince: (str(nbd?.province) || str(a.newProvince)).trim() || undefined,
				newWard: (str(nbd?.ward) || str(a.newWard)).trim() || undefined,
				country: (str(bd?.province) || str(a.province)).trim() ? 'Việt Nam' : undefined
			};
		});
		// Cấp 1 = entry đầu (địa chỉ chính) — đồng bộ field legacy address/district/province
		const main = entries[0];
		// avatarUrl là CON TRỎ vào 1 URL trong images (nếu images có mà avatar không
		// khớp URL nào → dùng ảnh đầu)
		const images = t.images.map((u) => str(u).trim()).filter(Boolean);
		const avatar = images.includes(str(t.avatarUrl)) ? str(t.avatarUrl) : (images[0] ?? '');
		return {
			name: str(t.name).trim(),
			contactPerson: str(t.contactPerson).trim() || undefined,
			address: main?.address || undefined,
			ward: main?.ward || undefined,
			district: main?.district || undefined,
			province: main?.province || undefined,
			country: main?.country || undefined,
			phones: t.phones.map((p) => str(p).trim()).filter(Boolean),
			emails: t.emails.map((e) => str(e).trim()).filter(Boolean),
			addresses: entries.filter((a) => a.address),
			zalo: t.zalo.map((v) => v.trim()).filter(Boolean).length ? t.zalo.map((v) => v.trim()).filter(Boolean) : undefined,
			telegram: t.telegram.map((v) => v.trim()).filter(Boolean).length ? t.telegram.map((v) => v.trim()).filter(Boolean) : undefined,
			discord: t.discord.map((v) => v.trim()).filter(Boolean).length ? t.discord.map((v) => v.trim()).filter(Boolean) : undefined,
			facebook: t.facebook.map((v) => v.trim()).filter(Boolean).length ? t.facebook.map((v) => v.trim()).filter(Boolean) : undefined,
			instagram: t.instagram.map((v) => v.trim()).filter(Boolean).length ? t.instagram.map((v) => v.trim()).filter(Boolean) : undefined,
			website: t.website.map((v) => v.trim()).filter(Boolean).length ? t.website.map((v) => v.trim()).filter(Boolean) : undefined,
			images: images.length > 0 ? images : undefined,
			avatarUrl: avatar || undefined,
			note: str(t.note).trim() || undefined,
			status: t.status
		};
	}

	async function submitSupplier() {
		if (supplierSubmitting || !encryptionKeys) return;
		const validationError = validateSupplierForm();
		if (validationError) {
			supplierError = validationError;
			// Scroll tới field invalid đầu tiên để user can thiệp (yêu cầu 4f)
			const key = (Object.keys(FIELD_SELECTORS) as (keyof typeof FIELD_SELECTORS)[]).find((k) =>
				validationError === pageContents.form[k]?.[lang]
			);
			if (key) scrollToInvalidField(FIELD_SELECTORS[key]);
			return;
		}
		supplierError = undefined;
		supplierSubmitting = true;
		try {
			// DEFER images: upload các file local chờ tải lên TRƯỚC khi build payload
			// (yêu cầu 4c — không upload rác khi hủy form). Fail upload → dừng, giữ modal.
			if (supplierImageUpload) {
				const uploaded = await supplierImageUpload.uploadPending();
				if (uploaded === undefined) {
					supplierSubmitting = false;
					return;
				}
				if (Array.isArray(uploaded)) supplierForm.images = uploaded;
				else supplierForm.images = [uploaded];
			}
			const isEdit = supplierEditMode === 'edit' && !!supplierEditId;
			const response = await encryption.fetchSecure(
				isEdit ? '/api/admin/suppliers/update' : '/api/admin/suppliers/create',
				{
					method: 'POST',
					body: isEdit
						? { supplierId: supplierEditId, patch: buildSupplierPayload() }
						: buildSupplierPayload()
				},
				encryptionKeys
			);
			supplierSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.supplierUpdated : pageContents.toasts.supplierCreated)
						: isEdit ? pageContents.toasts.supplierUpdated[lang] : pageContents.toasts.supplierCreated[lang],
					'success'
				);
				if (!isEdit) clearDraft(); // create thành công → xoá draft
				closeGuard.markClean(); // đóng programmatic không qua onCloseAttempt
				if (isEdit) cleanSupplierParam(); // deep-link gỡ khi đóng modal
				// Cập nhật field passive với response mới nhất (updatedBy/updatedAt từ server)
				const respSupplier = (response.data as { supplier?: Record<string, unknown> } | undefined)?.supplier;
				if (isEdit && respSupplier) {
					supplierPassive = {
						createdBy: (respSupplier.createdBy as string | null) ?? supplierPassive?.createdBy,
						createdAt: (respSupplier.createdAt as string | null) ?? supplierPassive?.createdAt,
						updatedBy: (respSupplier.updatedBy as string | null) ?? undefined,
						updatedAt: (respSupplier.updatedAt as string | null) ?? undefined
					};
				}
				supplierModalDisplay = false;
				await loadSuppliers();
			} else {
				supplierError = resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.supplierUpdateFailed : pageContents.toasts.supplierFailed);
			}
		} catch (err) {
			supplierSubmitting = false;
			supplierError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] submit supplier failed:', err);
		}
	}

	// ── Bulk copy (TSV: header + các cột đang hiển thị) + bulk delete ──
	function bulkCopySelected() {
		const cols = supplierColumns.filter((c) => c.id !== 'actions' && typeof c.accessor === 'function');
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = suppliers
			.filter((s) => s._id && selectedIds.includes(s._id))
			.map((s) => cols.map((c) => String((c.accessor as (row: unknown) => unknown)(s) ?? '')).join('\t'));
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() => showToast(pageContents.toasts.bulkCopied[lang].replace('{count}', String(bulkDisplayCount)), 'success'))
			.catch(() => showToast(pageContents.toasts.requestFailed[lang], 'error'));
	}

	async function bulkDeleteSelected() {
		if (!encryptionKeys || bulkDeleting || selectedIds.length === 0) return;
		bulkDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/bulk-delete',
				{ method: 'POST', body: { ids: selectedIds } },
				encryptionKeys
			);
			bulkDeleting = false;
			if (response.ok) {
				const data = response.data as { deleted?: number } | undefined;
				showToast(pageContents.toasts.bulkDeleted[lang].replace('{count}', String(data?.deleted ?? selectedIds.length)), 'success');
				bulkDeleteDisplay = false;
				clearSuppliersSelection();
				await loadSuppliers();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.bulkDeleteFailed), 'error');
			}
		} catch (err) {
			bulkDeleting = false;
			showToast(pageContents.toasts.bulkDeleteFailed, 'error');
			if (import.meta.env.DEV) console.error('[admin/suppliers] bulk delete failed:', err);
		}
	}

	// ── Modal tạo PO ──
	function openPOModal() {
		poForm = { poCode: '', supplierId: '', branchId: '', expectedAt: '', items: [] };
		poError = undefined;
		poModalDisplay = true;
		// markClean SAU khi modal render 1 frame — baseline snapshot poForm hiện tại.
		void (async () => {
			await tick();
			poCloseGuard.markClean();
		})();
		void loadVariantOptions();
	}

	function addPOItem() {
		poForm.items = [...poForm.items, { variantId: '', quantity: 1, unitCost: 0 }];
	}

	function removePOItem(index: number) {
		poForm.items = poForm.items.filter((_, i) => i !== index);
	}

	function validatePOForm(): string | undefined {
		if (!str(poForm.poCode).trim()) return pageContents.form.requireCode[lang];
		if (!poForm.supplierId) return pageContents.form.requireSupplier[lang];
		if (!poForm.branchId) return pageContents.form.requireBranch[lang];
		if (poForm.items.length === 0) return pageContents.form.requireItems[lang];
		for (const item of poForm.items) {
			if (!item.variantId || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0) {
				return pageContents.form.requireItem[lang];
			}
		}
		return undefined;
	}

	async function submitPO() {
		if (poSubmitting || !encryptionKeys) return;
		const validationError = validatePOForm();
		if (validationError) {
			poError = validationError;
			// Scroll tới field invalid đầu tiên (chuẩn chung với modal NCC).
			const key = (Object.keys(FIELD_SELECTORS_PO) as (keyof typeof FIELD_SELECTORS_PO)[]).find((k) =>
				validationError === pageContents.form[k]?.[lang]
			);
			if (key) scrollToInvalidField(FIELD_SELECTORS_PO[key], poModalBodyEl);
			return;
		}
		poError = undefined;
		poSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/create',
				{
					method: 'POST',
					body: {
						poCode: str(poForm.poCode).trim(),
						supplierId: poForm.supplierId,
						branchId: poForm.branchId,
						expectedAt: poForm.expectedAt || undefined,
						items: poForm.items.map((item) => ({
							variantId: item.variantId,
							quantity: Number(item.quantity),
							unitCost: Number(item.unitCost),
							lotNumber: str(item.lotNumber).trim() || undefined,
							expiresAt: item.expiresAt || undefined
						})),
						totalCost: poTotalCost
					}
				},
				encryptionKeys
			);
			poSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.poCreated)
						: pageContents.toasts.poCreated[lang],
					'success'
				);
				poModalDisplay = false;
				poCloseGuard.markClean();
				await loadPOs();
			} else {
				poError = resolveServerMessage(response.message, lang, pageContents.toasts.poFailed);
			}
		} catch (err) {
			poSubmitting = false;
			poError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] create PO failed:', err);
		}
	}

	// ── Modal cập nhật trạng thái PO ──
	function openStatusModal(row: PurchaseOrderRow) {
		statusRow = row;
		newStatus = row.status ?? 'draft';
		statusError = undefined;
		statusModalDisplay = true;
	}

	async function confirmStatus() {
		if (!statusRow || statusBusy || !encryptionKeys || !newStatus) return;
		statusBusy = true;
		statusError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/update-status',
				{
					method: 'POST',
					body: {
						poId: statusRow._id,
						status: newStatus
					}
				},
				encryptionKeys
			);
			statusBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.statusUpdated)
						: pageContents.toasts.statusUpdated[lang],
					'success'
				);
				statusModalDisplay = false;
				await loadPOs();
			} else {
				statusError = resolveServerMessage(response.message, lang, pageContents.toasts.statusFailed);
			}
		} catch (err) {
			statusBusy = false;
			statusError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] update PO status failed:', err);
		}
	}

	// BẪY TS: onMount async trả `Promise<() => void>` — cleanup trong callback
	// async KHÔNG hợp lệ (Svelte chỉ đọc return đồng bộ) → tách listener sync
	// onMount riêng; async init dùng onMount(async) thứ hai không return gì.
	onMount(() => {
		// Safari ≤15.3: scroll fallback — root Container (div.w-full.h-full.overflow-auto
		// ở +layout.svelte) là scroll container thật, window không bắn scroll event.
		// Gắn listener lên cả window + root container; tìm qua walk-up từ wrapEl.
		let scrollHost: HTMLElement | null = null;
		if (wrapEl) {
			let el: HTMLElement | undefined | null = wrapEl.parentElement;
			while (el && el !== document.body) {
				const ov = getComputedStyle(el).overflowY;
				if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight + 4) { scrollHost = el; break; }
				el = el.parentElement;
			}
		}
		window.addEventListener('scroll', onWindowScroll, { passive: true });
		scrollHost?.addEventListener('scroll', onWindowScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onWindowScroll);
			scrollHost?.removeEventListener('scroll', onWindowScroll);
		};
	});
	onMount(async () => {
		if (!client.browser) client.browser = {};
		// Restore prefs TRƯỚC load (pattern purchases): sort + cardFields
		const prefs = userPrefs.datatable?.[PREFS_KEY];
		if (prefs?.sort?.field) {
			sortField = prefs.sort.field;
			sortDirection = prefs.sort.direction === 'asc' ? 'asc' : 'desc';
		}
		cardFieldIds = prefs?.cardFields?.length ? [...prefs.cardFields] : ['name', 'status', 'contact', 'address'];
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadSuppliers()]);
		draftHydrated = true; // mở khoá draft auto-save sau khi store đã hydrate từ layout
	});

	// ── Draft auto-save (yêu cầu 1k): form create có dữ liệu → debounce 500ms
	// ghi DB qua user-prefs (draft = filters key 'draft'). Edit mode KHÔNG draft
	// (đang sửa row thật — reload mất là hợp lý, draft chỉ cho create).
	$effect(() => {
		if (!draftHydrated || supplierEditMode !== 'create') return;
		// Track SÂU từng field — `void supplierForm` chỉ track reference, mutate
		// property (bind:value gõ chữ) KHÔNG re-run effect → draft không bao giờ save.
		void supplierForm.name;
		void supplierForm.contactPerson;
		void supplierForm.address;
		void supplierForm.phones;
		void supplierForm.emails;
		void supplierForm.addresses;
		void supplierForm.zalo;
		void supplierForm.telegram;
		void supplierForm.discord;
		void supplierForm.facebook;
		void supplierForm.instagram;
		void supplierForm.website;
		void supplierForm.images;
		void supplierForm.avatarUrl;
		void supplierForm.note;
		void supplierForm.status;
		if (str(supplierForm.name).trim() || supplierForm.phones.length > 0 || supplierForm.emails.length > 0) {
			saveDraftDebounced();
		}
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section
	class="admin-page admin-page--fullheight"
	class:at-bottom={wrapAtBottom}
	// Batch 11 (yêu cầu 2): mọi rule scroll/animate/co-padding CHỈ mobile —
	// PC giữ nguyên bố cục tĩnh (is-scrolled thu gọn chỉ mobile qua CSS @media).
	class:is-scrolled={tableScrolled && isMobile}
	class:is-scrolling={scrollActive && isMobile}
	data-active-tab={activeTab}
>

	<!-- ── Tab ── -->
	<div class="tab-strip" role="tablist" class:is-scrolled={tableScrolled && isMobile} class:is-scrolling={scrollActive && isMobile}>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'suppliers'}
			role="tab"
			aria-selected={activeTab === 'suppliers'}
			onclick={() => switchTab('suppliers')}
		>
			{pageContents.tabs.suppliers[lang]}
		</button>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'purchase-orders'}
			role="tab"
			aria-selected={activeTab === 'purchase-orders'}
			onclick={() => switchTab('purchase-orders')}
		>
			{pageContents.tabs.purchaseOrders[lang]}
		</button>
	</div>

	<!-- (admin-filters ĐÃ BỎ — filter chuyển vào DataTable captionTools, yêu cầu 7) -->

	<!-- ── Tab SUPPLIERS ── -->
	{#if activeTab === 'suppliers'}
		{#if suppliersError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitleSuppliers[lang]}</p>
				<p class="state-detail">{suppliersError}</p>
				<Button color="primary" variant="outline" onClick={loadSuppliers}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<!-- DataTable — server-side paging + server sort + server search:
					paging trong DataTable TẮT (Pagination footer), sort/search qua
					onSortChange/captionTools (pattern purchases). Card mode mobile qua
					cardFields + mobileTapMode="callback". Yêu cầu 2: selectable + STT
					hover → checkbox + bulk copy/delete qua bulk-bar trong caption. -->
			<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
				<DataTable
					data={suppliersAny}
					columns={supplierColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					sortMode="server"
					bind:sortColumn={sortField}
					bind:sortDirection={sortDirection}
					onSortChange={onSupplierSortChange}
					resizable={{ enabled: true, fit: true }}
					loading={suppliersLoading || searching}
						// Batch 12: highlight + filter theo query search box của trang
						searchQuery={searchQuery ?? ''}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptySuppliers[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Danh sách nhà cung cấp', en: 'Suppliers list' }}
					captionDescription={{ vi: 'Tìm kiếm, sắp xếp và quản lý nhà cung cấp', en: 'Search, sort and manage suppliers' }}
					cardFields={cardFieldIds}
					mobileTapMode="callback"
					onRowClick={(row) => openSupplierEditModal(row)}
					actionsLabel={{ vi: pageContents.supplierTable.actions[lang], en: pageContents.supplierTable.actions[lang] }}
					stickyHead
					selectable
					showIndex
					indexOffset={(suppliersPage - 1) * pageSize}
					indexCheckboxes
					checkOnRowClick
					selectionTools={false}
					// id THẬT (_id DB) — root cause select-all 20/28 + bulk ids sai:
					// default idOf = String(index trang) → stale giữa trang.
					getRowId={(row) => String((row as unknown as SupplierRow)._id ?? '')}
					selection={selectedIds}
					selectAllMode="filtered"
					selectAllBusy={selectAllBusy}
					bind:allFilteredSelected={allFilteredSelected}
					onSelectAllFiltered={selectAllFilteredSuppliers}
					onSelectionChange={(ids) => (selectedIds = ids)}
					// BẪY memory: class:directive trên component CHẾT — gộp vào expression class
					// Batch 11: caption co/ẩn khi cuộn CHỈ mobile
					class={[
						tableScrolled && isMobile ? 'caption-collapsed' : undefined,
						scrollActive && isMobile ? 'tools-hidden-mobile' : undefined
					].filter(Boolean).join(' ') || undefined}
					data-test="suppliers-datatable"
				>
					{#snippet captionTools()}
						<!-- BẪY: searchQuery có thể undefined (card mode unmount Input) → ?? ''.
							Bulk-bar KHÔNG swap thay search (Input unmount → onDestroy emit value=undefined
							→ $effect search → searching=true → skeleton → mất selection hiển thị).
							Chỉ THÊM bulk-bar cạnh search — pattern purchases (bulk-bar cuối captionTools). -->
						<!-- Batch8 mục 2: đang cuộn trên mobile → ẨN row tools (search/filter/create)
							bằng CSS display:none — KHÔNG {#if} (unmount Input emit undefined → reload
							storm + mất từ khoá). Bulk-bar GIỮ khi có selection. -->
						{#if selectedIds.length > 0}
							<!-- bulk-bar khi chọn ≥1 row -->
							<div class="bulk-bar" data-test="suppliers-bulk-bar">
								<span class="bulk-count">{pageContents.bulk.selected[lang].replace('{count}', String(bulkDisplayCount))}</span>
								<Button color="primary" variant="soft" size="sm" onClick={bulkCopySelected}>
									{pageContents.bulk.copy[lang]}
								</Button>
								<Button color="error" variant="soft" size="sm" onClick={() => { bulkDeleteDisplay = true; }} data-test="suppliers-bulk-delete">
									{pageContents.bulk.delete[lang]}
								</Button>
								<Button color="default" variant="ghost" size="sm" onClick={clearSuppliersSelection}>
									<Icon icon={iconify['close-rounded']} size="sm" />
								</Button>
							</div>
						{/if}
							<div class="admin-search" data-suggest>
								{#if isMobile && !mobileSearchOpen}
									<!-- mobile 2c: search icon → click mở text field (autofocus);
									     đóng khi blur RỖNG (có từ khoá → giữ field, user chốt) -->
									<button
										type="button"
										class="mobile-caption-icon"
										aria-label={lang === 'vi' ? 'Tìm kiếm' : 'Search'}
										data-test="suppliers-mobile-search-open"
										onclick={() => {
											// Batch10 (m06635-1): flushSync mount field + focus TRONG
											// user gesture (iOS Safari chỉ mở keyboard khi focus nằm
											// trong gesture — setTimeout(0) thoát gesture → hỏng).
											flushSync(() => {
												mobileSearchOpen = true;
												suggestOpen = true;
											});
											mobileSearchInputInstance?.configs.focus();
										}}
									>
										<Icon icon={iconify['search-rounded']} size="sm" />
									</button>
								{:else}
									<Input
										bind:this={mobileSearchInputInstance}
										type="text"
										size="sm"
										placeholder={{ vi: 'Tìm NCC, SĐT, email…', en: 'Search name, phone, email…' }}
										bind:value={searchQuery}
										events={[
											{
												events: {
													focus: {
														handler() {
															searchFocused = true;
															suggestOpen = true;
														}
													},
													blur: {
														handler() {
															searchFocused = false;
															suggestOpen = false; // yêu cầu 5: blur → ẩn popover đúng flow
															saveSearchKeyword();
															// mobile: rỗng → thu về icon (có từ khoá → giữ field)
															if (isMobile && !str(searchQuery).trim()) mobileSearchOpen = false;
														}
													}
												}
											}
										]}
									>
										{#snippet leading(data)}
											{#if searching}
												<!-- yêu cầu 9: đang chờ kết quả → icon thành spinner loading -->
												<span class="admin-search-loading">
													<Spinner size="xs" pattern="circle" />
												</span>
											{:else}
												<Icon
													icon={iconify['search-rounded']}
													size={(data?.size ?? 'sm') as Size}
													class={mergeIconClasses(data?.defaultStyles, 'admin-search-icon')}
												/>
											{/if}
										{/snippet}
									</Input>
								{/if}
								<!-- yêu cầu 6: ĐÃ BỎ nút clear riêng — Input component có sẵn clear button -->
								{#if suggestOpen && getSearchKeywords(PREFS_KEY).length > 0}
									<div class="suggest-popover" role="listbox">
										<p class="suggest-title">{pageContents.suggest.title[lang]}</p>
										{#each getSearchKeywords(PREFS_KEY) as kw (kw)}
											<button
												type="button"
												class="suggest-item"
												role="option"
												aria-selected="false"
												onmousedown={(e) => e.preventDefault()}
												onclick={() => {
													searchQuery = kw;
													suggestOpen = false;
													suppliersPage = 1;
													currentPagingPage = 1;
													void loadSuppliers();
												}}
											>
												{kw}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<!-- yêu cầu 7: filter VÀO caption (bỏ admin-filters row).
							     Batch 3: Select component thay select native (tái sử dụng).
							     Mobile 2c: filter status đẩy vào popover từ nút tune. -->
							{#if !isMobile}
								<Select
									class="admin-filter-select"
									size="sm"
									bind:value={supplierStatusFilter}
									options={supplierStatusOptions}
									searchable
									clearable
									placeholder={pageContents.filters.allStatuses[lang]}
									onValueChange={() => onFilterChange()}
									data-test="suppliers-filter-status"
								/>
							{/if}
							<div class="admin-actions-group">
								<!-- Batch10 (m06635-3): nút setting (tune) header datatable mở
									SETTING MODAL (filter + sort) — cả desktop lẫn mobile thay
									popover gắn caption (bị ẩn theo row tools khi cuộn). -->
								{#if isMobile}
								<button
									type="button"
									class="mobile-caption-icon"
									aria-label={pageContents.filters.allStatuses[lang]}
									data-test="suppliers-mobile-filter-btn"
									onclick={() => (settingModalDisplay = true)}
								>
									<Icon icon={iconify['tune-rounded']} size="sm" />
								</button>
							{:else}
								<Button color="default" variant="outline" size="sm" onClick={() => { settingModalDisplay = true; }} aria-label={pageContents.filters.allStatuses[lang]} data-test="suppliers-header-setting-btn">
									<Icon icon={iconify['tune-rounded']} size="sm" />
								</Button>
							{/if}
								<!-- Quy ước màu nút: create = success -->
								{#if isMobile}
									<Button color="success" size="sm" onClick={openSupplierModal} aria-label={pageContents.actions.createSupplier[lang]} data-test="suppliers-create-btn">
										<Icon icon={iconify['add-rounded']} size="sm" />
									</Button>
								{:else}
									<Button color="success" size="sm" onClick={openSupplierModal} data-test="suppliers-create-btn">
										{pageContents.actions.createSupplier[lang]}
									</Button>
								{/if}
							</div>
					{/snippet}
					{#snippet actionsContent(row)}
						{@const supplier = row as unknown as SupplierRow}
						<div class="row-actions">
							<!-- update/edit = primary; history đã dời vào footer form modal -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openSupplierEditModal(row)}>
								{pageContents.actions.edit[lang]}
							</Button>
						</div>
					{/snippet}
				</DataTable>
			</div>
		{/if}
	{:else}
		<!-- ── Tab PURCHASE ORDERS ── -->
		{#if posError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitlePOs[lang]}</p>
				<p class="state-detail">{posError}</p>
				<Button color="primary" variant="outline" onClick={loadPOs}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
				<DataTable
					data={posAny}
					columns={poColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					searchable
					searchPlaceholder={{ vi: 'Tìm đơn mua hàng…', en: 'Search purchase orders…' }}
					resizable={{ enabled: true, fit: true }}
					loading={posLoading && !posLoadedOnce}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptyPOs[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Danh sách đơn mua hàng', en: 'Purchase orders list' }}
					actionsLabel={{ vi: pageContents.poTable.actions[lang], en: pageContents.poTable.actions[lang] }}
					stickyHead
					// Batch 11: co caption khi cuộn CHỈ mobile
					class={tableScrolled && isMobile ? 'caption-collapsed' : undefined}
					data-test="purchase-orders-datatable"
				>
					{#snippet captionTools()}
						<!-- yêu cầu 7: filter PO vào caption. Batch 3: Select component thay
						     select native (tái sử dụng, user chốt thay cả 4 filter). -->
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poStatusFilter}
							options={poStatusOptions}
							searchable
							clearable
							placeholder={pageContents.filters.allStatuses[lang]}
							onValueChange={() => onFilterChange()}
						/>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poBranchFilter}
							options={poBranchOptions}
							searchable
							clearable
							placeholder={pageContents.filters.allBranches[lang]}
							onValueChange={() => onFilterChange()}
						/>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poSupplierFilter}
							options={poSupplierOptions}
							searchable
							clearable
							placeholder={pageContents.filters.allSuppliers[lang]}
							onValueChange={() => onFilterChange()}
						/>
						<div class="admin-actions-group">
							<Button color="default" variant="outline" size="sm" onClick={refresh} aria-label={pageContents.states.retry[lang]}>
								<Icon icon={iconify['tune-rounded']} size="sm" />
							</Button>
							<Button color="success" size="sm" onClick={openPOModal} data-test="po-create-btn">
								{pageContents.actions.createPO[lang]}
							</Button>
						</div>
					{/snippet}
					{#snippet actionsContent(row)}
						{@const po = row as unknown as PurchaseOrderRow}
						<div class="row-actions">
							<!-- update/edit = primary -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openStatusModal(po)}>
								{pageContents.actions.updateStatus[lang]}
							</Button>
						</div>
					{/snippet}
				</DataTable>
			</div>
		{/if}
	{/if}

	<!-- ── Phân trang (server-side, dùng chung 2 tab) ── -->
	<footer
		class="admin-pagination"
		// Batch 11: co/ẩn pagination khi cuộn CHỈ mobile
		class:pagination-collapsed={scrollActive && isMobile}
		class:pagination-pop={paginationPopped && isMobile}
	>
		<span class="total-count">{totalCountText}</span>
		<div class="page-controls">
			<Pagination
				bind:page={currentPagingPage}
				totalPages={totalPages}
				loading={activeTab === 'suppliers' ? suppliersLoading : posLoading}
				variant="compact"
				prevLabel={pageContents.pagination.prev[lang]}
				nextLabel={pageContents.pagination.next[lang]}
				aria-label={pageContents.title[lang]}
			/>
			<label class="page-size">
				<span class="page-size-label">{pageContents.pagination.pageSizeLabel[lang]}</span>
				<select
					class="admin-select"
					value={pageSize}
					onchange={(e) => changePageSize(Number((e.currentTarget as HTMLSelectElement).value))}
				>
					{#each [10, 20, 50, 100] as size (size)}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</label>
		</div>
	</footer>

	<!-- ── FAB mobile (pattern purchases). Batch9c (m06530): 3 nút cùng cấp
		create + search + setting; group ẨN theo HÀNH ĐỘNG cuộn (opacity giống
		tab/pagination — scrollY=0 → ẩn, đang cuộn → ẩn, dừng → hiện).
		Batch 11: logic cuộn CHỈ mobile (PC @768 display:none có sẵn). -->
	<div
		class="fab-group"
		class:fab-hidden={isMobile && !tableScrolled}
		class:is-scrolling={scrollActive && isMobile}
		data-suggest
	>
		<!-- Batch10 (m06635-1): flushSync mount field + focus TRONG gesture (iOS
			Safari chỉ mở keyboard khi focus trong user gesture). Batch10-7: DOM
			create → setting → search + column-reverse → hiển thị TỪ TRÊN XUỐNG =
			search → setting → create (yêu cầu: search trước setting). -->
		<button
			type="button"
			class="fab fab--primary"
			aria-label={activeTab === 'suppliers' ? pageContents.actions.createSupplier[lang] : pageContents.actions.createPO[lang]}
			data-test="suppliers-fab"
			onclick={() => {
				// Batch10 (m06635-4): create mở modal NGAY (theo activeTab) — bỏ menu.
				if (activeTab === 'suppliers') openSupplierModal();
				else openPOModal();
			}}
		>
			<Icon icon={iconify['add-rounded']} />
		</button>
		<!-- Batch10 (m06635-2,3): setting mở SETTING MODAL (filter+sort) thay popover
			gắn caption — popover nằm trong row tools bị ẩn khi cuộn → "không có modal". -->
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.filters.allStatuses[lang]}
			data-test="suppliers-fab-setting"
			onclick={() => {
				settingModalDisplay = true;
				scrollActive = false;
			}}
		>
			<Icon icon={iconify['tune-rounded']} />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.actions.search[lang]}
			data-test="suppliers-fab-search-btn"
			onclick={() => {
				// Batch10 (m06635-1): flushSync mount field + focus TRONG gesture
				// (iOS Safari — keyboard chỉ mở khi focus trong user gesture).
				flushSync(() => {
					mobileSearchOpen = true;
					scrollActive = false;
				});
				mobileSearchInputInstance?.configs.focus();
			}}
		>
			<Icon icon={iconify['search-rounded']} />
		</button>
	</div>
</section>

<!-- ── Modal tạo/sửa nhà cung cấp (dùng chung form; dirty-guard qua onCloseAttempt) ── -->
{#if supplierModalDisplay}
	<Modal
		bind:display={supplierModalDisplay}
		size="lg"
		isDimissable
		onCloseAttempt={() => closeGuard.attemptClose()}
		// Batch 11 (5b): không auto-focus nút đầu tiên (nút ✕ đầu DOM) — trên
		// Safari iOS 15.1 trạng thái focus-ring y hệt trạng thái thường, user
		// tưởng modal "đã sẵn sàng đóng". Giữ focus tại chỗ, chỉ cài Tab-trap.
		autoFocus={false}
		// Mobile (batch7): full-size modal — class làm hook CSS scoped bên dưới
		class="supplier-modal-root"
	>
		<Modal.Container class="supplier-modal-container">
			<Modal.Container.Header
				actionButtons={{ close: { display: !isMobile } }}
			>
				<div class="supplier-modal-title">
					{#if isMobile}
						<!-- Mobile: thay nút ✕ bằng breadcrumb — chevron back đóng modal -->
						<button
							type="button"
							class="supplier-modal-back"
							aria-label={pageContents.modals.cancel[lang]}
							disabled={supplierSubmitting}
							onclick={() => closeGuard.attemptClose()}
						>
							<Icon icon={iconify['chevron-left-rounded']} size="md" />
						</button>
					{/if}
					<span class="supplier-modal-title__label">
						{supplierEditMode === 'edit' ? pageContents.supplierModal.titleEdit[lang] : pageContents.supplierModal.title[lang]}
					</span>
					{#if supplierEditMode === 'edit' && supplierForm.name}
						<span class="supplier-modal-title__name">{supplierForm.name}</span>
					{/if}
				</div>
			</Modal.Container.Header>
			<Modal.Container.Body bind:ref={supplierModalBodyEl}>
				{#if supplierError}
					<div class="form-error-banner" role="alert">{supplierError}</div>
				{/if}
				{#if hasDuplicates}
					<div class="form-error-banner form-dup-banner" role="alert">
						{pageContents.supplierModal.duplicateWarn[lang]}
					</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
							<div data-field="supplier-name">
						<!-- yêu cầu 1e: dùng Input component (không native input) -->
							<TextField name="supplier-name" required>
								<Label>{pageContents.supplierModal.name[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.name}
									disabled={supplierSubmitting}
									data-test="supplier-form-name"
								/>
							</TextField>
							</div>
						<TextField name="supplier-contact">
							<Label>{pageContents.supplierModal.contact[lang]}</Label>
							<Input
								type="text"
								bind:value={supplierForm.contactPerson}
								disabled={supplierSubmitting}
							/>
						</TextField>
					</div>
					<!-- ── Hình ảnh multiple (defer batch 3: preview local — chỉ upload
						     KHI SUBMIT qua uploadPending, tránh rác khi hủy form) ── -->
					<!-- ── Images: items-block solid (giống address/social, batch6) ── -->
					<div class="items-block social-group">
						<span class="items-block__label">{pageContents.supplierModal.images[lang]}</span>
						<ImageUpload
							bind:this={supplierImageUpload}
							images={supplierForm.images}
							bind:avatarUrl={supplierForm.avatarUrl}
							disabled={supplierSubmitting}
							defer
						/>
					</div>
					<!-- ── Phones + emails multiple: items-block solid (giống social) +
							     Badge STT nền ĐỤC (yêu cầu batch6: hết khuyết bg trái) +
							     line vertical trục x giữa + label giữa border line. ── -->
					<div class="items-block form-items-block" data-field="supplier-phones">
						<span class="items-block__label">{pageContents.supplierModal.phones[lang]}</span>
						{#each supplierForm.phones as phone, phoneIndex (phoneIndex)}
							<div class="field-row" class:field-row--dup={(phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2}>
								<Badge class="field-row-stt" label={String(phoneIndex + 1)} size="xs" variant="solid" color={(phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-phone-stt-${phoneIndex}`} />
								<PhoneInput bind:value={supplierForm.phones[phoneIndex]} placeholder={pageContents.supplierModal.phonePlaceholder[lang]} disabled={supplierSubmitting} />
								<button
									type="button"
									class="field-row-remove"
									aria-label={pageContents.supplierModal.removePhone[lang]}
									disabled={supplierSubmitting}
									onclick={() => {
										supplierForm.phones = supplierForm.phones.filter((_, i) => i !== phoneIndex);
									}}
								>✕</button>
								{#if (phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2}
									<span class="field-row-dup-msg">{pageContents.supplierModal.dupPhone[lang]}</span>
								{/if}
							</div>
						{/each}
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting || supplierForm.phones.some((p) => (p ?? '').trim() !== '' && !PHONE_RE.test((p ?? '').trim()))}
							onclick={() => {
								// Batch10 (m06635-5b): flushSync mount row + focus TRONG gesture
								// (iOS Safari chỉ mở keyboard khi focus trong user gesture).
								flushSync(() => {
									supplierForm.phones = [...supplierForm.phones, ''];
								});
								focusLastFieldRow(supplierModalBodyEl, '[data-field="supplier-phones"]');
							}}
						>+ {pageContents.supplierModal.addPhone[lang]}</button>
					</div>
					<div class="items-block form-items-block" data-field="supplier-emails">
						<span class="items-block__label">{pageContents.supplierModal.emails[lang]}</span>
						{#each supplierForm.emails as email, emailIndex (emailIndex)}
							<div class="field-row" class:field-row--dup={(emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2}>
								<Badge class="field-row-stt" label={String(emailIndex + 1)} size="xs" variant="solid" color={(emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-email-stt-${emailIndex}`} />
								<EmailInput bind:value={supplierForm.emails[emailIndex]} placeholder={pageContents.supplierModal.emailPlaceholder[lang]} disabled={supplierSubmitting} />
								<button
									type="button"
									class="field-row-remove"
									aria-label={pageContents.supplierModal.removeEmail[lang]}
									disabled={supplierSubmitting}
									onclick={() => {
										supplierForm.emails = supplierForm.emails.filter((_, i) => i !== emailIndex);
									}}
								>✕</button>
								{#if (emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2}
									<span class="field-row-dup-msg">{pageContents.supplierModal.dupEmail[lang]}</span>
								{/if}
							</div>
						{/each}
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting || supplierForm.emails.some((e) => (e ?? '').trim() !== '' && !EMAIL_RE.test((e ?? '').trim()))}
							onclick={() => {
								// Batch10 (m06635-5b): flushSync + focus trong gesture.
								flushSync(() => {
									supplierForm.emails = [...supplierForm.emails, ''];
								});
								focusLastFieldRow(supplierModalBodyEl, '[data-field="supplier-emails"]');
							}}
						>+ {pageContents.supplierModal.addEmail[lang]}</button>
					</div>
					<!-- ── Multiple addresses (yêu cầu 1g: BỎ address đơn — block này là duy nhất;
					     entry đầu = địa chỉ chính cho payload cấp 1) ── -->
					<div class="items-block social-group">
						<span class="items-block__label">{pageContents.supplierModal.addresses[lang]}</span>
						{#each supplierForm.addresses as entry, addrIndex (addrIndex)}
							<div class="address-entry" class:field-row--dup={(addressDupCounts.get(str(entry.address).trim().toLowerCase()) ?? 0) >= 2}>
								<div class="address-entry__head">
									<Badge class="field-row-stt" label={String(addrIndex + 1)} size="xs" variant="solid" color={(addressDupCounts.get(str(entry.address).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-address-stt-${addrIndex}`} />
									<Input
										type="text"
										bind:value={entry.label}
										placeholder={pageContents.supplierModal.addressLabelPlaceholder[lang]}
										disabled={supplierSubmitting}
										size="sm"
									/>
									<button
										type="button"
										class="field-row-remove"
										aria-label={pageContents.supplierModal.removeAddress[lang]}
										disabled={supplierSubmitting}
										onclick={() => {
											supplierForm.addresses = supplierForm.addresses.filter((_, i) => i !== addrIndex);
											supplierAddressBreakdowns = supplierAddressBreakdowns.filter((_, i) => i !== addrIndex);
											supplierNewAddressBreakdowns = supplierNewAddressBreakdowns.filter((_, i) => i !== addrIndex);
										}}
									>✕</button>
								</div>
								<AddressInput
									bind:value={entry.address}
									bind:breakdown={supplierAddressBreakdowns[addrIndex]}
									bind:newBreakdown={supplierNewAddressBreakdowns[addrIndex]}
									placeholder={pageContents.supplierModal.addressPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</div>
						{/each}
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting || supplierForm.addresses.some((a) => (a.address ?? '').trim() === '')}
							onclick={() => {
								// Batch10 (m06635-5b): flushSync + focus trong gesture.
								flushSync(() => {
									supplierForm.addresses = [...supplierForm.addresses, { label: '', address: '', province: '', district: '' }];
									supplierAddressBreakdowns = [...supplierAddressBreakdowns, { province: '', district: '', ward: '' }];
									supplierNewAddressBreakdowns = [...supplierNewAddressBreakdowns, { province: '', ward: '' }];
								});
								focusLastFieldRow(supplierModalBodyEl, undefined, 'address-entry');
							}}
						>+ {pageContents.supplierModal.addAddress[lang]}</button>
					</div>
					<!-- ── Social block: 6 field dạng TAG multi-value (yêu cầu batch7:
					     enter tạo mới, icon open-tab + remove, click text edit, cấm trùng) ── -->
					<div class="items-block social-group">
						<span class="items-block__label">{pageContents.supplierModal.social[lang]}</span>
						<div class="form-grid-2">
							{#each SOCIAL_FIELDS as sf (sf)}
								<div class="social-tag-block" data-field="social-{sf}">
									<span class="social-tag-block__label">{pageContents.supplierModal[sf][lang]}</span>
									<div class="social-tags">
										{#each supplierForm[sf] as tag, ti (ti)}
											{@const tagInvalid = socialEntryInvalid(sf, tag)}
											{@const isLink = !!socialTagHref(sf, tag)}
											<span
												class="social-tag"
												class:social-tag--invalid={tagInvalid}
												class:social-tag--link={isLink}
											>
												{#if isLink}
													<button
														type="button"
														class="social-tag__open"
														title={pageContents.supplierModal.socialOpen[lang]}
														aria-label={pageContents.supplierModal.socialOpen[lang]}
														onclick={() => {
															const href = socialTagHref(sf, tag);
															if (href) window.open(href, '_blank', 'noopener');
														}}
													>
														<Icon icon={iconify['open-in-new-rounded']} size="sm" />
													</button>
												{/if}
												<!-- click text → edit inline (chuyển thành input) -->
												{#if editingSocial?.field === sf && editingSocial.index === ti}
													<input
														class="social-tag__edit"
														type="text"
														bind:value={editingSocial.value}
														onkeydown={(e) => {
															if (e.key === 'Enter') commitSocialEdit();
															else if (e.key === 'Escape') editingSocial = null;
														}}
														onblur={commitSocialEdit}
													/>
												{:else}
													<button
														type="button"
														class="social-tag__text"
														title={pageContents.supplierModal.socialEdit[lang]}
														onclick={() => startSocialEdit(sf, ti)}
													>{tag}</button>
												{/if}
												<button
													type="button"
													class="social-tag__remove"
													title={pageContents.supplierModal.socialRemove[lang]}
													aria-label={pageContents.supplierModal.socialRemove[lang]}
													onclick={() => removeSocialTag(sf, ti)}
												>
													<Icon icon={iconify['close-rounded']} size="sm" />
												</button>
											</span>
										{/each}
										<input
											class="social-tags__input"
											type="text"
											placeholder={pageContents.supplierModal.socialAdd[lang]}
											bind:value={socialDraftInputs[sf]}
											onkeydown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													addSocialTag(sf);
												}
											}}
											disabled={supplierSubmitting}
										/>
									</div>
									{#if socialTagErrors[sf]}
										<span class="social-tag-error">{pageContents.supplierModal[socialTagErrors[sf]!][lang]}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
					<!-- ── Note long text (yêu cầu 1i) ── -->
					<TextField name="supplier-note">
						<Label>{pageContents.supplierModal.note[lang]}</Label>
						<Textarea
							bind:value={supplierForm.note}
							placeholder={pageContents.supplierModal.notePlaceholder[lang]}
							rows={3}
							autoResize
							maxLength={2000}
							disabled={supplierSubmitting}
							data-test="supplier-form-note"
						/>
					</TextField>
					<!-- ── Status: Switch (yêu cầu 1f: giảm thao tác) ── -->
					<div class="form-field">
						<span class="form-label">{pageContents.supplierModal.status[lang]}</span>
						<Switch
							checked={supplierForm.status === 'active'}
							label={supplierForm.status === 'active' ? pageContents.supplierModal.statusActive[lang] : pageContents.supplierModal.statusInactive[lang]}
							disabled={supplierSubmitting}
							color="success"
							onchange={(checked) => (supplierForm.status = checked ? 'active' : 'inactive')}
							data-test="supplier-form-status"
						/>
					</div>
					<!-- ── Field passive (batch 11): metadata created/updated — chỉ edit mode ── -->
					{#if supplierEditMode === 'edit' && supplierPassive}
						<dl class="supplier-passive" data-test="supplier-passive">
							{#if supplierPassive.createdAt}
								<div class="supplier-passive__row">
									<dt>{pageContents.supplierModal.passiveCreatedAt[lang]}</dt>
									<dd>{formatDate(supplierPassive.createdAt)}{#if supplierPassive.createdBy}<span class="supplier-passive__sep">·</span>{supplierPassive.createdBy}{/if}</dd>
								</div>
							{/if}
							{#if supplierPassive.updatedAt}
								<div class="supplier-passive__row">
									<dt>{pageContents.supplierModal.passiveUpdatedAt[lang]}</dt>
									<dd>{formatDate(supplierPassive.updatedAt)}{#if supplierPassive.updatedBy}<span class="supplier-passive__sep">·</span>{supplierPassive.updatedBy}{/if}</dd>
								</div>
							{/if}
						</dl>
					{/if}
					</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- History chỉ ở edit mode — nhóm riêng cách Save/Cancel khoảng trống -->
				{#if supplierEditMode === 'edit'}
					<Button
						color="default"
						variant="ghost"
						size="sm"
						disabled={supplierSubmitting}
						onclick={openHistoryFromFooter}
						data-test="suppliers-history-btn"
					>
						{pageContents.history.viewHistory[lang]}
					</Button>
				{/if}
				<span class="supplier-footer-spacer"></span>
				<!-- create/save = success. Batch10 (m06635-5c): disable khi form invalid
					(đỡ thao tác lãng phí — submit chỉ bật khi dữ liệu hợp lệ). -->
				<Button color="success" onClick={submitSupplier} loading={supplierSubmitting} disabled={supplierSubmitting || supplierFormInvalid}>
					{supplierEditMode === 'edit' ? pageContents.supplierModal.save[lang] : pageContents.supplierModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={supplierSubmitting}
					onClick={() => {
						closeGuard.attemptClose();
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog dirty-close (pattern purchases/brands) ── -->
{#if dirtyCloseDisplay}
	<AlertDialog bind:open={dirtyCloseDisplay} title={pageContents.dirty.title[lang]} description={pageContents.dirty.desc[lang]}>
		<AlertDialog.Content>
			<AlertDialog.Header variant="info">
				<AlertDialog.Title>{pageContents.dirty.title[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.dirty.desc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.dirty.continueEdit[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="primary"
					onselect={() => {
						// confirmDiscard → close() → supplierModalDisplay=false; AlertDialog tự đóng qua bind:open
						closeGuard.confirmDiscard();
					}}
				>
					{pageContents.dirty.discard[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
{/if}

<!-- ── Batch10 (m06635-3): Setting modal (filter status + sort) — mở từ nút
	tune header datatable (desktop + mobile) và nút setting FAB. Thay popover
	gắn caption (bị ẩn theo row tools khi đang cuộn → click FAB "không thấy"). ── -->
{#if settingModalDisplay}
	<Modal bind:display={settingModalDisplay} size="sm">
		<Modal.Container>
			<Modal.Container.Header>{pageContents.settings.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="setting-form" data-test="suppliers-setting-modal">
					<TextField name="suppliers-setting-status">
						<Label>{pageContents.settings.filterStatus[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={supplierStatusFilter}
							options={supplierStatusOptions}
							searchable
							clearable
							/* Batch 11 (yêu cầu 2b): panel option KHÔNG portal — nằm trong
							   .modal-body-root (overflow-y:auto) → phần dưới list bị footer
							   che, phải cuộn body mới thấy. Fullscreen mode = overlay riêng,
							   không còn xung đột scroll-container. */
							fullscreen
							placeholder={pageContents.filters.allStatuses[lang]}
							data-test="suppliers-setting-status"
						/>
					</TextField>
					<TextField name="suppliers-setting-sort">
						<Label>{pageContents.settings.sortBy[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={settingSortField}
							options={settingSortOptions}
							clearable
							fullscreen
							placeholder={pageContents.settings.sortBy[lang]}
							data-test="suppliers-setting-sort"
						/>
					</TextField>
					<TextField name="suppliers-setting-direction">
						<Label>{pageContents.settings.sortDirection[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={settingSortDirection}
							options={[
								{ value: 'asc', label: pageContents.settings.asc[lang] },
								{ value: 'desc', label: pageContents.settings.desc[lang] }
							]}
							fullscreen
							data-test="suppliers-setting-direction"
						/>
					</TextField>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="secondary"
					variant="outline"
					disabled={supplierStatusFilter === '' && settingSortField === ''}
					onClick={() => {
						settingSortField = '';
						settingSortDirection = 'desc';
					}}
				>
					{pageContents.settings.reset[lang]}
				</Button>
				<Button
					color="primary"
					data-test="suppliers-setting-apply"
					onClick={() => {
						sortField = settingSortField;
						sortDirection = settingSortDirection === 'asc' ? 'asc' : 'desc';
						settingModalDisplay = false;
						// mirror onSupplierFilterChange + onSupplierSortChange: persist
						// (filter + sort) + về trang 1 + reload
						saveDataTablePrefs(PREFS_KEY, {
							filters: { status: supplierStatusFilter || null },
							sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
							cardFields: cardFieldIds
						});
						suppliersPage = 1;
						currentPagingPage = 1;
						void loadSuppliers();
					}}
				>
					{pageContents.settings.apply[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal lịch sử thay đổi (timeline kiểu git + khôi phục từng entry) ── -->
{#if historyDisplay}
	<Modal bind:display={historyDisplay} size="lg">
		<Modal.Container>
			<Modal.Container.Header>
				{pageContents.historyModal.title[lang]}{historySupplier?.name ? ` — ${historySupplier.name}` : ''}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if historyLoading}
					<div class="history-state">{pageContents.historyModal.loading[lang]}</div>
				{:else if historyEntries.length === 0}
					<div class="history-state">{pageContents.historyModal.empty[lang]}</div>
				{:else}
					<div class="history-timeline" data-test="suppliers-history-timeline">
						{#each historyEntries as entry (entry._id)}
							{@const entryLabel = pageContents.historyModal[entry.type === 'restore' ? 'restore' : 'update'][lang]}
							<div class="history-entry" class:history-entry--restore={entry.type === 'restore'}>
								<div class="history-entry__rail">
									<span class="history-dot" class:history-dot--restore={entry.type === 'restore'}></span>
								</div>
								<div class="history-entry__card">
									<div class="history-entry__head">
										<Badge variant="soft" color={entry.type === 'restore' ? 'success' : 'info'}>{entryLabel}</Badge>
										<time class="history-time">{entry.createdAt ? formatDateShared(entry.createdAt, lang) : ''}</time>
										<span class="history-actor">
											{pageContents.historyModal.by[lang]}
											{entry.actorName || pageContents.historyModal.unknownActor[lang]}
										</span>
									</div>
									{#if entry.changes.length === 0}
										<p class="history-nochanges">{pageContents.historyModal.noChanges[lang]}</p>
									{:else}
										<ul class="history-changes">
											{#each entry.changes as ch (ch.field)}
												<li class="history-change">
													<span class="history-change__field">{pageContents.historyModal.fieldLabels[ch.field]?.[lang] ?? ch.field}</span>
													<del class="history-change__before">{snapshotDisplay(ch.before)}</del>
													<ins class="history-change__after">{snapshotDisplay(ch.after)}</ins>
												</li>
											{/each}
										</ul>
									{/if}
									{#if entry.type === 'update'}
										<div class="history-entry__actions">
											<Button
												color="secondary"
												variant="outline"
												size="xs"
												disabled={restoreBusy !== null}
												onClick={() => {
													historyPendingRestore = entry;
													historyConfirmDisplay = true;
												}}
												data-test="suppliers-restore-btn"
											>
												{pageContents.historyModal.restoreBtn[lang]}
											</Button>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Modal.Container.Body>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog confirm khôi phục entry ── -->
{#if historyConfirmDisplay}
	<AlertDialog
		bind:open={historyConfirmDisplay}
		title={pageContents.historyModal.confirmTitle[lang]}
		description={pageContents.historyModal.confirmDesc[lang]}
	>
		<AlertDialog.Content>
			<AlertDialog.Header variant="info">
				<AlertDialog.Title>{pageContents.historyModal.confirmTitle[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.historyModal.confirmDesc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.historyModal.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action color="primary" disabled={restoreBusy !== null} onselect={() => historyPendingRestore && void performRestore(historyPendingRestore)}>
					{pageContents.historyModal.confirmYes[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
{/if}

<!-- ── AlertDialog bulk-delete (yêu cầu 2: xóa hàng loạt qua confirm) ── -->
{#if bulkDeleteDisplay}
	<AlertDialog bind:open={bulkDeleteDisplay} title={pageContents.bulk.title[lang]} description={pageContents.bulk.desc[lang]}>
		<AlertDialog.Content>
			<AlertDialog.Header variant="danger">
				<AlertDialog.Title>{pageContents.bulk.title[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.bulk.desc[lang].replace('{count}', String(bulkDisplayCount))}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.bulk.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="danger"
					disabled={bulkDeleting}
					onselect={() => {
						void bulkDeleteSelected();
					}}
				>
					{pageContents.bulk.confirm[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
{/if}

<!-- ── Modal tạo đơn mua hàng (chuẩn chung: TextField/Input + Select + dirty-guard) ── -->
{#if poModalDisplay}
	<Modal bind:display={poModalDisplay} size="lg" isDimissable onCloseAttempt={() => poCloseGuard.attemptClose()}>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.poModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body bind:ref={poModalBodyEl}>
				{#if poError}
					<div class="form-error-banner" role="alert">{poError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<div data-field="po-code">
							<TextField name="po-code" required>
								<Label>{pageContents.poModal.code[lang]}</Label>
								<Input
									type="text"
									bind:value={poForm.poCode}
									disabled={poSubmitting}
									data-test="po-form-code"
								/>
							</TextField>
						</div>
						<div class="form-field" data-field="po-expected">
							<span class="form-label">{pageContents.poModal.expectedAt[lang]}</span>
							<input class="admin-input" type="date" bind:value={poForm.expectedAt} disabled={poSubmitting} />
						</div>
					</div>
					<div class="form-grid-2">
						<div class="form-field" data-field="po-supplier">
							<span class="form-label">{pageContents.poModal.supplier[lang]}</span>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={poForm.supplierId}
								options={poSupplierModalOptions}
								searchable
								clearable
								placeholder={pageContents.poModal.supplierPlaceholder[lang]}
								disabled={poSubmitting}
							/>
						</div>
						<div class="form-field" data-field="po-branch">
							<span class="form-label">{pageContents.poModal.branch[lang]}</span>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={poForm.branchId}
								options={poBranchModalOptions}
								searchable
								clearable
								placeholder={pageContents.poModal.branchPlaceholder[lang]}
								disabled={poSubmitting}
							/>
						</div>
					</div>

					<div class="items-block" data-field="po-items">
						<p class="form-label">{pageContents.poModal.items[lang]}</p>
						{#each poForm.items as item, index (index)}
							<div class="po-item">
								<Select
									class="admin-filter-select po-item-variant"
									size="sm"
									bind:value={item.variantId}
									options={poVariantModalOptions}
									searchable
									clearable
									placeholder={pageContents.poModal.itemVariantPlaceholder[lang]}
									disabled={poSubmitting}
								/>
								<input class="admin-input po-item-num" type="number" min="1" step="1" bind:value={item.quantity} disabled={poSubmitting} placeholder={pageContents.poModal.itemQuantity[lang]} />
								<input class="admin-input po-item-num" type="number" min="0" step="any" bind:value={item.unitCost} disabled={poSubmitting} placeholder={pageContents.poModal.itemUnitCost[lang]} />
								<input class="admin-input po-item-lot" type="text" bind:value={item.lotNumber} disabled={poSubmitting} placeholder={pageContents.poModal.itemLot[lang]} />
								<input class="admin-input po-item-date" type="date" bind:value={item.expiresAt} disabled={poSubmitting} />
								<!-- delete/remove = error -->
								<Button color="error" variant="ghost" size="sm" disabled={poSubmitting} onClick={() => removePOItem(index)}>
									{pageContents.poModal.removeItem[lang]}
								</Button>
							</div>
						{/each}
						<Button color="default" variant="outline" size="sm" disabled={poSubmitting} onClick={addPOItem}>
							{pageContents.poModal.addItem[lang]}
						</Button>
						<p class="po-total">
							{pageContents.poModal.totalCost[lang]}: <strong>{formatMoney(poTotalCost)}</strong>
						</p>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitPO} loading={poSubmitting} disabled={poSubmitting}>
					{pageContents.poModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={poSubmitting}
					onClick={() => {
						poCloseGuard.attemptClose();
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>

	<!-- Dirty-guard confirm (chuẩn chung với modal NCC) -->
	{#if dirtyPOCloseDisplay}
		<AlertDialog bind:open={dirtyPOCloseDisplay} title={pageContents.dirty.title[lang]} description={pageContents.dirty.desc[lang]}>
			<AlertDialog.Content>
				<AlertDialog.Header variant="info">
					<AlertDialog.Title>{pageContents.dirty.title[lang]}</AlertDialog.Title>
					<AlertDialog.Description>{pageContents.dirty.desc[lang]}</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Cancel>{pageContents.dirty.continueEdit[lang]}</AlertDialog.Cancel>
					<AlertDialog.Action
						color="primary"
						onselect={() => {
							poCloseGuard.confirmDiscard();
						}}
					>
						{pageContents.dirty.discard[lang]}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
	{/if}
{/if}

<!-- ── Modal cập nhật trạng thái PO ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.statusModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					<strong>{statusRow?.poCode ?? '—'}</strong>
					— {getSupplierLabel(statusRow?.supplierId)}
				</p>
				{#if statusError}
					<div class="form-error-banner" role="alert">{statusError}</div>
				{/if}
				<label class="form-field">
					<span class="form-label">{pageContents.statusModal.status[lang]}</span>
					<select class="admin-select" bind:value={newStatus} disabled={statusBusy}>
						{#each PO_STATUSES as status (status)}
							<option value={status}>{poStatusLabel(status)}</option>
						{/each}
					</select>
				</label>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update/edit = primary -->
				<Button color="primary" onClick={confirmStatus} loading={statusBusy}>
					{pageContents.statusModal.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						statusModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<style lang="scss">
	.admin-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;

		@media (max-width: 720px) {
			padding: 1rem;
		}
	}

	/* ── Fullheight (pattern purchases): ZERO 3 var sticky của layout — wrap tự
	   scroll trong page (caption/th sticky bám wrap, không bám layout) ── */
	.admin-page--fullheight {
		height: 100%;
		max-width: none;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		transition: padding 200ms ease, gap 200ms ease;
		/* caption/th sticky của DataTable đọc 3 var này từ ancestor — zero để
		   sticky top = 0 (bám đỉnh wrap, không bị "hở" dưới header layout) */
		--admin-header-h: 0px;
		--admin-filters-h: 0px;
		--admin-page-header-h: 0px;

		@media (max-width: 767px) {
			padding: 0.75rem;
		}

		// Scroll → co page padding BLOCK + gap tăng không gian row (yêu cầu 1 sticky
		// tab-strip: dừng cuộn trả lại — transition tự đảo). Batch7: GIỮ padding
		// inline (ngang) — chỉ co block (dọc).
		// Batch8: co theo HÀNH ĐỘNG cuộn (is-scrolling = đang cuộn, dừng 200ms trả
		// lại) — is-scrolled giữ lại cho trạng thái vị trí (top > 8px).
		// Batch 11 (yêu cầu 2): CHỈ mobile — PC giữ padding tĩnh.
		@media (max-width: 767px) {
			&.is-scrolled,
			&.is-scrolling {
				gap: 0.375rem;
				padding-block: 0.5rem;
			}
		}
	}

	/* Cuộn tới đáy: bỏ padding block page + pagination để tối đa không gian row.
	   Rời đáy (scroll to top) → media 767 trả lại padding như ban đầu. */
	.admin-page--fullheight.at-bottom {
		@media (max-width: 767px) {
			padding-block: 0;
		}
	}

	.admin-table-area {
		flex: 1;
		min-height: 0;
	}

	.admin-table-wrap {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	/* ── Tab-strip: sticky khi cuộn (yêu cầu 4 — scroll to bottom giữ tab-strip) ── */
	.tab-strip {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--default-200);
		background: var(--background);
		position: sticky;
		/* Layout cuộn ở root (Safari <15.4 không dvh → fullheight chết): header
		   breadcrumb sticky top:0 z-500 ĐÈ tab-strip sticky top:0 z-20 khi cả hai
		   cùng ghim → tab cần top = chiều cao header. KHÔNG dùng --admin-header-h:
		   page zero-hoá var này cho DataTable sticky (khối .admin-page--fullheight
		   ở trên) → tab-strip kế thừa 0px. Layout set --admin-tab-top (không bị
		   page shadow). */
		top: var(--admin-tab-top, 0px);
		z-index: 20;
		transition: box-shadow 200ms ease, opacity 150ms ease;
	}

	.tab-item {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		border: none;
		background: transparent;
		color: var(--foreground-500);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: padding 200ms ease, font-size 200ms ease;

		&.active {
			color: var(--foreground);
			font-weight: 600;
			border-bottom-color: var(--primary);
		}

		&:hover {
			color: var(--foreground);
		}
	}

	// Scroll sang dưới → tab-strip thu nhỏ (pattern admin-inset-header.is-scrolled);
	// scroll về top → trả lại padding ban đầu (transition tự đảo).
	// Batch9 (user m05696): ĐANG cuộn → ẨN tab-strip (tăng rows hiển thị),
	// dừng 200ms → trả lại. is-scrolled giữ cho trạng thái vị trí.
	// Batch9b (m06345): display:none co flow → khi trả lại ở đáy, nội dung bị
	// đẩy xuống (row cuối che vĩnh viễn — max-scroll đổi giữa chừng). Đổi
	// OPACITY: tab-strip giữ chỗ trong flow, chỉ mờ đi → max-scroll ổn định.
	.tab-strip.is-scrolling {
		opacity: 0;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.tab-strip,
		.tab-item {
			transition: none;
		}
	}

	.admin-select {
		height: 2.25rem;
		padding: 0 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.85rem;
		cursor: pointer;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
		}

		option {
			background: var(--default-200);
			color: var(--foreground);
		}
	}

	/* Select component filter trong captionTools (batch 3: thay select native).
	   BẪY: scoped selector không match element Select (mang hash Select component)
	   → :global() bắt buộc (pattern purchases +page.svelte:4640). */
	:global(.datatable-caption-tools .admin-filter-select) {
		width: 10rem;
		max-width: 10rem;
		flex-shrink: 0;

		:global(.select-trigger) {
			height: 2.25rem;
			min-height: 2.25rem;
			border-radius: 0.5rem;
			border: 1px solid var(--default-300);
			background: var(--default-50, transparent);
			font-size: 0.85rem;
		}
	}

	/* Scroll → caption collapsed (DataTable root class từ page): ẩn desc +
	   co caption đã làm ở DataTable; ở đây thu nhỏ tools (search/select/btn).
	   Batch 11 (yêu cầu 2): CHỈ mobile — PC caption giữ kích thước tĩnh. */
	@media (max-width: 767px) {
		:global(.datatable-root.caption-collapsed) {
			:global(.datatable-caption-tools .admin-search .input-root),
			:global(.datatable-caption-tools .admin-filter-select .select-trigger) {
				height: 1.75rem;
				min-height: 1.75rem;
			}

			:global(.datatable-caption-tools .admin-actions-group .button-root) {
				height: 1.75rem;
				min-height: 1.75rem;
				padding-inline: 0.625rem;
			}

			:global(.datatable-caption-tools .bulk-bar) {
				height: 1.75rem;
			}
		}
	}

	/* Batch8 mục 2: mobile đang cuộn → ẨN row tools (search/filter/create) bằng
	   display:none — Input vẫn mounted (không emit undefined qua bind:value).
	   Class tách khỏi caption-collapsed (vị trí) — chỉ khi ĐANG cuộn (hành động).
	   Bulk-bar + mobile-filter-popover mở vẫn hiện (user đang thao tác). */
	:global(.datatable-root.tools-hidden-mobile) {
		@media (max-width: 767px) {
			:global(.datatable-caption-tools .admin-search:not(:has(.mobile-filter-popover))),
			:global(.datatable-caption-tools .admin-actions-group:not(:has(.mobile-filter-popover))) {
				/* Batch9b (m06345): opacity thay display — giữ flow height ổn định
				   (display:none co flow → trả lại ở đáy xô nội dung che row cuối). */
				opacity: 0;
				pointer-events: none;
				transition: opacity 150ms ease;
			}
		}
	}

	/* Select component trong modal PO (batch 4: đồng bộ chuẩn chung) —
	   full-width trong form-field, trigger cùng style admin-select. */
	:global(.modal-body-root .admin-filter-select) {
		width: 100%;

		:global(.select-trigger) {
			height: 2.25rem;
			min-height: 2.25rem;
			border-radius: 0.5rem;
			border: 1px solid var(--default-300);
			background: var(--default-50, transparent);
			font-size: 0.85rem;
		}
	}

	.po-item :global(.admin-filter-select.po-item-variant) {
		flex: 1 1 12rem;
		min-width: 10rem;
	}

	@media (max-width: 767px) {
		:global(.datatable-caption-tools .admin-filter-select) {
			width: 100%;
			max-width: 100%;
		}
	}

	.admin-input {
		height: 2.5rem;
		padding: 0 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		width: 100%;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
		}
	}

	.admin-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--foreground-500);

		&.error {
			color: var(--error);
		}

		.state-title {
			font-weight: 600;
			margin: 0;
		}

		.state-detail {
			font-size: 0.85rem;
			margin: 0;
		}

		p {
			margin: 0;
		}
	}

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		/* Sticky thead: wrap overflow-x auto tao scroll context - th sticky bam
		   theo wrap (khong cuon) -> thead truot mat. Co stickyHead: wrap phai
		   thoat scroll context (beng ngang do .datatable-table-wrap tu cuon). */
		&:has(:global(.datatable-sticky-head)) {
			overflow-x: visible;
		}
	}

	/* Fullheight: wrap tự cuộn dọc (scroll container của page) — đọc cả 2 chiều */
	.admin-page--fullheight .admin-table-wrap {
		overflow: auto;
		/* Batch8: tắt scroll anchoring — anchor tự điều chỉnh scrollTop khi
		   scroll-active co/giãn padding + ẩn/hiện tools (đổi layout) → bắn scroll
		   event → markScrollActive lại → LOOP co/giãn vĩnh viễn (top dao động
		   27↔63). DataTable không có ảnh lazy → mất anchor vô hại. */
		overflow-anchor: none;
	}

	/* Nút action trong actionsContent — chống nén (bẫy 39px clip) */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		width: 1%;
		min-width: fit-content;
	}

	.admin-pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	/* ── Pagination: Batch9 ĐANG cuộn → ẨN hẳn (tăng rows hiển thị), dừng
	   200ms → trả lại. pop-anim giữ (chạm đáy flash 1 lần khi hiện lại). ── */
	.admin-pagination {
		transition: opacity 150ms ease;
	}

	.pagination-collapsed.admin-pagination {
		opacity: 0;
		pointer-events: none;
	}
	.pagination-pop.admin-pagination {
		animation: pagination-pop-anim 450ms ease-out;
	}
	@keyframes pagination-pop-anim {
		0% {
			transform: scale(0.94);
		}
		60% {
			transform: scale(1.04);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pagination-pop.admin-pagination {
			animation: none;
		}
	}

	.total-count {
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.page-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.page-size {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-size-label {
		font-size: 0.8rem;
		color: var(--foreground-500);
	}

	.modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--foreground);
		line-height: 1.5;
	}

	.form-error-banner {
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}

	/* ── History timeline (kiểu git log: rail dọc + dot + card diff) ── */
	.history-state {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-text-muted, var(--muted, #6b7280));
		font-size: 0.9rem;
	}
	.history-timeline {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	// Footer form modal: History trái — spacer đẩy Save/Cancel sang phải
	// (footer là flex justify-end; spacer flex:1 chiếm khoảng giữa).
	// Class thật của footer element là .modal-footer-root (Footer/Main.svelte).
	:global(.modal-footer-root .supplier-footer-spacer) {
		flex: 1;
	}

	.history-entry {
		display: flex;
		gap: 0.75rem;
	}
	/* rail: cột 12px chứa dot + đoạn line nối xuống entry sau (nốt cuối không line) */
	.history-entry__rail {
		flex: 0 0 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 0.45rem;
	}
	.history-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--color-sky-500, #0ea5e9);
		flex: 0 0 auto;
	}
	.history-dot--restore {
		background: var(--success, #22c55e);
	}
	.history-entry:not(:last-child) .history-entry__rail::after {
		content: '';
		flex: 1;
		width: 1px;
		background: var(--border, hsl(240 5.9% 90%));
		margin-top: 4px;
	}
	.history-entry__card {
		flex: 1;
		min-width: 0;
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.625rem;
		padding: 0.65rem 0.85rem;
		margin-bottom: 0.75rem;
		background: var(--surface, transparent);
	}
	.history-entry--restore .history-entry__card {
		border-color: var(--success-soft, hsl(143, 85%, 96%));
	}
	.history-entry__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
	.history-time {
		font-size: 0.8rem;
		color: var(--color-text-muted, var(--muted, #6b7280));
	}
	.history-actor {
		font-size: 0.8rem;
		color: var(--color-text-muted, var(--muted, #6b7280));
	}
	.history-nochanges {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-muted, var(--muted, #6b7280));
	}
	.history-changes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.history-change {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		line-height: 1.45;
	}
	.history-change__field {
		flex: 0 0 auto;
		min-width: 7.5rem;
		font-weight: 600;
		color: var(--color-text, var(--foreground));
	}
	.history-change__before {
		color: var(--error);
		text-decoration-color: hsl(0 84% 65% / 0.6);
		word-break: break-word;
	}
	.history-change__after {
		color: var(--success, #16a34a);
		text-decoration: none;
		word-break: break-word;
	}
	.history-entry__actions {
		margin-top: 0.5rem;
		display: flex;
		justify-content: flex-end;
	}

	/* Scroll-to-invalid: flash viền field lỗi 1.6s để user định vị nhanh */
	.field-flash {
		animation: field-flash-pulse 1.6s ease-out;
		border-radius: 0.5rem;
	}
	@keyframes field-flash-pulse {
		0%, 60% {
			box-shadow: 0 0 0 2px var(--color-sky-500, #0ea5e9);
		}
		100% {
			box-shadow: 0 0 0 2px transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.field-flash {
			animation: none;
			box-shadow: 0 0 0 2px var(--color-sky-500, #0ea5e9);
		}
	}

	.form-grid {
		display: grid;
		gap: 0.75rem;
	}

	/* Batch10 (m06635-3): setting modal — các field xếp dọc */
	.setting-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* hàng phone/email + nút xoá.
	   Batch 3: Badge STT (trái) + remove (phải) ĐÈ LÊN VIỀN TRÊN của field
	   (absolute, translateY(-50%)) → không tốn chiều cao hàng; kích thước nhỏ
	   (1.15rem) tiết kiệm không gian. Z-index trên viền input; field-row cần
	   margin-top để badge không bị cắt bởi field phía trên (modal-body có
	   overflow-y auto → không clip nếu đủ khoảng cách gap 0.5rem + 0.6rem). */
	.field-row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.55rem;

		& > :global(.input-root) {
			flex: 1;
			min-width: 0;
		}
	}

	/* Line vertical trục x giữa (batch6): cột dọc nối các item qua tâm,
	   đặt ::before bên trái mỗi row trừ row đầu — nằm giữa gap 2 item. */
	.form-items-block > .field-row + .field-row::before {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: calc(-0.55rem - 1px);
		height: calc(0.55rem + 2px);
		width: 1px;
		background: var(--default-300);
	}

	/* Badge STT đè viền trên góc trái — variant=solid nền ĐỤC (batch6: hết
	   "khuyết bg trái" do badge soft bán trong suốt lộ viền input xuyên qua). */
	.field-row > :global(.field-row-stt),
	.field-row > .field-row-stt {
		position: absolute;
		top: 0;
		left: 0.6rem;
		transform: translate(-50%, -50%);
		z-index: 2;
		min-height: 1.15rem;
		padding-inline: 0.35rem;
		font-size: 0.65rem;
		line-height: 1;
		border-radius: 9999px;
		box-shadow: 0 0 0 2px var(--background, #fff);
	}

	.field-row-remove {
		position: absolute;
		top: 0;
		right: 0.6rem;
		transform: translate(50%, -50%);
		z-index: 2;
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 9999px;
		background: var(--background, #fff);
		color: var(--foreground-500, inherit);
		cursor: pointer;
		font-size: 0.625rem;
		line-height: 1;
		transition: background 0.15s ease, color 0.15s ease;

		&:hover:not(:disabled) {
			background: color-mix(in oklab, var(--error) 10%, transparent);
			color: var(--error);
			border-color: var(--error);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.field-add {
		align-self: flex-start;
		padding: 0.25rem 0.5rem;
		border: 1px dashed var(--border, #d1d5db);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--primary-600, var(--primary));
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover:not(:disabled) {
			background: color-mix(in oklab, var(--primary) 8%, transparent);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.form-grid-2 {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: 1fr 1fr;
		// Cột phải (phones/emails multiple) tự dồn lên đầu — không stretch
		// theo cột trái (avatar cao) → hết khoảng trống dọc bất đối xứng.
		align-items: start;

		@media (max-width: 680px) {
			grid-template-columns: 1fr;
		}
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.items-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px dashed var(--default-300);
		border-radius: 0.75rem;
		/* position:relative đặt TRỰC TIẾP (không qua :has() — Safari ≤15.3 bỏ
		   rule có :has() → label mất điểm neo absolute, trôi khỏi viền). */
		position: relative;
	}

	/* Label block NGỰA TRÊN BORDER LINE (batch6): label absolute dịch -50% lên
	   giữa viền, nền background che đoạn border phía sau. */
	.form-items-block,
	.social-group {
		position: relative;
	}

	.items-block__label {
		position: absolute;
		top: 0;
		left: 0.75rem;
		transform: translateY(-50%);
		padding-inline: 0.375rem;
		background: var(--background, #fff);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--foreground);
		white-space: nowrap;
	}

	.po-item {
		display: grid;
		grid-template-columns: minmax(10rem, 2fr) 5rem 6rem minmax(6rem, 1fr) minmax(8rem, 1fr) auto;
		gap: 0.5rem;
		align-items: center;

		@media (max-width: 860px) {
			grid-template-columns: 1fr 1fr;
		}
	}

	.po-item-num {
		width: auto;
	}

	.po-total {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		color: var(--foreground);
	}

	/* ── Search trong captionTools (pattern purchases) ── */
	.admin-search {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.admin-search-icon {
		opacity: 0.6;
	}

	.admin-search-loading {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Suggest popover từ khoá đã tìm */
	.suggest-popover {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		min-width: 14rem;
		max-height: 16rem;
		overflow-y: auto;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.65rem;
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
		padding: 0.35rem;
		z-index: 50;
	}

	.suggest-title {
		margin: 0.25rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--foreground-500);
	}

	.suggest-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.45rem 0.6rem;
		border: none;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--foreground);
		font-size: 0.85rem;
		cursor: pointer;

		&:hover {
			background: var(--default-100);
		}
	}

	/* ── Caption tools: actions-group (create/refresh) + bulk-bar (yêu cầu 2/3/7) ── */
	.admin-actions-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Mobile caption (yêu cầu 2c): icon search/filter/create thu gọn + popover filter */
	.mobile-caption-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		cursor: pointer;

		&:hover {
			background: var(--default-100);
		}
	}

	.mobile-filter-anchor {
		position: relative;
	}

	.mobile-filter-popover {
		position: absolute;
		top: calc(100% + 0.375rem);
		right: 0;
		z-index: 30;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
		padding: 0.5rem;
		width: 12rem;

		:global(.admin-filter-select) {
			width: 100%;
			max-width: 100%;
		}
	}

	.bulk-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bulk-count {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.field-row--dup {
		& > :global(.input-root),
		& > :global(.address-input),
		& > .admin-input {
			border-color: var(--error);
		}
	}

	/* Batch10 (m06635-6c): text cảnh báo trùng dưới field-row */
	.field-row-dup-msg {
		position: absolute;
		top: 100%;
		left: 2.75rem;
		font-size: 0.72rem;
		color: var(--error);
		pointer-events: none;
	}

	.form-dup-banner {
		background: color-mix(in oklab, var(--error) 8%, transparent);
		border-left-color: var(--error);
	}

	/* ── Multiple addresses: entry block (badge/remove đè viền trên — mirror .field-row).
	   Batch6: solid border ĐỒNG NHẤT với social-group; line vertical trục x giữa. */
	.address-entry {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.55rem;
		padding: 0.6rem;
		border: 1px solid var(--default-300);
		border-radius: 0.6rem;

		&.field-row--dup {
			border-color: var(--error);
		}
	}

	.social-group > .address-entry + .address-entry::before {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: calc(-0.55rem - 1px);
		height: calc(0.55rem + 2px);
		width: 1px;
		background: var(--default-300);
	}

	.address-entry > :global(.field-row-stt),
	.address-entry > .field-row-stt {
		position: absolute;
		top: 0;
		left: 0.6rem;
		transform: translate(-50%, -50%);
		z-index: 2;
		min-height: 1.15rem;
		padding-inline: 0.35rem;
		font-size: 0.65rem;
		line-height: 1;
		border-radius: 9999px;
		box-shadow: 0 0 0 2px var(--background, #fff);
	}

	.address-entry .field-row-remove {
		top: 0;
		right: 0.6rem;
		transform: translate(50%, -50%);
	}

	.address-entry__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.address-entry__label {
		flex: 1;
		height: 2.25rem;
	}

	.social-group {
		border-style: solid;
	}

	/* ── Social tags (batch7): chips multi-value — enter tạo, click text edit
	   inline, icon open-tab link, remove; input "Thêm giá trị…" inline cuối ── */
	.social-tag-block {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.social-tag-block__label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--foreground-600, var(--foreground));
	}
	.social-tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		min-height: 2.5rem;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
		background: var(--background);
	}
	.social-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		padding-inline: 0.375rem 0.25rem;
		padding-block: 0.125rem;
		border-radius: 0.375rem;
		background: var(--primary-50, var(--default-100));
		color: var(--primary-700, var(--foreground));
		font-size: 0.8rem;
		line-height: 1.2;
		max-width: 100%;
	}
	.social-tag--invalid {
		background: var(--error-50, var(--default-100));
		color: var(--error-600, var(--error));
		text-decoration: line-through;
	}
	.social-tag--invalid .social-tag__text {
		color: inherit;
	}
	.social-tag__text {
		border: none;
		background: transparent;
		padding: 0.125rem 0.25rem;
		font: inherit;
		color: inherit;
		cursor: text;
		overflow-wrap: anywhere;
		text-align: left;
	}
	.social-tag__open,
	.social-tag__remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
		padding: 0;
		flex: none;
	}
	/* Batch 11 (5d): remove button theo quy tắc thiết kế chung — màu error.
	   Open-tab giữ màu chip (primary); hover tách riêng 2 nút. */
	.social-tag__open:hover {
		background: rgb(0 0 0 / 0.08);
	}
	.social-tag__remove {
		color: var(--error, #dc2626);
	}
	.social-tag--invalid .social-tag__remove {
		color: inherit;
	}
	.social-tag__remove:hover {
		background: var(--error-50, rgb(0 0 0 / 0.08));
		color: var(--error-600, var(--error, #dc2626));
	}
	.social-tag__edit {
		font: inherit;
		color: inherit;
		background: var(--background);
		border: 1px solid var(--primary);
		border-radius: 0.25rem;
		padding: 0.0625rem 0.25rem;
		min-width: 4rem;
		outline: none;
	}
	.social-tags__input {
		flex: 1;
		min-width: 6rem;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.8rem;
		outline: none;
		padding: 0.125rem;
		color: var(--foreground);
	}
	.social-tag-error {
		font-size: 0.75rem;
		color: var(--error);
	}

	/* ── FAB mobile (pattern purchases) ── */
	.fab-group {
		position: fixed;
		right: 1rem;
		bottom: 7.25rem;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.6rem;
		z-index: 400;
		/* Batch9c (m06530): ẩn theo HÀNH ĐỘNG cuộn giống tab/pagination —
		   scrollY=0 → ẩn (row caption tools đang hiện), đang cuộn → ẩn,
		   dừng 200ms → hiện lại. Batch10: bỏ fab-keep (menu create đã bỏ). */
		transition: opacity 200ms ease;
		&.fab-hidden {
			opacity: 0;
			pointer-events: none;
		}
		/* Batch8: đang cuộn mờ đi (giữ chỗ trong flow — pointer-events chặn tap chìm) */
		&.is-scrolling {
			opacity: 0;
			pointer-events: none;
		}

		@media (min-width: 768px) {
			display: none;
		}
	}

	.fab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid var(--default-300);
		box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;

		&:active {
			transform: scale(0.96);
		}
	}

	.fab--primary {
		width: 3.25rem;
		height: 3.25rem;
		background: var(--primary);
		color: var(--primary-contrast, #fff);
		border-color: transparent;
	}

	.fab--secondary {
		width: 2.75rem;
		height: 2.75rem;
		background: var(--background);
		color: var(--foreground);
	}

	/* Fullheight padding bottom cho FAB (pattern purchases) — FAB group 2 nút
	   chồng dọc cao ~7rem + pagination ~3rem → đệm 12rem để card cuối và
	   pagination không bị FAB fixed che khi cuộn hết danh sách */
	@media (max-width: 767px) {
		.admin-page--fullheight {
			padding-bottom: 12rem;
		}
		/* FAB fixed góc phải đè "Rows: 20" (page-size) khi cuộn — chừa chỗ phải */
		.admin-pagination {
			padding-right: 4.75rem;
		}
	}

	/* ── Bridge inset (pattern purchases): layout .admin-inset đọc :has() từ page
	   để co padding-bottom + header khi page chạm đáy (at-bottom) ── */
	:global(.admin-inset:has(.admin-page--fullheight)) .admin-page--fullheight {
		@media (max-width: 767px) {
			padding-bottom: 4.5rem;
		}
	}

	:global(.admin-inset:has(.admin-page--fullheight.at-bottom)) .admin-page--fullheight {
		@media (max-width: 767px) {
			padding-bottom: 0;
		}
	}

	/* Mobile chạm đáy: inset-header (breadcrumb) zero padding (yêu cầu 2 —
	   breadcrumb co hết cỡ khi cuộn đáy, trả lại khi rời đáy) */
	:global(.admin-inset:has(.admin-page--fullheight.at-bottom)) :global(.admin-inset-header) {
		@media (max-width: 767px) {
			padding: 0;
		}
	}

	/* ── Mobile FULL-SIZE modal (batch7 yêu cầu 1): modal form NCC chiếm trọn
	   màn hình — bỏ padding root, container fullwidth + fullheight, nội dung
	   start từ trên (không center dọc), header/footer sticky tự nhiên (flex
	   column: header/footer flex sibling đứng yên, body tự cuộn tới đáy →
	   nút Save/Close luôn với tới được). Áp CHỈ mobile touch — desktop giữ
	   modal giữa màn hình. ── */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-modal-root) {
			padding: 0;
			align-items: stretch;
		}
		:global(.supplier-modal-root .modal-container-root) {
			/* Full-bleed qua position:fixed + inset:0 — KHÔNG dùng vh/dvh:
			   100vh trên iOS = large viewport (vươn sau toolbar) → footer vẫn
			   chìm; dvh chỉ hỗ trợ từ iOS 15.4. Fixed inset:0 = đúng vùng nhìn
			   thấy trên mọi trình duyệt, kể cả Safari ≤15.3. */
			position: fixed;
			inset: 0;
			width: 100% !important; /* thắng .size-lg (40rem) — scoped CSS load sau page CSS */
			max-width: none;
			max-height: none;
			border-radius: 0;
			margin: 0;
		}
		/* Header modal: co padding → gọn như breadcrumb bar */
		:global(.supplier-modal-root .modal-header-root) {
			padding-block: 0.5rem;
		}
	}

	/* Batch 11 (5c): title modal đồng bộ tên supplier — label + tên với ellipsis
	   (tên dài không vỡ layout). Back chevron chỉ mobile (thay nút ✕). */
	.supplier-modal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.supplier-modal-back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		margin-left: -0.375rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground);
		cursor: pointer;
		flex-shrink: 0;

		&:hover {
			background: hsl(0 0% 0% / 0.06);
		}
	}

	.supplier-modal-title__label {
		flex-shrink: 0;
		font-weight: 600;
	}

	.supplier-modal-title__name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--foreground-500);
		font-weight: 400;
	}

	/* Batch 11 (5e): field passive — thông tin created/updated ở cuối form */
	.supplier-passive {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0.75rem 0.875rem;
		border: 1px dashed var(--default-300, hsl(0 0% 88%));
		border-radius: 0.625rem;
		background: var(--default-50, hsl(0 0% 98%));
		font-size: 0.8125rem;

		dt {
			color: var(--foreground-500);
			font-weight: 500;
		}

		dd {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			margin: 0;
			color: var(--foreground);
		}
	}

	.supplier-passive__row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.supplier-passive__sep {
		color: var(--foreground-300);
	}
</style>
