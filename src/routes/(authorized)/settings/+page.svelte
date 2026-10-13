<!-- src/routes/(authorized)/settings/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Accordion, AlertDialog, Button, Tag, Tabs } from '$components/element';
	import { Input, Select, Switch } from '$components/form';
	import type { SelectOption } from '$components/form';
	import { encryption } from '$modules/encryption';
	import { saveDraft, readDraft, clearDraft } from '$modules/draft-store';
	import { client } from '$store/basic.svelte';
	import { resolveServerMessage } from '../admin/_interface';
	import type { TranslateContent } from '$interfaces/basic';
	import DraftRestoreDialog from '../_DraftRestoreDialog.svelte';

	// ── Shape settings (đồng bộ service SystemSettingsService) ──
	// Enum fields dùng string để bind 2 chiều với Select được (Select.value là
	// string | string[] — bind union 'vi'|'en' sẽ lỗi writable type mismatch);
	// phần hợp lệ enum do server mergeWithDefaults chặn khi update.
	interface SystemSettings {
		general: { appName: string; defaultLang: string; timezone: string };
		security: { sessionTimeoutMinutes: number; maxLoginAttempts: number; passwordMinLength: number };
		commerce: { currency: string; taxRatePercent: number; lowStockThreshold: number };
		appearance: { theme: string; density: string };
		/** B9 draft-store: bật/tắt autosave bản nháp form toàn app. */
		features: { draftRestore: boolean };
	}
	interface SystemAuditRow {
		userId?: string;
		action?: string;
		collectionName?: string;
		createdAt?: string;
	}
	interface SystemStatus {
		uptimeSeconds: number;
		timestamp: string;
		nodeVersion: string;
		platform: string;
		memory: { heapUsed: number; heapTotal: number };
		db: { ok: boolean };
		audit: { ok: boolean; total: number; items: SystemAuditRow[] };
	}

	// ── Backup/restore (tab 'backup') ──
	// Shape khớp BackupService ($lib/server/db/backup.ts) qua API
	// /api/admin/settings/backup/list | export | restore.
	interface BackupListRow {
		name: string;
		count: number;
	}
	interface BackupRestoreSummary {
		collections: Record<string, { upserted: number; failed: number }>;
		totalUpserted: number;
	}

	// ── Ngôn ngữ ──
	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : (client.browser?.language === 'en' ? 'en' : 'en')
	);

	// ── Cặp khoá RSA cho mọi fetchSecure trên trang ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Trạng thái settings ──
	const DEFAULT_SETTINGS: SystemSettings = {
		general: { appName: 'Kit Admin', defaultLang: 'vi', timezone: 'Asia/Ho_Chi_Minh' },
		security: { sessionTimeoutMinutes: 30, maxLoginAttempts: 5, passwordMinLength: 8 },
		commerce: { currency: 'VND', taxRatePercent: 10, lowStockThreshold: 10 },
		appearance: { theme: 'system', density: 'comfortable' },
		features: { draftRestore: true }
	};

	let settings = $state<SystemSettings>(DEFAULT_SETTINGS);
	// Bản gốc (đã load từ server) — đối chiếu modified
	let original = $state<SystemSettings>(DEFAULT_SETTINGS);
	let canEdit = $state(false);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let saving = $state(false);
	let loadedOnce = $state(false);

	// ── B9 draft autosave (formKey 'settings' — toàn trang là 1 form lớn) ──
	const SETTINGS_DRAFT_FORM_KEY = 'settings';
	let draftRestoreDisplay = $state(false);
	/** Đã hỏi restore lần này chưa (chỉ hỏi 1 lần khi load trang xong). */
	let draftAsked = false;

	function currentUserId(): string {
		return (page.data as { user?: { userId?: string } })?.user?.userId ?? '';
	}

	function applyDraftRestore() {
		const draft = readDraft<SystemSettings>(currentUserId(), SETTINGS_DRAFT_FORM_KEY);
		if (draft) {
			// Merge từng group để tránh thiếu field khi schema đổi giữa các phiên.
			settings = { ...settings, ...draft };
		}
	}

	function discardDraft() {
		clearDraft(currentUserId(), SETTINGS_DRAFT_FORM_KEY);
	}

	// ── Trạng thái system status ──
	let status = $state<SystemStatus | undefined>(undefined);
	let statusError = $state<string | undefined>(undefined);
	let statusLoading = $state(false);

	// ── Trạng thái backup/restore ──
	let backupItems = $state<BackupListRow[] | undefined>(undefined);
	let backupListLoading = $state(false);
	let backupListError = $state<string | undefined>(undefined);
	let backupExporting = $state(false);
	let backupRestoring = $state(false);
	// File .json user chọn (Input type=file bind:files — 1 file duy nhất).
	let backupFile = $state<File[]>([]);
	// AlertDialog confirm restore — mở khi bấm "Khôi phục", Action mới gọi API.
	let restoreConfirmOpen = $state(false);
	let restoreConfirmMessage = $state('');

	// ── Tabs ──
	let activeTab = $state('general');

	// ── Draft string cho các field number (Input.value là string — bind số
	// trực tiếp sẽ lỗi type; parse Number() lúc build patch trong handleSave) ──
	let sessionTimeoutDraft = $state('');
	let maxLoginAttemptsDraft = $state('');
	let passwordMinLengthDraft = $state('');
	let taxRateDraft = $state('');
	let lowStockDraft = $state('');

	// ── i18n ──
	const t = {
		title: { vi: 'Cấu hình hệ thống', en: 'System settings' } as TranslateContent,
		subtitle: {
			vi: 'Quản lý cấu hình app và theo dõi trạng thái hệ thống',
			en: 'Manage app configuration and monitor system status'
		} as TranslateContent,
		save: { vi: 'Lưu cấu hình', en: 'Save settings' } as TranslateContent,
		saving: { vi: 'Đang lưu…', en: 'Saving…' } as TranslateContent,
		cancel: { vi: 'Bỏ thay đổi', en: 'Discard changes' } as TranslateContent,
		cancelled: { vi: 'Đã bỏ các thay đổi chưa lưu', en: 'Unsaved changes discarded' } as TranslateContent,
		ownerOnly: {
			vi: 'Chỉ owner được sửa cấu hình',
			en: 'Only the owner can edit settings'
		} as TranslateContent,
		modified: { vi: 'Có thay đổi chưa lưu', en: 'Unsaved changes' } as TranslateContent,
		loading: { vi: 'Đang tải cấu hình…', en: 'Loading settings…' } as TranslateContent,
		statusLoading: { vi: 'Đang tải trạng thái…', en: 'Loading status…' } as TranslateContent,
		loadFailed: { vi: 'Không tải được cấu hình', en: 'Failed to load settings' } as TranslateContent,
		statusFailed: { vi: 'Không tải được trạng thái', en: 'Failed to load status' } as TranslateContent,
		retry: { vi: 'Thử lại', en: 'Retry' } as TranslateContent,
		saveSuccess: {
			vi: 'Đã lưu cấu hình hệ thống',
			en: 'System settings saved'
		} as TranslateContent,
		saveFailed: { vi: 'Lưu cấu hình thất bại', en: 'Failed to save settings' } as TranslateContent,
		requestFailed: { vi: 'Lỗi kết nối máy chủ', en: 'Server connection error' } as TranslateContent,
		tabGeneral: { vi: 'Chung', en: 'General' } as TranslateContent,
		tabSecurity: { vi: 'Bảo mật', en: 'Security' } as TranslateContent,
		tabCommerce: { vi: 'Thương mại', en: 'Commerce' } as TranslateContent,
		tabAppearance: { vi: 'Giao diện', en: 'Appearance' } as TranslateContent,
		tabStatus: { vi: 'System Status', en: 'System Status' } as TranslateContent,
		tabBackup: { vi: 'Sao lưu / Khôi phục', en: 'Backup / Restore' } as TranslateContent,
		// field labels
		appName: { vi: 'Tên ứng dụng', en: 'App name' } as TranslateContent,
		defaultLang: { vi: 'Ngôn ngữ mặc định', en: 'Default language' } as TranslateContent,
		timezone: { vi: 'Múi giờ', en: 'Timezone' } as TranslateContent,
		sessionTimeout: {
			vi: 'Thời gian hết phiên (phút)',
			en: 'Session timeout (minutes)'
		} as TranslateContent,
		maxLoginAttempts: { vi: 'Số lần đăng nhập tối đa', en: 'Max login attempts' } as TranslateContent,
		passwordMinLength: {
			vi: 'Độ dài mật khẩu tối thiểu',
			en: 'Password minimum length'
		} as TranslateContent,
		draftRestore: {
			vi: 'Tự lưu bản nháp form',
			en: 'Autosave form drafts'
		} as TranslateContent,
		currency: { vi: 'Tiền tệ', en: 'Currency' } as TranslateContent,
		taxRate: { vi: 'Thuế suất (%)', en: 'Tax rate (%)' } as TranslateContent,
		lowStock: { vi: 'Ngưỡng tồn kho thấp', en: 'Low stock threshold' } as TranslateContent,
		theme: { vi: 'Chủ đề', en: 'Theme' } as TranslateContent,
		density: { vi: 'Mật độ hiển thị', en: 'Density' } as TranslateContent,
		// status section
		statusTitle: { vi: 'Trạng thái hệ thống', en: 'System status' } as TranslateContent,
		uptime: { vi: 'Uptime', en: 'Uptime' } as TranslateContent,
		memory: { vi: 'Bộ nhớ (heap)', en: 'Memory (heap)' } as TranslateContent,
		nodeVersion: { vi: 'Phiên bản Node', en: 'Node version' } as TranslateContent,
		platform: { vi: 'Nền tảng', en: 'Platform' } as TranslateContent,
		dbStatus: { vi: 'Kết nối DB', en: 'Database' } as TranslateContent,
		dbOk: { vi: 'Đã kết nối', en: 'Connected' } as TranslateContent,
		dbError: { vi: 'Mất kết nối', en: 'Disconnected' } as TranslateContent,
		auditLogs: { vi: 'Audit logs gần đây (7 ngày)', en: 'Recent audit logs (7 days)' } as TranslateContent,
		auditTotal: { vi: 'sự kiện', en: 'events' } as TranslateContent,
		auditEmpty: { vi: 'Chưa có sự kiện nào', en: 'No events yet' } as TranslateContent,
		auditFailed: { vi: 'Không đọc được audit logs', en: 'Failed to read audit logs' } as TranslateContent,
		colTime: { vi: 'Thời gian', en: 'Time' } as TranslateContent,
		colAction: { vi: 'Hành động', en: 'Action' } as TranslateContent,
		colCollection: { vi: 'Collection', en: 'Collection' } as TranslateContent,
		// options
		langVi: { vi: 'Tiếng Việt', en: 'Vietnamese' } as TranslateContent,
		langEn: { vi: 'Tiếng Anh', en: 'English' } as TranslateContent,
		themeLight: { vi: 'Sáng', en: 'Light' } as TranslateContent,
		themeDark: { vi: 'Tối', en: 'Dark' } as TranslateContent,
		themeSystem: { vi: 'Theo hệ thống', en: 'System' } as TranslateContent,
		densityComfortable: { vi: 'Thoáng', en: 'Comfortable' } as TranslateContent,
		densityCompact: { vi: 'Gọn', en: 'Compact' } as TranslateContent,
		// backup section
		backupDesc: {
			vi: 'Tải toàn bộ dữ liệu các collection dưới dạng 1 file JSON, hoặc khôi phục từ file backup trước đó. Khôi phục sẽ GHI ĐÈ document trùng _id (upsert) — thao tác chỉ dành cho owner.',
			en: 'Download all collection data as a single JSON file, or restore from a previous backup file. Restore UPSERTS documents with matching _id — owner-only operation.'
		} as TranslateContent,
		backupCreate: { vi: 'Tạo backup & tải xuống', en: 'Create backup & download' } as TranslateContent,
		backupCreating: { vi: 'Đang tạo backup…', en: 'Creating backup…' } as TranslateContent,
		backupCreateSuccess: {
			vi: 'Đã tạo backup — file đang được tải xuống',
			en: 'Backup created — download starting'
		} as TranslateContent,
		backupCreateFailed: { vi: 'Tạo backup thất bại', en: 'Failed to create backup' } as TranslateContent,
		backupListTitle: { vi: 'Collections trong scope', en: 'Collections in scope' } as TranslateContent,
		backupListLoading: { vi: 'Đang đếm documents…', en: 'Counting documents…' } as TranslateContent,
		backupListFailed: {
			vi: 'Không đọc được danh sách collection',
			en: 'Failed to list collections'
		} as TranslateContent,
		backupColName: { vi: 'Collection', en: 'Collection' } as TranslateContent,
		backupColDocs: { vi: 'Số documents', en: 'Documents' } as TranslateContent,
		backupRestoreTitle: { vi: 'Khôi phục từ file backup', en: 'Restore from backup file' } as TranslateContent,
		backupPickFile: { vi: 'Chọn file backup (.json)', en: 'Choose backup file (.json)' } as TranslateContent,
		backupFilePicked: { vi: 'Đã chọn', en: 'Selected' } as TranslateContent,
		backupNoFile: { vi: 'Chưa chọn file backup', en: 'No backup file selected' } as TranslateContent,
		backupRestore: { vi: 'Khôi phục', en: 'Restore' } as TranslateContent,
		backupRestoring: { vi: 'Đang khôi phục…', en: 'Restoring…' } as TranslateContent,
		backupRestoreConfirmTitle: {
			vi: 'Xác nhận khôi phục dữ liệu',
			en: 'Confirm data restore'
		} as TranslateContent,
		backupRestoreSuccess: {
			vi: 'Khôi phục hoàn tất',
			en: 'Restore completed'
		} as TranslateContent,
		backupRestoreFailed: { vi: 'Khôi phục thất bại', en: 'Restore failed' } as TranslateContent,
		backupRestoreInvalid: {
			vi: 'File backup không hợp lệ',
			en: 'Invalid backup file'
		} as TranslateContent,
		backupFileReadFailed: {
			vi: 'Không đọc được file đã chọn',
			en: 'Failed to read selected file'
		} as TranslateContent,
		backupSummaryTitle: { vi: 'Kết quả khôi phục', en: 'Restore result' } as TranslateContent,
		backupSummaryUpserted: { vi: 'đã ghi', en: 'upserted' } as TranslateContent,
		backupSummaryFailed: { vi: 'lỗi', en: 'failed' } as TranslateContent
	};

	// ── Options cho Select ──
	const langOptions: SelectOption[] = [
		{ value: 'vi', label: 'Tiếng Việt' },
		{ value: 'en', label: 'English' }
	];
	const currencyOptions: SelectOption[] = [
		{ value: 'VND', label: 'VND' },
		{ value: 'USD', label: 'USD' }
	];
	const themeOptions: SelectOption[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	];
	const densityOptions: SelectOption[] = [
		{ value: 'comfortable', label: 'Comfortable' },
		{ value: 'compact', label: 'Compact' }
	];

	// ── Modified tracking: JSON khác gốc ──
	const modified = $derived(JSON.stringify(settings) !== JSON.stringify(original));

	// TranslateContent có mọi key optional → chuẩn hoá về fallback { vi, en }
	// non-null cho resolveServerMessage (các hằng số t.* luôn có vi+en)
	const fb = (c: TranslateContent): { vi: string; en: string } => ({
		vi: c.vi ?? '',
		en: c.en ?? ''
	});

	// ── Format helpers ──
	function formatUptime(seconds: number | undefined): string {
		if (seconds == null || !Number.isFinite(seconds)) return '—';
		const totalMinutes = Math.floor(seconds / 60);
		const h = Math.floor(totalMinutes / 60);
		const m = totalMinutes % 60;
		if (h <= 0) return `${m}m`;
		return `${h}h ${m}m`;
	}

	function formatMemory(bytes: number | undefined): string {
		if (bytes == null || !Number.isFinite(bytes)) return '—';
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function formatAuditTime(raw: string | undefined): string {
		if (!raw) return '—';
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date(raw));
		} catch {
			return '—';
		}
	}

	// ── Gọi API ──
	async function loadSettings() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/system-settings/get',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { settings?: SystemSettings; canEdit?: boolean } | undefined;
				if (data?.settings) {
					// Guard features default (server bản cũ chưa có group này).
					const loaded = {
						...data.settings,
						features: data.settings.features ?? { draftRestore: true }
					};
					// Gán object mới (không mutate) — draft copy qua $state deep
					settings = { ...loaded };
					original = { ...loaded };
				}
				canEdit = Boolean(data?.canEdit);
				loadedOnce = true;
				// B9: sau lần load đầu — hỏi khôi phục draft nếu có (1 lần duy nhất).
				if (!draftAsked) {
					draftAsked = true;
					const draft = readDraft<SystemSettings>(currentUserId(), SETTINGS_DRAFT_FORM_KEY);
					if (draft) draftRestoreDisplay = true;
				}
			} else {
				loadError = resolveServerMessage(response.message, lang, fb(t.loadFailed));
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, fb(t.loadFailed));
			if (import.meta.env.DEV) console.error('[settings] load failed:', err);
		}
	}

	async function loadStatus() {
		if (!encryptionKeys) return;
		statusLoading = true;
		statusError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/system-settings/status',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			statusLoading = false;
			if (response.ok) {
				status = (response.data as SystemStatus | undefined) ?? undefined;
			} else {
				statusError = resolveServerMessage(response.message, lang, fb(t.statusFailed));
			}
		} catch (err) {
			statusLoading = false;
			statusError = resolveServerMessage(undefined, lang, fb(t.statusFailed));
			if (import.meta.env.DEV) console.error('[settings] status failed:', err);
		}
	}

	// ── Sync draft string ↔ settings number ──
	// settings → draft: gán String(...) — gán cùng giá trị là no-op nên không
	// ghi đè chữ đang gõ; load server đặt settings mới → draft refresh.
	$effect(() => {
		const s = settings.security;
		sessionTimeoutDraft = String(s.sessionTimeoutMinutes ?? '');
		maxLoginAttemptsDraft = String(s.maxLoginAttempts ?? '');
		passwordMinLengthDraft = String(s.passwordMinLength ?? '');
	});
	$effect(() => {
		const c = settings.commerce;
		taxRateDraft = String(c.taxRatePercent ?? '');
		lowStockDraft = String(c.lowStockThreshold ?? '');
	});

	// ── B9 autosave draft toàn form settings ──
	// Theo dõi cả settings + 5 draft string (number field gõ qua draft string).
	// Bỏ qua khi chưa load xong (loadedOnce) hoặc khi modified=false — modified
	// ngay sau load là false nên lần chạy effect đầu tiên tự nhiên bị chặn,
	// KHÔNG cần flag skip-first (flag đó nuốt luôn thay đổi đầu tiên của user).
	$effect(() => {
		void settings;
		void sessionTimeoutDraft;
		void maxLoginAttemptsDraft;
		void passwordMinLengthDraft;
		void taxRateDraft;
		void lowStockDraft;
		if (!loadedOnce || !settings.features.draftRestore) return;
		if (!modified) return;
		saveDraft(currentUserId(), SETTINGS_DRAFT_FORM_KEY, { ...settings });
	});

	// ── Save ──
	async function handleSave() {
		if (!canEdit || !modified || saving || !encryptionKeys) return;
		saving = true;
		try {
			// Parse draft string → number trước khi gửi (server mergeWithDefaults
			// chỉ nhận Number.isFinite; rỗng/không hợp lệ → giữ giá trị hiện có)
			const parseNum = (raw: string, fallback: number): number => {
				const n = Number(raw);
				return raw !== '' && Number.isFinite(n) ? n : fallback;
			};
			const response = await encryption.fetchSecure(
				'/api/admin/system-settings/update',
				{
					method: 'POST',
					body: {
						patch: {
							general: { ...settings.general },
							security: {
								...settings.security,
								sessionTimeoutMinutes: parseNum(sessionTimeoutDraft, settings.security.sessionTimeoutMinutes),
								maxLoginAttempts: parseNum(maxLoginAttemptsDraft, settings.security.maxLoginAttempts),
								passwordMinLength: parseNum(passwordMinLengthDraft, settings.security.passwordMinLength)
							},
							commerce: {
								...settings.commerce,
								taxRatePercent: parseNum(taxRateDraft, settings.commerce.taxRatePercent),
								lowStockThreshold: parseNum(lowStockDraft, settings.commerce.lowStockThreshold)
							},
							appearance: { ...settings.appearance },
							// B9: gửi cả features group (draftRestore switch).
							features: { ...settings.features }
						}
					}
				},
				encryptionKeys
			);
			saving = false;
			if (response.ok) {
				// B9: save thành công → xoá draft settings.
				clearDraft(currentUserId(), SETTINGS_DRAFT_FORM_KEY);
				client.browser?.toasts?.create({
					title: resolveServerMessage(response.message, lang, fb(t.saveSuccess)),
					color: 'success'
				});
				await loadSettings();
			} else {
				client.browser?.toasts?.create({
					title: resolveServerMessage(response.message, lang, fb(t.saveFailed)),
					color: 'error'
				});
			}
		} catch (err) {
			saving = false;
			if (import.meta.env.DEV) console.error('[settings] save failed:', err);
			client.browser?.toasts?.create({
				title: t.requestFailed[lang] ?? t.requestFailed.en ?? 'Error',
				color: 'error'
			});
		}
	}

	// ── Cancel (B5): revert settings về bản gốc đã load — draft string tự
	// refresh qua $effect sync (settings → draft), modified trở về false ──
	function handleCancel() {
		if (!modified) return;
		settings = { ...original };
		client.browser?.toasts?.create({
			title: t.cancelled[lang] ?? t.cancelled.en ?? 'Đã bỏ thay đổi',
			color: 'secondary'
		});
	}

	// ── Backup / Restore ──
	// List collections + counts (gọi khi cần render tab backup lần đầu).
	async function loadBackupList() {
		if (!encryptionKeys || backupListLoading) return;
		backupListLoading = true;
		backupListError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/settings/backup/list',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			backupListLoading = false;
			if (response.ok) {
				backupItems = (response.data as { items?: BackupListRow[] } | undefined)?.items ?? [];
			} else {
				backupListError = resolveServerMessage(response.message, lang, fb(t.backupListFailed));
			}
		} catch (err) {
			backupListLoading = false;
			backupListError = resolveServerMessage(undefined, lang, fb(t.backupListFailed));
			if (import.meta.env.DEV) console.error('[settings] backup list failed:', err);
		}
	}

	// Tạo backup → decrypt payload → build Blob → trigger download.
	async function handleCreateBackup() {
		if (!encryptionKeys || backupExporting) return;
		backupExporting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/settings/backup/export',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as
					| { filename?: string; contentBase64?: string; totalDocs?: number }
					| undefined;
				if (data?.contentBase64) {
					// base64 → bytes → UTF-8 JSON text → Blob download (pattern
					// chart/Main.svelte downloadFile).
					const bytes = encryption.base64ToBytes(data.contentBase64);
					const text = new TextDecoder().decode(bytes);
					const blob = new Blob([text], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = data.filename || 'backup.json';
					document.body.appendChild(a);
					a.click();
					a.remove();
					setTimeout(() => URL.revokeObjectURL(url), 1000);
					client.browser?.toasts?.create({
						title: `${fb(t.backupCreateSuccess).vi && t.backupCreateSuccess[lang]}${
							data.totalDocs != null ? ` (${data.totalDocs})` : ''
						}`,
						color: 'success'
					});
				} else {
					client.browser?.toasts?.create({
						title: fb(t.backupCreateFailed)[lang],
						color: 'error'
					});
				}
			} else {
				client.browser?.toasts?.create({
					title: resolveServerMessage(response.message, lang, fb(t.backupCreateFailed)),
					color: 'error'
				});
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[settings] backup export failed:', err);
			client.browser?.toasts?.create({
				title: t.requestFailed[lang] ?? t.requestFailed.en ?? 'Error',
				color: 'error'
			});
		} finally {
			backupExporting = false;
		}
	}

	// Bấm "Khôi phục" → đọc file → validate shape thô → mở AlertDialog confirm
	// với số docs ước lượng. API thật chỉ gọi khi confirm (onselect Action).
	async function handleRestoreClick() {
		const file = backupFile[0];
		if (!file || restoreConfirmOpen) return;
		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as {
				version?: number;
				collections?: Record<string, { count?: number; docs?: unknown[] }>;
			};
			if (parsed?.version !== 1 || !parsed.collections) {
				client.browser?.toasts?.create({
					title: fb(t.backupRestoreInvalid)[lang],
					color: 'error'
				});
				return;
			}
			// Ước lượng tổng docs (dùng count nếu có, fallback đếm docs array).
			let totalDocs = 0;
			for (const group of Object.values(parsed.collections)) {
				totalDocs += group?.count ?? group?.docs?.length ?? 0;
			}
			restoreConfirmMessage =
				lang === 'vi'
					? `Restore sẽ UPSERT ${totalDocs} documents từ file "${file.name}" — tiếp tục?`
					: `Restore will UPSERT ${totalDocs} documents from "${file.name}" — continue?`;
			restoreConfirmOpen = true;
		} catch {
			client.browser?.toasts?.create({
				title: fb(t.backupFileReadFailed)[lang],
				color: 'error'
			});
		}
	}

	// Confirm trong AlertDialog → gọi API restore → toast + summary.
	async function handleRestoreConfirm() {
		const file = backupFile[0];
		if (!file || !encryptionKeys || backupRestoring) return;
		backupRestoring = true;
		try {
			const text = await file.text();
			const response = await encryption.fetchSecure(
				'/api/admin/settings/backup/restore',
				{ method: 'POST', body: { backup: JSON.parse(text) } },
				encryptionKeys
			);
			if (response.ok) {
				const summary = (response.data as { summary?: BackupRestoreSummary } | undefined)?.summary;
				const failed = summary
					? Object.values(summary.collections).reduce((s, c) => s + (c?.failed ?? 0), 0)
					: 0;
				client.browser?.toasts?.create({
					title:
						`${fb(t.backupRestoreSuccess).vi && t.backupRestoreSuccess[lang]} ` +
						`(${summary?.totalUpserted ?? 0} ${fb(t.backupSummaryUpserted)[lang]}` +
						(failed > 0 ? `, ${failed} ${fb(t.backupSummaryFailed)[lang]}` : '') +
						`)`,
					color: failed > 0 ? 'warning' : 'success'
				});
				// Refresh list counts (số docs có thể đổi sau restore).
				loadBackupList();
			} else {
				client.browser?.toasts?.create({
					title: resolveServerMessage(response.message, lang, fb(t.backupRestoreFailed)),
					color: 'error'
				});
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[settings] restore failed:', err);
			client.browser?.toasts?.create({
				title: t.requestFailed[lang] ?? t.requestFailed.en ?? 'Error',
				color: 'error'
			});
		} finally {
			backupRestoring = false;
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadSettings(), loadStatus(), loadBackupList()]);
	});
</script>

<svelte:head>
	<title>{t.title[lang]}</title>
</svelte:head>

<section class="settings-page" data-test="settings-page">
	<header class="settings-header">
		<div class="settings-header-text">
			<h1 class="settings-title" data-test="settings-title">{t.title[lang]}</h1>
			<p class="settings-subtitle">{t.subtitle[lang]}</p>
		</div>
		<div class="settings-header-actions">
			{#if modified && canEdit}
				<Tag label={t.modified[lang]} color="warning" variant="soft" size="sm" data-test="settings-modified-tag" />
			{/if}
			<Button
				color="primary"
				onClick={handleSave}
				disabled={!canEdit || !modified || saving}
				loading={saving}
				data-test="settings-save"
			>
				{saving ? t.saving[lang] : t.save[lang]}
			</Button>
		</div>
	</header>

	{#if !canEdit && loadedOnce}
		<div class="settings-notice" data-test="settings-readonly-notice">
			<Tag label={t.ownerOnly[lang]} color="secondary" variant="soft" size="sm" />
		</div>
	{/if}

	<!-- ── Trạng thái loading ── -->
	{#if loading && !loadedOnce}
		<div class="settings-state" role="status">
			<p>{t.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="settings-state error" role="alert">
			<p class="state-title">{t.loadFailed[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadSettings}>
				{t.retry[lang]}
			</Button>
		</div>
	{:else}
		<!-- ── Pha 3 (B5): NỘI DUNG 5 TAB tách thành 5 snippet — render 2 nơi:
		     Tabs (desktop ≥768px) + Accordion (mobile <768px). activeTab SHARED
		     giữ trạng thái khi đổi viewport ── -->
		{#snippet tabGeneralContent()}
			<div class="form-grid">
				<div class="form-field">
					<label class="form-label" for="settings-app-name">{t.appName[lang]}</label>
					<Input
						id="settings-app-name"
						bind:value={settings.general.appName}
						disabled={!canEdit}
						data-test="input-app-name"
					/>
				</div>
				<div class="form-field">
					<span class="form-label">{t.defaultLang[lang]}</span>
					<Select
						bind:value={settings.general.defaultLang}
						options={langOptions}
						disabled={!canEdit}
						data-test="select-default-lang"
					/>
				</div>
				<div class="form-field">
					<label class="form-label" for="settings-timezone">{t.timezone[lang]}</label>
					<Input
						id="settings-timezone"
						bind:value={settings.general.timezone}
						disabled={!canEdit}
						placeholder="Asia/Ho_Chi_Minh"
						data-test="input-timezone"
					/>
				</div>
			</div>
		{/snippet}
		{#snippet tabSecurityContent()}
			<div class="form-grid">
				<div class="form-field">
					<label class="form-label" for="settings-session-timeout">{t.sessionTimeout[lang]}</label>
					<Input
						id="settings-session-timeout"
						type="number"
						inputmode="numeric"
						bind:value={sessionTimeoutDraft}
						disabled={!canEdit}
						data-test="input-session-timeout"
					/>
				</div>
				<div class="form-field">
					<label class="form-label" for="settings-max-login">{t.maxLoginAttempts[lang]}</label>
					<Input
						id="settings-max-login"
						type="number"
						inputmode="numeric"
						bind:value={maxLoginAttemptsDraft}
						disabled={!canEdit}
						data-test="input-max-login"
					/>
				</div>
				<div class="form-field">
					<label class="form-label" for="settings-password-min">{t.passwordMinLength[lang]}</label>
					<Input
						id="settings-password-min"
						type="number"
						inputmode="numeric"
						bind:value={passwordMinLengthDraft}
						disabled={!canEdit}
						data-test="input-password-min"
					/>
				</div>
				<div class="form-field">
					<span class="form-label">{t.draftRestore[lang]}</span>
					<Switch
						bind:checked={settings.features.draftRestore}
						disabled={!canEdit}
						aria-label={t.draftRestore[lang]}
						data-test="switch-draft-restore"
					/>
				</div>
			</div>
		{/snippet}
		{#snippet tabCommerceContent()}
			<div class="form-grid">
				<div class="form-field">
					<span class="form-label">{t.currency[lang]}</span>
					<Select
						bind:value={settings.commerce.currency}
						options={currencyOptions}
						disabled={!canEdit}
						data-test="select-currency"
					/>
				</div>
				<div class="form-field">
					<label class="form-label" for="settings-tax-rate">{t.taxRate[lang]}</label>
					<Input
						id="settings-tax-rate"
						type="number"
						inputmode="decimal"
						bind:value={taxRateDraft}
						disabled={!canEdit}
						data-test="input-tax-rate"
					/>
				</div>
				<div class="form-field">
					<label class="form-label" for="settings-low-stock">{t.lowStock[lang]}</label>
					<Input
						id="settings-low-stock"
						type="number"
						inputmode="numeric"
						bind:value={lowStockDraft}
						disabled={!canEdit}
						data-test="input-low-stock"
					/>
				</div>
			</div>
		{/snippet}
		{#snippet tabAppearanceContent()}
			<div class="form-grid">
				<div class="form-field">
					<span class="form-label">{t.theme[lang]}</span>
					<Select
						bind:value={settings.appearance.theme}
						options={themeOptions}
						disabled={!canEdit}
						data-test="select-theme"
					/>
				</div>
				<div class="form-field">
					<span class="form-label">{t.density[lang]}</span>
					<Select
						bind:value={settings.appearance.density}
						options={densityOptions}
						disabled={!canEdit}
						data-test="select-density"
					/>
				</div>
			</div>
		{/snippet}
		{#snippet tabStatusContent()}
			{#if statusLoading && !status}
				<div class="settings-state" role="status">
					<p>{t.statusLoading[lang]}</p>
				</div>
			{:else if statusError && !status}
				<div class="settings-state error" role="alert">
					<p class="state-title">{t.statusFailed[lang]}</p>
					<p class="state-detail">{statusError}</p>
					<Button color="primary" variant="outline" onClick={loadStatus}>
						{t.retry[lang]}
					</Button>
				</div>
			{:else if status}
				<div class="status-grid" data-test="status-grid">
					<div class="status-card">
						<span class="status-label">{t.uptime[lang]}</span>
						<span class="status-value" data-test="status-uptime">{formatUptime(status.uptimeSeconds)}</span>
					</div>
					<div class="status-card">
						<span class="status-label">{t.memory[lang]}</span>
						<span class="status-value" data-test="status-memory">
							{formatMemory(status.memory?.heapUsed)} / {formatMemory(status.memory?.heapTotal)}
						</span>
					</div>
					<div class="status-card">
						<span class="status-label">{t.nodeVersion[lang]}</span>
						<span class="status-value" data-test="status-node">{status.nodeVersion ?? '—'}</span>
					</div>
					<div class="status-card">
						<span class="status-label">{t.platform[lang]}</span>
						<span class="status-value" data-test="status-platform">{status.platform ?? '—'}</span>
					</div>
					<div class="status-card">
						<span class="status-label">{t.dbStatus[lang]}</span>
						<span class="status-value">
							{#if status.db?.ok}
								<Tag label={t.dbOk[lang]} color="success" variant="soft" size="sm" data-test="db-badge-ok" />
							{:else}
								<Tag label={t.dbError[lang]} color="error" variant="soft" size="sm" data-test="db-badge-error" />
							{/if}
						</span>
					</div>
				</div>

				<!-- Audit logs gần đây (bảng nhỏ) -->
				<div class="audit-section" data-test="audit-section">
					<h2 class="audit-title">{t.auditLogs[lang]}</h2>
					{#if !status.audit?.ok}
						<p class="audit-empty error">{t.auditFailed[lang]}</p>
					{:else if (status.audit?.items?.length ?? 0) === 0}
						<p class="audit-empty">{t.auditEmpty[lang]}</p>
					{:else}
						<p class="audit-total">
							{status.audit.total} {t.auditTotal[lang]}
						</p>
						<div class="audit-table-wrap">
							<table class="audit-table">
								<thead>
									<tr>
										<th scope="col">{t.colTime[lang]}</th>
										<th scope="col">{t.colAction[lang]}</th>
										<th scope="col">{t.colCollection[lang]}</th>
									</tr>
								</thead>
								<tbody>
									{#each status.audit.items as row, i (row.createdAt ?? i)}
										<tr>
											<td>{formatAuditTime(row.createdAt)}</td>
											<td class="audit-action">{row.action ?? '—'}</td>
											<td>{row.collectionName ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		{/snippet}
		{#snippet tabBackupContent()}
			<p class="backup-desc">{t.backupDesc[lang]}</p>

			<!-- ── Khu backup: list collections + nút tạo backup ── -->
			<div class="backup-section" data-test="backup-section">
				<div class="backup-section-head">
					<h2 class="backup-section-title">{t.backupListTitle[lang]}</h2>
					<Button
						color="success"
						onClick={handleCreateBackup}
						loading={backupExporting}
						disabled={backupExporting || !encryptionKeys}
						data-test="backup-create"
					>
						{backupExporting ? t.backupCreating[lang] : t.backupCreate[lang]}
					</Button>
				</div>
				{#if backupListLoading && !backupItems}
					<div class="settings-state" role="status">
						<p>{t.backupListLoading[lang]}</p>
					</div>
				{:else if backupListError && !backupItems}
					<div class="settings-state error" role="alert">
						<p class="state-title">{t.backupListFailed[lang]}</p>
						<p class="state-detail">{backupListError}</p>
						<Button color="primary" variant="outline" onClick={loadBackupList}>
							{t.retry[lang]}
						</Button>
					</div>
				{:else if backupItems}
					<div class="backup-table-wrap">
						<table class="backup-table" data-test="backup-table">
							<thead>
								<tr>
									<th scope="col">{t.backupColName[lang]}</th>
									<th scope="col">{t.backupColDocs[lang]}</th>
								</tr>
							</thead>
							<tbody>
								{#each backupItems as row, i (row.name)}
									<tr data-test="backup-row-{row.name}">
										<td class="backup-name">{row.name}</td>
										<td>{row.count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- ── Khu restore: chọn file + confirm + gọi API ── -->
			<div class="backup-section" data-test="restore-section">
				<h2 class="backup-section-title">{t.backupRestoreTitle[lang]}</h2>
				<div class="backup-restore-row">
					<Input
						type="file"
						accept=".json,application/json"
						bind:files={backupFile}
						data-test="backup-file-input"
					/>
					<Button
						color="primary"
						onClick={handleRestoreClick}
						loading={backupRestoring}
						disabled={backupFile.length === 0 || backupRestoring || !encryptionKeys}
						data-test="backup-restore"
					>
						{backupRestoring ? t.backupRestoring[lang] : t.backupRestore[lang]}
					</Button>
				</div>
				{#if backupFile.length > 0}
					<p class="backup-file-name" data-test="backup-file-name">
						{t.backupFilePicked[lang]}: {backupFile[0]?.name}
					</p>
				{/if}
			</div>
		{/snippet}

		<!-- ── Tabs cấu hình (4 tab cấu hình + tab status + tab backup) — DESKTOP ≥768px.
		     Wrapper div mang data-test (Tabs.Root không forward data-test) ── -->
		<div class="settings-tabs" data-test="settings-tabs">
		<Tabs bind:value={activeTab} type="underline">
			<Tabs.List>
				<Tabs.Trigger value="general" icon="lucide:settings" data-test="tab-trigger-general">
					{t.tabGeneral[lang]}
				</Tabs.Trigger>
				<Tabs.Trigger value="security" icon="lucide:shield" data-test="tab-trigger-security">
					{t.tabSecurity[lang]}
				</Tabs.Trigger>
				<Tabs.Trigger value="commerce" icon="lucide:shopping-cart" data-test="tab-trigger-commerce">
					{t.tabCommerce[lang]}
				</Tabs.Trigger>
				<Tabs.Trigger value="appearance" icon="lucide:palette" data-test="tab-trigger-appearance">
					{t.tabAppearance[lang]}
				</Tabs.Trigger>
				<Tabs.Trigger value="status" icon="lucide:activity" data-test="tab-trigger-status">
					{t.tabStatus[lang]}
				</Tabs.Trigger>
				<Tabs.Trigger value="backup" icon="lucide:database-backup" data-test="tab-trigger-backup">
					{t.tabBackup[lang]}
				</Tabs.Trigger>
			</Tabs.List>

			<!-- ── Tab General ── -->
			<Tabs.Content value="general" data-test="tab-content-general">
				{@render tabGeneralContent()}
			</Tabs.Content>

			<!-- ── Tab Security ── -->
			<Tabs.Content value="security" data-test="tab-content-security">
				{@render tabSecurityContent()}
			</Tabs.Content>

			<!-- ── Tab Commerce ── -->
			<Tabs.Content value="commerce" data-test="tab-content-commerce">
				{@render tabCommerceContent()}
			</Tabs.Content>

			<!-- ── Tab Appearance ── -->
			<Tabs.Content value="appearance" data-test="tab-content-appearance">
				{@render tabAppearanceContent()}
			</Tabs.Content>

			<!-- ── Tab System Status ── -->
			<Tabs.Content value="status" data-test="tab-content-status">
				{@render tabStatusContent()}
			</Tabs.Content>

			<!-- ── Tab Backup / Restore ── -->
			<Tabs.Content value="backup" data-test="tab-content-backup">
				{@render tabBackupContent()}
			</Tabs.Content>
		</Tabs>
		</div>

		<!-- ── Pha 3 (B5): ACCORDION mobile <768px — thay Tabs (5 trigger ngang
		     tràn mobile). bind:value={activeTab} chia sẻ state: mở item = chọn
		     tab, đổi breakpoint giữ mục đang xem. Wrapper div mang data-test ── -->
		<div class="settings-accordion" data-test="settings-accordion">
		<Accordion type="single" collapsible bind:value={activeTab}>
			<Accordion.Item value="general">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:settings" data-test="acc-trigger-general">
						{t.tabGeneral[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="acc-content-general">
					{@render tabGeneralContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="security">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:shield" data-test="acc-trigger-security">
						{t.tabSecurity[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="acc-content-security">
					{@render tabSecurityContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="commerce">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:shopping-cart" data-test="acc-trigger-commerce">
						{t.tabCommerce[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="acc-content-commerce">
					{@render tabCommerceContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="appearance">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:palette" data-test="acc-trigger-appearance">
						{t.tabAppearance[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="acc-content-appearance">
					{@render tabAppearanceContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="status">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:activity" data-test="acc-trigger-status">
						{t.tabStatus[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="acc-content-status">
					{@render tabStatusContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="backup">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:database-backup" data-test="acc-trigger-backup">
						{t.tabBackup[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="acc-content-backup">
					{@render tabBackupContent()}
				</Accordion.Content>
			</Accordion.Item>
		</Accordion>
		</div>

		<!-- ── Pha 3 (B5): ACTION BAR mobile — sticky bottom, Save + Cancel luôn
		     trong tầm ngón tay (yêu cầu user: action buttons dưới viewport).
		     Chỉ hiện khi có thay đổi chưa lưu + được sửa. Desktop ẩn (Save ở
		     header như cũ) ── -->
		{#if modified && canEdit}
			<div class="settings-action-bar" data-test="settings-action-bar">
				<Button
					color="primary"
					variant="outline"
					onClick={handleCancel}
					disabled={saving}
					data-test="settings-cancel"
				>
					{t.cancel[lang]}
				</Button>
				<Button
					color="primary"
					onClick={handleSave}
					disabled={saving}
					loading={saving}
					data-test="settings-save-bar"
				>
					{saving ? t.saving[lang] : t.save[lang]}
				</Button>
			</div>
		{/if}
	{/if}
</section>

<!-- ── B9: dialog hỏi khôi phục bản nháp (load trang xong, có draft) ── -->
<DraftRestoreDialog
	bind:display={draftRestoreDisplay}
	onRestore={applyDraftRestore}
	onDiscard={discardDraft}
	{lang}
/>

<!-- ── Backup: dialog xác nhận trước khi restore (ghi đè theo _id) ── -->
<AlertDialog bind:open={restoreConfirmOpen} data-test="backup-restore-dialog">
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{t.backupRestoreConfirmTitle[lang]}</AlertDialog.Title>
			<AlertDialog.Description>{restoreConfirmMessage}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel data-test="backup-restore-cancel">
				{t.cancel[lang]}
			</AlertDialog.Cancel>
			<AlertDialog.Action
				data-test="backup-restore-confirm"
				color="primary"
				onselect={handleRestoreConfirm}
			>
				{t.backupRestore[lang]}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<style lang="scss">
	.settings-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;
	}

	.settings-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.settings-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.settings-subtitle {
		font-size: 0.9rem;
		color: var(--foreground-500);
		margin: 0.25rem 0 0;
	}

	.settings-header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;

		/* Pha 3 (B5): mobile — Save/badge header ẨN: action bar sticky dưới đáy
		   đã có đủ Save + Cancel (yêu cầu user ưu tiên action button dưới viewport);
		   tránh trùng 2 nút "Lưu" trên cùng 1 màn hình nhỏ. */
		@media (max-width: 767px) {
			display: none;
		}
	}

	.settings-notice {
		display: flex;
	}

	.settings-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--foreground-500);
		text-align: center;

		&.error {
			color: var(--error);
		}

		.state-title {
			font-weight: 600;
			color: var(--foreground);
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

	/* ── Pha 3 (B5): BREAKPOINT responsive — Tabs desktop ≥768px, Accordion
	   mobile <768px. Cả 2 luôn render trong DOM (đơn giản, không SSR-mismatch)
	   — CSS display toggle theo media query; state activeTab chia sẻ. ── */
	:global(.settings-tabs) {
		display: none;

		@media (min-width: 768px) {
			display: block;
		}
	}

	:global(.settings-accordion) {
		display: block;

		@media (min-width: 768px) {
			display: none;
		}
	}

	/* ── Pha 3 (B5): ACTION BAR mobile — FIXED dính đáy viewport: user scroll
	   form dài vẫn thấy Save/Cancel (yêu cầu: action buttons nằm dưới viewport
	   rút ngắn thao tác). Bẫy sticky đã gặp: trang vừa khít viewport → sticky
	   dịch bar LÊN đè item accordion cuối + KHÔNG thể scroll để lộ → dùng fixed
	   (luôn dính đáy) + padding-bottom động :has() bên dưới cho content chỗ trống.
	   Desktop ẩn — Save header như cũ. ── */
	.settings-action-bar {
		position: fixed;
		bottom: 0.75rem;
		/* Center theo settings-page (max-width 1280, padding 1.5rem) — fixed
		   thoát flow nên tự tính width, không kế thừa container. */
		left: 50%;
		transform: translateX(-50%);
		width: min(calc(100vw - 3rem), calc(1280px - 3rem));
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--background, #fff);
		border: 1px solid var(--border, hsl(0 0% 88%));
		border-radius: var(--border-radius-lg, 0.5rem);
		box-shadow: 0 -4px 16px rgb(0 0 0 / 0.08);
		z-index: 10;

		@media (prefers-color-scheme: dark) {
			background: var(--background, hsl(240 5.9% 10%));
			border-color: var(--border, hsl(240 5.9% 24%));
		}

		@media (min-width: 768px) {
			display: none;
		}
	}

	/* Bar fixed đè content cuối → khi bar hiện, content cần padding-bottom
	   (bar ~66px + bottom 12px + thoáng) để scroll đáy vẫn thấy item cuối.
	   :has() động — chưa modified (bar ẩn) KHÔNG có padding thừa.
	   Bẫy thứ 2: mobile nội dung accordion có thể KHÔNG tràn viewport (5 item
	   gập, 1 mở — tổng < 700px) → padding KHÔNG sinh scrollbar, bar vẫn đè.
	   min-height bù: khi bar hiện, page cao ÍT NHẤT viewport + bar → luôn có
	   chỗ scroll lộ item cuối. */
	.settings-page:has(.settings-action-bar) {
		@media (max-width: 767px) {
			padding-bottom: 5.5rem;
			min-height: calc(100dvh + 1rem);
		}
	}

	/* ── Form (4 tab cấu hình) ── */
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.25rem;
		padding: 1.25rem 0.25rem;
		max-width: 760px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.form-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--foreground);
	}

	/* ── Status dashboard ── */
	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		padding: 1.25rem 0.25rem;
	}

	.status-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 1rem 1.125rem;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		transition: border-color 300ms cubic-bezier(0.65, 0, 0.35, 1);
	}

	.status-card:hover {
		border-color: var(--default-500);
	}

	.status-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--foreground-500);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.status-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--foreground);
		word-break: break-all;
	}

	/* ── Audit logs (bảng nhỏ) ── */
	.audit-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 0.25rem 1.5rem;
	}

	.audit-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.audit-total {
		font-size: 0.85rem;
		color: var(--foreground-500);
		margin: 0;
	}

	.audit-empty {
		font-size: 0.9rem;
		color: var(--foreground-500);
		margin: 0;

		&.error {
			color: var(--error);
		}
	}

	.audit-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	.audit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;

		th,
		td {
			padding: 0.625rem 1rem;
			text-align: left;
			border-bottom: 1px solid var(--default-200);
			white-space: nowrap;
		}

		th {
			font-weight: 600;
			color: var(--foreground-500);
			background: var(--default-100);
			font-size: 0.75rem;
			text-transform: uppercase;
			letter-spacing: 0.03em;
		}

		tbody tr:last-child td {
			border-bottom: none;
		}

		tbody tr {
			transition: background 300ms cubic-bezier(0.65, 0, 0.35, 1);
		}

		tbody tr:hover {
			background: var(--default-50);
		}
	}

	.audit-action {
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--foreground);
	}

	/* ── Backup / Restore ── */
	.backup-desc {
		font-size: 0.9rem;
		color: var(--foreground-500);
		margin: 0;
		padding: 0.25rem;
	}

	.backup-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 0.25rem 1.5rem;
	}

	.backup-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.backup-section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.backup-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	.backup-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;

		th,
		td {
			padding: 0.5rem 1rem;
			text-align: left;
			border-bottom: 1px solid var(--default-200);
			white-space: nowrap;
		}

		th {
			font-weight: 600;
			color: var(--foreground-500);
			background: var(--default-100);
			font-size: 0.75rem;
			text-transform: uppercase;
			letter-spacing: 0.03em;
		}

		tbody tr:last-child td {
			border-bottom: none;
		}

		tbody tr:hover {
			background: var(--default-50);
		}
	}

	.backup-name {
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--foreground);
	}

	.backup-restore-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		flex-wrap: wrap;

		> :first-child {
			flex: 1 1 260px;
		}
	}

	.backup-file-name {
		font-size: 0.85rem;
		color: var(--foreground-500);
		margin: 0;
		word-break: break-all;
	}
</style>

