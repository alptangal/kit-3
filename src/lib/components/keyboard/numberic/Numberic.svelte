<script lang="ts">
	import { Button } from '$components/element';
	import type { EventListener } from '$components/interface';
	import { profile } from '$store/basic.svelte';
	import { fly } from 'svelte/transition';
	import type { KeyboardNumberic } from './_interface';
	import { iconify } from '$assets/icons/iconify';
	import { onMount, type SvelteComponent } from 'svelte';
	import { handleEvents } from '$modules/_attachments';

	let { ...props }: KeyboardNumberic = $props();
	let configs = $state({
		ref: null as null | HTMLElement,
		event: {
			load: {
				handler(e) {
					if (configs.ref) {
						document.body.appendChild(configs.ref);

						return () => {
							configs.ref?.remove();
						};
					}
				}
			}
		} as EventListener,
		doneBtn: {
			component: null as null | SvelteComponent
		}
	});
	export { configs };
</script>

<svelte:element
	this={'div'}
	transition:fly={profile.transition.templates.flyY}
	bind:this={configs.ref}
	class="keyboard-numberic grid {props.otherFieldsButtonEnabled || props.doneButtonEnabled
		? 'grid-rows-[auto_1fr_1fr_1fr_1fr_1fr]'
		: 'grid-rows-5'} min-h-32 w-full divide-y divide-gray-500 touch-none"
	style:width={`${profile.browser.dimensions?.width ?? 0}px`}
	style:max-width="450px"
	style:height={`${profile.visualKeyboard.height ?? 0}px`}
	style:left="50%"
	style:transform="translateX(-50%)"
	{@attach handleEvents([{ events: [configs.event] }])}
>
	{#if props.otherFieldsButtonEnabled || props.doneButtonEnabled}
		<div class="flex justify-between items-end backdrop-blur-md pb-1">
			{#if props.otherFieldsButtonEnabled}
				<div class="flex gap-1">
					<Button
						icon={iconify['arrow-left-rounded']}
						variant="ghost"
						color="primary"
						events={{
							events: [
								{
									click: {
										handler() {
											if (props.output) {
												props.output('PrevField');
											}
										}
									}
								}
							]
						}}
					/>
					<Button
						icon={iconify['arrow-right-rounded']}
						variant="ghost"
						color="primary"
						events={{
							events: [
								{
									click: {
										handler() {
											if (props.output) {
												props.output('NextField');
											}
										}
									}
								}
							]
						}}
					/>
				</div>
			{:else}
				<div class=""></div>
			{/if}
			{#if props.doneButtonEnabled}
				<Button
					variant="ghost"
					color="success"
					events={{
						events: [
							{
								click: {
									handler() {
										if (props.output) {
											props.output('Done');
										}
									}
								}
							}
						]
					}}>Done</Button
				>
			{/if}
		</div>
	{/if}
	<div class="grid grid-cols-4 divide-x divide-gray-500">
		<div>
			<Button
				disabled={props.disableKeys?.includes('AC')}
				class="flex justify-center text-center items-center w-full h-full"
				overwriteDefaultStyles
				radius="none"
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('AC');
									}
								}
							}
						}
					]
				}}
				><span>AC</span>
			</Button>
		</div>

		<div class="grid grid-cols-2">
			<Button
				disabled={props.disableKeys?.includes('(')}
				minWidthDisabled
				radius="none"
				class="flex justify-center items-center w-full h-full "
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('(');
									}
								}
							}
						}
					]
				}}>(</Button
			>
			<Button
				disabled={props.disableKeys?.includes(')')}
				minWidthDisabled
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(')');
									}
								}
							}
						}
					]
				}}>)</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('Del')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('Del');
									}
								}
							}
						}
					]
				}}
				icon={iconify['backspace-outline-rounded']}
			></Button>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(':')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(':');
									}
								}
							}
						}
					]
				}}>:</Button
			>
		</div>
	</div>
	<div class="grid grid-cols-4 divide-x divide-gray-500">
		<div>
			<Button
				disabled={props.disableKeys?.includes(7)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(7);
									}
								}
							}
						}
					]
				}}>7</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(8)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(8);
									}
								}
							}
						}
					]
				}}>8</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(9)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(9);
									}
								}
							}
						}
					]
				}}>9</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('*')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('*');
									}
								}
							}
						}
					]
				}}>x</Button
			>
		</div>
	</div>
	<div class="grid grid-cols-4 divide-x divide-gray-500">
		<div>
			<Button
				disabled={props.disableKeys?.includes(4)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(4);
									}
								}
							}
						}
					]
				}}>4</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(5)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(5);
									}
								}
							}
						}
					]
				}}>5</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(6)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(6);
									}
								}
							}
						}
					]
				}}>6</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('-')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('-');
									}
								}
							}
						}
					]
				}}>-</Button
			>
		</div>
	</div>
	<div class="grid grid-cols-4 divide-x divide-gray-500">
		<div>
			<Button
				disabled={props.disableKeys?.includes(1)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(1);
									}
								}
							}
						}
					]
				}}>1</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(2)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(2);
									}
								}
							}
						}
					]
				}}>2</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes(3)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(3);
									}
								}
							}
						}
					]
				}}>3</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('+')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('+');
									}
								}
							}
						}
					]
				}}>+</Button
			>
		</div>
	</div>
	<div class="grid grid-cols-4 divide-x divide-gray-500">
		<div>
			<Button
				disabled={props.disableKeys?.includes(0)}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output(0);
									}
								}
							}
						}
					]
				}}>0</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('.')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('.');
									}
								}
							}
						}
					]
				}}>.</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('%')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('%');
									}
								}
							}
						}
					]
				}}>%</Button
			>
		</div>
		<div>
			<Button
				disabled={props.disableKeys?.includes('=')}
				radius="none"
				class="flex justify-center items-center w-full h-full"
				overwriteDefaultStyles
				events={{
					events: [
						{
							click: {
								handler() {
									if (props.output) {
										props.output('=');
									}
								}
							}
						}
					]
				}}>=</Button
			>
		</div>
	</div>
</svelte:element>

<style lang="scss">
	.keyboard-numberic {
		position: fixed;
		left: 0px;
		bottom: 0px;
		z-index: 99999;
	}
</style>
