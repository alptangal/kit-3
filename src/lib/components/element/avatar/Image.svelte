// src/lib/components/element/avatar/Image.svelte
// Avatar.Image — element img (loading="lazy" decoding="async"), object-fit cover.
// Không có src → KHÔNG render img + báo Root về state 'empty' (fallback giữ nguyên).
// onload → 'loaded' (fallback fade out), onerror → 'error' (fallback hiện lại).
// BasicProps (events/size/...) không phải DOM attr → tách ra, chỉ spread prop lạ.
<script lang="ts">
	import { getAvatarContext } from './_context';
	import type { AvatarImageProps } from './_interface';

let {
	src,
	alt,
	class: classProp,
	// props không render lên element img (tránh attribute rác / sai nghĩa)
	events,
	name,
	size,
	onLoad,
	onDestroy,
	transitionDuration,
	transitionEnabled,
	touchActionDisabled,
	portal,
	disabled,
	...props
}: AvatarImageProps = $props();

const ctx = getAvatarContext();

// state đọc qua getter $state proxy → reactive.
const state = $derived(ctx?.state ?? 'loading');

// src reactive: src biến mất (bind đổi) → về lại 'empty' (không còn ảnh để load).
$effect(() => {
	if (!src) ctx?.notifyEmpty();
});
</script>

{#if src}
	<img
		src={src}
		alt={alt ?? ctx?.alt ?? ''}
		loading="lazy"
		decoding="async"
		draggable="false"
		class={classProp}
		class:is-broken={state === 'error'}
		onload={() => ctx?.notifyLoaded()}
		onerror={() => ctx?.notifyError()}
		{...props}
	/>
{/if}

<style lang="scss">
	// img nằm trong template Image → scoped CSS phải ở file này (hash scope Svelte 5).
	// img (loaded) nằm TRÊN fallback (z-1); fallback là z-0 absolute cover của Root.
	img {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	// src hỏng: ẩn img (tránh icon broken-image đè lên fallback) — fallback giữ hiển thị.
	img.is-broken {
		visibility: hidden;
	}
</style>
