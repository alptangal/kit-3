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
	r: '--thr'
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

/**
 * Đổi theme với animate lan dần từ vị trí click/tap (x, y).
 *
 * - Có View Transitions API: render view mới (data-theme trên html) trong
 *   startViewTransition + clip-path circle từ tâm click mở rộng (keyframes
 *   theme-clip-expand app.css). Theme state (profile.theme) đổi TRONG callback —
 *   snapshot mới chụp sau khi DOM đổi. Radial-gradient rAF của setter bị skip
 *   (cancel + reset body background) — tránh frame gradient 0% rơi vào snapshot.
 * - Không có API: fallback setter radial-gradient rAF (setter đọc
 *   profile.cursor — set cursor trước khi gọi setter).
 * - reduced-motion → đổi tức thì.
 */
export function animateThemeTransition(next: AppTheme, x: number, y: number): void {
	if (typeof document === 'undefined') return;

	// Reduced-motion → đổi tức thì (không animate)
	if (prefersReducedMotion()) {
		profile.cursor.x = x;
		profile.cursor.y = y;
		profile.theme = next;
		return;
	}

	// Fallback: không có View Transitions API → setter radial-gradient rAF
	// (profile.theme setter tự animate radial-gradient trên body từ cursor).
	if (typeof document.startViewTransition !== 'function') {
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
	});
}
