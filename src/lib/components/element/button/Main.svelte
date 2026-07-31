<script lang="ts">
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { pick } from 'es-toolkit/compat';
	import type { ButtonConfigs, ButtonProps } from './_interface';
	import { Icon } from '$components/element';
	import type { EventListener } from '$components/interface';
	let { children, disabled = $bindable(), ...props }: ButtonProps = $props();
	let configs: ButtonConfigs = $state({
		status: {},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'button-root',
				`variant-${this.variant}`,
				`size-${this.size}`,
				props['aspect-square'] ? 'aspect-square' : undefined,
				props.rounded ? `rounded-${props.rounded}` : undefined,
				disabled ? 'disabled' : undefined,
				props.loading ? 'loading disabled' : undefined,
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
		get type() {
			return props.type ?? 'button';
		},
		get variant() {
			return props.variant ?? 'solid';
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
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
				disabled || props.loading ? { ...evObj, events: pick(evObj.events, ['load']) } : evObj
			);
			return [
				{ events: disabled || props.loading ? pick(defaultEvent, ['load']) : defaultEvent },
				...propEvents
			];
		}
	});

	$effect(() => {
		if (props.loading && configs.ref) {
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
	@use '$styles/button.scss';

	// .button-root1 {
	// 	--cursor: pointer;
	// 	&.variant-solid {
	// 		--border-color: transparent;
	// 		&.color-default {
	// 			--background: var(--color-gray-600);
	// 			--color: var(--color-gray-300);
	// 			@media (hover: hover) and (pointer: fine) {
	// 				&:hover:not(.disabled) {
	// 					--background: var(--color-gray-500);
	// 					--color: white;
	// 				}
	// 			}
	// 			&.button-tapped {
	// 				--background: var(--color-gray-500);
	// 				--color: white;
	// 			}
	// 		}
	// 		&.color-info {
	// 			--background: var(--color-sky-700);
	// 			--color: var(--color-gray-300);
	// 			@media (hover: hover) and (pointer: fine) {
	// 				&:hover:not(.disabled) {
	// 					--background: var(--color-sky-500);
	// 					--color: white;
	// 				}
	// 			}
	// 			&.button-tapped {
	// 				--background: var(--color-sky-500);
	// 				--color: white;
	// 			}
	// 		}
	// 		&.color-error {
	// 			--background: var(--color-red-600);
	// 			--color: var(--color-gray-300);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-red-500);
	// 				--color: white;
	// 			}
	// 		}
	// 		&.color-success {
	// 			--background: var(--color-green-600);
	// 			--color: var(--color-gray-300);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-green-500);
	// 				--color: white;
	// 			}
	// 		}
	// 		&.color-warning {
	// 			--background: var(--color-amber-600);
	// 			--color: var(--color-gray-300);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-amber-500);
	// 				--color: white;
	// 			}
	// 		}
	// 		&.color-secondary {
	// 			--background: var(--color-cyan-600);
	// 			--color: var(--color-gray-300);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-cyan-500);
	// 				--color: white;
	// 			}
	// 		}
	// 	}
	// 	&.variant-subtle {
	// 		&.color-default {
	// 			--background: var(--color-gray-100);
	// 			--color: var(--foreground-500);
	// 			--border-color: var(--foreground-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-gray-200);
	// 			}
	// 		}
	// 		&.color-info {
	// 			--background: var(--color-sky-100);
	// 			--color: var(--color-sky-500);
	// 			--border-color: var(--color-sky-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-sky-200);
	// 			}
	// 		}
	// 		&.color-error {
	// 			--background: var(--color-red-100);
	// 			--color: var(--color-red-500);
	// 			--border-color: var(--color-red-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-red-200);
	// 			}
	// 		}
	// 		&.color-success {
	// 			--background: var(--color-green-100);
	// 			--color: var(--color-green-500);
	// 			--border-color: var(--color-green-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-green-200);
	// 			}
	// 		}
	// 		&.color-warning {
	// 			--background: var(--color-amber-100);
	// 			--color: var(--color-amber-500);
	// 			--border-color: var(--color-amber-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-amber-200);
	// 			}
	// 		}
	// 		&.color-secondary {
	// 			--background: var(--color-cyan-100);
	// 			--color: var(--color-cyan-500);
	// 			--border-color: var(--color-cyan-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--background: var(--color-cyan-200);
	// 			}
	// 		}
	// 	}
	// 	&.variant-outline {
	// 		&.color-default {
	// 			--background: transparent;
	// 			--color: var(--foreground);
	// 			--border-color: var(--foreground);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-gray-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-gray-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-info {
	// 			--background: transparent;
	// 			--color: var(--color-sky-500);
	// 			--border-color: var(--color-sky-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-sky-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-sky-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-error {
	// 			--background: transparent;
	// 			--color: var(--color-red-500);
	// 			--border-color: var(--color-red-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-red-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-red-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-success {
	// 			--background: transparent;
	// 			--color: var(--color-green-500);
	// 			--border-color: var(--color-green-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-green-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-green-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-warning {
	// 			--background: transparent;
	// 			--color: var(--color-amber-500);
	// 			--border-color: var(--color-amber-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-amber-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-amber-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-secondary {
	// 			--background: transparent;
	// 			--color: var(--color-cyan-500);
	// 			--border-color: var(--color-cyan-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-cyan-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-cyan-200);
	// 				}
	// 			}
	// 		}
	// 	}
	// 	&.variant-soft {
	// 		--border-color: transparent;
	// 		&.color-default {
	// 			@media (prefers-color-scheme: dark) {
	// 				--background: var(--color-gray-950);
	// 			}
	// 			@media (prefers-color-scheme: light) {
	// 				--background: var(--color-gray-200);
	// 			}
	// 			--color: var(--foreground);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-gray-900);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-gray-300);
	// 				}
	// 			}
	// 		}
	// 		&.color-info {
	// 			@media (prefers-color-scheme: dark) {
	// 				--background: var(--color-sky-950);
	// 			}
	// 			@media (prefers-color-scheme: light) {
	// 				--background: var(--color-sky-200);
	// 			}
	// 			--color: var(--color-sky-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-sky-900);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-sky-300);
	// 				}
	// 			}
	// 		}
	// 		&.color-error {
	// 			@media (prefers-color-scheme: dark) {
	// 				--background: var(--color-red-950);
	// 			}
	// 			@media (prefers-color-scheme: light) {
	// 				--background: var(--color-red-200);
	// 			}
	// 			--color: var(--color-red-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-red-900);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-red-300);
	// 				}
	// 			}
	// 		}
	// 		&.color-success {
	// 			@media (prefers-color-scheme: dark) {
	// 				--background: var(--color-green-950);
	// 			}
	// 			@media (prefers-color-scheme: light) {
	// 				--background: var(--color-green-200);
	// 			}
	// 			--color: var(--color-green-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-green-900);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-green-300);
	// 				}
	// 			}
	// 		}
	// 		&.color-warning {
	// 			@media (prefers-color-scheme: dark) {
	// 				--background: var(--color-amber-950);
	// 			}
	// 			@media (prefers-color-scheme: light) {
	// 				--background: var(--color-amber-200);
	// 			}
	// 			--color: var(--color-amber-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-amber-900);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-amber-300);
	// 				}
	// 			}
	// 		}
	// 		&.color-secondary {
	// 			@media (prefers-color-scheme: dark) {
	// 				--background: var(--color-cyan-950);
	// 			}
	// 			@media (prefers-color-scheme: light) {
	// 				--background: var(--color-cyan-200);
	// 			}
	// 			--color: var(--color-cyan-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-cyan-900);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-cyan-300);
	// 				}
	// 			}
	// 		}
	// 	}
	// 	&.variant-ghost {
	// 		--border-color: transparent;
	// 		&.color-default {
	// 			--background: transparent;
	// 			--color: var(--foreground);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-gray-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-gray-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-info {
	// 			--background: transparent;
	// 			--color: var(--color-sky-500);
	// 			@media (hover: hover) and (pointer: fine) {
	// 				&:hover:not(.disabled) {
	// 					@media (prefers-color-scheme: dark) {
	// 						--background: var(--color-sky-950);
	// 					}
	// 					@media (prefers-color-scheme: light) {
	// 						--background: var(--color-sky-200);
	// 					}
	// 				}
	// 			}
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-sky-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-sky-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-error {
	// 			--background: transparent;
	// 			--color: var(--color-red-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-red-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-red-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-success {
	// 			--background: transparent;
	// 			--color: var(--color-green-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-green-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-green-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-warning {
	// 			--background: transparent;
	// 			--color: var(--color-amber-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-amber-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-amber-200);
	// 				}
	// 			}
	// 		}
	// 		&.color-secondary {
	// 			--background: transparent;
	// 			--color: var(--color-cyan-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				@media (prefers-color-scheme: dark) {
	// 					--background: var(--color-cyan-950);
	// 				}
	// 				@media (prefers-color-scheme: light) {
	// 					--background: var(--color-cyan-200);
	// 				}
	// 			}
	// 		}
	// 	}
	// 	&.variant-link {
	// 		--border-color: transparent;
	// 		&.color-default {
	// 			--background: transparent;
	// 			--color: var(--foreground);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--color: var(--foreground-500);
	// 			}
	// 		}
	// 		&.color-info {
	// 			--background: transparent;
	// 			--color: var(--color-sky-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--color: var(--color-sky-700);
	// 			}
	// 		}
	// 		&.color-error {
	// 			--background: transparent;
	// 			--color: var(--color-red-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--color: var(--color-red-700);
	// 			}
	// 		}
	// 		&.color-success {
	// 			--background: transparent;
	// 			--color: var(--color-green-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--color: var(--color-green-700);
	// 			}
	// 		}
	// 		&.color-warning {
	// 			--background: transparent;
	// 			--color: var(--color-amber-500);
	// 			&:hover:not(.disabled),
	// 			.button-tapped {
	// 				--color: var(--color-amber-700);
	// 			}
	// 		}
	// 		&.color-secondary {
	// 			--background: transparent;
	// 			--color: var(--color-cyan-500);
	// 			&:hover:not(.disabled),
	// 			&.button-tapped {
	// 				--color: var(--color-cyan-700);
	// 			}
	// 		}
	// 	}
	// 	&.transition {
	// 		transition: all ease-in-out var(--transition-duration);
	// 	}
	// 	&.disabled {
	// 		--cursor: not-allowed;
	// 		&::before {
	// 			content: '';
	// 			position: absolute;
	// 			top: 0px;
	// 			left: 0px;
	// 			width: 100%;
	// 			height: 100%;
	// 			border-radius: var(--border-radius);
	// 			background: var(--color-gray-200);
	// 			opacity: 0.4;
	// 			touch-action: none;
	// 		}
	// 	}
	// 	&.loading {
	// 		--background: transparent !important;
	// 		&.color-default {
	// 			--loading-background: linear-gradient(
	// 				100deg,
	// 				var(--color-gray-200) 0%,
	// 				var(--color-gray-300) 25%,
	// 				white 50%,
	// 				var(--color-gray-400) 75%,
	// 				var(--color-gray-200) 100%
	// 			);
	// 		}
	// 		&.color-secondary {
	// 			--loading-background: linear-gradient(
	// 				100deg,
	// 				var(--color-cyan-200) 0%,
	// 				var(--color-cyan-300) 25%,
	// 				white 50%,
	// 				var(--color-cyan-400) 75%,
	// 				var(--color-cyan-200) 100%
	// 			);
	// 		}
	// 		&.color-success {
	// 			--loading-background: linear-gradient(
	// 				100deg,
	// 				var(--color-green-200) 0%,
	// 				var(--color-green-300) 25%,
	// 				white 50%,
	// 				var(--color-green-400) 75%,
	// 				var(--color-green-200) 100%
	// 			);
	// 		}
	// 		&.color-error {
	// 			--loading-background: linear-gradient(
	// 				100deg,
	// 				var(--color-red-200) 0%,
	// 				var(--color-red-300) 25%,
	// 				white 50%,
	// 				var(--color-red-400) 75%,
	// 				var(--color-red-200) 100%
	// 			);
	// 		}
	// 		&.color-warning {
	// 			--loading-background: linear-gradient(
	// 				100deg,
	// 				var(--color-amber-200) 0%,
	// 				var(--color-amber-300) 25%,
	// 				white 50%,
	// 				var(--color-amber-400) 75%,
	// 				var(--color-amber-200) 100%
	// 			);
	// 		}
	// 		&.color-info {
	// 			--loading-background: linear-gradient(
	// 				100deg,
	// 				var(--color-sky-200) 0%,
	// 				var(--color-sky-300) 25%,
	// 				white 50%,
	// 				var(--color-sky-400) 75%,
	// 				var(--color-sky-200) 100%
	// 			);
	// 		}
	// 		&::before {
	// 			content: '';
	// 			position: absolute;
	// 			top: 0px;
	// 			left: 0px;
	// 			width: 100%;
	// 			height: 100%;
	// 			border-radius: var(--border-radius);
	// 			background: var(--loading-background);
	// 			opacity: 0.8;
	// 			backdrop-filter: blur(999px);
	// 			background-size: 200% 100%;
	// 			background-position: 0% 0%;
	// 			animation: shimmer var(--loading-duration) linear infinite;
	// 		}
	// 		@keyframes shimmer {
	// 			0% {
	// 				background-position: 200% 0%;
	// 			}
	// 			100% {
	// 				background-position: -200% 0%;
	// 			}
	// 		}
	// 	}
	// 	&[data-tap='true'] {
	// 		transform: scale(0.995);
	// 	}
	// 	color: var(--color);
	// 	background: var(--background);
	// 	border-radius: var(--border-radius);
	// 	border-width: var(--border-width);
	// 	border-style: solid;
	// 	border-color: var(--border-color);
	// 	font-size: var(--font-size);
	// 	max-width: 100%;
	// 	padding-inline: var(--padding);
	// 	line-height: var(--line-height);
	// 	overflow: hidden;
	// 	display: flex;
	// 	align-items: center;
	// 	justify-content: center;
	// 	gap: var(--gap);
	// 	cursor: var(--cursor);
	// 	opacity: var(--opacity);
	// 	touch-action: none;
	// 	position: relative;
	// 	transform: scale(1);

	// 	.button-render {
	// 		overflow: hidden;
	// 		text-overflow: ellipsis;
	// 		white-space: nowrap;
	// 	}
	// }
</style>
