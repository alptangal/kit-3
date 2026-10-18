// $lib/modules/prefs-api.ts
// Client write-path cho per-user preferences — fetchSecure POST debounced.
// KHÔNG import $store/basic.svelte (tránh circular: store cần gọi module này
// qua themePersistHook, module không được import ngược store).
// Fire-and-forget: lỗi mạng/không đăng nhập chỉ log, không chặn UI.

const PENDING_DELAY = 500;

let prefsTimer: ReturnType<typeof setTimeout> | null = null;
let prefsQueue: Record<string, unknown> = {};

/**
 * Ghép patch vào queue rồi gửi 1 PATCH debounced 500ms (merge các write liền nhau
 * — vd theme + language đổi liên tiếp chỉ tạo 1 request).
 */
export function saveUserPrefs(patch: Record<string, unknown>): void {
	if (typeof window === 'undefined') return;
	prefsQueue = { ...prefsQueue, ...patch };
	// searchKeywords: merge per-route (2 route lưu liên tiếp không ghi đè nhau).
	if (patch.searchKeywords && prefsQueue.searchKeywords) {
		prefsQueue.searchKeywords = {
			...(prefsQueue.searchKeywords === patch.searchKeywords ? {} : (prefsQueue.searchKeywords as Record<string, string[]>)),
			...(patch.searchKeywords as Record<string, string[]>)
		};
	}
	if (prefsTimer) clearTimeout(prefsTimer);
	prefsTimer = setTimeout(flushUserPrefs, PENDING_DELAY);
}

/** Gửi ngay queue hiện có (dùng khi cần flush — onDestroy, beforeNavigate...). */
export async function flushUserPrefs(): Promise<void> {
	if (prefsTimer) {
		clearTimeout(prefsTimer);
		prefsTimer = null;
	}
	const patch = prefsQueue;
	prefsQueue = {};
	if (Object.keys(patch).length === 0) return;

	try {
		const { encryption } = await import('$modules/encryption');
		const res = await encryption.fetchSecure('/api/admin/user-preferences/update', {
			body: { patch }
		});
		if (!res.ok) {
			console.warn('[prefs-api] update failed:', res.message);
		}
	} catch (e) {
		// offline / chưa đăng nhập — bỏ qua (fire-and-forget)
		console.warn('[prefs-api] save failed (offline?)', e);
	}
}
