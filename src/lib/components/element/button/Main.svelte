<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import { onDestroy } from 'svelte';
	import { defaultButton } from './_default';
	import type { ButtonProps } from './_interface';
	import Icon from '@iconify/svelte';
	import './_styles.scss';

	let { ...props }: ButtonProps = $props();
	let configs = $state({
		root: {
			status: {
				hover: undefined as undefined | boolean,
				mousePos: { x: undefined, y: undefined } as {
					x: number | undefined;
					y: number | undefined;
				},
				rippleProcess: undefined as number | undefined,
				timeId: undefined as undefined | number,
				loadingTimeId: undefined as undefined | number,
				loadingPercent: 0
			},
			ref: undefined as undefined | HTMLElement,
			events: {
				load: {
					handler() {
						if (configs.root.ref) {
							const mutationObserver = new MutationObserver(() => {
								if (props.loading) {
									configs.root.ref?.classList.add(
										`loading-animation-${
											typeof props.loadingAnimation == 'string'
												? props.loadingAnimation.split('-')[1]
												: typeof props.loadingAnimation == 'object'
													? (props.loadingAnimation.style ?? 'style-1').split('-')[1]
													: 1
										}`
									);
								} else {
									configs.root.ref?.classList.remove(
										`loading-animation-${
											typeof props.loadingAnimation == 'string'
												? props.loadingAnimation.split('-')[1]
												: typeof props.loadingAnimation == 'object'
													? (props.loadingAnimation.style ?? 'style-1').split('-')[1]
													: 1
										}`
									);
								}
							});
							//mutationObserver.observe(configs.root.ref, { attributes: true });
							return () => {
								mutationObserver.disconnect();
							};
						}
						if (props.width) {
							if (
								!props.parentRef &&
								configs.root.ref &&
								configs.root.ref instanceof HTMLElement &&
								configs.root.ref.parentElement instanceof HTMLElement
							) {
								const propWidth = props.width == 'full' ? 100 : parseFloat(props.width);
								const parentWidth = configs.root.ref.parentElement.clientWidth;
								configs.root.ref.style.width = `${(parentWidth * propWidth) / 100}px`;
							} else if (props.parentRef && configs.root.ref) {
								const propWidth = props.width == 'full' ? 100 : parseFloat(props.width);
								const parentWidth = props.parentRef.clientWidth;
								configs.root.ref.style.width = `${(parentWidth * propWidth) / 100}px`;
							}
						}
					}
				},
				mouseover: {
					handler() {
						configs.root.status.hover = true;
					}
				},
				mouseout: {
					handler() {
						configs.root.status.hover = undefined;
					}
				},
				click: {
					handler(e, data) {
						if (data?.node instanceof HTMLElement) {
							const { clientX, clientY } = e as MouseEvent;
							const rect = data.node.getBoundingClientRect();
							configs.root.status.mousePos = { x: clientX - rect.left, y: clientY - rect.top };
							const startAt = performance.now();
							const duration = props.transitionDuration
								? typeof props.transitionDuration == 'string'
									? parseFloat(props.transitionDuration)
									: props.transitionDuration
								: profile.transition.duration;

							function startAnimation() {
								const elapsed = performance.now() - startAt;
								const progress = Math.min(elapsed / duration, 1);
								configs.root.status.rippleProcess = progress * 100;
								if (progress < 1) {
									configs.root.status.timeId = requestAnimationFrame(startAnimation);
								} else {
									configs.root.status.mousePos = { x: undefined, y: undefined };
									configs.root.status.rippleProcess = undefined;
								}
							}
							configs.root.status.timeId = requestAnimationFrame(startAnimation);
							return () => {
								if (configs.root.status.timeId) {
									cancelAnimationFrame(configs.root.status.timeId);
								}
							};
						}
					},
					options: {
						delay: 300
					}
				}
			} as EventListener
		}
	});
	$effect(() => {
		if (
			props.loading &&
			((typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-3') ||
				(typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-2'))
		) {
			const startAt = performance.now();
			let duration =
				typeof props.loadingAnimation == 'object' && props.loadingAnimation.duration
					? props.loadingAnimation.duration
					: (props.transitionDuration ?? profile.transition.duration);
			const durationFormatted =
				typeof duration == 'number'
					? duration
					: duration.endsWith('ms')
						? parseFloat(duration)
						: parseFloat(duration) * 1000;
			function startAnimation() {
				const currentTime = performance.now();
				configs.root.status.loadingPercent = ((currentTime - startAt) * 100) / durationFormatted;

				if (configs.root.status.loadingPercent > 100 && configs.root.status.loadingTimeId) {
					cancelAnimationFrame(configs.root.status.loadingTimeId);
					configs.root.status.loadingPercent = 100;
				} else {
					configs.root.status.loadingTimeId = requestAnimationFrame(startAnimation);
				}
			}
			configs.root.status.loadingTimeId = requestAnimationFrame(startAnimation);
		}
	});

	onDestroy(() => {
		if (configs.root.status.timeId) cancelAnimationFrame(configs.root.status.timeId);
		if (configs.root.status.loadingTimeId) cancelAnimationFrame(configs.root.status.loadingTimeId);
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'button'}
	bind:this={configs.root.ref}
	{@attach handleEvents([
		!props.disabled
			? { event: [configs.root.events] }
			: {
					event: [
						{
							load: {
								handler() {
									if (configs.root.ref && props.loading) {
										configs.root.ref.classList.add(
											`loading-animation-${
												typeof props.loadingAnimation == 'string'
													? props.loadingAnimation.split('-')[1]
													: typeof props.loadingAnimation == 'object'
														? (props.loadingAnimation.style ?? 'style-1').split('-')[1]
														: 1
											}`
										);
									}
								}
							}
						}
					]
				}
	])}
	class={props.overwriteDefaultStyles
		? props.class
		: [
				...(typeof defaultButton.class == 'object'
					? (defaultButton.class ?? [])
					: typeof defaultButton.class == 'string'
						? [defaultButton.class]
						: []),
				...(typeof props.class == 'object'
					? (props.class ?? [])
					: typeof props.class == 'string'
						? [props.class]
						: [])
			]}
	data-size={props.size ?? 'sm'}
	data-color={props.color ?? 'primary'}
	data-variant={props.variant ?? 'bordered'}
	data-radius={props.radius ?? props.size ?? 'sm'}
	data-transition={props.transitionEnabled ?? 'true'}
	data-disabled={props.disabled}
	data-hover={configs.root.status.hover}
	data-loading={props.loading}
	data-width={props.width ?? 'auto'}
	data-ripple-animation-disabled={props.rippleAnimationDisabled}
	data-ripple-process={configs.root.status.rippleProcess ? true : undefined}
	style:--transition-duration={`${props.transitionDuration ?? profile.transition.duration ?? 300}ms`}
	style:--mouse-pos-x={configs.root.status.mousePos.x
		? `${configs.root.status.mousePos.x}px`
		: undefined}
	style:--mouse-pos-y={configs.root.status.mousePos.y
		? `${configs.root.status.mousePos.y}px`
		: undefined}
	style:--ripple-process={configs.root.status.rippleProcess
		? `${configs.root.status.rippleProcess}%`
		: undefined}
	style:--loading-animation={typeof props.loadingAnimation == 'string'
		? `loading-animation-${props.loadingAnimation.split('-')[1]}`
		: typeof props.loadingAnimation == 'object'
			? `loading-animation-${(props.loadingAnimation.style ?? 'style-1').split('-')[1]}`
			: 'loading-animation-1'}
	style:--loading-animation-duration={`${
		typeof props.loadingAnimation == 'object'
			? typeof props.loadingAnimation.duration == 'number'
				? `${props.loadingAnimation.duration}ms`
				: props.loadingAnimation.duration
			: `${props.transitionDuration ?? 300}ms`
	}`}
	style:--loading-percent={props.loading &&
	((typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-3') ||
		(typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-2'))
		? `${configs.root.status.loadingPercent}%`
		: undefined}
>
	{#if typeof props.snippet == 'function'}
		{@render props.snippet()}
	{:else}
		{#if props.loading && (!props.loadingAnimation || (typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-1') || (typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-1'))}
			<div class="loading-icon">
				<Icon icon={props.loadingIcon ?? 'mdi:loading'} />
			</div>
		{/if}
		{#if props.leading}
			{#if typeof props.leading == 'string'}
				<div>
					<Icon icon={props.leading} />
				</div>
			{/if}
		{/if}
		{#if typeof props.label == 'string'}
			<div class="truncate flex-1">{props.label}</div>
		{/if}
		{#if props.trailing}
			{#if typeof props.trailing == 'string'}
				<Icon icon={props.trailing} />
			{/if}
		{/if}
	{/if}
</svelte:element>

<style lang="scss">
</style>
