// src/lib/modules/close-guard.svelte.ts
// P3 confirm-dirty: helper DÙNG CHUNG cho các modal form admin — chặn đóng
// modal khi form còn thay đổi chưa lưu (dirty), hiện dialog xác nhận thay vì
// mất dữ liệu.
//
// Cách hoạt động:
//  - Modal chặn 3 đường tự động (escape / backdrop / nút ×) qua prop
//    `onCloseAttempt` (trả false = chặn đóng).
//  - Nút Cancel trong footer đóng kiểu programmatic (caller set display =
//    false trực tiếp, không đi qua Modal guard) → trang gọi `attemptClose()`
//    thủ công trước khi đóng.
//  - User chọn "Bỏ thay đổi" → `close()` của trang (đóng + reset form).
//    Draft B9 KHÔNG bị xoá (đã autosave) → mở lại form sẽ được hỏi khôi phục
//    nên dữ liệu không mất thật.
//
// LƯU Ý Svelte 5: snapshot đọc sâu form (JSON.stringify) — nếu gọi markClean
// trong $effect (vd reset form khi mở modal) thì lần đọc đó PHẢI untrack,
// nếu không effect sẽ track toàn bộ field → re-run mỗi keystroke → loop.

import { untrack } from 'svelte';

export interface CloseGuardOptions {
	/** Getter trả form state hiện tại (so JSON snapshot với baseline). */
	form: () => unknown;
	/** Mở dialog xác nhận (trang tự set $state của nó). */
	openConfirm: () => void;
	/** Đóng THẬT + làm sạch form (submit ok / user xác nhận discard). */
	close: () => void;
}

export interface CloseGuard {
	/**
	 * Cửa đóng DUY NHẤT cho nút Cancel + onCloseAttempt của Modal:
	 * form sạch → tự `close()` (đóng thật); dirty → mở dialog xác nhận
	 * và trả false (Modal giữ nguyên display).
	 */
	attemptClose: (reason?: string) => boolean;
	/** Đánh dấu form hiện tại là "sạch" — gọi sau khi set formData
	 *  (mở form / reset / khôi phục draft). */
	markClean: () => void;
	/** Nút "Bỏ thay đổi" trong dialog xác nhận. */
	confirmDiscard: () => void;
}

export function createCloseGuard(opts: CloseGuardOptions): CloseGuard {
	// Baseline KHÔNG cần reactive: chỉ đọc/ghi trong event handler (không bao
	// giờ đọc trong $effect) — biến thường trong closure là đủ.
	let baseline = '';
	// untrack: đọc form cho mục đích so-sánh (không bao giờ tạo dependency) —
	// cho phép markClean gọi an toàn bên trong $effect của trang.
	const snapshot = (): string => untrack(() => JSON.stringify(opts.form()));
	return {
		attemptClose() {
			if (snapshot() === baseline) {
				opts.close(); // sạch → đóng luôn
				return true;
			}
			opts.openConfirm(); // dirty → dialog xác nhận, chặn đóng
			return false;
		},
		markClean() {
			baseline = snapshot();
		},
		confirmDiscard: () => opts.close()
	};
}
