<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import Icon from '@iconify/svelte';
	import type { Button } from './_interface';
	import { iconify } from '$assets/icons/iconify';
	import { fly } from 'svelte/transition';
	import { pick } from 'es-toolkit/compat';
	import { getFormContext } from '$components/form/form';

	let { children, ...props }: Button = $props();

	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		default: {
			style: ['w-fit max-w-full flex justify-center items-center'],
			/**duration in miliseconds */
			duration: 3000
		},
		get type() {
			return props.type ?? 'button';
		},
		status: {
			get onlyIcon() {
				if (!configs.icon.ref) return undefined;
				return props.icon && configs.ref && configs.ref.children.length == 1;
			},
			timeId: {
				requestAnimation: undefined as undefined | number,
				timeout: undefined as undefined | NodeJS.Timeout
			},
			/**start at performance.now() */
			statAt: undefined as undefined | number,
			looped: undefined as undefined | number,
			backgroundInit: undefined as undefined | string,
			borderWidthInit: undefined as undefined | number,
			borderRadiusInit: undefined as undefined | number,
			offset: {
				width: undefined as undefined | number,
				height: undefined as undefined | number
			},
			get perimeter() {
				return (
					2 * (configs.status.offset.width ?? 0 + (configs.status.offset.height ?? 0)) +
					8 * (configs.status.borderRadiusInit ?? 0) +
					2 * Math.PI * (configs.status.borderRadiusInit ?? 0)
				);
			},
			canvas: {
				get x() {
					return configs.status.borderWidthInit ?? 0;
				},
				get y() {
					return configs.status.borderWidthInit ?? 0;
				}
			},
			_tapped: undefined as undefined | boolean,
			get tapped() {
				return this._tapped;
			},
			set tapped(val) {
				if (val) {
					this._tapped = val;
					setTimeout(() => {
						this._tapped = false;
					}, profile.delay);
				}
			}
		},
		rippleAnimation: {
			get duration() {
				return profile.delay ?? 300;
			}
		},
		event: {
			load: {
				handler(e, data) {
					if (data?.node instanceof HTMLElement) {
						const resizeObs = new ResizeObserver(() => {
							if (data.node instanceof HTMLElement) {
								updateOffset(data.node);
							}
						});
						const mutationObs = new MutationObserver(() => {
							if (data.node instanceof HTMLElement) {
								updateOffset(data.node);
							}
						});
						mutationObs.observe(data.node as HTMLElement, {
							childList: true,
							subtree: true
						});
						resizeObs.observe(data.node);
						return () => {
							mutationObs.disconnect();
							resizeObs.disconnect();
						};
					}
				}
			},
			get click() {
				if (!profile.browser.type?.includes('desktop')) return undefined;
				return this.touchstart;
			},
			touchstart: {
				handler(e: MouseEvent, data) {
					configs.status.tapped = true;
					if (data?.node instanceof HTMLElement) {
						function cleaning() {
							if (configs.status.timeId.requestAnimation && data?.node instanceof HTMLElement) {
								cancelAnimationFrame(configs.status.timeId.requestAnimation);
								data.node.style.removeProperty('--clientX');
								data.node.style.removeProperty('--clientY');
								data.node.style.removeProperty('--percent');
							}
						}
						cleaning();
						data.node.style.setProperty('--clientX', `${e.clientX}px`);
						data.node.style.setProperty('--clientY', `${e.clientY}px`);
						data.node.style.setProperty('--ripple-opacity', `.2`);

						const startAt = performance.now();
						function processing() {
							const currentTime = performance.now();
							const percent = ((currentTime - startAt) * 100) / configs.rippleAnimation.duration;
							if (Math.min(percent, 100) == 100 && configs.status.timeId.requestAnimation) {
								cancelAnimationFrame(configs.status.timeId.requestAnimation);
								if (data?.node instanceof HTMLElement) {
									data.node.style.setProperty('--ripple-opacity', `0`);
									cleaning();
								}
							} else {
								if (data?.node instanceof HTMLElement) {
									data.node.style.setProperty('--percent', `${percent}%`);
								}

								configs.status.timeId.requestAnimation = requestAnimationFrame(processing);
							}
						}
						configs.status.timeId.requestAnimation = requestAnimationFrame(processing);

						if (configs.type == 'submit' && formCtx.onSubmit) {
							formCtx.onSubmit();
						}
						if (configs.type == 'reset' && formCtx.onReset) {
							formCtx.onReset();
						}
						return () => {
							if (configs.status.timeId.requestAnimation) {
								cancelAnimationFrame(configs.status.timeId.requestAnimation);
							}
						};
					}
				}
			}
		} as EventListener,
		icon: {
			default: {
				style: ''
			},
			ref: undefined as undefined | HTMLElement
		},
		svg: {
			rect: {
				ref: undefined as undefined | SVGRectElement
			}
		}
	});

	const formCtx = getFormContext();

	//-----------------------------------------------BEGIN METHODS--------------------------------------------
	function updateOffset(element: HTMLElement) {
		if (configs.status.timeId.timeout) clearTimeout(configs.status.timeId.timeout);
		configs.status.timeId.timeout = setTimeout(() => {
			if (element && element instanceof HTMLElement) {
				const computedStyles = window.getComputedStyle(element);
				configs.status.offset.width =
					element.offsetWidth + parseFloat(computedStyles.paddingInline) * 2;
				configs.status.offset.height =
					element.offsetHeight +
					parseFloat(computedStyles.paddingTop) +
					parseFloat(computedStyles.paddingBottom);
			}
		}, profile.delay);
	}
	function processLoading2() {
		if (!configs.status.statAt) return;
		if (configs.status.timeId.requestAnimation)
			cancelAnimationFrame(configs.status.timeId.requestAnimation);
		const currentTime = performance.now();
		let duration: number;
		if (typeof props.loadingAnimation == 'object') {
			if (props.loadingAnimation.duration) {
				if (typeof props.loadingAnimation.duration == 'string') {
					if (!props.loadingAnimation.duration.includes('ms')) {
						duration = parseFloat(props.loadingAnimation.duration) * 1000;
					} else {
						duration = parseFloat(props.loadingAnimation.duration);
					}
				} else {
					duration = props.loadingAnimation.duration;
				}
			} else {
				duration = configs.default.duration;
			}
		} else {
			duration = configs.default.duration;
		}
		const percent = ((currentTime - configs.status.statAt) * 100) / duration;

		const loop = props.loadingLoop ?? 'infinite';
		if (configs.svg.rect.ref) {
			configs.svg.rect.ref.setAttribute(
				'stroke-dashoffset',
				`${configs.status.perimeter - (percent * configs.status.perimeter) / 100}`
			);
			if (Math.min(percent, 100) == 100 && configs.status.timeId.requestAnimation) {
				if (loop == 'infinite') {
					configs.status.statAt = performance.now();
					configs.status.timeId.requestAnimation = requestAnimationFrame(processLoading2);
				} else {
					if (!configs.status.looped) {
						configs.status.looped = 1;
					} else {
						configs.status.looped += 1;
					}
					if (configs.status.looped >= (typeof loop == 'string' ? parseInt(loop) : loop)) {
						cancelAnimationFrame(configs.status.timeId.requestAnimation);
						configs.status.statAt = undefined;
					} else {
						configs.status.statAt = performance.now();
						configs.status.timeId.requestAnimation = requestAnimationFrame(processLoading2);
					}
				}
			} else {
				configs.status.timeId.requestAnimation = requestAnimationFrame(processLoading2);
			}
		}
	}
	// function processLoading21() {
	// 	if (!configs.status.statAt) return;
	// 	if (configs.status.timeId.requestAnimation)
	// 		cancelAnimationFrame(configs.status.timeId.requestAnimation);
	// 	const currentTime = performance.now();
	// 	let duration: number;
	// 	if (typeof props.loadingAnimation == 'object') {
	// 		if (props.loadingAnimation.duration) {
	// 			if (typeof props.loadingAnimation.duration == 'string') {
	// 				if (!props.loadingAnimation.duration.includes('ms')) {
	// 					duration = parseFloat(props.loadingAnimation.duration) * 1000;
	// 				} else {
	// 					duration = parseFloat(props.loadingAnimation.duration);
	// 				}
	// 			} else {
	// 				duration = props.loadingAnimation.duration;
	// 			}
	// 		} else {
	// 			duration = configs.default.duration;
	// 		}
	// 	} else {
	// 		duration = configs.default.duration;
	// 	}
	// 	const percent = ((currentTime - configs.status.statAt) * 100) / duration;
	// 	const degree = (percent * 360) / 100;
	// 	const loop = props.loadingLoop ?? 'infinite';
	// 	if (configs.ref) {
	// 		configs.ref.style.setProperty('--loading-percent', `${degree}deg`);
	// 	}
	// 	if (Math.min(percent, 100) == 100 && configs.status.timeId.requestAnimation) {
	// 		if (loop == 'infinite') {
	// 			configs.status.statAt = performance.now();
	// 			configs.status.timeId.requestAnimation = requestAnimationFrame(processLoading2);
	// 		} else {
	// 			if (!configs.status.looped) {
	// 				configs.status.looped = 1;
	// 			} else {
	// 				configs.status.looped += 1;
	// 			}
	// 			if (configs.status.looped >= (typeof loop == 'string' ? parseInt(loop) : loop)) {
	// 				cancelAnimationFrame(configs.status.timeId.requestAnimation);
	// 				configs.status.statAt = undefined;
	// 			} else {
	// 				configs.status.statAt = performance.now();
	// 				configs.status.timeId.requestAnimation = requestAnimationFrame(processLoading2);
	// 			}
	// 		}
	// 	} else {
	// 		configs.status.timeId.requestAnimation = requestAnimationFrame(processLoading2);
	// 	}
	// }
	// function getVisualColor(el: HTMLElement) {
	// 	const { x, y, width, height } = el.getBoundingClientRect();

	// 	const canvas = document.createElement('canvas');
	// 	canvas.width = window.innerWidth;
	// 	canvas.height = window.innerHeight;

	// 	const ctx = canvas.getContext('2d');

	// 	// "chụp" toàn bộ trang vào canvas
	// 	// ⚠️ cần html2canvas vì ctx không đọc được DOM trực tiếp
	// 	// → dùng thư viện html2canvas
	// 	return html2canvas(document.body, { canvas }).then(() => {
	// 		if (!ctx) return;
	// 		// lấy pixel ở giữa element
	// 		const cx = Math.floor(x + width / 2);
	// 		const cy = Math.floor(y + height / 2);
	// 		const [r, g, b, a] = ctx.getImageData(cx, cy, 1, 1).data;
	// 		return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
	// 	});
	// }
	//-----------------------------------------------END METHODS--------------------------------------------

	$effect(() => {
		if (
			!configs.status.statAt &&
			!configs.status.looped &&
			props.loading &&
			((typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-2') ||
				(typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-2'))
		) {
			configs.status.statAt = performance.now();
			configs.status.looped = 0;
			processLoading2();
		}
		if (configs.ref && !configs.status.borderRadiusInit) {
			const computedStyles = window.getComputedStyle(configs.ref);
			configs.status.borderWidthInit = parseFloat(computedStyles.borderWidth);
			configs.status.borderRadiusInit = parseFloat(computedStyles.borderRadius);
		}
		// if (configs.ref && props.loading && !configs.status.backgroundInit) {
		// 	configs.status.timeId.timeout = setTimeout(async () => {
		// 		if (!configs.ref) return;
		// 		const backgroundColor = await getVisualColor(configs.ref);
		// 		console.log(backgroundColor);
		// 		configs.status.backgroundInit = backgroundColor;
		// 		if (backgroundColor) {
		// 			configs.ref.style.setProperty('--background-color', backgroundColor);
		// 		}
		// 	}, profile.delay);
		// }
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'button'}
	bind:this={configs.ref}
	class={props.overwriteDefaultStyles
		? ['button-root', typeof props.class == 'object' ? [...props.class] : props.class]
		: [
				'button-root ',
				...configs.default.style,
				typeof props.class == 'object' ? [...props.class] : props.class
			]}
	class:loading={props.loading}
	class:only-icon={configs.status.onlyIcon}
	data-size={props.size ?? 'md'}
	data-variant={props.variant ?? 'solid'}
	data-color={props.color ?? 'default'}
	data-ripple-animation={!props.rippleAnimationDisabled && !props.disabled}
	data-disabled={props.disabled}
	data-loading={props.loading}
	data-directive={props.directive == 'rtl' ? props.directive : undefined}
	data-radius={props.radius ? props.radius : undefined}
	data-aspect-ratio={props['aspect-ratio'] == 'square' ? props['aspect-ratio'] : undefined}
	data-background-initialized={configs.status.backgroundInit}
	data-loading-animation={typeof props.loadingAnimation == 'object'
		? (props.loadingAnimation.style ?? 'style-1')
		: (props.loadingAnimation ?? 'style-1')}
	data-min-width-disabled={props.minWidthDisabled ?? true}
	data-tapped={profile.browser.type?.includes('mobile') ? configs.status.tapped : undefined}
	style:--loading-loop={props.loadingLoop ?? 'infinite'}
	style:--loading-duration={typeof props.loadingAnimation == 'object'
		? !`${props.loadingAnimation.duration ?? profile.delay}`.includes('ms') &&
			!`${props.loadingAnimation.duration ?? profile.delay}`.includes('s')
			? `${props.loadingAnimation.duration ?? profile.delay}ms`
			: `${props.loadingAnimation.duration ?? profile.delay}`
		: `${configs.default.duration}ms`}
	transition:fly={profile.transition.templates.flyY}
	title={props.alt}
	type={configs.type}
	{@attach handleEvents([
		{
			events: [
				...(!props.disabled && !props.loading
					? [configs.event]
					: [{ ...pick(configs.event, ['load']) }])
			]
		},
		!props.disabled && !props.loading && props.events ? props.events : { events: [] }
	])}
>
	{#if props.loading || props.icon}
		<svelte:element this={'div'} class="icon" bind:this={configs.icon.ref}>
			{#if props.loading}
				<div
					class={typeof props.icon == 'object' && props.icon.overwriteDefaultStyles
						? props.icon.class
						: typeof props.icon == 'object'
							? typeof props.icon.class == 'object'
								? [...props.icon.class, configs.icon.default.style]
								: [props.icon.class, configs.icon.default.style]
							: [configs.icon.default.style]}
					transition:fly={profile.transition.templates.flyX}
				>
					<Icon icon={props.loadingIcon ?? iconify.loading} />
				</div>
			{:else}
				<div
					class={typeof props.icon == 'object' && props.icon.overwriteDefaultStyles
						? props.icon.class
						: typeof props.icon == 'object'
							? typeof props.icon.class == 'object'
								? [...props.icon.class, configs.icon.default.style]
								: [props.icon.class, configs.icon.default.style]
							: [configs.icon.default.style]}
					transition:fly={profile.transition.templates.flyX}
				>
					{#if typeof props.icon == 'object'}
						<Icon icon={props.icon.string ?? ''} />
					{:else}
						<Icon icon={props.icon ?? ''} />
					{/if}
				</div>
			{/if}
		</svelte:element>
	{/if}
	{#if children}
		{@render children()}
	{:else if props.label}
		<div class="content">
			<svelte:element
				this={typeof props.label === 'object' && props.label.as ? props.label.as : 'span'}
				class={typeof props.label == 'object'
					? props.label.overwriteDefaultStyles
						? props.label.class
						: [
								'label',
								typeof props.label.class == 'object' ? [...props.label.class] : props.label.class
							]
					: 'label'}
				>{typeof props.label === 'object' && props.label.text
					? props.label.text
					: props.label}</svelte:element
			>
			{#if props.description}
				<svelte:element
					this={typeof props.description === 'object' && props.description.as
						? props.description.as
						: 'span'}
					class={typeof props.description == 'object'
						? props.description.overwriteDefaultStyles
							? props.description.class
							: [
									'description',
									typeof props.description.class == 'object'
										? [...props.description.class]
										: props.description.class
								]
						: 'description'}
					>{typeof props.description === 'object' && props.description.text
						? props.description.text
						: props.description}</svelte:element
				>
			{/if}
		</div>
	{/if}
	{#if props.loading && ((typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-2') || (typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-2')) && ((typeof props.loadingLoop == 'string' && !isNaN(parseFloat(props.loadingLoop)) && parseFloat(props.loadingLoop) != configs.status.looped) || props.loadingLoop == 'infinite' || !props.loadingLoop || (typeof props.loadingLoop == 'number' && props.loadingLoop != configs.status.looped))}
		<svg
			transition:fly={profile.transition.templates.fade}
			viewBox="0 0 {configs.status.offset.width} {configs.status.offset.height}"
			style="position:absolute;inset:0;width:100%;height:100%;"
		>
			<rect
				bind:this={configs.svg.rect.ref}
				fill="none"
				stroke="green"
				stroke-width={configs.status.borderWidthInit ?? 0}
				stroke-linecap="round"
				stroke-dasharray="{configs.status.perimeter} {configs.status.perimeter - 200}"
				stroke-dashoffset={configs.status.perimeter}
				x={0}
				y={0}
				width={configs.status.offset.width ?? 0}
				height={configs.status.offset.height ?? 0}
				rx={configs.status.borderRadiusInit}
				class="loading-stroke"
				style:--wi={configs.status.offset.width ?? 0}
				style:--stroke-dashoffset={configs.status.perimeter}
				style="filter:blur(var(--border-width));"
			/>
		</svg>
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/variables.scss';

	:global([data-theme='light']) .button-root {
		&[data-color='default'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--black));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--default));
				&:hover:not(.loading, [data-disabled='true']) {
					--color: hsl(var(--default-600));
					--border-color: hsl(var(--default-600));
				}
			}

			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--black));
				--border-style: solid;
				--border-color: hsl(var(--default));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true']) {
					--background-color: hsl(var(--default));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--black));
				--background-color: hsl(var(--default));

				@media (hover: hover) and (pointer: fine) {
					&:hover:not(.loading, [data-disabled='true']) {
						--background-color: hsl(var(--default-600));
					}
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--default));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true']) {
					--color: hsl(var(--default-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--default));
				&:hover:not(.loading, [data-disabled='true']) {
					--background-color: hsl(var(--default-600));
				}
				--shadow-color: hsl(var(--default));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--default));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true']) {
					--background-color: hsl(var(--default-200));
				}
			}
			&[data-variant='faded'] {
				--color: hsl(var(--default));
				--background-color: hsl(var(--default-100));
				--border-color: hsl(var(--default));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true']) {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'] {
				--color: hsl(var(--default-600));
				--background-color: hsl(var(--default-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true']) {
					--opacity: 0.9;
				}
				@media (hover: none) {
					--opacity: 0.9;
				}
			}
		}
	}

	.button-root {
		touch-action: none;
		&[data-disabled='true'],
		&[data-loading='true'] {
			opacity: var(--disabled-opacity);
			cursor: not-allowed;
		}
		&[data-color='default'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--default));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--default));
				&:hover:not(.loading, [data-disabled='true']) {
					--color: hsl(var(--default-600));
					--border-color: hsl(var(--default-600));
				}
			}
			&[data-variant='ghost'] {
				--border-width: 0px;
			}
			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--default));
				--border-style: solid;
				--border-color: hsl(var(--default));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true']) {
					--background-color: hsl(var(--default));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--default));

				@media (hover: hover) and (pointer: fine) {
					&:hover:not(.loading, [data-disabled='true']) {
						--background-color: hsl(var(--default-600));
					}
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--default));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true']) {
					--color: hsl(var(--default-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--default));
				&:hover:not(.loading, [data-disabled='true']) {
					--background-color: hsl(var(--default-600));
				}
				--shadow-color: hsl(var(--default));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--default));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true']) {
					--background-color: hsl(var(--default-200));
				}
			}
			&[data-variant='faded'] {
				--color: hsl(var(--default));
				--background-color: hsl(var(--default-100));
				--border-color: hsl(var(--default));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true']) {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'] {
				--color: hsl(var(--default-600));
				--background-color: hsl(var(--default-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true']) {
					--opacity: 0.9;
				}
				@media (hover: none) {
					--opacity: 0.9;
				}
			}
		}
		&[data-color='primary'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--primary));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--primary));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--primary-600));
					--border-color: hsl(var(--primary-600));
				}
			}
			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--primary));
				--border-style: solid;
				--border-color: hsl(var(--primary));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--primary));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--primary));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--primary-600));
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--primary));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--primary-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--primary));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--primary-600));
				}
				--shadow-color: hsl(var(--primary));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--primary));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--primary-200));
				}
			}
			&[data-variant='faded'] {
				--color: hsl(var(--primary));
				--background-color: hsl(var(--default-100));
				--border-color: hsl(var(--default));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'] {
				--color: hsl(var(--primary-600));
				--background-color: hsl(var(--primary-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
		}
		&[data-color='secondary'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--secondary));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--secondary));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--secondary-600));
					--border-color: hsl(var(--secondary-600));
				}
			}
			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--secondary));
				--border-style: solid;
				--border-color: hsl(var(--secondary));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--secondary));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--secondary));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--secondary-600));
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--secondary));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--secondary-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--secondary));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--secondary-600));
				}
				--shadow-color: hsl(var(--secondary));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--secondary));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--secondary-200));
				}
			}
			&[data-variant='faded'] {
				--color: hsl(var(--secondary));
				--background-color: hsl(var(--secondary-100));
				--border-color: hsl(var(--secondary));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'] {
				--color: hsl(var(--secondary-600));
				--background-color: hsl(var(--secondary-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
		}
		&[data-color='success'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--success));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--success));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--success-600));
					--border-color: hsl(var(--success-600));
				}
			}
			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--success));
				--border-style: solid;
				--border-color: hsl(var(--success));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--success));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--success));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--success-600));
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--success));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--success-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--success));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--success-600));
				}
				--shadow-color: hsl(var(--success));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--success));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--success-200));
				}
				/* &[data-tapped] {
					--background-color: hsl(var(--success-200));
				} */
			}
			&[data-variant='faded'] {
				--color: hsl(var(--success));
				--background-color: hsl(var(--success-100));
				--border-color: hsl(var(--success));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'] {
				--color: hsl(var(--success-600));
				--background-color: hsl(var(--success-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
		}
		&[data-color='warning'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--warning));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--warning));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--warning-600));
					--border-color: hsl(var(--warning-600));
				}
			}
			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--warning));
				--border-style: solid;
				--border-color: hsl(var(--warning));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--warning));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--warning));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--warning-600));
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--warning));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--warning-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--warning));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--warning-600));
				}
				--shadow-color: hsl(var(--warning));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--warning));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--warning-200));
				}
			}
			&[data-variant='faded'] {
				--color: hsl(var(--warning));
				--background-color: hsl(var(--warning-100));
				--border-color: hsl(var(--warning));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'] {
				--color: hsl(var(--warning-600));
				--background-color: hsl(var(--warning-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
		}
		&[data-color='danger'] {
			&[data-variant='outline'],
			&[data-variant='border'] {
				--color: hsl(var(--danger));
				--background-color: transparent;
				--border-style: solid;
				--border-color: hsl(var(--danger));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--danger-600));
					--border-color: hsl(var(--danger-600));
				}
			}
			&[data-variant='ghost'],
			&[data-variant='subtle'] {
				--color: hsl(var(--danger));
				--border-style: solid;
				--border-color: hsl(var(--danger));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--danger));
					--color: var(--white);
				}
			}
			&[data-variant='solid'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--danger));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--danger-600));
				}
			}
			&[data-variant='link'] {
				--color: hsl(var(--danger));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--color: hsl(var(--danger-600));
				}
			}
			&[data-variant='shadow'] {
				--color: hsl(var(--white));
				--background-color: hsl(var(--danger));
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--danger-600));
				}
				--shadow-color: hsl(var(--danger));
				--shadow: var(--box-shadow);
			}
			&[data-variant='light'] {
				--color: hsl(var(--danger));
				--background-color: transparent;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--background-color: hsl(var(--danger-200));
				}
			}
			&[data-variant='faded'] {
				--color: hsl(var(--danger));
				--background-color: hsl(var(--danger-100));
				--border-color: hsl(var(--danger));
				--border-style: solid;
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
			&[data-variant='flat'],
			&[data-variant='soft'] {
				--color: hsl(var(--danger-600));
				--background-color: hsl(var(--danger-100));
				--opacity: 1;
				&:hover:not(.loading, [data-disabled='true'], [data-tapped='false']),
				&[data-tapped='true'] {
					--opacity: 0.9;
				}
			}
		}

		&[data-size='xs'] {
			--label-font-size: 0.75rem;
			--line-height: calc(1/0.75);
			--border-radius: calc(var(--radius) * 0.25);
			--border-width: var(--border-width-small);
			--padding: calc(var(--spacing) * 2);
			--box-shadow: 0 1px 2px 0 var(--shadow-color);
			--min-width: calc(var(--spacing) * 12);
		}
		&[data-size='sm'] {
			--label-text-size: 0.875rem;
			--line-height: calc(1.25/0.875);
			--border-radius: calc(var(--radius) * 0.5);
			--border-width: var(--border-width-small);
			--padding: calc(var(--spacing) * 3);
			--box-shadow: 0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color);
			--min-width: calc(var(--spacing) * 16);
		}
		&[data-size='md'] {
			--label-font-size: 1rem;
			--line-height: 1.5;
			--border-radius: calc(var(--radius) * 0.75);
			--border-width: var(--border-width-medium);
			--padding: calc(var(--spacing) * 4);
			--box-shadow: 0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color);
			--min-width: calc(var(--spacing) * 20);
		}
		&[data-size='lg'] {
			--label-font-size: 1.125rem;
			--line-height: calc(1.75/1.125);
			--border-radius: calc(var(--radius));
			--border-width: var(--border-width-medium);
			--padding: calc(var(--spacing) * 5);
			--box-shadow: 0 10px 15px -3px var(--shadow-color), 0 4px 6px -4px var(--shadow-color);
			--min-width: calc(var(--spacing) * 24);
		}
		&[data-size='xl'] {
			--label-font-size: 1.25rem;
			--line-height: calc(2/1.25);
			--border-radius: calc(var(--radius) * 1.5);
			--border-width: var(--border-width-medium);
			--padding: calc(var(--spacing) * 6);
			--box-shadow: 0 20px 25px -5px var(--shadow-color), 0 8px 10px -6px var(--shadow-color);
			--min-width: calc(var(--spacing) * 28);
		}
		&[data-size='2xl'] {
			--label-font-size: 1.5rem;
			--line-height: calc(2.25/1.5);
			--border-radius: calc(var(--radius) * 2);
			--border-width: var(--border-width-medium);
			--padding: calc(var(--spacing) * 7);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 32);
		}
		&[data-size='3xl'] {
			--label-font-size: 1.875rem;
			--line-height: calc(2.5/1.875);
			--border-radius: calc(var(--radius) * 3);
			--border-width: var(--border-width-large);
			--padding: calc(var(--spacing) * 8);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 36);
		}
		&[data-size='4xl'] {
			--label-font-size: 2.25rem;
			--line-height: calc(2.75/2.25);
			--border-radius: calc(var(--radius) * 4);
			--border-width: var(--border-width-large);
			--padding: calc(var(--spacing) * 9);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 40);
		}
		&[data-size='5xl'] {
			--label-font-size: 3rem;
			--line-height: 1;
			--border-radius: calc(var(--radius) * 5);
			--border-width: var(--border-width-large);
			--padding: calc(var(--spacing) * 10);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 44);
		}
		&[data-size='6xl'] {
			--label-font-size: 3.75rem;
			--line-height: 1;
			--border-radius: calc(var(--radius) * 6);
			--border-width: var(--border-width-large);
			--padding: calc(var(--spacing) * 11);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 48);
		}
		&[data-size='7xl'] {
			--label-font-size: 4.5rem;
			--line-height: 1;
			--border-radius: calc(var(--radius) * 7);
			--border-width: var(--border-width-extra-large);
			--padding: calc(var(--spacing) * 12);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 52);
		}
		&[data-size='8xl'] {
			--label-font-size: 6rem;
			--line-height: 1;
			--border-radius: calc(var(--radius) * 8);
			--border-width: var(--border-width-extra-large);
			--padding: calc(var(--spacing) * 13);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 56);
		}
		&[data-size='9xl'] {
			--label-font-size: 8rem;
			--line-height: 1;
			--border-radius: calc(var(--radius) * 9);
			--border-width: var(--border-width-extra-large);
			--padding: calc(var(--spacing) * 14);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
			--min-width: calc(var(--spacing) * 60);
		}
		&[data-radius='xs'] {
			--border-radius: calc(var(--radius) * 0.25);
		}
		&[data-radius='sm'] {
			--border-radius: calc(var(--radius) * 0.5);
		}
		&[data-radius='base'] {
			--border-radius: calc(var(--radius) * 0.75);
		}
		&[data-radius='lg'] {
			--border-radius: calc(var(--radius));
		}
		&[data-radius='xl'] {
			--border-radius: calc(var(--radius) * 1.5);
		}
		&[data-radius='2xl'] {
			--border-radius: calc(var(--radius) * 2);
		}
		&[data-radius='3xl'] {
			--border-radius: calc(var(--radius) * 3);
		}
		&[data-radius='4xl'] {
			--border-radius: calc(var(--radius) * 4);
		}
		&[data-radius='5xl'] {
			--border-radius: calc(var(--radius) * 5);
		}
		&[data-radius='6xl'] {
			--border-radius: calc(var(--radius) * 6);
		}
		&[data-radius='7xl'] {
			--border-radius: calc(var(--radius) * 7);
		}
		&[data-radius='8xl'] {
			--border-radius: calc(var(--radius) * 8);
		}
		&[data-radius='9xl'] {
			--border-radius: calc(var(--radius) * 9);
		}
		&[data-radius='full'] {
			--border-radius: 50%;
		}
		&[data-radius='none'] {
			--border-radius: none;
		}
		.label {
			@apply truncate;
			font-size: var(--label-font-size);
		}
		.description {
			@apply truncate;
			font-size: calc(var(--label-font-size) * 2 / 3);
		}
		line-height: var(--line-height);
		border-radius: var(--border-radius);
		padding-inline: var(--padding);
		padding-block: calc(var(--padding) / 10);
		gap: calc(var(--spacing) * 2);
		color: var(--color);
		background-color: var(--background-color);
		border-width: var(--border-width);
		border-style: var(--border-style);
		border-color: var(--border-color);
		box-shadow: var(--shadow);
		opacity: var(--opacity);
		position: relative;
		transition: all ease-in-out 0.01s;
		max-width: 100%;
		&:not(.only-icon):not([data-min-width-disabled='true']) {
			min-width: var(--min-width);
		}
		&[data-ripple-animation='true'] {
			&::before {
				content: '';
				position: absolute;
				top: 0px;
				left: 0px;
				width: 100%;
				height: 100%;
				border-radius: var(--border-radius);
				background: radial-gradient(
					circle at var(--clientX) var(--clientY),
					white var(--percent),
					black var(--percent)
				);
				opacity: var(--ripple-opacity);
				z-index: 1;
			}
		}
		&[data-loading='true'] {
		}
		&[data-directive='rtl'] {
			@apply flex-row-reverse;
		}
		&[data-aspect-ratio='square'] {
			aspect-ratio: 1/1;
		}
	}

	.icon {
		font-size: calc(var(--label-font-size));
	}
	[data-loading-animation='style-1'] {
		&.loading > .icon {
			animation: loading-rotate var(--loading-duration) var(--loading-loop) ease-in-out;
		}
	}
	[data-loading-animation='style-2'][data-background-initialized] {
		&.loading1 {
			&::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0px;
				width: 100%;
				height: 100%;
				z-index: -1;
				background: conic-gradient(
					from var(--loading-percent, 0deg),
					green var(--loading-percent, 0deg),
					transparent var(--loading-percent, 0deg)
				);
				filter: blur(var(--border-width, 4px));
			}
			&::after {
				content: '';
				position: absolute;
				top: 50%;
				left: 50%;
				width: calc(100% - var(--border-width, 4px));
				height: calc(100% - var(--border-width, 4px));
				z-index: 0;
				background-color: var(--background-color);
				transform: translate(-50%, -50%);
				border-radius: var(--border-radius);
			}
			* {
				transform: scale(calc((100% - var(--border-width, 4px)) / 100%));
				z-index: 1;
			}
		}
	}
	[data-loading-animation='style-3'] {
		&.loading {
			position: relative;
		}
		&.loading::after {
			content: '';
			position: absolute;
			inset: 0;
			background: linear-gradient(
				90deg,
				rgba(255, 255, 255, 0.7) 0%,
				rgba(255, 255, 255, 0) 40%,
				rgba(255, 255, 255, 0) 60%,
				rgba(255, 255, 255, 0.7) 100%
			);
			background-size: 400px 100%;
			animation: shimmer var(--loading-duration) linear var(--loading-loop);
			pointer-events: none;
			border-radius: var(--border-radius);
		}
	}

	.content {
		@apply flex flex-1 flex-col truncate;
	}
	@keyframes loading-rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	.loading-stroke {
		position: absolute;
		z-index: 1;
	}

	@keyframes run {
		from {
			stroke-dashoffset: var(--stroke-dashoffset);
		} /* = perimeter */
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes shimmer {
		from {
			background-position: -600px 0;
		}
		to {
			background-position: 600px 0;
		}
	}
</style>
