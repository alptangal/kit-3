<script lang="ts">
	//$components/element/tag/Main.svelte
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import type { TagConfigs, TagProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let { ...props }: TagProps = $props();

	// Resolve TranslateContent | string to the active language (fallback en → vi)
	const getText = (content?: TranslateContent | string): string => {
		if (!content) return '';
		if (typeof content === 'string') return content;
		const lang = client.browser?.language ?? 'en';
		return content[lang] ?? content.en ?? content.vi ?? '';
	};

	const sizeDerived = $derived(props.size ?? 'sm');
	const colorDerived = $derived(props.color ?? 'secondary');
	const variantDerived = $derived(props.variant ?? 'soft');
	const removableDerived = $derived(!!props.removable);
	const maxCharsDerived = $derived(props.maxChars ?? 0);

	// Text hiển thị (resolve i18n + truncate theo maxChars)
	const textDerived = $derived.by(() => {
		const raw = getText(props.label);
		const max = maxCharsDerived;
		if (max > 0 && raw.length > max) return raw.slice(0, max);
		return raw;
	});

	const removeLabelDerived = $derived.by(
		() => getText(props.removeLabel) || getText({ en: 'Remove', vi: 'Gỡ' })
	);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'tag-root',
			`size-${sizeDerived}`,
			`color-${colorDerived}`,
			`variant-${variantDerived}`,
			removableDerived ? 'removable' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	let configs: TagConfigs = $state({
		get style() {
			return styleDerived;
		},
		get event() {
			return props.events;
		},
		get size() {
			return sizeDerived;
		},
		get color() {
			return colorDerived;
		},
		get variant() {
			return variantDerived;
		},
		get removable() {
			return removableDerived;
		},
		get text() {
			return textDerived;
		},
		get removeLabel() {
			return removeLabelDerived;
		}
	});

	export { configs };
</script>

<svelte:element this={props.as ?? 'span'} class={configs.style} {@attach handleEvents(configs.event)}>
	<span class="tag-text" title={textDerived}>{configs.text}</span>
	{#if configs.removable}
		<!-- Nút ×: preventDefault mousedown để tránh blur trigger (tag nằm trong trigger button của Select) -->
		<button
			type="button"
			class="tag-remove"
			aria-label={configs.removeLabel}
			onmousedown={(e) => e.preventDefault()}
			onclick={(e) => {
				e.stopPropagation();
				props.onRemove?.(e);
			}}
			onkeydown={(e) => {
				// Chặn key bóng lên document handler (nav/option của Select)
				e.stopPropagation();
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					props.onRemove?.(e);
				}
			}}
		>
			<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	{/if}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
