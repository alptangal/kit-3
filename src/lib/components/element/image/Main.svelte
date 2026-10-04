<script lang="ts">
	//$components/element/image/Main.svelte
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import type { ImageConfigs, ImageLoadState, ImageProps } from './_interface';
	import { onDestroy, untrack } from 'svelte';

	let { ...props }: ImageProps = $props();

	// ── Resolve design tokens (sizes.scss: size-*/rounded-*) ──
	const sizeDerived = $derived(props.size ?? client.browser?.size ?? 'md');
	const roundedDerived = $derived(props.rounded ?? sizeDerived);
	const objectFitDerived = $derived(props.objectFit ?? 'cover');
	const objectPositionDerived = $derived(props.objectPosition ?? 'center');
	const lazyDerived = $derived(props.lazy ?? true);
	const shimmerDerived = $derived(props.shimmer ?? true);
	const fadeDerived = $derived(props.fade ?? true);
	const zoomDerived = $derived(props.zoom ?? true);
	const crossfadeDerived = $derived(props.crossfade ?? true);
	const altDerived = $derived(props.alt ?? '');

	// ── Box: width/height/aspect-ratio (aspect-ratio khoá box → không CLS) ──
	const widthCss = $derived(
		props.width == null ? undefined : typeof props.width === 'number' ? `${props.width}px` : props.width
	);
	const heightCss = $derived(
		props.height == null ? undefined : typeof props.height === 'number' ? `${props.height}px` : props.height
	);
	const ratioCss = $derived.by(() => {
		const r = props.ratio;
		if (r == null) return undefined;
		// Số = tỉ lệ width/height (vd 1.777 = 16:9) → CSS đọc 1 giá trị theo chiều ngang/dọc
		if (typeof r === 'number') return `${r}`;
		switch (r) {
			case 'square':
			case '1:1':
				return '1 / 1';
			case '4:3':
				return '4 / 3';
			case '3:2':
				return '3 / 2';
			case '16:9':
				return '16 / 9';
			case '21:9':
				return '21 / 9';
			default:
				return undefined;
		}
	});

	// ── Vòng đời load ──
	/** src đang render (src gốc hoặc fallback đã bật). */
	let activeSrc = $state<string | undefined>(props.src || undefined);
	/** src layer cũ giữ lại trong lúc crossfade/blur-up (tự dọn sau khi ảnh mới load). */
	let prevSrc = $state<string | undefined>(undefined);
	// `let` (không const) — reassign binding khi đổi vòng đời load.
	let status = $state<ImageLoadState>('loading');
	let fallbackUsed = false;
	let clearPrevId: ReturnType<typeof setTimeout> | undefined;

	// Đổi src → reset về loading; nếu đang loaded + crossfade thì giữ layer cũ (blur-up).
	// CHỈ reactive với `props.src`: activeSrc/status đọc trong untrack để KHÔNG re-run khi
	// handleError đổi activeSrc sang fallback (nếu reactive → effect re-run vì đọc activeSrc
	// đã đổi → reset activeSrc về props.src + fallbackUsed=false → lỗi → fallback → reset…
	// vòng lặp vô hạn, ảnh fallback không bao giờ load).
	$effect.pre(() => {
		const s = props.src;
		const currentActive = untrack(() => activeSrc);
		const wasLoaded = untrack(() => status === 'loaded');
		if (!s || s === currentActive) return;
		if (wasLoaded && crossfadeDerived) prevSrc = currentActive ?? undefined;
		activeSrc = s;
		status = 'loading';
		fallbackUsed = false;
		if (clearPrevId) {
			clearTimeout(clearPrevId);
			clearPrevId = undefined;
		}
	});

	function handleLoad() {
		status = 'loaded';
		if (prevSrc) {
			// Ảnh mới đã fade lên trên layer cũ → dọn layer cũ sau khi crossfade xong.
			if (clearPrevId) clearTimeout(clearPrevId);
			clearPrevId = setTimeout(() => {
				prevSrc = undefined;
				clearPrevId = undefined;
			}, 450);
		}
	}

	function handleError(e: Event) {
		// Fallback: retry đúng 1 lần (guard fallbackUsed + khác activeSrc tránh lặp vô hạn).
		if (props.fallback && props.fallback !== activeSrc && !fallbackUsed) {
			fallbackUsed = true;
			const wasLoaded = status === 'loaded';
			if (wasLoaded && crossfadeDerived) prevSrc = activeSrc ?? undefined;
			activeSrc = props.fallback;
			status = 'loading';
			return;
		}
		status = 'error';
		props.onError?.(e);
	}

	onDestroy(() => {
		if (clearPrevId) clearTimeout(clearPrevId);
	});

	let configs: ImageConfigs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'image-root',
				`size-${sizeDerived}`,
				`rounded-${roundedDerived}`,
				`is-${status}`,
				fadeDerived ? undefined : 'image-no-fade',
				zoomDerived ? 'image-zoomable' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return sizeDerived;
		},
		get status() {
			return status;
		},
		get event() {
			return props.events;
		}
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'div'}
	class={configs.style}
	bind:this={configs.ref}
	style:width={widthCss}
	style:height={heightCss}
	style:aspect-ratio={ratioCss}
	style:--image-fit={objectFitDerived}
	style:--image-pos={objectPositionDerived}
	{@attach handleEvents(configs.event)}
>
	<!-- Crossfade/blur-up: layer cũ giữ nền (mờ + hơi phóng to) tới khi ảnh mới fade lên -->
	{#if prevSrc && status === 'loading'}
		<img class="image-old" src={prevSrc} alt="" aria-hidden="true" loading="eager" decoding="async" />
	{/if}
	<!-- Shimmer skeleton: chỉ khi load lần đầu (không có layer cũ để giữ chỗ) -->
	{#if status === 'loading' && shimmerDerived && !prevSrc}
		<div class="image-shimmer" aria-hidden="true"></div>
	{/if}
	<!-- Error: fallback hết lượt hoặc không có fallback -->
	{#if status === 'error'}
		<div class="image-error" role="img" aria-label={altDerived || 'image could not be loaded'}>
			<svg
				width="1em"
				height="1em"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="18" height="18" rx="2"></rect>
				<circle cx="8.5" cy="8.5" r="1.5"></circle>
				<path d="M21 15l-5-5L5 21"></path>
			</svg>
		</div>
	{:else if activeSrc}
		<img
			class="image"
			src={activeSrc}
			alt={altDerived}
			{...(!altDerived ? { role: 'presentation' } : {})}
			loading={lazyDerived ? 'lazy' : 'eager'}
			decoding="async"
			onload={handleLoad}
			onerror={handleError}
		/>
	{/if}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
