<script lang="ts">
//$components/element/button/Main.svelte
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { pick } from 'es-toolkit/compat';
	import type { ButtonConfigs, ButtonProps } from './_interface';
	import { Icon } from '$components/element';
	import type { EventListener } from '$components/interface';
	import { getFormContext } from '$components/form/form';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	let { children, ...props }: ButtonProps = $props();
	const formContext = getFormContext();
	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'button-root',
			`variant-${variantDerived}`,
			`size-${sizeDerived}`,
			props['aspect-square'] ? 'aspect-square' : undefined,
			props.rounded ? `rounded-${props.rounded}` : undefined,
			disabledDerived ? 'disabled' : undefined,
			loadingDerived ? 'loading' : undefined,
			!props.transitionDisabled ? 'transition' : undefined,
			`color-${colorDerived}`,
			configs.status?.tap || props.actived ? `button-tapped` : undefined
		];
		const propStyles: (string | undefined)[] | undefined | string =
			typeof props.class == 'object' && !Array.isArray(props.class)
				? props.class.root
				: props.class;
		return styleSynced({ defaultStyles, propStyles }, props.overwriteDefaultStyles);
	});

	const loadingDerived = $derived.by(() => {
		if (props.loading) return props.loading;
		if (typeDerived == 'submit' && formContext?.loading) return formContext.loading;
		return undefined;
	});

	const disabledDerived = $derived.by(() => {
		if (props.disabled) return props.disabled;
		if (formContext) {
			if (formContext.loading || formContext.disabled) return true;
			if (!formContext.validation.isValid && typeDerived == 'submit') return true;
			if (formContext.childrens?.size && ['submit', 'reset'].includes(typeDerived)) {
				return [...formContext.childrens.values()].every((children) => !children.status.changed);
			}
		}
		return false;
	});

	const typeDerived = $derived(props.type ?? 'button');
	const variantDerived = $derived(props.variant ?? 'solid');
	const sizeDerived = $derived(props.size ?? formContext?.size ?? client.browser?.size ?? 'md');
	const colorDerived = $derived(props.color ?? 'default');

	const delayDerived = $derived.by(() => {
		if (!props.delay) return client.browser?.delay ?? 300;
		if (props.delay == 'none') return undefined;
		return typeof props.delay == 'number'
			? props.delay
			: props.delay.includes('ms')
				? parseFloat(props.delay)
				: parseFloat(props.delay) * 1000;
	});

	const transitionDurationDerived = $derived.by(() => {
		if (!props.transitionDuration) return client.browser?.delay ?? 300;
		return typeof props.transitionDuration == 'number'
			? props.transitionDuration
			: props.transitionDuration.includes('ms')
				? parseFloat(props.transitionDuration)
				: parseFloat(props.transitionDuration) * 1000;
	});

	const loadingDurationDerived = $derived.by(() => {
		if (!props.loadingDuration) return (client.browser?.delay ?? 300) * 10;
		return typeof props.loadingDuration == 'number'
			? props.loadingDuration
			: props.loadingDuration.includes('ms')
				? parseFloat(props.loadingDuration)
				: parseFloat(props.loadingDuration) * 1000;
	});

	const debounceDerived = $derived(props.debounce);
	const longPressDurationDerived = $derived(props.longPressDuration ?? 500);
	const rippleDerived = $derived(props.ripple ?? false);
	const tooltipDerived = $derived(props.tooltip);
	const ariaLabelDerived = $derived(props['aria-label'] ?? props.tooltip);
	const shortcutDerived = $derived(
		props.shortcut
			? Array.isArray(props.shortcut)
				? props.shortcut.map((s) => s.toLowerCase())
				: [props.shortcut.toLowerCase()]
			: undefined
	);

	/** Tạo và phát ripple effect tại vị trí click */
	function spawnRipple(e: MouseEvent | PointerEvent, node: HTMLElement) {
		const rect = node.getBoundingClientRect();
		const ripple = document.createElement('span');
		const size = Math.max(rect.width, rect.height) * 2;
		ripple.className = 'button-ripple';
		ripple.style.cssText = `
			width:${size}px; height:${size}px;
			left:${e.clientX - rect.left - size / 2}px;
			top:${e.clientY - rect.top - size / 2}px;
		`;
		node.appendChild(ripple);
		setTimeout(() => ripple.remove(), 600);
	}

	const eventDerived = $derived.by(() => {
		const defaultEvent: EventListener = {
			load(e, data) {
				const node = data?.node;
				if (!(node instanceof HTMLElement)) return;
				// Keyboard shortcut — attach to window keydown
				if (shortcutDerived?.length) {
					const handleKey = (ev: KeyboardEvent) => {
						if (disabledDerived || loadingDerived) return;
						const key = ev.key.toLowerCase();
						if (shortcutDerived.includes(key)) {
							ev.preventDefault();
							node.click();
						}
					};
					window.addEventListener('keydown', handleKey);
					return () => window.removeEventListener('keydown', handleKey);
				}
			},
			pointerdown: {
				handler(e) {
					if (disabledDerived || loadingDerived) return;
					
					// 1. Instant Tap animation (Mobile optimized)
					if (delayDerived) {
						if (!configs.status) configs.status = {};
						if (!configs.timeId) configs.timeId = new Map();
						const prevTap = configs.timeId.get('animation-tap');
						if (prevTap) clearTimeout(prevTap);
						configs.status.tap = true;
					}

					// 2. Instant Ripple effect (Mobile optimized)
					if (rippleDerived && configs.ref) {
						spawnRipple(e as PointerEvent, configs.ref);
					}

					// 3. Long press start
					if (props.onLongPress) {
						if (!configs.status) configs.status = {};
						if (!configs.timeId) configs.timeId = new Map();
						const prevLp = configs.timeId.get('long-press');
						if (prevLp) clearTimeout(prevLp);
						
						// Store start coordinates to detect scroll distance
						configs.status.pointerStartX = (e as PointerEvent).clientX;
						configs.status.pointerStartY = (e as PointerEvent).clientY;

						configs.timeId.set(
							'long-press',
							setTimeout(async () => {
								if (!configs.status) configs.status = {};
								configs.status.longPress = true;
								configs.status.longPressFired = true; // Flag to block upcoming click
								await props.onLongPress!(e as PointerEvent);
								if (configs.status) configs.status.longPress = false;
							}, longPressDurationDerived)
						);
					}
				},
				options: {}
			},
			pointermove: {
				handler(e) {
					if (disabledDerived || loadingDerived) return;
					
					// Cancel long-press if moved (scrolling on mobile)
					const lpId = configs.timeId?.get('long-press');
					if (lpId && configs.status?.pointerStartX !== undefined && configs.status?.pointerStartY !== undefined) {
						const pe = e as PointerEvent;
						const deltaX = Math.abs(pe.clientX - configs.status.pointerStartX);
						const deltaY = Math.abs(pe.clientY - configs.status.pointerStartY);
						if (deltaX > 10 || deltaY > 10) { // 10px threshold
							clearTimeout(lpId);
							configs.timeId?.delete('long-press');
							if (configs.status) {
								configs.status.pointerStartX = undefined;
								configs.status.pointerStartY = undefined;
							}
						}
					}
				},
				options: {}
			},
			pointerup: {
				handler() {
					// Revert tap animation
					if (delayDerived && configs.status?.tap) {
						if (!configs.timeId) configs.timeId = new Map();
						configs.timeId.set(
							'animation-tap',
							setTimeout(() => {
								if (configs.status) configs.status.tap = false;
							}, delayDerived)
						);
					}

					// Cancel long-press if released early
					const lpId = configs.timeId?.get('long-press');
					if (lpId) {
						clearTimeout(lpId);
						configs.timeId?.delete('long-press');
					}
					if (configs.status) {
						configs.status.longPress = false;
						configs.status.pointerStartX = undefined;
						configs.status.pointerStartY = undefined;
					}
				},
				options: {}
			},
			pointerleave: {
				handler() {
					// Revert tap animation
					if (configs.status?.tap) {
						configs.status.tap = false;
						const prevTap = configs.timeId?.get('animation-tap');
						if (prevTap) clearTimeout(prevTap);
					}

					// Cancel long-press
					const lpId = configs.timeId?.get('long-press');
					if (lpId) {
						clearTimeout(lpId);
						configs.timeId?.delete('long-press');
					}
					if (configs.status) {
						configs.status.longPress = false;
						configs.status.pointerStartX = undefined;
						configs.status.pointerStartY = undefined;
					}
				},
				options: {}
			},
			click: {
				async handler(e) {
					// Ignore click if long-press was just fired
					if (configs.status?.longPressFired) {
						configs.status.longPressFired = false;
						return;
					}

					// Debounce — reject if still in cooldown
					if (debounceDerived) {
						if (configs.status?.debouncing) return;
						if (!configs.status) configs.status = {};
						if (!configs.timeId) configs.timeId = new Map();
						configs.status.debouncing = true;
						configs.timeId.set(
							'debounce',
							setTimeout(() => {
								if (configs.status) configs.status.debouncing = false;
							}, debounceDerived)
						);
					}

					// Confirm dialog
					if (props.confirmText) {
						const confirmed = window.confirm(props.confirmText);
						if (!confirmed) return;
					}

					if (typeDerived == 'reset' && formContext?.childrens?.size) {
						[...formContext.childrens.values()].forEach((field) => {
							field.reset();
						});
						if (formContext.onReset) formContext.onReset();
					}
					if (typeDerived == 'button' && variantDerived == 'link' && props.to)
						await goto(resolve(props.to as any));

					if (typeDerived == 'submit' && formContext) {
						formContext.disabled = true;
						formContext.loading = true;
					}
					try {
						if (props.onClick) await props.onClick(e);
					} finally {
						if (typeDerived == 'submit' && formContext) {
							formContext.loading = false;
							formContext.disabled = false;
						}
					}
				},
				options: {
					get delay() {
						return delayDerived;
					}
				}
			}
		};
		const propEvents = (props.events ?? []).map((evObj) =>
			disabledDerived ? { ...evObj, events: pick(evObj.events, ['load']) } : evObj
		);
		return [
			{ events: disabledDerived ? pick(defaultEvent, ['load']) : defaultEvent },
			...propEvents
		];
	});

	let configs: ButtonConfigs = $state({
		status: {},
		get style() { return styleDerived; },
		get loading() { return loadingDerived; },
		get disabled() { return disabledDerived; },
		get type() { return typeDerived; },
		get variant() { return variantDerived; },
		get size() { return sizeDerived; },
		get color() { return colorDerived; },
		get delay() { return delayDerived; },
		get transitionDuration() { return transitionDurationDerived; },
		get loadingDuration() { return loadingDurationDerived; },
		get event() { return eventDerived; }
	});

	$effect(() => {
		if (configs.loading && configs.ref) {
			if (!configs.timeId) configs.timeId = new Map();
			const issetProcess = configs.timeId.get('loading');
			if (issetProcess) cancelAnimationFrame(issetProcess as number);
			const startAt = performance.now();
			configs.timeId.set('loading', requestAnimationFrame(processLoading));
			function processLoading() {
				const currentAt = performance.now();
				const percent = Math.min(((currentAt - startAt) * 100) / configs.transitionDuration, 100);
				if (configs.ref) configs.ref.style.setProperty('--loading-percent', `${percent}%`);
				// BUG FIX: stop animation when loading finishes — do NOT loop back to 0%
				if (percent < 100) {
					if (!configs.timeId) configs.timeId = new Map();
					configs.timeId.set('loading', requestAnimationFrame(processLoading));
				}
			}
			return () => {
				const issetProcess = configs.timeId?.get('loading');
				if (issetProcess) cancelAnimationFrame(issetProcess as number);
			};
		}
	});

	

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'button'}
	bind:this={configs.ref}
	type={configs.type}
	class={configs.style}
	disabled={configs.disabled}
	data-tap={configs.status?.tap}
	data-long-press={configs.status?.longPress}
	title={tooltipDerived}
	aria-label={ariaLabelDerived}
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
	{#if tooltipDerived}
		<span class="button-tooltip" role="tooltip">{tooltipDerived}</span>
	{/if}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
