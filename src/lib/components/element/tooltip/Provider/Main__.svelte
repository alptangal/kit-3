<script>
	import { onDestroy } from 'svelte';

	// Props
	export let title = '';
	export let body = '';
	export let gap = 10; // khoảng cách từ border element đến tooltip
	export let maxWidth = 230;

	const ARROW = 10;
	const AH = ARROW / 2;
	const ARROW_MARGIN = 6; // arrow cách mép tooltip tối thiểu

	let visible = false;
	let tx = 0;
	let ty = 0;
	let placement = 'bottom'; // top | bottom | left | right
	let arrowOffset = 0; // vị trí arrow dọc theo cạnh tooltip (px)

	let tooltipEl;
	let targetEl = null;

	function getSide(mx, my, rect) {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const bw = tooltipEl?.offsetWidth ?? maxWidth;
		const bh = tooltipEl?.offsetHeight ?? 80;

		const sides = [
			{ id: 'top', dist: my - rect.top, fits: rect.top - GAP >= bh },
			{ id: 'bottom', dist: rect.bottom - my, fits: vh - rect.bottom - GAP >= bh },
			{ id: 'left', dist: mx - rect.left, fits: rect.left - GAP >= bw },
			{ id: 'right', dist: rect.right - mx, fits: vw - rect.right - GAP >= bw }
		];

		sides.sort((a, b) => a.dist - b.dist);
		return (sides.find((s) => s.fits) ?? sides[0]).id;
	}

	const GAP = gap;

	export function show(event, el) {
		targetEl = el;
		title = el.dataset.ttTitle ?? title;
		body = el.dataset.ttBody ?? body;
		visible = true;
		requestAnimationFrame(() => update(event.clientX, event.clientY));
	}

	export function move(mx, my) {
		if (!targetEl || !visible) return;
		update(mx, my);
	}

	export function hide() {
		visible = false;
		targetEl = null;
	}

	function update(mx, my) {
		if (!tooltipEl || !targetEl) return;
		const rect = targetEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const bw = tooltipEl.offsetWidth;
		const bh = tooltipEl.offsetHeight;

		placement = getSide(mx, my, rect);

		if (placement === 'top') {
			tx = mx - bw * ((mx - rect.left) / rect.width);
			tx = Math.max(8, Math.min(tx, vw - bw - 8));
			ty = rect.top - bh - GAP;
			arrowOffset = Math.max(ARROW_MARGIN, Math.min(mx - tx - AH, bw - ARROW - ARROW_MARGIN));
		} else if (placement === 'bottom') {
			tx = mx - bw * ((mx - rect.left) / rect.width);
			tx = Math.max(8, Math.min(tx, vw - bw - 8));
			ty = rect.bottom + GAP;
			arrowOffset = Math.max(ARROW_MARGIN, Math.min(mx - tx - AH, bw - ARROW - ARROW_MARGIN));
		} else if (placement === 'left') {
			tx = rect.left - bw - GAP;
			ty = my - bh * ((my - rect.top) / rect.height);
			ty = Math.max(8, Math.min(ty, vh - bh - 8));
			arrowOffset = Math.max(ARROW_MARGIN, Math.min(my - ty - AH, bh - ARROW - ARROW_MARGIN));
		} else {
			tx = rect.right + GAP;
			ty = my - bh * ((my - rect.top) / rect.height);
			ty = Math.max(8, Math.min(ty, vh - bh - 8));
			arrowOffset = Math.max(ARROW_MARGIN, Math.min(my - ty - AH, bh - ARROW - ARROW_MARGIN));
		}
	}
</script>

{#if visible}
	<div
		class="tt"
		bind:this={tooltipEl}
		style="left:{tx}px; top:{ty}px; max-width:{maxWidth}px;"
		role="tooltip"
	>
		<!-- Arrow -->
		<div
			class="tt-arrow"
			class:arrow-top={placement === 'bottom'}
			class:arrow-bottom={placement === 'top'}
			class:arrow-left={placement === 'right'}
			class:arrow-right={placement === 'left'}
			style={placement === 'top' || placement === 'bottom'
				? `left:${arrowOffset}px`
				: `top:${arrowOffset}px`}
		></div>

		{#if title}
			<p class="tt-title">{title}</p>
		{/if}
		{#if body}
			<p class="tt-body">{body}</p>
		{/if}

		<!-- Slot cho nội dung tùy chỉnh -->
		<slot />
	</div>
{/if}

<style>
	.tt {
		position: fixed;
		z-index: 9999;
		pointer-events: none;
		min-width: 130px;
		animation: tt-fade 0.12s ease;
	}

	@keyframes tt-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.tt-title {
		font-weight: 500;
		font-size: 13px;
		margin: 0 0 2px;
		color: #111;
	}

	.tt-body {
		font-size: 12px;
		color: #555;
		line-height: 1.5;
		margin: 0;
	}

	/* Box */
	.tt {
		background: #fff;
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 8px;
		padding: 8px 12px;
	}

	/* Arrow base */
	.tt-arrow {
		position: absolute;
		width: 10px;
		height: 10px;
		background: #fff;
		transform: rotate(45deg);
	}

	/* Arrow - tooltip ở dưới, arrow trỏ lên (ở đỉnh tooltip) */
	.arrow-top {
		top: -5px;
		border-top: 1px solid rgba(0, 0, 0, 0.12);
		border-left: 1px solid rgba(0, 0, 0, 0.12);
	}

	/* Arrow - tooltip ở trên, arrow trỏ xuống (ở đáy tooltip) */
	.arrow-bottom {
		bottom: -5px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.12);
		border-right: 1px solid rgba(0, 0, 0, 0.12);
	}

	/* Arrow - tooltip ở phải, arrow trỏ sang trái (ở cạnh trái tooltip) */
	.arrow-left {
		left: -5px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.12);
		border-left: 1px solid rgba(0, 0, 0, 0.12);
	}

	/* Arrow - tooltip ở trái, arrow trỏ sang phải (ở cạnh phải tooltip) */
	.arrow-right {
		right: -5px;
		border-top: 1px solid rgba(0, 0, 0, 0.12);
		border-right: 1px solid rgba(0, 0, 0, 0.12);
	}
</style>
