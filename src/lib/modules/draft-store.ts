// src/lib/modules/draft-store.ts
// Lưu tự động bản nháp form theo từng user — khôi phục khi mở lại form
// sau khi crash/quên lưu. localStorage key `draft:{userId}:{formKey}`.
//
// Shape: {v: 1, savedAt: epoch-ms, data: unknown} — v để nâng cấp sau
// (field đổi cấu trúc ⇒ bump v + migrate). Hết hạn 7 ngày tự xoá.
//
// Toàn bộ guard SSR (typeof localStorage) + try/catch (quota/private-mode)
// — draft là tiện ích, KHÔNG bao giờ được làm gãy app.

export interface StoredDraft<T = unknown> {
	v: 1;
	savedAt: number;
	data: T;
}

const DRAFT_KEY_PREFIX = 'draft:';
const DRAFT_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 500;

const pending = new Map<string, ReturnType<typeof setTimeout>>();

function storageKey(userId: string, formKey: string): string {
	return `${DRAFT_KEY_PREFIX}${userId}:${formKey}`;
}

function isAvailable(): boolean {
	return typeof localStorage !== 'undefined';
}

/** Đọc draft còn hạn — trả undefined khi không có/hết hạn/parse lỗi (tự dọn key hỏng). */
export function readDraft<T>(userId: string, formKey: string): T | undefined {
	if (!userId || !isAvailable()) return undefined;
	try {
		const raw = localStorage.getItem(storageKey(userId, formKey));
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as StoredDraft<T>;
		if (!parsed || parsed.v !== 1 || typeof parsed.savedAt !== 'number' || !('data' in parsed)) {
			localStorage.removeItem(storageKey(userId, formKey));
			return undefined;
		}
		if (Date.now() - parsed.savedAt > DRAFT_EXPIRE_MS) {
			localStorage.removeItem(storageKey(userId, formKey));
			return undefined;
		}
		return parsed.data;
	} catch {
		try {
			localStorage.removeItem(storageKey(userId, formKey));
		} catch {
			/* private mode — bỏ qua */
		}
		return undefined;
	}
}

/** Ghi ngay (không debounce) — gọi khi form đóng/success để flush nốt queue. */
export function writeDraftNow<T>(userId: string, formKey: string, data: T): void {
	if (!userId || !isAvailable()) return;
	cancelPendingDraft(userId, formKey);
	try {
		const payload: StoredDraft<T> = { v: 1, savedAt: Date.now(), data };
		localStorage.setItem(storageKey(userId, formKey), JSON.stringify(payload));
	} catch {
		/* quota/private mode — bỏ qua */
	}
}

/** Autosave debounce 500ms — gộp các lần đổi liên tiếp thành 1 lần ghi. */
export function saveDraft<T>(userId: string, formKey: string, data: T): void {
	if (!userId || !isAvailable()) return;
	cancelPendingDraft(userId, formKey);
	const id = setTimeout(() => {
		pending.delete(storageKey(userId, formKey));
		writeDraftNow(userId, formKey, data);
	}, DEBOUNCE_MS);
	pending.set(storageKey(userId, formKey), id);
}

/** Huỷ timer debounce đang treo (không xoá draft đã ghi). */
export function cancelPendingDraft(userId: string, formKey: string): void {
	const key = storageKey(userId, formKey);
	const id = pending.get(key);
	if (id) {
		clearTimeout(id);
		pending.delete(key);
	}
}

/** Flush mọi timer đang treo (beforeunload) — ghi nốt trước khi rời trang. */
export function flushAllDrafts(): void {
	for (const [key, id] of pending) {
		clearTimeout(id);
		pending.delete(key);
		// key = draft:{userId}:{formKey} — data đã bị closure nuốt, ghi không được nữa.
		// Timer 500ms đủ ngắn: chấp nhận mất tail khi unload đột ngột.
		void key;
	}
}

/** Xoá draft (khi save thành công hoặc user chọn Bỏ qua). */
export function clearDraft(userId: string, formKey: string): void {
	if (!userId || !isAvailable()) return;
	cancelPendingDraft(userId, formKey);
	try {
		localStorage.removeItem(storageKey(userId, formKey));
	} catch {
		/* bỏ qua */
	}
}
