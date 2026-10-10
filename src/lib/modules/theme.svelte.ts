// src/lib/modules/theme.svelte.ts
// Wave 11 — Theme toggle: animate chuyển màu lan dần từ vị trí click/tap.
//
// Thiết kế:
// - View Transitions API (document.startViewTransition) + ::view-transition-new(root)
//   clip-path circle() từ tâm click → mở rộng radius tới góc xa nhất viewport
//   (Math.hypot tới 4 góc). Tâm/bán kính qua CSS custom properties (--thx, --thy,
//   --thr) trên documentElement + keyframes theme-clip-expand trong app.css
//   (::view-transition-* là pseudo-element — KHÔNG inline style / Element.animate
//   được; CSS keyframes + custom properties là cách chuẩn).
// - Fallback (trình duyệt không có View Transitions): dùng setter profile.theme
//   có sẵn — radial-gradient rAF trên body từ profile.cursor (không crash).
// - prefers-reduced-motion: reduce → đổi tức thì (bỏ animate).
// - 'system' truyền thẳng vào setter — setter set data-theme = 'system' raw,
//   CSS media query (prefers-color-scheme) quyết định tokens → vẫn theo OS.
// - SSR: document/window chỉ tồn tại client → guard typeof document / window.
import { profile } from '$store/basic.svelte';
import type { AppTheme } from '$interfaces/basic';

/** CSS custom property names cho clip-path circle (keyframes app.css đọc) */
export const THEME_TRANSITION_VARS = {
	x: '--thx',
	y: '--thy',
	r: '--thr',
	/** duration animate circle (app.css ::view-transition-new(root) đọc) — pseudo
	    không inline style được → var là cách duy nhất (default 450ms). */
	duration: '--theme-transition-duration'
} as const;

/** Class gắn lên html trong lúc transition chạy — scope keyframes app.css */
export const THEME_TRANSITION_CLASS = 'theme-transitioning';

function prefersReducedMotion(): boolean {
	if (typeof matchMedia === 'undefined') return false;
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Bán kính lớn nhất từ tâm (x, y) tới 4 góc viewport (góc xa nhất quyết định) */
function maxRadius(x: number, y: number): number {
	if (typeof window === 'undefined') return 0;
	const w = window.innerWidth;
	const h = window.innerHeight;
	return Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)));
}

/** Chuẩn hoá duration (TimeUnits: number | `${number}s` | `${number}ms`) → ms */
function normalizeDuration(d: number | `${number}s` | `${number}ms`): number {
	if (typeof d === 'number') return d;
	return d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000;
}

/**
 * Đổi theme với animate lan dần từ vị trí click/tap (x, y).
 *
 * - Có View Transitions API: render view mới (data-theme trên html) trong
 *   startViewTransition + clip-path circle từ tâm click mở rộng (keyframes
 *   theme-clip-expand app.css). Theme state (profile.theme) đổi TRONG callback —
 *   snapshot mới chụp sau khi DOM đổi. Radial-gradient rAF của setter bị skip
 *   (cancel + reset body background) — tránh frame gradient 0% rơi vào snapshot.
 * - duration (TimeUnits, default 450ms): đặt --theme-transition-duration trên
 *   documentElement (cạnh --thx) — app.css ::view-transition-new(root) đọc var
 *   (pseudo không inline style được → var là cách duy nhất).
 * - Không có API: fallback setter radial-gradient rAF (setter đọc
 *   profile.cursor — set cursor trước khi gọi setter; duration fallback qua
 *   biến module THEME_FALLBACK_DURATION_MS — KHÔNG sửa store).
 * - reduced-motion → đổi tức thì.
 */

/** Duration fallback (ms) cho path radial-gradient rAF (không có View
    Transitions) — module-level vì setter profile.theme không nhận tham số. */
export let THEME_FALLBACK_DURATION_MS: number | null = null;

export function animateThemeTransition(
	next: AppTheme,
	x: number,
	y: number,
	duration: number | `${number}s` | `${number}ms` = 450
): void {
	if (typeof document === 'undefined') return;

	const durationMs = normalizeDuration(duration);

	// Reduced-motion → đổi tức thì (không animate)
	if (prefersReducedMotion()) {
		profile.cursor.x = x;
		profile.cursor.y = y;
		profile.theme = next;
		return;
	}

	// Fallback: không có View Transitions API → setter radial-gradient rAF
	// (profile.theme setter tự animate radial-gradient trên body từ cursor).
	// Duration đồng bộ qua biến module (setter đọc profile.delay ?? 300 —
	// KHÔNG sửa store; biến module đọc trong setDuration setter bên dưới).
	if (typeof document.startViewTransition !== 'function') {
		THEME_FALLBACK_DURATION_MS = durationMs;
		profile.cursor.x = x;
		profile.cursor.y = y;
		profile.theme = next;
		return;
	}

	const root = document.documentElement;

	// View Transitions path — clip-path circle từ tâm click (keyframes app.css
	// đọc --thx/--thy/--thr). Class theme-transitioning scope old animation:none
	// + new clip-path expand (không ăn đè page-fade-out/in của page navigation).
	root.style.setProperty(THEME_TRANSITION_VARS.x, `${x}px`);
	root.style.setProperty(THEME_TRANSITION_VARS.y, `${y}px`);
	root.style.setProperty(THEME_TRANSITION_VARS.r, `${maxRadius(x, y)}px`);
	root.style.setProperty(THEME_TRANSITION_VARS.duration, `${durationMs}ms`);
	root.classList.add(THEME_TRANSITION_CLASS);

	const transition = document.startViewTransition(() => {
		profile.cursor.x = x;
		profile.cursor.y = y;
		profile.theme = next;
		// Skip radial-gradient rAF của setter — snapshot mới cần giá trị CUỐI
		// (frame gradient 0% schedule trong cùng frame với capture → rơi vào
		// snapshot → circle frozen). Cancel + reset body background inline.
		const raf = profile.timeId.theme.requestAnimation;
		if (raf) cancelAnimationFrame(raf);
		profile.timeId.theme.requestAnimation = null;
		document.body.style.background = 'var(--background)';
	});

	// Dọn class + CSS custom properties sau khi transition xong (finished
	// reject khi user skip — .finally vẫn chạy).
	transition.finished.finally(() => {
		root.classList.remove(THEME_TRANSITION_CLASS);
		root.style.removeProperty(THEME_TRANSITION_VARS.x);
		root.style.removeProperty(THEME_TRANSITION_VARS.y);
		root.style.removeProperty(THEME_TRANSITION_VARS.r);
		root.style.removeProperty(THEME_TRANSITION_VARS.duration);
	});
}
