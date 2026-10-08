<script lang="ts">
	import { Button } from '$components/element';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import type { KeyboardNumberConfigs, KeyboardNumberProps } from './_interface';
	import { numberKeyboardState } from '$modules/numberKeyboardState.svelte';
	import type { BasicProps } from '$components/interface';
	import type { NumberKeyAllowed } from '$components/form/input/_interface';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';

	// Khoảng cách tối thiểu giữa đáy input và đỉnh keyboard — chênh nhỏ hơn này
	// nghĩa là keyboard đè lên input → cần đẩy nội dung trang lên trên.
	const OFFSET = 5;

	let { ...props }: KeyboardNumberProps = $props();
	let configs: KeyboardNumberConfigs = $state({
		// timeId khởi tạo ngay từ $state (không đợi onMount) — load handler luôn có
		// Map bất kể thứ tự attachment vs onMount khi keyboard mount qua host.
		timeId: new Map(),
		get style() {
			const defaultStyles: (string | undefined)[] = ['keyboard-number-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		event: [
			{
				events: {
					load(e, data) {
						if (!(data?.node instanceof HTMLElement) || !configs.timeId) return;
						if (client.browser?.visualKeyboard) client.browser.visualKeyboard.ref = configs.ref;
						let bodyHeightBackup: undefined | string;
						requestAnimationFrame(() => {
							if (!(data.node instanceof HTMLElement) || !numberKeyboardState.target?.ref) return;
							const kbRect = data.node.getBoundingClientRect();
							const targetRect = numberKeyboardState.target.ref.getBoundingClientRect();
							bodyHeightBackup = document.body.style.getPropertyValue('margin-top');
							if (kbRect.top - targetRect.bottom < OFFSET) {
								// Keyboard đè lên input: đẩy toàn bộ nội dung trang lên trên
								// keyboard (margin âm) + cuộn xuống để input + vùng phía trên hiện đủ.
								document.body.style.marginTop = `-${targetRect.bottom - kbRect.top + OFFSET}px`;
								data.node.style.bottom = `${0}px`;
								// Cuộn 100px quanh mốc sau khi margin đổi — bù viewport mobile
								// (input có thể bị khuất nếu không cuộn).
								window.scrollTo({ top: 100, behavior: 'smooth' });
							} else if (kbRect.top - targetRect.bottom > OFFSET) {
								// Keyboard cách input quá xa: kéo nội dung xuống gần keyboard hơn.
								document.body.style.marginTop = `${kbRect.top - targetRect.bottom - OFFSET}px`;
							}
						});
						return () => {
							document.body.style.marginTop = bodyHeightBackup ?? '0px';
						};
					},
					mousedown(e) {
						// Root-level: phủ cả vùng trống (gap) giữa các phím — mousedown ở vùng
						// trống không được focus native input. Per-key preventDefault nằm ở keyEvents().
						(e as MouseEvent).preventDefault();
					}
				}
			}
		]
	});

	// ── Cấu hình phím — tập trung theo pattern configs $state (Checkbox/DataTable) ──
	// label = ký tự hiển thị trên nút, detail = chuỗi gửi qua CustomEvent('keydown')
	// cho input tiêu thụ (calculator xử lý '=', 'x'→'*', ':'→'/').
	type NumberKeyConfig = { label: string; detail: NumberKeyAllowed };
	// Lưới số: 7 8 9 x / 4 5 6 - / 1 2 3 + / 0 . % =
	const NUMBER_KEYS: NumberKeyConfig[] = [
		{ label: '7', detail: '7' },
		{ label: '8', detail: '8' },
		{ label: '9', detail: '9' },
		{ label: 'x', detail: 'x' },
		{ label: '4', detail: '4' },
		{ label: '5', detail: '5' },
		{ label: '6', detail: '6' },
		{ label: '-', detail: '-' },
		{ label: '1', detail: '1' },
		{ label: '2', detail: '2' },
		{ label: '3', detail: '3' },
		{ label: '+', detail: '+' },
		{ label: '0', detail: '0' },
		{ label: '.', detail: '.' },
		{ label: '%', detail: '%' },
		{ label: '=', detail: '=' }
	];
	// Props dùng chung cho mọi phím — góc vuông (không bo) + không delay (bấm là chạy).
	const KEY_PROPS = { rounded: 'none', delay: '0ms' } as const;

	/**
	 * Sự kiện mousedown dùng chung cho 1 phím — preventDefault (không focus native
	 * input, caret do visual keyboard quản lý) + dispatch CustomEvent('keydown',
	 * { detail }) → input (form/input Main.svelte) tiêu thụ để cập nhật value.
	 * Closure per phím (Button events không có kênh truyền payload khác).
	 */
	function keyEvents(detail: NumberKeyAllowed): BasicProps['events'] {
		return [
			{
				events: {
					mousedown: {
						handler(e) {
							(e as MouseEvent).preventDefault();
							numberKeyboardState.target?.ref?.dispatchEvent(
								new CustomEvent<string>('keydown', { detail })
							);
						}
					}
				}
			}
		];
	}

	onMount(() => {
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
	<Button {...KEY_PROPS} events={keyEvents('ac')}>AC</Button>
	<div class="grid grid-cols-2">
		<Button {...KEY_PROPS} events={keyEvents('(')}>(</Button>
		<Button {...KEY_PROPS} events={keyEvents(')')}>)</Button>
	</div>
	<Button {...KEY_PROPS} events={keyEvents('del')}>Del</Button>
	<Button {...KEY_PROPS} events={keyEvents(':')}>:</Button>
	{#each NUMBER_KEYS as key (key.detail)}
		<Button {...KEY_PROPS} events={keyEvents(key.detail)}>{key.label}</Button>
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
