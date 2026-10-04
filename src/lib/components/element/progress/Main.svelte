<script lang="ts">
	// $components/element/progress/Main.svelte
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import type { ProgressConfigs, ProgressProps } from './_interface';

	let { ...props }: ProgressProps = $props();

	// Resolve TranslateContent | string theo ngôn ngữ (fallback en → vi)
	const getText = (content?: { [k: string]: string | undefined }): string => {
		const lang = client.browser?.language ?? 'en';
		return content?.[lang] ?? content?.en ?? content?.vi ?? '';
	};

	let configs: ProgressConfigs = $state({
		get size() {
			return props.size ?? 'sm';
		},
		get color() {
			return props.color ?? 'primary';
		},
		get max() {
			const m = props.max ?? 100;
			return m > 0 ? m : 100;
		},
		/** Giá trị hiện tại (0 nếu chưa có). */
		get value() {
			return props.value ?? 0;
		},
		/** indeterminate khi có prop indeterminate, HOẶC value undefined/null. */
		get indeterminate() {
			return props.indeterminate || props.value == null;
		},
		/** Clamp value vào [0, max]. */
		get clampedValue() {
			const v = this.value;
			return Math.min(Math.max(v, 0), this.max);
		},
		/** Độ rộng bar theo % (0–100). */
		get percent() {
			return (this.clampedValue / this.max) * 100;
		},
		/** Text hiển thị khi showValue. */
		get displayText() {
			return `${Math.round(this.clampedValue)}%`;
		},
		/** aria-label (mặc định "Progress"/"Tiến độ" cho a11y). */
		get ariaLabel() {
			return getText(props.label) || getText({ en: 'Progress', vi: 'Tiến độ' });
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'progress-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.indeterminate ? 'is-indeterminate' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			return props.events;
		},
		ref: undefined as HTMLElement | undefined
	});

	const barWidth = $derived(configs.indeterminate ? undefined : `${configs.percent}%`);
	const barNow = $derived(configs.indeterminate ? undefined : configs.clampedValue);
	const barBusy = $derived(configs.indeterminate ? 'true' : undefined);
	const showValue = $derived(!!props.showValue);
</script>

<div
	class={configs.style}
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={configs.max}
	aria-valuenow={barNow}
	aria-busy={barBusy}
	aria-label={configs.ariaLabel}
	{@attach handleEvents(configs.event)}
>
	<div class="progress-track">
		<div class="progress-bar" style:width={barWidth}></div>
	</div>
	{#if showValue}
		<span class="progress-value">{configs.displayText}</span>
	{/if}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
