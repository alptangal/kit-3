<script lang="ts">
	//$components/element/kbd/Combo.svelte
	// Kbd.Combo — combo phím (⌘⇧K): wrapper inline-flex, separator "&" giữa
	// các <Kbd single> (CSS ::before absolute trong gap — không sửa DOM children).
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import type { KbdComboConfigs, KbdComboProps } from './_interface';

	let {
		'aria-label': ariaLabel,
		class: classProp,
		overwriteDefaultStyles,
		events,
		children,
		...props
	}: KbdComboProps = $props();

	const styleDerived = $derived.by(() =>
		styleSynced({ defaultStyles: ['kbd-combo'], propStyles: classProp }, overwriteDefaultStyles)
	);

	let configs: KbdComboConfigs = $state({
		get style() {
			return styleDerived;
		},
		get event() {
			return events;
		},
		get ariaLabel() {
			return ariaLabel;
		}
	});

	export { configs };
</script>

<span class={configs.style} aria-label={configs.ariaLabel} {@attach handleEvents(configs.event)} {...props}>
	{@render children?.()}
</span>

<style lang="scss">
	@use '_styles.scss';
</style>
