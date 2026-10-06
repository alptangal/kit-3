<script lang="ts">
	import type { DistanceUnits, EventListener } from '$components/interface';
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { keys, pickBy } from 'es-toolkit/compat';
	import { getTooltipCtx } from '..';
	import type { TooltipContentConfigs, TooltipContentProps } from '../_interface';
	import { getMetaSide } from '.';

	const OFFSET = 10;
	let { children, disabled = $bindable(), ...props }: TooltipContentProps = $props();
	let configs: TooltipContentConfigs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'tooltip-content',
				`size-${this.size}`,
				`color-${this.color}`,
				`variant-${this.variant}`,
				`rounded-${this.rounded}`
			];
			return styleSynced(
				{
					defaultStyles,
					propStyles: props.class
				},
				props.overwriteDefaultStyles
			);
		},
		previousPosition: undefined,
		get size() {
			return props.size ?? tooltipCtx?.size ?? client.browser?.size ?? 'md';
		},
		// Bề mặt màu theo hệ thống chung (Color + variant) — class `color-*`/`variant-*`
		// resolve qua ma trận trong _styles.scss (khai báo :global vì render vào body).
		get color() {
			return props.color ?? tooltipCtx?.color ?? 'info';
		},
		get variant() {
			return props.variant ?? tooltipCtx?.variant ?? 'solid';
		},
		get delay() {
			return convertToMiliseconds(props.delay) ?? tooltipCtx?.delay ?? client.browser?.delay ?? 300;
		},
		get offset() {
			return convertToPixels(props.offset) ?? tooltipCtx?.offset ?? OFFSET;
		},
		get rounded() {
			return props.rounded ?? tooltipCtx?.rounded ?? this.size;
		},
		position: undefined,
		get event() {
			const defaultEvents: EventListener = {
				load(e, data) {
					if (tooltipCtx?.updateContentMeta && data?.node instanceof HTMLElement) {
						tooltipCtx.updateContentMeta({
							get size() {
								return configs.size;
							},
							ref: data.node,
							get position() {
								return configs.position;
							},
							get offset() {
								return configs.offset;
							}
						});
					}
					// Điểm neo: ưu tiên anchor (chốt lúc đầu hover — ỔN ĐỊNH, không đổi
					// theo mousemove), fallback mousePosition (trường hợp không có anchor,
					// vd mobile actionButton).
					const anchor = tooltipCtx?.status?.anchor ?? tooltipCtx?.status?.mousePosition;
					if (
						data?.node instanceof HTMLElement &&
						tooltipCtx?.ref &&
						anchor?.x &&
						anchor?.y
					) {
						document.body.appendChild(data.node);
						setPositionTooltip(tooltipCtx.ref, data.node, anchor);
						const mutationObs = new MutationObserver(() => {
							if (
								data?.node instanceof HTMLElement &&
								tooltipCtx?.ref &&
								anchor?.x
							)
								setPositionTooltip(tooltipCtx.ref, data.node, anchor);
						});
						const resizeObs = new ResizeObserver(() => {
							if (
								data?.node instanceof HTMLElement &&
								tooltipCtx?.ref &&
								anchor?.x
							)
								setPositionTooltip(tooltipCtx.ref, data.node, anchor);
						});
						mutationObs.observe(data.node, { childList: true, subtree: true });
						resizeObs.observe(data.node);
						return () => {
							mutationObs.disconnect();
							resizeObs.disconnect();
							if (data.node instanceof HTMLElement) data.node.remove();
						};
					}
				}
			};
			return [{ events: defaultEvents }, ...(props.events ?? [])];
		}
	});
	const tooltipCtx = getTooltipCtx();

	function setPositionTooltip(
		targetRef: HTMLElement | Element,
		contentRef: HTMLElement,
		mousePosition: { x: number; y: number }
	) {
		if (!configs.timeId) configs.timeId = new Map();
		const name = 'animation-show-content';
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		configs.timeId.set(
			name,
			setTimeout(async () => {
				// contentRef.style.width = '';
				// contentRef.style.maxWidth = '';
				// contentRef.style.maxHeight = '';
				// contentRef.style.top = '';
				// contentRef.style.left = '';
				// contentRef.style.right = '';
				// contentRef.style.bottom = '';
				const targetRect = targetRef.getBoundingClientRect();
				const contentRect = contentRef.getBoundingClientRect();
				let arrowSize: undefined | number = 0;
				if (tooltipCtx?.arrowMeta?.ref)
					arrowSize =
						(convertToPixels(
							getComputedStyle(tooltipCtx.arrowMeta.ref).getPropertyValue('--size') as DistanceUnits
						) ?? 0) / 2;

				const meta = getMetaSide(
					targetRef,
					contentRef,
					tooltipCtx?.arrowMeta?.ref,
					configs.offset,
					OFFSET,
					mousePosition
				);
				const finalPosition = (
					!keys(pickBy(meta, (value) => value.ready)).length
						? Object.entries(meta).sort(
								([, value], [, value1]) => value1.acreage - value.acreage
							)[0][0]
						: Object.entries(pickBy(meta, (value) => value.ready)).sort(
								([, val], [, val1]) => val.mousePositionToSide - val1.mousePositionToSide
							)[0][0]
				) as 'top' | 'bottom' | 'left' | 'right';
				configs.position = finalPosition;
				if (!keys(pickBy(meta, (value) => value.ready)).length)
					contentRef.style.width = `${contentRef.offsetWidth}px`;
				switch (finalPosition) {
					case 'top':
						contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - OFFSET * 2}px`;
						contentRef.style.maxHeight = `${targetRect.top - arrowSize - configs.offset - OFFSET}px`;
						contentRef.style.top = `${targetRect.top - arrowSize - contentRect.height - configs.offset}px`;
						if (contentRef.offsetWidth > targetRect.width) {
							if (contentRef.offsetWidth < (client.browser?.width ?? 0) - OFFSET * 2) {
								contentRef.style.left = `${targetRect.left + targetRect.width / 2 - contentRef.offsetWidth / 2}px`;
							} else {
								contentRef.style.left = `${OFFSET}px`;
							}
						} else {
							contentRef.style.left = `${Math.max(targetRect.left, Math.min(mousePosition.x - contentRef.offsetWidth / 2, targetRect.right - contentRef.offsetWidth))}px`;
						}

						break;
					case 'bottom':
						contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - OFFSET * 2}px`;
						contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - targetRect.bottom - configs.offset - arrowSize - OFFSET}px`;
						contentRef.style.top = `${targetRect.bottom + arrowSize + configs.offset}px`;
						if (contentRef.offsetWidth > targetRect.width) {
							if (contentRef.offsetWidth < (client.browser?.width ?? 0) - OFFSET * 2) {
								contentRef.style.left = `${targetRect.left + targetRect.width / 2 - contentRef.offsetWidth / 2}px`;
							} else {
								contentRef.style.left = `${OFFSET}px`;
							}
						} else {
							contentRef.style.left = `${Math.max(targetRect.left, Math.min(mousePosition.x - contentRef.offsetWidth / 2, targetRect.right - contentRef.offsetWidth))}px`;
						}
						break;
					case 'left':
						contentRef.style.maxWidth = `${targetRect.left - arrowSize - OFFSET}px`;
						contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - OFFSET * 2}px`;
						contentRef.style.left = `${Math.max(
							OFFSET,
							targetRect.left - contentRect.width - arrowSize - configs.offset
						)}px`;
						if (contentRef.offsetHeight > targetRect.height) {
							if (contentRef.offsetHeight < (client.browser?.height ?? 0) - OFFSET * 2) {
								contentRef.style.top = `${targetRect.top + targetRect.height / 2 - contentRef.offsetHeight / 2}px`;
							} else {
								contentRef.style.top = `${OFFSET}px`;
							}
						} else {
							contentRef.style.top = `${Math.max(targetRect.top, Math.min(mousePosition.y - contentRef.offsetHeight / 2, targetRect.bottom - contentRef.offsetHeight))}px`;
						}
						break;
					case 'right':
						contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - targetRect.right - arrowSize - OFFSET}px`;
						contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - OFFSET * 2}px`;
						contentRef.style.left = `${Math.min(
							(client.browser?.width ?? 0) - contentRef.offsetWidth - OFFSET,
							targetRect.right + arrowSize + configs.offset
						)}px`;
						if (contentRef.offsetHeight > targetRect.height) {
							if (contentRef.offsetHeight < (client.browser?.height ?? 0) - OFFSET * 2) {
								contentRef.style.top = `${targetRect.top + targetRect.height / 2 - contentRef.offsetHeight / 2}px`;
							} else {
								contentRef.style.top = `${OFFSET}px`;
							}
						} else {
							contentRef.style.top = `${Math.max(targetRect.top, Math.min(mousePosition.y - contentRef.offsetHeight / 2, targetRect.bottom - contentRef.offsetHeight))}px`;
						}
						break;
				}
				// ARROW SYNC: content đã định vị (có thể clamp) → bump version để arrow
				// đọc rect CUỐI CÙNG của content và bám theo (không lệch ra ngoài khung).
				tooltipCtx?.bumpContentVersion?.();
			}, configs.delay)
		);
	}
</script>

{#if tooltipCtx?.status?.hover}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		{@attach handleEvents(configs.event)}
	>
		{@render children?.()}
	</svelte:element>
{/if}

<style lang="scss">
	@use '$styles/sizes.scss';
	/* Ma trận màu (variant × color → --background/--color/--border-color) dùng
	   CHUNG với tooltip-arrow (_styles.scss, khai báo :global) — @use để content
	   element (portal vào body) ăn đúng class variant và color. */
	@use '../_styles.scss';
	.tooltip-content {
		overflow: auto;
		pointer-events: none;
		background: var(--background);
		color: var(--color);
		/* Variant outline: border ăn màu palette (từ ma trận) — variant khác
		   resolve --border-color: transparent nên không lộ viền. */
		border: 1px solid var(--border-color, transparent);
		width: fit-content;
		height: fit-content;
		padding-inline: var(--padding);
		padding-block: 0.25em;
		border-radius: var(--border-radius);
		/* Elevation nhẹ — đồng bộ popup/tooltip trong hệ thống (không flat).
		   Dùng literal (không --box-shadow-md vì token phụ thuộc --shadow-color,
		   undefined trong theme hiện tại → resolve thành 'none'). */
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.18),
			0 2px 4px rgba(0, 0, 0, 0.1);
		position: fixed;
		/* Content append vào body (position:fixed) → cần z-index cao hơn dropdown select
		 (z=50) VÀ modal fullscreen của Select (root 10000 / container 10001) để tooltip
		 edit/delete option trong fullscreen panel vẫn nổi trên modal. */
		z-index: 10500;
		font-size: var(--font-size);
		line-height: 1.4;
		transition: opacity ease-in-out 0.2s, box-shadow ease-in-out 0.2s;
	}
</style>
