// src/lib/components/element/avatar/Fallback.svelte
// Avatar.Fallback — hiện khi state !== 'loaded' (empty/loading/error).
// Có slot → render slot; không slot → initials tự động từ alt (root):
// chữ cái đầu word đầu + word cuối, uppercase ("Nguyễn Văn A" → "NA", "ACME Inc" → "AI").
// Nền --muted (trên Root), chữ --foreground, font-size = 40% --avatar-size, căn giữa.
// Fade-out khi loaded: Svelte transition (in:fade / out:fade) — transition: opacity.
// BasicProps (events/size/...) không phải DOM attr → tách ra.
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { styleSynced } from '$modules';
	import { getAvatarContext } from './_context';
	import type { AvatarFallbackProps } from './_interface';

let {
	class: classProp,
	children,
	// props không render lên div fallback
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
}: AvatarFallbackProps = $props();

const ctx = getAvatarContext();

// state đọc qua getter của $state proxy → reactive: 'loaded' → block unmount (fade out).
const state = $derived(ctx?.state ?? 'empty');

// class: merge default (.avatar-fallback) + class prop (styleSynced theo contract).
const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['avatar-fallback'] as (string | undefined)[],
			propStyles: classProp
		},
		props.overwriteDefaultStyles
	)
);

// Initials = chữ cái đầu (word đầu) + chữ cái đầu (word cuối), uppercase.
// Ví dụ "Nguyễn Văn A" → "NA", "ACME Inc" → "AI", "ACME" → "A".
const initials = $derived.by(() => {
	const source = (ctx?.alt ?? '').trim();
	if (!source) return '';
	const words = source.split(/\s+/).filter(Boolean);
	const first = words[0].charAt(0).toUpperCase();
	const last = words.length > 1 ? words[words.length - 1].charAt(0).toUpperCase() : '';
	return first + last;
});
</script>

{#if state !== 'loaded'}
	<div class={styleDerived} in:fade={{ duration: 200 }} out:fade={{ duration: 200 }} {...props}>
		{#if children}
			{@render children()}
		{:else if initials}
			<span class="avatar-fallback__initials">{initials}</span>
		{/if}
	</div>
{/if}

<style lang="scss">
	.avatar-fallback {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		font-size: calc(var(--avatar-size, 40px) * 0.4);
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.02em;
		color: var(--foreground);
		user-select: none;
	}
</style>
