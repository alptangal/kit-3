<!-- src/routes/ui/tooltip/+page.svelte -->
<script lang="ts">
	// Demo Tooltip — hover hiện tooltip + state disabled + ma trận size/color/variant
	// theo hệ thống chung. Cursor: trigger mọc = pointer (button); root disabled =
	// not-allowed (display:contents → cursor inherit).
	import { Tooltip } from '$components/element';

	// Hệ thống chung (DESIGN_SYSTEM): size 2xs→9xl, color 7 giá trị, variant 4.
	const SIZES = [
		'2xs',
		'xs',
		'sm',
		'md',
		'lg',
		'xl',
		'2xl',
		'3xl',
		'4xl',
		'5xl',
		'6xl',
		'7xl',
		'8xl',
		'9xl'
	] as const;
	const COLORS = ['default', 'secondary', 'success', 'info', 'warning', 'error', 'primary'] as const;
	const VARIANTS = ['solid', 'outline', 'soft', 'ghost'] as const;
</script>

<div class="page" data-test="tooltip-demo">
	<h1 class="page-title">Tooltip · thông báo hover</h1>
	<p class="page-desc">
		Hover trigger → hiện tooltip sau delay (mặc định ~300ms). Trigger = control user
		(button/input...); <code>disabled</code> tắt hoàn toàn events (không hiện tooltip).
	</p>

	<section class="demo" data-test="tp-enabled">
		<h2>Enabled (hover)</h2>
		<p class="demo-hint">Hover trigger → tooltip hiện sau ~300ms.</p>
		<Tooltip data-test="tp-enabled-wrap">
			<button class="demo-btn" data-test="tp-enabled-trigger">
				Hover để xem tooltip
			</button>
			<Tooltip.Content class="p-2">
				<Tooltip.Arrow />
				Tooltip enabled — hover 300ms để hiện.
			</Tooltip.Content>
		</Tooltip>
	</section>

	<section class="demo" data-test="tp-disabled">
		<h2>Disabled (không hiện + cursor not-allowed)</h2>
		<p class="demo-hint">
			<code>disabled</code> → tooltip không mount events; root class <code>disabled</code>
			→ <code>cursor: not-allowed</code> (inherit qua display:contents).
		</p>
		<Tooltip disabled data-test="tp-disabled-wrap">
			<button class="demo-btn" data-test="tp-disabled-trigger">
				Disabled trigger
			</button>
			<Tooltip.Content class="p-2">
				<Tooltip.Arrow />
				Tooltip disabled — không bao giờ hiện.
			</Tooltip.Content>
		</Tooltip>
	</section>

	<section class="demo" data-test="tp-size">
		<h2>Size (2xs → 9xl)</h2>
		<p class="demo-hint">
			Kích thước cascade: <code>props.size</code> → root → content; cả trigger lẫn tooltip
			đổi cùng bậc size.
		</p>
		<div class="grid">
			{#each SIZES as s (s)}
				<Tooltip size={s} data-test={`tp-size-${s}`}>
					<button class="demo-btn" data-test={`tp-size-${s}-trigger`}>{s}</button>
					<Tooltip.Content>
						<Tooltip.Arrow />
						Tooltip size {s}
					</Tooltip.Content>
				</Tooltip>
			{/each}
		</div>
	</section>

	<section class="demo" data-test="tp-color">
		<h2>Color (7 giá trị hệ thống)</h2>
		<p class="demo-hint">
			7 màu hệ thống (raw palette — không đảo theo theme, giống Button). Class
			<code>color-*</code> + <code>variant-*</code> resolve qua ma trận _styles.scss.
		</p>
		<div class="grid">
			{#each COLORS as c (c)}
				<Tooltip color={c} data-test={`tp-color-${c}`}>
					<button class="demo-btn" data-test={`tp-color-${c}-trigger`}>{c}</button>
					<Tooltip.Content>
						<Tooltip.Arrow />
						Tooltip color {c}
					</Tooltip.Content>
				</Tooltip>
			{/each}
		</div>
	</section>

	<section class="demo" data-test="tp-variant">
		<h2>Variant (4 kiểu bề mặt)</h2>
		<p class="demo-hint">
			4 variant (solid/outline/soft/ghost) × color info — nền/border/arrow đổi theo
			ma trận; arrow ĐỒNG MÀU nền (không lộ "gãy" giữa content và mũi tên).
		</p>
		<div class="grid">
			{#each VARIANTS as v (v)}
				<Tooltip variant={v} data-test={`tp-variant-${v}`}>
					<button class="demo-btn" data-test={`tp-variant-${v}-trigger`}>{v}</button>
					<Tooltip.Content>
						<Tooltip.Arrow />
						Tooltip variant {v}
					</Tooltip.Content>
				</Tooltip>
			{/each}
		</div>
	</section>

	<section class="demo" data-test="tp-follow">
		<h2>Follow (bám theo chuột)</h2>
		<p class="demo-hint">
			<code>follow</code> → anchor cập nhật theo mousemove (rAF throttle) — tooltip
			và arrow bám vị trí chuột hiện tại. Không follow → neo tại điểm vào hover.
		</p>
		<div class="grid">
			<Tooltip follow data-test="tp-follow-on">
				<button class="demo-btn" data-test="tp-follow-trigger">
					follow=true (bám chuột)
				</button>
				<Tooltip.Content>
					<Tooltip.Arrow />
					Tooltip follow — bám theo chuột (rAF).
				</Tooltip.Content>
			</Tooltip>
			<Tooltip data-test="tp-follow-off">
				<button class="demo-btn" data-test="tp-nofollow-trigger">
					follow=false (neo điểm vào)
				</button>
				<Tooltip.Content>
					<Tooltip.Arrow />
					Tooltip neo — đứng tại điểm vào hover.
				</Tooltip.Content>
			</Tooltip>
		</div>
	</section>

	<section class="demo" data-test="tp-animate">
		<h2>Animate (fade / scale / slide)</h2>
		<p class="demo-hint">
			3 kiểu transition: <code>fade</code> (mặc định, chỉ opacity), <code>scale</code>
			(opacity + scale 0.95), <code>slide</code> (opacity + dịch 4px theo hướng
			position). Content + arrow fade in CÙNG frame.
		</p>
		<div class="grid">
			<Tooltip animate="scale" data-test="tp-animate-scale">
				<button class="demo-btn" data-test="tp-animate-scale-trigger">
					animate=scale
				</button>
				<Tooltip.Content>
					<Tooltip.Arrow />
					Tooltip animate scale — opacity + scale.
				</Tooltip.Content>
			</Tooltip>
			<Tooltip animate="slide" data-test="tp-animate-slide">
				<button class="demo-btn" data-test="tp-animate-slide-trigger">
					animate=slide
				</button>
				<Tooltip.Content>
					<Tooltip.Arrow />
					Tooltip animate slide — trượt từ hướng position.
				</Tooltip.Content>
			</Tooltip>
		</div>
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
		font-size: 1.375rem;
		font-weight: 700;
		margin: 0;
	}

	.page-desc {
		font-size: 0.9rem;
		color: var(--muted, var(--foreground));
		margin: 0;
	}

	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		h2 {
			font-size: 1rem;
			font-weight: 600;
			margin: 0;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0;
	}

	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.demo-btn {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 0.875rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		color: var(--foreground);
		background: var(--content2, hsl(240 4.8% 96%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.375rem;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}
	}

	@media (prefers-color-scheme: dark) {
		.demo-btn {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
