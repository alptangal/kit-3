<!-- src/routes/ui/image/+page.svelte -->
<script lang="ts">
	import { Image, Button } from '$components/element';
	import type { ImageRatio } from '$components/element';

	// ── Ảnh tự chứa (SVG data-URI) — không phụ thuộc mạng, load đồng bộ ──
	function svgDataUri(w: number, h: number, from: string, to: string, label: string): string {
		const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
			<defs>
				<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
					<stop offset='0%' stop-color='${from}'/>
					<stop offset='100%' stop-color='${to}'/>
				</linearGradient>
			</defs>
			<rect width='${w}' height='${h}' fill='url(#g)'/>
			<text x='50%' y='50%' font-family='sans-serif' font-size='${Math.round(h / 9)}'
				fill='rgba(255,255,255,0.9)' text-anchor='middle' dominant-baseline='middle'>${label}</text>
		</svg>`;
		return `data:image/svg+xml,${encodeURIComponent(svg)}`;
	}

	const imgA = svgDataUri(800, 600, '#0ea5e9', '#6366f1', 'Image A');
	const imgB = svgDataUri(800, 600, '#f59e0b', '#ef4444', 'Image B');
	const imgC = svgDataUri(800, 600, '#10b981', '#14b8a6', 'Image C');
	// src không hợp lệ → lỗi (dùng cho fallback/error)
	const badSrc = 'data:image/svg+xml,;invalid-image-404';

	// ── Crossfade demo: đổi src giữa A ⇄ B ──
	let cfSrc = $state(imgA);

	const ratios: { label: string; value: ImageRatio }[] = [
		{ label: '1:1', value: '1:1' },
		{ label: '4:3', value: '4:3' },
		{ label: '16:9', value: '16:9' },
		{ label: '21:9', value: '21:9' }
	];

	// Grid shimmer/lazy: mỗi ô 1 data-URI khác nhau
	const gridImages = [
		svgDataUri(400, 300, '#8b5cf6', '#ec4899', '01'),
		svgDataUri(400, 300, '#06b6d4', '#3b82f6', '02'),
		svgDataUri(400, 300, '#f97316', '#dc2626', '03'),
		svgDataUri(400, 300, '#22c55e', '#15803d', '04'),
		svgDataUri(400, 300, '#eab308', '#a16207', '05'),
		svgDataUri(400, 300, '#64748b', '#334155', '06')
	];
</script>

<div class="page" data-test="image-demo">
	<h1 class="page-title">Image component</h1>

	<!-- 1. Basic + ratio (CLS lock qua aspect-ratio) -->
	<section class="demo">
		<h2>Basic · ratio · aspect-ratio</h2>
		<div class="demo-grid">
			<figure class="cell">
				<Image src={imgA} alt="Sample" ratio="1:1" width={160} />
				<figcaption>1:1</figcaption>
			</figure>
			<figure class="cell">
				<Image src={imgB} alt="Sample" ratio="4:3" width={160} />
				<figcaption>4:3</figcaption>
			</figure>
			<figure class="cell">
				<Image src={imgC} alt="Sample" ratio="16:9" width={200} />
				<figcaption>16:9</figcaption>
			</figure>
			<figure class="cell">
				<Image src={imgA} alt="Sample" ratio="21:9" width={240} />
				<figcaption>21:9</figcaption>
			</figure>
		</div>
	</section>

	<!-- 2. object-fit / object-position / rounded -->
	<section class="demo">
		<h2>object-fit · object-position · rounded</h2>
		<div class="demo-grid">
			<figure class="cell">
				<Image src={imgA} alt="cover" objectFit="cover" width={160} height={120} />
				<figcaption>cover</figcaption>
			</figure>
			<figure class="cell">
				<Image src={imgA} alt="contain" objectFit="contain" width={160} height={120} rounded="sm" />
				<figcaption>contain</figcaption>
			</figure>
			<figure class="cell">
				<Image src={imgA} alt="top-left" objectPosition="top left" rounded="lg" width={160} height={120} />
				<figcaption>pos: top left</figcaption>
			</figure>
			<figure class="cell">
				<Image src={imgA} alt="round" ratio="1:1" rounded="full" width={120} />
				<figcaption>rounded full</figcaption>
			</figure>
		</div>
	</section>

	<!-- 3. Crossfade (blur-up khi đổi src) -->
	<section class="demo">
		<h2>Crossfade · blur-up khi đổi src</h2>
		<div class="demo-row">
			<div data-test="crossfade-img">
				<Image src={cfSrc} alt="Crossfade" width={320} ratio="16:9" />
			</div>
			<Button
				variant="outline"
				color="info"
				data-test="crossfade-toggle"
				onClick={() => (cfSrc = cfSrc === imgA ? imgB : imgA)}
			>
				Đổi src
			</Button>
		</div>
		<p class="demo-hint">Bấm "Đổi src" → ảnh cũ giữ mờ ở nền, ảnh mới fade lên (giữ ~450ms).</p>
	</section>

	<!-- 4. Fallback / error -->
	<section class="demo">
		<h2>Error · fallback</h2>
		<div class="demo-row">
			<figure class="cell">
				<div data-test="fallback-img">
					<Image src={badSrc} alt="Fallback" fallback={imgC} width={160} height={120} lazy={false} />
				</div>
				<figcaption>src lỗi → fallback</figcaption>
			</figure>
			<figure class="cell">
				<div data-test="error-img">
					<Image src={badSrc} alt="Error" width={160} height={120} lazy={false} />
				</div>
				<figcaption>src lỗi, không fallback</figcaption>
			</figure>
		</div>
	</section>

	<!-- 5. Shimmer / lazy grid (scroll) -->
	<section class="demo">
		<h2>Shimmer · lazy load (grid)</h2>
		<div class="shimmer-grid">
			{#each gridImages as src, i}
				<div data-test="shimmer-img-{i}">
					<Image src={src} alt={`Tile ${i + 1}`} ratio="4:3" />
				</div>
			{/each}
		</div>
	</section>

	<!-- 6. Hover zoom (PC) -->
	<section class="demo">
		<h2>Hover zoom (chỉ thiết bị có con trỏ)</h2>
		<figure class="cell">
			<div data-test="zoom-img">
				<Image src={imgA} alt="Zoom" width={320} ratio="16:9" zoom />
			</div>
			<figcaption>Di chuột lên ảnh (PC)</figcaption>
		</figure>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		color: var(--foreground);
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
	}
	.demo {
		margin-bottom: 2.5rem;
		h2 {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
			opacity: 0.8;
		}
	}
	.demo-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-start;
	}
	.demo-row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	.demo-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		opacity: 0.6;
	}
	.cell {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.cell figcaption {
		font-size: 0.75rem;
		opacity: 0.6;
	}
	.shimmer-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		@media (max-width: 520px) {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
