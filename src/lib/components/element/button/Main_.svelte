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
			? { events: [configs.root.events] }
			: {
					events: [
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
	@use '$assets/styles/variables.scss' as *;
	@use 'sass:list';
	@use 'sass:math';

	[data-variant] {
		--shadow-2xs: 0 1px hsl(var(--color) / 0.05);
		--shadow-xs: 0 1px 2px 0 hsl(var(--color, #0000001a));
		--shadow-sm:
			0 1px 3px 0 hsl(var(--color, #0000001a)), 0 1px 2px -1px hsl(var(--color, #0000001a));
		--shadow-base:
			0 4px 6px -1px hsl(var(--color, #0000001a)), 0 2px 4px -2px hsl(var(--color, #0000001a));
		--shadow-lg:
			0 10px 15px -3px hsl(var(--color, #0000001a)), 0 4px 6px -4px hsl(var(--color, #0000001a));
		--shadow-xl:
			0 20px 25px -5px hsl(var(--color, #0000001a)), 0 8px 10px -6px hsl(var(--color, #0000001a));
		--shadow-2xl:
			0 25px 30px -7px hsl(var(--color, #0000001a)), 0 12px 14px -8px hsl(var(--color, #0000001a));
		--shadow-3xl:
			0 30px 35px -9px hsl(var(--color, #0000001a)), 0 16px 18px -10px hsl(var(--color, #0000001a));
		--shadow-4xl:
			0 35px 40px -11px hsl(var(--color, #0000001a)), 0 20px 22px -12px hsl(var(--color, #0000001a));
		--shadow-5xl:
			0 40px 45px -13px hsl(var(--color, #0000001a)), 0 24px 26px -14px hsl(var(--color, #0000001a));
		--shadow-6xl:
			0 45px 50px -15px hsl(var(--color, #0000001a)), 0 28px 30px -16px hsl(var(--color, #0000001a));
		--shadow-7xl:
			0 50px 55px -17px hsl(var(--color, #0000001a)), 0 32px 34px -18px hsl(var(--color, #0000001a));
		--shadow-8xl:
			0 55px 60px -19px hsl(var(--color, #0000001a)), 0 36px 38px -20px hsl(var(--color, #0000001a));
		--shadow-9xl:
			0 60px 65px -21px hsl(var(--color, #0000001a)), 0 40px 42px -22px hsl(var(--color, #0000001a));

		&[data-color='default'] {
			--color: var(--default);
			--text-color: var(--default);
			--text-color-foreground: var(--default-foreground);
			--background-color: var(--default);
			--border-color: var(--default);
			&[data-variant='flat'] {
				--text-color: var(--default-600);
			}
		}
		&[data-color='primary'] {
			--color: var(--primary);
			--text-color: var(--primary);
			--text-color-foreground: var(--primary-foreground);
			--background-color: var(--primary);
			--border-color: var(--primary);
			&[data-variant='flat'] {
				--text-color: var(--primary-600);
			}
		}
		&[data-color='secondary'] {
			--color: var(--secondary);
			--text-color: var(--secondary);
			--text-color-foreground: var(--secondary-foreground);
			--background-color: var(--secondary);
			--border-color: var(--secondary);
			&[data-variant='flat'] {
				--text-color: var(--secondary-600);
			}
		}
		&[data-color='success'] {
			--color: var(--success);
			--text-color: var(--success);
			--text-color-foreground: var(--success-foreground);
			--background-color: var(--success);
			--border-color: var(--success);
			&[data-variant='flat'] {
				--text-color: var(--success-600);
			}
		}
		&[data-color='warning'] {
			--color: var(--warning);
			--text-color: var(--warning);
			--text-color-foreground: var(--warning-foreground);
			--background-color: var(--warning);
			--border-color: var(--warning);
			&[data-variant='flat'] {
				--text-color: var(--warning-600);
			}
		}
		&[data-color='danger'] {
			--color: var(--danger);
			--text-color: var(--danger);
			--text-color-foreground: var(--danger-foreground);
			--background-color: var(--danger);
			--border-color: var(--danger);
			&[data-variant='flat'] {
				--text-color: var(--danger-600);
			}
		}
		&[data-size='xs'] {
			--min-width: calc(var(--spacing) * (12 + (0 - 1) * 2));
			--min-height: calc(var(--spacing) * (6 + (0 - 1) * 2));
			--padding: 0px calc(var(--spacing) * (2 + (0 - 1)));
			--font-size: var(--text-0);
			--line-height: var(--text-0--line-height);
			--border-width: var(--border-width-0);
			--max-width: 100%;
			--border-radius: var(--border-radius-0);
			--shadow: var(--shadow-xs);
		}
		&[data-radius='xs'] {
			--border-radius: var(--border-radius-xs) !important;
		}
		&[data-size='sm'] {
			--min-width: calc(var(--spacing) * (12 + (1 - 1) * 2));
			--min-height: calc(var(--spacing) * (6 + (1 - 1) * 2));
			--padding: 0px calc(var(--spacing) * (2 + (1 - 1)));
			--font-size: var(--text-0);
			--line-height: var(--text-0--line-height);
			--border-width: var(--border-width-0);
			--max-width: 100%;
			--border-radius: var(--border-radius-0);
			--shadow: var(--shadow-sm);
		}
		&[data-radius='sm'] {
			--border-radius: var(--border-radius-sm) !important;
		}
		&[data-size='base'] {
			--min-width: calc(var(--spacing) * (12 + (2 - 1) * 2));
			--min-height: calc(var(--spacing) * (6 + (2 - 1) * 2));
			--padding: 0px calc(var(--spacing) * (2 + (2 - 1)));
			--font-size: var(--text-0);
			--line-height: var(--text-0--line-height);
			--border-width: var(--border-width-0);
			--max-width: 100%;
			--border-radius: var(--border-radius-0);
			--shadow: var(--shadow-base);
		}
		&[data-radius='base'] {
			--border-radius: var(--border-radius-base) !important;
		}
		&[data-size='lg'] {
			--min-width: calc(var(--spacing) * (12 + (3 - 1) * 2));
			--min-height: calc(var(--spacing) * (6 + (3 - 1) * 2));
			--padding: 0px calc(var(--spacing) * (2 + (3 - 1)));
			--font-size: var(--text-0);
			--line-height: var(--text-0--line-height);
			--border-width: var(--border-width-0);
			--max-width: 100%;
			--border-radius: var(--border-radius-0);
			--shadow: var(--shadow-lg);
		}
		&[data-radius='lg'] {
			--border-radius: var(--border-radius-base) !important;
		}
		&[data-size='xl'] {
			--min-width: calc(var(--spacing) * (12 + (4 - 1) * 2));
			--min-height: calc(var(--spacing) * (6 + (4 - 1) * 2));
			--padding: 0px calc(var(--spacing) * (2 + (4 - 1)));
			--font-size: var(--text-0);
			--line-height: var(--text-0--line-height);
			--border-width: var(--border-width-0);
			--max-width: 100%;
			--border-radius: var(--border-radius-0);
			--shadow: var(--shadow-xl);
		}
		&[data-radius='xl'] {
			--border-radius: var(--border-radius-base) !important;
		}

		&[data-variant='bordered'] {
			--background-color: transparent;
			&[data-hover] {
				--opacity: var(--hover-opacity);
			}
		}
		&[data-variant='ghost'] {
			--background-color: transparent;
			&[data-hover] {
				--background-color: var(--color);
				--text-color: var(--text-color-foreground);
			}
		}
		&[data-variant='shadow'] {
			--background-color: var(--color);
			--text-color: var(--text-color-foreground);
			--box-shadow: var(--shadow);
			&[data-hover] {
				--opacity: var(--hover-opacity);
			}
		}
		&[data-variant='flat'] {
			--background-color: var(--color);
			--background-opacity: 0.2;
			--border-width: 0px !important;
			&[data-hover] {
				--opacity: var(--hover-opacity);
			}
		}
		&[data-variant='light'] {
			--background-color: transparent;
			--background-opacity: 0.2;
			--border-width: 0px !important;
			&[data-hover] {
				--background-color: var(--color);
				--opacity: var(--hover-opacity);
			}
		}
		&[data-variant='faded'] {
			--background-color: var(--default-100);
			--border-color: var(--default);
			&[data-hover] {
				--opacity: var(--hover-opacity);
			}
		}
		&[data-variant='solid'] {
			--background-color: var(--color);
			--text-color: var(--text-color-foreground);
			&[data-hover] {
				--opacity: var(--hover-opacity);
			}
		}
		&[data-variant='solid'],
		&[data-variant='flat'],
		&[data-variant='shadow'] {
			--border-width: 0px !important;
		}

		&[data-transition-duration] {
			--transition-duration: var(--transition-duration);
		}
		&[data-transition] {
			--transition: all ease-in-out var(--transition-duration);
			&[data-transition='false'] {
				--transition: none;
			}
		}
		&[data-radius='none'] {
			--border-radius: none !important;
		}
		&[data-radius='full'] {
			--border-radius: calc(infinity * 1px) !important;
		}
		&[data-disabled] {
			--cursor: not-allowed;
			--opacity: var(--disabled-opacity);
		}
		--opacity: 1;
		--background-opacity: 1;
		--cursor: pointer;
		--box-shadow: 0 0 #0000;

		color: var(--text-color);
		background-color: hsl(var(--background-color) / var(--background-opacity));
		padding: var(--padding);
		min-height: var(--min-height);
		min-width: var(--min-width);
		max-width: var(--max-width);
		border-color: hsl(var(--border-color));
		border-width: var(--border-width);
		border-style: solid;
		transition: var(--transition);
		cursor: var(--cursor);
		border-radius: var(--border-radius);
		opacity: var(--opacity);
		box-shadow: var(--box-shadow);

		* {
			color: hsl(var(--text-color));
			font-size: var(--font-size) !important;
			line-height: var(--line-height);
			z-index: 0;
		}

		&:not([data-ripple-animation-disabled]) {
			&[data-ripple-process] {
				--background-ripple: var(--color);
				&[data-variant='shadow'],
				&[data-variant='ghost'],
				&[data-variant='solid'] {
					--background-ripple: var(--background);
				}
				position: relative;
				&::before {
					content: '';
					position: absolute;
					top: 0px;
					left: 0px;
					width: 100%;
					height: 100%;
					z-index: 1;
					background: radial-gradient(
						circle at var(--mouse-pos-x) var(--mouse-pos-y),
						hsl(var(--background-ripple) / 0.4),
						hsl(var(--background-ripple) / 0.4),
						hsl(var(--background-ripple) / 0.4),
						hsl(var(--background-ripple) / 0) calc(var(--ripple-process) * 2)
					);
					opacity: 0.5;
				}
			}
		}
	}
	[data-loading] {
		&.loading-animation-1 {
			.loading-icon {
				animation: loading-animation-1 var(--loading-animation-duration) infinite linear;
			}
			@keyframes loading-animation-1 {
				0% {
					transform: rotate(0deg);
				}
				100% {
					transform: rotate(360deg);
				}
			}
		}

		&.loading-animation-2 {
			position: relative;
			&::before {
				content: '';
				position: absolute;
				inset: 0;
				background-image: linear-gradient(
					90deg,
					transparent 25%,
					rgba(255, 255, 255, 0.5) 50%,
					transparent 75%
				);
				background-size: 400% 100%;
				animation: loading-animation-2 var(--loading-animation-duration) infinite linear;
				pointer-events: none;
				z-index: 1;
			}

			@keyframes loading-animation-2 {
				0% {
					background-position: 200% center;
				}
				100% {
					background-position: -200% center;
				}
			}
		}
		&.loading-animation-3 {
			--loading-background: var(--color);
			&[data-variant='shadow'],
			&[data-variant='ghost'],
			&[data-variant='solid'] {
				--loading-background: var(--background);
			}
			position: relative;
			* {
				z-index: 2;
			}
			&::before {
				width: var(--loading-percent);
				height: 100%;
				content: '';
				position: absolute;
				inset: 0;
				background: hsl(var(--loading-background) / 0.5);
				background-size: 10% 100%;
				/* animation: loading-animation-2 var(--loading-animation-duration) infinite linear; */
				pointer-events: none;
				z-index: 1;
			}

			@keyframes loading-animation-2 {
				0% {
					background-position: 200% center;
				}
				100% {
					background-position: -200% center;
				}
			}
		}
	}
</style>
