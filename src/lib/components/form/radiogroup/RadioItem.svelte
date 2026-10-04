<script lang="ts">
	//$components/form/radiogroup/RadioItem.svelte
	// Một option radio: native input (visually-hidden, giữ a11y + click area)
	// + indicator inline (.radio-circle, general-sibling CSS) + label (+description).
	// Đọc Symbol context của group (getRadioContext) — KHÔNG còn string context.
	// Roving tabindex (WAI-ARIA radio group): chỉ activeId có tabindex=0.
	import { onDestroy, onMount } from 'svelte';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getRadioContext } from './_context';
	import type { RadioItemProps } from './_interface';

	let { id, label, description, children, ...props }: RadioItemProps = $props();
	// Narrow qua const trung gian: hoisted `function` declaration (handleChange/
	// handleFocus/handleBlur) được type-check trước khi `if (!configs) throw` chạy
	// nên không kế thừa narrowing trực tiếp → `configs` phải là const đã narrow sẵn.
	const radioContext = getRadioContext();
	if (!radioContext) {
		throw new Error('RadioItem phải nằm trong RadioGroup (thiếu radio context).');
	}
	const configs = radioContext;

	// Item-level disabled (đăng ký vào configs.items để group tính enabledIds)
	const disabledEffective = $derived(props.disabled ?? configs.disabled ?? false);
	const isSelected = $derived(configs.value === id);
	const isActive = $derived(configs.activeId === id);

	// Description: TranslateContent | string (giữ đúng convention của input placeholder)
	const descriptionText = $derived.by(() => {
		if (!description) return undefined;
		if (typeof description === 'string') return description;
		const lang = client.browser?.language ?? 'en';
		const text = description[lang] ?? description.en ?? description.vi;
		return text ? text : undefined;
	});

	const itemClass = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'radio-item',
			isSelected ? 'selected' : undefined,
			disabledEffective ? 'disabled-item' : undefined,
			descriptionText ? 'has-description' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Đăng ký id vào group (DOM order = thứ tự mount, static children)
	onMount(() => {
		if (!configs.ids.includes(id)) configs.ids = [...configs.ids, id];
		configs.items.set(id, { disabled: props.disabled });
		return () => {
			const idx = configs.ids.indexOf(id);
			if (idx >= 0) configs.ids = configs.ids.filter((item) => item !== id);
			configs.items.delete(id);
		};
	});

	function handleChange() {
		configs.select(id);
	}

	function handleFocus() {
		if (!disabledEffective) configs.status.focus = true;
	}

	function handleBlur() {
		configs.status.focus = false;
	}
</script>

<label class={itemClass}>
	<!--
		Native input: visually-hidden nhưng VẪN chiếm box (absolute + opacity 0)
		để giữ click area + a11y native (checked/disabled). Đứng TRƯỚC .radio-circle
		trong DOM → CSS general-sibling `.radio-input:checked ~ .radio-circle`
		(không dùng :has() — build target es2020 + safari15).
	-->
	<input
		type="radio"
		class="radio-input"
		name={configs.name}
		value={id}
		checked={isSelected}
		disabled={disabledEffective}
		tabindex={isActive ? 0 : -1}
		aria-label={label}
		onchange={handleChange}
		onfocus={handleFocus}
		onblur={handleBlur}
	/>
	<span class="radio-circle" aria-hidden="true"></span>
	<span class="radio-text">
		<span class="radio-label">{label}</span>
		{#if descriptionText}
			<span class="radio-description">{descriptionText}</span>
		{/if}
	</span>
	{#if children}
		{@render children()}
	{/if}
</label>

<style lang="scss">
	@use '_item-styles.scss';
</style>
