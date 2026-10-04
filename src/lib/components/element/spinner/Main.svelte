<script lang="ts">
	// $components/element/spinner/Main.svelte
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import type { SpinnerConfigs, SpinnerProps } from './_interface';

	let { ...props }: SpinnerProps = $props();

	// Resolve TranslateContent | string theo ngôn ngữ (fallback en → vi)
	const getText = (content?: { [k: string]: string | undefined }): string => {
		const lang = client.browser?.language ?? 'en';
		return content?.[lang] ?? content?.en ?? content?.vi ?? '';
	};

	let configs: SpinnerConfigs = $state({
		get pattern() {
			return props.pattern ?? 'circle';
		},
		get size() {
			return props.size ?? 'md';
		},
		get color() {
			return props.color ?? 'primary';
		},
		get duration() {
			return convertToMiliseconds(props.duration) ?? 900;
		},
		/** Label hiển thị cho sr-only (mặc định "Loading…"/"Đang tải…"). */
		get labelText() {
			return getText(props.label) || getText({ en: 'Loading…', vi: 'Đang tải…' });
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'spinner-root',
				`pattern-${this.pattern}`,
				`size-${this.size}`,
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			return props.events;
		},
		ref: undefined as HTMLElement | undefined
	});

	const labeled = $derived(!!props.label);
	const statusBar = $derived(labeled ? 'status' : undefined);
	const barHidden = $derived(labeled ? undefined : 'true');
</script>

<div
	class={configs.style}
	role={statusBar}
	aria-hidden={barHidden}
	style:--spinner-duration={`${configs.duration}ms`}
	{@attach handleEvents(configs.event)}
>
	{#if configs.pattern === 'circle'}
		<span class="spinner-ring"></span>
		<span class="spinner-arc"></span>
	{:else if configs.pattern === 'dots'}
		<span class="spinner-dot"></span>
		<span class="spinner-dot"></span>
		<span class="spinner-dot"></span>
	{:else if configs.pattern === 'bars'}
		<span class="spinner-bar"></span>
		<span class="spinner-bar"></span>
		<span class="spinner-bar"></span>
	{:else}
		<span class="spinner-square"></span>
	{/if}
	{#if labeled}
		<span class="spinner-sr">{configs.labelText}</span>
	{/if}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
