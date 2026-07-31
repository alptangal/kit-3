<script lang="ts">
	import { Button } from '$components/element';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import type { KeyboardNumberConfigs, KeyboardNumberProps } from './_interface';
	import { numberKeyboardState } from '$modules/numberKeyboardState.svelte';
	import type { BasicProps } from '$components/interface';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';

	const OFFSET = 5;

	let { ...props }: KeyboardNumberProps = $props();
	let configs: KeyboardNumberConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = ['keyboard-number-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		event: [
			{
				events: {
					load(e, data) {
						if (data?.node instanceof HTMLElement && configs.timeId) {
							const name = 'timeout-load';
							const timeId = configs.timeId.get(name);
							if (timeId) clearTimeout(timeId);
							let bodyHeightBackup: undefined | string;
							if (client.browser?.visualKeyboard) client.browser.visualKeyboard.ref = configs.ref;
							requestAnimationFrame(() => {
								if (!(data.node instanceof HTMLElement) || !numberKeyboardState.target?.ref) return;
								const kbRect = data.node.getBoundingClientRect();
								const targetRect = numberKeyboardState.target.ref.getBoundingClientRect();
								bodyHeightBackup = document.body.style.getPropertyValue('margin-top');
								if (kbRect.top - targetRect.bottom < OFFSET) {
									document.body.style.marginTop = `-${targetRect.bottom - kbRect.top + OFFSET}px`;
									data.node.style.bottom = `${0}px`;
									window.scrollTo({ top: 100, behavior: 'smooth' });
								} else if (kbRect.top - targetRect.bottom > OFFSET) {
									document.body.style.marginTop = `${kbRect.top - targetRect.bottom - OFFSET}px`;
								}
							});
							return () => {
								document.body.style.marginTop = bodyHeightBackup ?? '0px';
							};
						}
					},
					mousedown(e) {
						const event = e as MouseEvent;
						event.preventDefault();
					}
				}
			}
		]
	});
	type keys =
		| '1'
		| '2'
		| '3'
		| '4'
		| '5'
		| '6'
		| '7'
		| '8'
		| '9'
		| '+'
		| '-'
		| 'x'
		| '0'
		| '.'
		| '%'
		| '=';
	const keys: { [k in keys]?: BasicProps['events'] }[] = [
		{ '7': eventObj('7') },
		{ '8': eventObj('8') },
		{ '9': eventObj('9') },
		{ x: eventObj('x') },
		{ '4': eventObj('4') },
		{ '5': eventObj('5') },
		{ '6': eventObj('6') },
		{ '-': eventObj('-') },
		{ '1': eventObj('1') },
		{ '2': eventObj('2') },
		{ '3': eventObj('3') },
		{ '+': eventObj('+') },
		{ '0': eventObj('0') },
		{ '.': eventObj('.') },
		{ '%': eventObj('%') },
		{ '=': eventObj('=') }
	];
	function eventObj(character: keys | 'ac' | 'del' | '(' | ')'): BasicProps['events'] {
		return [
			{
				events: {
					mousedown: {
						handler(e) {
							const event = e as MouseEvent;
							event.preventDefault();
							if (!numberKeyboardState.target) return;
							numberKeyboardState.target.ref?.dispatchEvent(
								new CustomEvent<string>('keydown', { detail: character })
							);
						}
					}
				}
			}
		];
	}

	onMount(() => {
		if (!configs.timeId) configs.timeId = new Map();
		if (client.browser?.visualKeyboard) {
			configs.width = client.browser.visualKeyboard.width;
			configs.height = client.browser.visualKeyboard.height;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	style:width={configs.width ? `${configs.width}px` : undefined}
	style:height={configs.height ? `${configs.height}px` : undefined}
	{@attach handleEvents(configs.event)}
>
	<Button rounded="none" delay="0ms" events={eventObj('ac')}>AC</Button>
	<div class="grid grid-cols-2">
		<Button rounded="none" delay="0ms" events={eventObj('(')}>(</Button>
		<Button rounded="none" delay="0ms" events={eventObj(')')}>)</Button>
	</div>
	<Button rounded="none" delay="0ms" events={eventObj('del')}>Del</Button>
	<Button rounded="none" delay="0ms">:</Button>
	{#each keys as item, k (k)}
		<Button rounded="none" delay="0ms" events={Object.values(item)[0]}
			>{Object.keys(item)[0]}</Button
		>
	{/each}
</svelte:element>

<style lang="scss">
	.keyboard-number-root {
		@apply grid grid-cols-4;
		--safe-bottom: env(safe-area-inset-bottom, 0px);
		--safe-top: env(safe-area-inset-top, 0px);
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		gap: var(--border-width-xs);
		position: fixed;
		bottom: 0px;
		z-index: 99;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
	}
</style>
