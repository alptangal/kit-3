<script lang="ts">
	// src/lib/components/element/date-picker/Trigger.svelte
	// DatePicker.Trigger — button hiển thị ngày đã chọn (dd/mm/yyyy) hoặc
	// placeholder. ARIA: aria-haspopup="dialog" + aria-expanded + aria-controls
	// (contentId từ context). Icon calendar inline SVG (KHÔNG iconify → không
	// phụ thuộc fetch runtime). Click → ctx.toggle(); kích thước đồng bộ
	// Button↔Input (DESIGN_SYSTEM §2.1) qua class size-* trên ROOT.
	import { getDatePickerContext } from './_context';
	import { formatDateVN } from './_dates';
	import type { DatePickerTriggerProps } from './_interface';

	let {
		onclick: onClick,
		'aria-label': ariaLabel,
		...props
	}: DatePickerTriggerProps = $props();

	const ctx = getDatePickerContext();
	const open = $derived(ctx?.open ?? false);
	const disabled = $derived(ctx?.disabled ?? false);
	const placeholder = $derived(ctx?.placeholder ?? 'Chọn ngày');
	const label = $derived(ariaLabel ?? ctx?.ariaLabel ?? 'Chọn ngày');
	const selectedText = $derived(formatDateVN(ctx?.selected ?? null));
	const size = $derived(ctx?.size ?? 'md');

	function handleClick(e: MouseEvent) {
		onClick?.(e);
		if (disabled || !ctx) return;
		e.stopPropagation();
		ctx.toggle();
	}
</script>

<button
	type="button"
	data-dp-trigger
	class="date-picker-trigger size-{size} {disabled ? 'disabled' : ''} {open ? 'open' : ''} {selectedText ? 'has-value' : ''}"
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls={ctx?.contentId}
	aria-label={selectedText ? undefined : label}
	{disabled}
	onclick={handleClick}
	{...props}
>
	<svg
		class="date-picker-trigger__icon"
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
	<span class="date-picker-trigger__label" data-dp-trigger-label>{selectedText || placeholder}</span>
</button>

<style lang="scss">
	// Size map trigger đồng bộ Button↔Input (DESIGN_SYSTEM §2.1) — giá trị
	// chính qua --dp-trigger-h (table min-height). class size-* gắn trên trigger
	// (font-size theo size; height ">= min-height" — trigger có thể cao hơn nếu
	// label dài, KHÔNG ép fixed height).
	.date-picker-trigger {
		--dp-trigger-h: 2.875rem;
		--dp-trigger-font: 0.9375rem;
		&.size-xs {
			--dp-trigger-h: 1.875rem;
			--dp-trigger-font: 0.75rem;
		}
		&.size-sm {
			--dp-trigger-h: 2.5rem;
			--dp-trigger-font: 0.875rem;
		}
		&.size-lg {
			--dp-trigger-font: 1rem;
		}
		&.size-xl {
			--dp-trigger-h: 3.125rem;
			--dp-trigger-font: 1rem;
		}
		&.size-2xl,
		&.size-3xl,
		&.size-4xl,
		&.size-5xl {
			--dp-trigger-h: var(--font-size);
		}

		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--dp-trigger-h, 2.875rem);
		padding: 0 0.75rem;
		font-size: var(--dp-trigger-font, 0.9375rem);
		font-weight: 500;
		line-height: 1.25;
		color: var(--foreground);
		background: var(--background, #fff);
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: pointer;
		user-select: none;
		touch-action: manipulation;
		transition: border-color var(--transition-duration, 150ms) ease,
			box-shadow var(--transition-duration, 150ms) ease;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}

		.date-picker-trigger__icon {
			width: 1em;
			height: 1em;
			flex-shrink: 0;
			opacity: 0.7;
		}

		.date-picker-trigger__label {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		// field-type focus recipe (mẫu Input): border + glow indigo
		&.open {
			--dp-border: var(--color-sky-500, hsl(199 89% 48%));
			border-color: var(--dp-border);
			box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
		}

		@media (hover: hover) and (pointer: fine) {
			&:not(.disabled):not(.open):hover {
				border-color: var(--color-indigo-300, hsl(234 89% 73%));
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
			pointer-events: none;
		}

		// mobile: font ≥ 1rem cho size nhỏ chặn iOS auto-zoom
		@media (hover: none) and (pointer: coarse) {
			&.size-xs,
			&.size-sm {
				font-size: 1rem;
			}

			&:active:not(.disabled) {
				transform: scale(0.97);
			}
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);

			&.open {
				box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
			}
		}
	}
</style>
