// $lib/store/theme-persist-sink.ts
// Sink persist theme per-user: basic.svelte (setter theme) gọi, user-prefs đăng ký.
// Module riêng 1 chiều — KHÔNG import basic.svelte/user-prefs (tránh circular):
//   basic.svelte.ts  → import callThemePersistSink (gọi trong setter)
//   user-prefs       → import setThemePersistSink (đăng ký khi bootstrap)
// Sink không cần reactive (đăng ký 1 lần) nên module thuần TS, không rune.

import type { AppTheme } from '$interfaces/basic';

let sink: null | ((theme: AppTheme) => void) = null;

/** user-prefs đăng ký sink sau bootstrap — null trước đó (SSR/chưa login) vô hại. */
export function setThemePersistSink(fn: null | ((theme: AppTheme) => void)) {
	sink = fn;
}

/** basic.svelte setter theme gọi — persist fail không được chặn UI theme. */
export function callThemePersistSink(theme: AppTheme) {
	try {
		sink?.(theme);
	} catch {
		// ignore — persist là best-effort
	}
}
