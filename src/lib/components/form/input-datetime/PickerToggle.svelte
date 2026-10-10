<script lang="ts">
	// src/lib/components/form/input-datetime/PickerToggle.svelte
	// Nút mở panel lịch của InputDatetime (props.datePicker) — mirror
	// date-picker/Trigger.svelte: đọc DatePicker context (Root render trong
	// Main.svelte bọc quanh snippet), aria-haspopup="dialog" + aria-expanded +
	// aria-controls. data-dp-trigger để Root.closeAndFocusTrigger() (Escape /
	// outside-click / chọn xong) trả focus đúng nút này. Icon calendar inline
	// SVG (KHÔNG iconify — đồng bộ Trigger).
	import { getDatePickerContext } from '$components/element/date-picker/_context';

	const ctx = getDatePickerContext();
	const open = $derived(ctx?.open ?? false);
	const disabled = $derived(ctx?.disabled ?? false);
	const size = $derived(ctx?.size ?? 'md');

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		if (disabled || !ctx) return;
		ctx.toggle();
	}
</script>

<button
	type="button"
	data-dp-trigger
	class="dt-picker size-{size} {open ? 'open' : ''}"
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls={ctx?.contentId}
	aria-label="Chọn ngày từ lịch"
	{disabled}
	onclick={handleClick}
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="4" width="18" height="18" rx="2" />
		<path d="M16 2v4M8 2v4M3 10h18" />
	</svg>
</button>

<style lang="scss">
	@use '_picker-styles.scss';
</style>
