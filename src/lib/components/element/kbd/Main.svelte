<script lang="ts">
	//$components/element/kbd/Main.svelte
	// Kbd — phím tắt / key: render <kbd> (semantic). Content là children
	// (vd <Kbd>⌘</Kbd>, <Kbd>Ctrl</Kbd>). Atom nhẹ: $derived cho style (mẫu tag).
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import type { KbdConfigs, KbdProps } from './_interface';

	let {
		variant,
		size,
		single,
		disabled,
		as: _as,
		class: classProp,
		overwriteDefaultStyles,
		events,
		children,
		...props
	}: KbdProps = $props();

	const sizeDerived = $derived(size ?? 'sm');
	const variantDerived = $derived(variant ?? 'default');
	const singleDerived = $derived(!!single);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'kbd-root',
			`size-${sizeDerived}`,
			`variant-${variantDerived}`,
			singleDerived ? 'is-single' : undefined,
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: classProp }, overwriteDefaultStyles);
	});

	let configs: KbdConfigs = $state({
		get style() {
			return styleDerived;
		},
		get event() {
			return events;
		},
		get size() {
			return sizeDerived;
		},
		get variant() {
			return variantDerived;
		},
		get single() {
			return singleDerived;
		}
	});

	export { configs };
</script>

<kbd class={configs.style} {@attach handleEvents(configs.event)} {...props}>
	{@render children?.()}
</kbd>

<style lang="scss">
	@use '_styles.scss';
</style>
