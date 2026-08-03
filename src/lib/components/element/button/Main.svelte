<script lang="ts">
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { pick } from 'es-toolkit/compat';
	import type { ButtonConfigs, ButtonProps } from './_interface';
	import { Icon } from '$components/element';
	import type { EventListener } from '$components/interface';
	import { getFormContext } from '$components/form/form';
	let { children, ...props }: ButtonProps = $props();
	let configs: ButtonConfigs = $state({
		status: {},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'button-root',
				`variant-${this.variant}`,
				`size-${this.size}`,
				props['aspect-square'] ? 'aspect-square' : undefined,
				props.rounded ? `rounded-${props.rounded}` : undefined,
				configs.disabled ? 'disabled' : undefined,
				configs.loading ? 'loading' : undefined,
				!props.transitionDisabled ? 'transition' : undefined,
				`color-${this.color}`,
				configs.status?.tap || props.actived ? `button-tapped` : undefined
			];
			const propStyles: (string | undefined)[] | undefined | string =
				typeof props.class == 'object' && !Array.isArray(props.class)
					? props.class.root
					: props.class;
			return styleSynced({ defaultStyles, propStyles }, props.overwriteDefaultStyles);
		},
		get loading() {
			if (props.loading) return props.loading;
			if (configs.type == 'submit' && formContext?.loading) return formContext.loading;
			return undefined;
		},
		get disabled() {
			if (props.disabled) return props.disabled;
			if (configs.type == 'submit') {
				if (formContext?.loading) return formContext.loading;

				if (!formContext?.validation.isValid) return true;
				if (formContext.childrens?.size) {
					return formContext.childrens.values().every((children) => !children.status.changed);
				}
			}
			if (configs.type == 'reset') {
				if (formContext?.childrens?.size)
					return formContext.childrens.values().every((children) => !children.status.changed);
			}
			return undefined;
		},
		get type() {
			return props.type ?? 'button';
		},
		get variant() {
			return props.variant ?? 'solid';
		},
		get size() {
			return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
		},
		get color() {
			return props.color ?? 'default';
		},
		get delay() {
			if (!props.delay) return client.browser?.delay ?? 300;
			if (props.delay == 'none') return undefined;
			return typeof props.delay == 'number'
				? props.delay
				: props.delay.includes('ms')
					? parseFloat(props.delay)
					: parseFloat(props.delay) * 1000;
		},
		get transitionDuration() {
			if (!props.transitionDuration) return client.browser?.delay ?? 300;
			return typeof props.transitionDuration == 'number'
				? props.transitionDuration
				: props.transitionDuration.includes('ms')
					? parseFloat(props.transitionDuration)
					: parseFloat(props.transitionDuration) * 1000;
		},

		get loadingDuration() {
			if (!props.loadingDuration) return (client.browser?.delay ?? 300) * 10;
			return typeof props.loadingDuration == 'number'
				? props.loadingDuration
				: props.loadingDuration.includes('ms')
					? parseFloat(props.loadingDuration)
					: parseFloat(props.loadingDuration) * 1000;
		},
		get event() {
			const defaultEvent: EventListener = {
				load(e, data) {
					if (data?.node instanceof HTMLElement) {
						if (props['aspect-square']) {
							if (!configs.timeId) configs.timeId = new Map();
							const name = 'timeout-fixed-size';
							const timeId = configs.timeId.get(name);
							if (timeId) clearTimeout(timeId);
							configs.timeId.set(
								name,
								setTimeout(() => {
									// if (data.node instanceof HTMLElement) {
									// 	const sizeFixed = Math.min(data.node.offsetHeight, data.node.offsetWidth);
									// 	data.node.style.width = `${sizeFixed / 16}rem `;
									// 	data.node.style.height = `${sizeFixed / 16}rem`;
									// }
								}, configs.delay)
							);
						}
					}
				},
				click: {
					async handler() {
						if (configs.delay) {
							if (!configs.status) configs.status = {};
							if (!configs.timeId) configs.timeId = new Map();
							configs.status.tap = !configs.status.tap;
							configs.timeId.set(
								'animation-tap',
								setTimeout(() => {
									if (!configs.status) configs.status = {};
									configs.status.tap = !configs.status.tap;
								}, configs.delay)
							);
						}
						if (props.onClick) await props.onClick();
						if (configs.type == 'reset' && formContext?.childrens?.size)
							formContext.childrens.values().forEach((field) => {
								field.reset();
							});

						return () => {
							const timeId = configs.timeId?.get('animation-tap');
							if (timeId) cancelAnimationFrame(timeId as number);
						};
					},
					options: {
						get delay() {
							return configs.delay;
						}
					}
				}
			};
			const propEvents = (props.events ?? []).map((evObj) =>
				configs.disabled ? { ...evObj, events: pick(evObj.events, ['load']) } : evObj
			);
			return [
				{ events: configs.disabled ? pick(defaultEvent, ['load']) : defaultEvent },
				...propEvents
			];
		}
	});

	$effect(() => {
		if (configs.loading && configs.ref) {
			if (!configs.timeId) configs.timeId = new Map();
			const issetProcess = configs.timeId.get('loading');
			if (issetProcess) cancelAnimationFrame(issetProcess as number);
			let startAt = performance.now();
			configs.timeId.set('loading', requestAnimationFrame(processLoading));
			function processLoading() {
				const currentAt = performance.now();
				const percent = Math.min(((currentAt - startAt) * 100) / configs.transitionDuration, 100);
				if (configs.ref) configs.ref.style.setProperty('--loading-percent', `${percent}%`);
				if (percent == 100) {
					startAt = performance.now();
				}
				if (!configs.timeId) configs.timeId = new Map();
				configs.timeId.set('loading', requestAnimationFrame(processLoading));
			}
			return () => {
				const issetProcess = configs.timeId?.get('loading');
				if (issetProcess) cancelAnimationFrame(issetProcess as number);
			};
		}
	});

	const formContext = getFormContext();

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'button'}
	bind:this={configs.ref}
	type={configs.type}
	class={configs.style}
	data-tap={configs.status?.tap}
	style:--transition-duration={`${configs.transitionDuration}ms`}
	style:--loading-duration={`${configs.loadingDuration}ms`}
	{@attach handleEvents(configs.event)}
>
	{#if typeof props.icon == 'string'}
		<Icon icon={props.icon} size={props.size} />
	{:else if typeof props.icon == 'object' && props.icon.leading}
		<Icon icon={props.icon.leading} size={props.size} />
	{/if}
	{#if children}
		<div class="button-render">
			{@render children?.()}
		</div>
	{/if}
	{#if typeof props.icon == 'object' && props.icon.trailing}
		<Icon icon={props.icon.trailing} size={props.size} />
	{/if}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
