<!-- src/routes/ui/theme/+page.svelte -->
<!-- Wave 11 — Theme toggle: animate chuyển màu lan dần từ vị trí click/tap.
     Demo 3 section: toggle theme (light ⇄ dark), set giá trị cụ thể
     (light/dark/system), vị trí click tuỳ ý (4 góc — circle lan từ tâm nút). -->
<script lang="ts">
	import { ThemeToggle } from '$components/theme-toggle';
	import { Button } from '$components/element';
	import { profile } from '$store/basic.svelte';
	import { browser } from '$app/environment';
	import type { AppTheme } from '$interfaces/basic';
	import { animateThemeTransition } from '$modules/theme.svelte';

	// Giá trị theme hiện tại (profile.theme getter resolve 'system' → dark/light)
	const currentTheme = $derived.by(() => {
		if (!browser) return 'system' as AppTheme;
		return profile.theme;
	});

	// data-theme attribute trên html (giá trị CSS thực tế — light/dark).
	// Attribute KHÔNG tự track trong $derived → mirror qua profile.theme getter
	// (getter set data-theme mỗi lần đọc — cùng nguồn, đồng bộ giá trị).
	const resolvedTheme = $derived.by(() => {
		if (!browser) return 'light';
		if (currentTheme === 'system') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return currentTheme;
	});

	// Log vị trí click gần nhất (clientX/clientY truyền vào animateThemeTransition)
	let lastClick = $state<{ x: number; y: number } | null>(null);

	// Coords từ event click: onClick Button type (event?: Event | MouseEvent |
	// undefined) — nhận kiểu rộng; MouseEvent có clientX/Y, programmatically
	// click() không kèm coords → fallback tâm viewport.
	function eventCoords(e?: Event | MouseEvent): { x: number; y: number } {
		if (e instanceof MouseEvent) return { x: e.clientX, y: e.clientY };
		if (typeof window === 'undefined') return { x: 0, y: 0 };
		return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
	}

	// Toggle light ⇄ dark từ nút text (coords tự lấy từ event click)
	function handleToggleClick(e?: Event | MouseEvent) {
		const { x, y } = eventCoords(e);
		lastClick = { x, y };
		const next: AppTheme = currentTheme === 'dark' ? 'light' : 'dark';
		animateThemeTransition(next, x, y, duration);
	}

	// Đổi trực tiếp sang giá trị cụ thể (light/dark/system) — circle từ nút vừa click
	function setTheme(next: AppTheme) {
		return (e?: Event | MouseEvent) => {
			const { x, y } = eventCoords(e);
			lastClick = { x, y };
			animateThemeTransition(next, x, y, duration);
		};
	}

	// Đổi theme từ 4 góc viewport (circle lan từ tâm nút góc — demo vị trí click
	// tuỳ ý: radius tính từ tâm click tới góc xa nhất viewport)
	function cornerTheme(next: AppTheme) {
		return (e?: Event | MouseEvent) => {
			const { x, y } = eventCoords(e);
			lastClick = { x, y };
			animateThemeTransition(next, x, y, duration);
		};
	}

	// store theme (localStorage — profile.theme setter persist mỗi lần đổi;
	// đọc qua getter client.browser.theme là getter localStorage — cùng nguồn
	// localStorage, nhưng không reactive theo profile.theme → mirror qua
	// currentTheme cho đồng bộ hiển thị)
	function currentStoreTheme(): string {
		if (!browser) return 'system';
		return currentTheme;
	}

	// P2: duration animate circle (ms) — truyền vào ThemeToggle + animate
	// trực tiếp (nút text/corner). Fallback 450ms (default app.css var).
	const durations = [150, 300, 450, 600] as const;
	let duration = $state<number>(450);
</script>

<div class="page" data-test="theme-demo">
	<h1 class="page-title">Theme · toggle — animate chuyển màu lan dần từ vị trí click</h1>

	<!-- 1) ThemeToggle (Button + Icon sun/moon) — light ⇄ dark -->
	<section class="demo" data-test="th-toggle">
		<h2>ThemeToggle (light ⇄ dark)</h2>
		<div class="toggle-row">
			<ThemeToggle duration={duration} />
			<!-- data-test nằm trên wrapper (Button không render 'data-test' prop) -->
			<span data-test="theme-toggle-btn">
				<Button variant="outline" onclick={handleToggleClick}>Đổi theme (nút text)</Button>
			</span>
		</div>
		<p class="demo-hint">
			Theme hiện tại: <code data-test="theme-current">{currentTheme}</code> ·
			data-theme html: <code data-test="theme-resolved">{resolvedTheme}</code> ·
			store client.browser.theme: <code data-test="theme-store">{currentStoreTheme()}</code>
		</p>
		<p class="demo-hint">
			Click anywhere → circle lan từ tâm vị trí vừa click (View Transitions API
			+ clip-path circle). Reduced-motion → đổi tức thì.
		</p>
		<!-- P2: duration animate circle (token qua inline CSS var — pseudo
		     ::view-transition không inline style được) -->
		<div class="duration-row" data-test="th-duration-row">
			<span class="duration-label">Duration animate</span>
			<div class="duration-seg" role="group" aria-label="Chọn duration animate">
				{#each durations as d (d)}
					<button
						type="button"
						class:duration-on={duration === d}
						aria-pressed={duration === d}
						onclick={() => (duration = d)}
						data-test="th-duration-{d}"
					>
						{d}ms
					</button>
				{/each}
			</div>
			<code class="duration-current" data-test="th-duration-current">{duration}ms</code>
		</div>
	</section>

	<!-- 2) Đổi trực tiếp sang giá trị cụ thể (light / dark / system) -->
	<section class="demo" data-test="th-set">
		<h2>Đổi trực tiếp (light / dark / system)</h2>
		<div class="toggle-row">
			<!-- data-test nằm trên wrapper (Button không render 'data-test' prop) -->
			<span data-test="theme-set-light"><Button variant="soft" onclick={setTheme('light')}>Light</Button></span>
			<span data-test="theme-set-dark"><Button variant="soft" onclick={setTheme('dark')}>Dark</Button></span>
			<span data-test="theme-set-system"><Button variant="soft" onclick={setTheme('system')}>System</Button></span>
		</div>
		<p class="demo-hint">
			'system' = theo prefers-color-scheme (getter profile.theme resolve khi data-theme
			chưa set thủ công — localStorage persist giữ giá trị người dùng chọn).
		</p>
	</section>

	<!-- 3) Vị trí click tuỳ ý — 4 góc viewport -->
	<section class="demo" data-test="th-corners">
		<h2>Vị trí click tuỳ ý (4 góc viewport)</h2>
		<div class="corners-row">
			<span data-test="theme-corner-tl"><Button variant="outline" onclick={cornerTheme('dark')}>↖ Dark</Button></span>
			<span data-test="theme-corner-tr"><Button variant="outline" onclick={cornerTheme('dark')}>↗ Dark</Button></span>
			<span data-test="theme-corner-bl"><Button variant="outline" onclick={cornerTheme('light')}>↙ Light</Button></span>
			<span data-test="theme-corner-br"><Button variant="outline" onclick={cornerTheme('light')}>↘ Light</Button></span>
		</div>
		<p class="demo-hint">
			Bấm nút góc → circle lan từ tâm nút vừa bấm tới góc xa nhất viewport
			(radius = Math.hypot tới 4 góc — góc xa nhất quyết định radius max).
			Last click: <code data-test="theme-last-click">
				{lastClick ? `${Math.round(lastClick.x)}, ${Math.round(lastClick.y)}` : '—'}
			</code>
		</p>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 42rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}
	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.demo h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}
	.toggle-row,
	.corners-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}
	/* P2: điều khiển duration animate (segmented — bám p3-seg của sidebar demo) */
	.duration-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;

		.duration-label {
			font-size: 0.875rem;
			color: var(--foreground);
		}

		.duration-current {
			font-size: 0.8rem;
			color: var(--foreground);
		}
	}
	.duration-seg {
		display: inline-flex;
		border: 1px solid var(--border, hsl(0 0% 88%));
		border-radius: var(--border-radius-sm, 0.375rem);
		overflow: hidden;

		@media (prefers-color-scheme: dark) {
			border-color: var(--border, hsl(0 0% 24%));
		}

		button {
			padding: 0.25rem 0.75rem;
			font-size: 0.8125rem;
			color: var(--foreground);
			background: transparent;
			border: 0;
			cursor: pointer;
			transition: background-color var(--transition-duration, 150ms) ease;

			&:not(:first-child) {
				border-left: 1px solid var(--border, hsl(0 0% 88%));
			}

			&.duration-on {
				background: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
				color: var(--background, #fff);
			}
		}
	}
	.demo-hint {
		font-size: 0.85rem;
		color: var(--muted, var(--foreground));
		margin: 0;
	}
	.demo-hint code {
		font-size: 0.8rem;
		color: var(--foreground);
	}
</style>
