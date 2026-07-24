<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { pick } from 'es-toolkit/compat';
	import { setToolTipCtx, type ArrowMeta, type ContentMeta } from '.';
	import type { TooltipConfigs, TooltipProps } from './_interface';

	const OFFSET = 10;
	let { children, disabled = $bindable(), ...props }: TooltipProps = $props();
	let configs: TooltipConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = ['tooltip-root', `size-${this.size}`];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get delay() {
			return convertToMiliseconds(props.delay) ?? client.browser?.delay ?? 300;
		},
		get offset() {
			return convertToPixels(props.offset) ?? OFFSET;
		},
		get rounded() {
			return props.rounded ?? this.size ?? client.browser?.size ?? 'md';
		},
		get event() {
			const defaultEvents: EventListener = {
				load(e, data) {},
				mousemove(e) {
					if (!e) return;
					const event = e as MouseEvent;
					if (!configs.status) configs.status = {};
					configs.status.mousePosition = { x: event.clientX, y: event.clientY };
				},
				mouseover() {
					if (!configs.status) configs.status = {};
					configs.status.hover = true;
				},
				mouseleave() {
					if (!configs.status) configs.status = {};
					// configs.status.hover = false;
				}
			};
			const propEvents = (props.events ?? []).map((ev) =>
				disabled ? { ...ev, events: pick(ev.events, ['load']) } : ev
			);
			return [{ events: disabled ? pick(defaultEvents, ['load']) : defaultEvents }, ...propEvents];
		}
	});
	let contentMeta: ContentMeta = $state({});
	let arrowMeta: ArrowMeta = $state({});
	setToolTipCtx({
		get size() {
			return configs.size;
		},
		get ref() {
			return configs.ref;
		},
		get status() {
			return configs.status;
		},
		get delay() {
			return configs.delay;
		},
		get offset() {
			return configs.offset;
		},
		get contentMeta() {
			return contentMeta;
		},
		get rounded() {
			return configs.rounded;
		},
		updateContentMeta(data) {
			contentMeta = data;
		},
		get arrowMeta() {
			return arrowMeta;
		},
		updateArrowMeta(data) {
			arrowMeta = data;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.tooltip-root {
		font-size: var(--font-size);
		width: fit-content;
		min-width: 0;
		max-width: 100%;
	}
</style>
