<script lang="ts">
	import type { DistanceUnits } from '$components/interface';
	import { convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { getTooltipCtx } from '..';
	import type { TooltipArrowConfigs, TooltipArrowProps } from '../_interface';

	let { ...props }: TooltipArrowProps = $props();
	const tooltipCtx = getTooltipCtx();
	let configs: TooltipArrowConfigs = $state({
		get size() {
			return props.size ?? tooltipCtx?.contentMeta?.size ?? tooltipCtx?.size ?? 'md';
		},
		get color() {
			// Bề mặt màu theo root (Color + variant) — ĐỒNG BỘ với tooltip-content qua
			// cùng ma trận _styles.scss (--arrow-color). Tự đặt màu riêng vẫn được.
			return props.color ?? tooltipCtx?.color ?? 'info';
		},
		get variant() {
			return props.variant ?? tooltipCtx?.variant ?? 'solid';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'tooltip-arrow',
				`color-${this.color}`,
				`variant-${this.variant}`,
				`size-${this.size}`,
				tooltipCtx?.contentMeta?.position
					? `position-${tooltipCtx.contentMeta.position}`
					: undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		event: [
			{
				events: {
					load(e, data) {
						if (data?.node instanceof HTMLElement && tooltipCtx?.updateArrowMeta) {
							tooltipCtx.updateArrowMeta({
								get size() {
									return configs.size;
								},
								ref: data.node
							});
							// appendChild: @types/node override Body.append đè ParentNode.append
							document.body.appendChild(data.node);
							return () => {
								if (data.node instanceof HTMLElement) data.node.remove();
							};
						}
					}
				}
			}
		]
	});

	$effect(() => {
		const contentRef = tooltipCtx?.contentMeta?.ref;
		const targetRef = tooltipCtx?.ref;
		const arrowRef = configs.ref;
		// ARROW SYNC — cùng nguồn dữ liệu với content (anchor):
		//  1. anchor = điểm mouse LÚC BẮT ĐẦU hover (không đổi theo mousemove →
		//     arrow không còn "chạy theo chuột" trong khi content đứng yên);
		//  2. clamp vào rect CUỐI CÙNG của content (đã clamp theo viewport);
		//  3. contentVersion tăng mỗi lần content reposition → effect re-sync,
		//     arrow luôn bám rect mới (không lộ ra ngoài khung content).
		const anchor = tooltipCtx?.status?.anchor ?? tooltipCtx?.status?.mousePosition;
		const position = tooltipCtx?.contentMeta?.position;
		const version = tooltipCtx?.contentVersion;
		// IS-SHOWN: arrow chỉ hiện KHI content đã định vị (bump version > 0) —
		// cùng frame fade in với content (fix arrow hiện TRƯỚC content panel).
		const versionSeen = version ?? 0;
		if (
			!position ||
			version === undefined ||
			!(contentRef instanceof HTMLElement) ||
			!(targetRef instanceof HTMLElement) ||
			!(arrowRef instanceof HTMLElement) ||
			!anchor
		)
			return;
		// Content đã chờ delay rồi mới định vị + bump version → arrow áp NGAY
		// (không chờ thêm) để mũi tên xuất hiện CÙNG lúc content.
		if (!contentRef.isConnected || !arrowRef.isConnected || !targetRef.isConnected) return;
		const contentRect = contentRef.getBoundingClientRect();
		const targetRect = targetRef.getBoundingClientRect();
		let arrowSize: undefined | number = 0;
		if (tooltipCtx?.arrowMeta?.ref)
			arrowSize =
				(convertToPixels(
					getComputedStyle(tooltipCtx.arrowMeta.ref).getPropertyValue('--size') as DistanceUnits
				) ?? 0) / 2;

		for (const clss of [...arrowRef.classList])
			if (clss.includes('position')) arrowRef.classList.remove(clss);
		const gap = tooltipCtx?.contentMeta?.offset ?? 0;
		const cl = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
		// Điểm neo đã clamp vào khung content (chừa nửa mũi tên mỗi mép).
		const ax = cl(anchor.x, contentRect.left + arrowSize, contentRect.right - arrowSize);
		const ay = cl(anchor.y, contentRect.top + arrowSize, contentRect.bottom - arrowSize);
		switch (position) {
			case 'top':
				arrowRef.style.left = `${ax - arrowSize / 2}px`;
				arrowRef.style.top = `${targetRect.top - gap - arrowSize}px`;
				if (anchor.x < contentRect.left + gap) arrowRef.classList.add('position-top-left');
				else if (anchor.x > contentRect.right - gap) arrowRef.classList.add('position-top-right');
				else arrowRef.classList.add('position-top');
				break;
			case 'bottom':
				arrowRef.style.left = `${ax - arrowSize / 2}px`;
				arrowRef.style.top = `${targetRect.bottom + gap}px`;
				if (anchor.x < contentRect.left + gap) arrowRef.classList.add('position-bottom-left');
				else if (anchor.x > contentRect.right - gap)
					arrowRef.classList.add('position-bottom-right');
				else arrowRef.classList.add('position-bottom');
				break;
			case 'left':
				arrowRef.style.top = `${ay - arrowSize / 2}px`;
				arrowRef.style.left = `${targetRect.left - gap - arrowSize}px`;
				if (anchor.y < contentRect.top + gap) arrowRef.classList.add('position-left-top');
				else if (anchor.y > contentRect.bottom - gap)
					arrowRef.classList.add('position-left-bottom');
				else arrowRef.classList.add('position-left');
				break;
			case 'right':
				arrowRef.style.top = `${ay - arrowSize / 2}px`;
				arrowRef.style.left = `${targetRect.right + gap}px`;
				if (anchor.y < contentRect.top + gap) arrowRef.classList.add('position-right-top');
				else if (anchor.y > contentRect.bottom - gap)
					arrowRef.classList.add('position-right-bottom');
				else arrowRef.classList.add('position-right');
				break;
		}
		// is-shown đặt SAU khi set left/top — arrow fade in cùng frame content.
		if (versionSeen > 0) arrowRef.classList.add('is-shown');
		else arrowRef.classList.remove('is-shown');
	});
</script>

{#if tooltipCtx?.status?.hover && tooltipCtx?.contentMeta?.position}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		{@attach handleEvents(configs.event)}
	></svelte:element>
{/if}

<style lang="scss">
	/* Ma trận màu (variant × color → --arrow-color) dùng CHUNG với tooltip-content
	   (_styles.scss, khai báo :global) — @use để arrow element (portal vào body)
	   ăn đúng class variant + color như content. */
	@use '../_styles.scss';
	.tooltip-arrow {
		&.size-2xs {
			--size: var(--font-size-2xs);
		}
		&.size-xs {
			--size: var(--font-size-xs);
		}
		&.size-sm {
			--size: var(--font-size-sm);
		}
		&.size-md {
			--size: var(--font-size-md);
		}
		&.size-lg {
			--size: var(--font-size-lg);
		}
		&.size-xl {
			--size: var(--font-size-xl);
		}
		&.size-2xl {
			--size: var(--font-size-2xl);
		}
		&.size-3xl {
			--size: var(--font-size-3xl);
		}
		&.size-4xl {
			--size: var(--font-size-4xl);
		}
		&.size-5xl {
			--size: var(--font-size-5xl);
		}
		&.size-6xl {
			--size: var(--font-size-6xl);
		}
		&.size-7xl {
			--size: var(--font-size-7xl);
		}
		&.size-8xl {
			--size: var(--font-size-8xl);
		}
		&.size-9xl {
			--size: var(--font-size-9xl);
		}
		/* Màu mũi tên qua --arrow-color (ma trận _styles.scss) — KHÔNG dùng --color
		   (semantic map colors.scss) để variant/color tự resolve theo root. */
		&.position-top {
			top: 100%;
			border-top: calc(var(--size) / 2) solid var(--arrow-color);
			border-left: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-right: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
		}
		&.position-top-left {
			top: 100%;
			left: 0px;
			border-top: calc(var(--size) / 2) solid var(--arrow-color);
			border-right: calc((var(--size)) / 2) solid transparent;
		}
		&.position-top-right {
			top: 100%;
			right: 0px;
			border-top: calc(var(--size) / 2) solid var(--arrow-color);
			border-left: calc((var(--size)) / 2) solid transparent;
		}
		&.position-bottom {
			bottom: 100%;
			border-bottom: calc(var(--size) / 2) solid var(--arrow-color);
			border-left: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-right: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
		}
		&.position-bottom-left {
			bottom: 100%;
			left: 0px;
			border-bottom: calc(var(--size) / 2) solid var(--arrow-color);
			border-right: calc((var(--size)) / 2) solid transparent;
		}
		&.position-bottom-right {
			bottom: 100%;
			right: 0px;
			border-bottom: calc(var(--size) / 2) solid var(--arrow-color);
			border-left: calc((var(--size)) / 2) solid transparent;
		}
		&.position-left {
			left: 100%;
			border-left: calc(var(--size) / 2) solid var(--arrow-color);
			border-top: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-bottom: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
		}
		&.position-left-top {
			left: 100%;
			top: 0px;
			border-left: calc(var(--size) / 2) solid var(--arrow-color);
			border-bottom: calc((var(--size)) / 2) solid transparent;
		}
		&.position-left-bottom {
			bottom: 100%;
			right: 0px;
			border-left: calc(var(--size) / 2) solid var(--arrow-color);
			border-top: calc((var(--size)) / 2) solid transparent;
		}
		&.position-right {
			right: 100%;
			border-right: calc(var(--size) / 2) solid var(--arrow-color);
			border-top: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-bottom: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-left: 0 solid transparent;
		}
		&.position-right-top {
			right: 100%;
			top: 0%;
			border-right: calc(var(--size) / 2) solid var(--arrow-color);
			border-bottom: calc((var(--size)) / 2) solid transparent;
			border-top: 0 solid transparent;
			border-left: 0 solid transparent;
		}
		&.position-right-bottom {
			right: 100%;
			bottom: 0%;
			border-right: calc(var(--size) / 2) solid var(--arrow-color);
			border-top: calc((var(--size)) / 2) solid transparent;
			border-bottom: 0 solid transparent;
			border-left: 0 solid transparent;
		}
		width: 0px;
		height: 0px;
		position: fixed;
		/* Chỉ mượt opacity — left/top áp tức thì: arrow KHÔNG trượt lệch khi content
		   reposition (transition all làm "arrow chạy" chậm hơn content). */
		transition: opacity ease-in-out 0.2s;

		/* Reduced motion: bỏ transition — LỒNG sau transition (không đặt @media
		   trong _styles.scss bị @use TRƯỚC — cùng specificity, rule sau thắng). */
		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}
</style>
