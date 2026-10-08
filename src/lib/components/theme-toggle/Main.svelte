<script lang="ts">
	//$components/theme-toggle/Main.svelte
	// Wave 11 — Theme toggle: animate chuyển màu lan dần từ vị trí click/tap.
	//
	// Dùng Button component có sẵn + Icon iconify (sun/moon). Click → truyền
	// coords (clientX/clientY) vào animateThemeTransition (module theme.svelte.ts):
	// View Transitions API clip-path circle từ tâm click → mở rộng radius tới góc
	// xa nhất viewport. Fallback: radial-gradient rAF profile.theme setter.
	// reduced-motion → đổi tức thì.
	//
	// Theme cycle: light ⇄ dark (toggle 2 trạng thái — 'system' giữ nguyên giá trị
	// theo prefers-color-scheme khi data-theme chưa set thủ công).
	// Icon hiện theo giá trị HIỆN (resolved): light = moon (bấm sang dark),
	// dark = sun (bấm sang light).
	import { profile } from '$store/basic.svelte';
	import { browser } from '$app/environment';
	import type { AppTheme } from '$interfaces/basic';
	import { animateThemeTransition } from '$modules/theme.svelte';
	import { Button } from '$components/element';
	import Icon from '$components/element/icon/Main.svelte';

	// Resolved theme hiện tại (getter profile.theme resolve 'system' → dark/light
	// + set data-theme). Guard browser bên trong getter (document chỉ có client).
	const currentTheme = $derived.by(() => {
		if (!browser) return 'system' as AppTheme;
		return profile.theme;
	});

	// Icon theo giá trị HIỆN (resolved) — moon khi light (bấm sang dark),
	// sun khi dark (bấm sang light).
	const iconDerived = $derived.by(() => {
		const th = currentTheme;
		return th === 'dark' ? 'lucide:sun' : 'lucide:moon';
	});

	// aria-label theo giá trị hiện tại (đổi sau mỗi lần toggle)
	const labelDerived = $derived.by(() => {
		const th = currentTheme;
		if (th === 'dark') return 'Theme: dark — bấm để sang light';
		return 'Theme: light — bấm để sang dark';
	});

	// Toggle 2 trạng thái: light ⇄ dark
	function nextTheme(from: AppTheme): AppTheme {
		return from === 'dark' ? 'light' : 'dark';
	}

	// onClick Button type: (event?: Event | MouseEvent | undefined) — nhận kiểu
	// rộng hơn (undefined khi gọi programmatically click() không kèm event).
	function handleClick(e?: Event | MouseEvent) {
		// Coords: MouseEvent có clientX/Y; Event programmatically (click() không
		// kèm coords) → fallback tâm viewport.
		const me = e instanceof MouseEvent ? e : null;
		const x = me?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
		const y = me?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
		animateThemeTransition(nextTheme(currentTheme), x, y);
	}
</script>

<!-- data-test nằm trên wrapper (Button không render 'data-test' prop —
     BasicProps khai báo nhưng Main.svelte không truyền ra element) -->
<span class="theme-toggle-root" data-test="theme-toggle">
	<Button
		variant="ghost"
		color="default"
		aspect-square={true}
		aria-label={labelDerived}
		onclick={handleClick}
	>
		<Icon icon={iconDerived} />
	</Button>
</span>
