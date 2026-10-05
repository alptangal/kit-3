// src/lib/components/element/avatar/Root.svelte
// Avatar (Root) — `role="img"` + aria-label (aria-label ?? alt). Giữ load-state
// (empty/loading/loaded/error) + Symbol context cho Image/Fallback.
// size → --avatar-size (px map spec: xs 24 / sm 32 / md 40 / lg 48 / xl 64, size khác clamp md).
// shape → border-radius: circle 50% / rounded --border-radius / square 0.
<script lang="ts">
	import { styleSynced } from '$modules';
	import type { Size } from '$components/interface';
	import { setAvatarContext } from './_context';
	import type { AvatarConfigs, AvatarLoadState, AvatarProps, AvatarShape } from './_interface';

let {
	size: sizeProp,
	shape = 'circle',
	alt,
	'aria-label': ariaLabel,
	as: asProp,
	class: classProp,
	children,
	...props
}: AvatarProps = $props();

// Size map (spec). Size ngoài bảng (2xl+) clamp về md — không phóng đại avatar.
const SIZE_PX: Record<string, number> = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };

const resolvedSize: Size = $derived(sizeProp ?? 'md');
const sizePx = $derived(SIZE_PX[resolvedSize] ?? 40);
const label = $derived(ariaLabel ?? alt);

// Load-state: 'empty' khi Image không có src; 'loading' khi có src chưa onload/onerror.
// Tên KHÔNG dùng `state` (trùng rune `$state` → compiler parse `$state(...)` thành
// auto-subscription của biến, sai nghĩa). Dùng `loadState`.
let loadState: AvatarLoadState = $state('loading');

// Getter (không phải property copy): sub-components (Image/Fallback) đọc qua
// $derived → theo dõi `loadState` $state → fallback unmount đúng khi loaded.
let configs: AvatarConfigs = $state({
	get state() {
		return loadState;
	},
	get size() {
		return resolvedSize;
	},
	get shape() {
		return shape;
	},
	get alt() {
		return alt;
	},
	get sizePx() {
		return sizePx;
	},
	notifyLoaded() {
		loadState = 'loaded';
	},
	notifyError() {
		loadState = 'error';
	},
	notifyEmpty() {
		// Không có src → 'empty' (không có ảnh để load).
		loadState = 'empty';
	}
});

setAvatarContext(configs);
export { configs };

// State là class do JS quản lý (contract §0 DNA-3) — probe dựa vào đây.
const styleDerived = $derived.by(() => {
	const defaultStyles: (string | undefined)[] = [
		'avatar-root',
		`size-${resolvedSize}`,
		`shape-${shape}`,
		loadState === 'loaded' ? 'is-loaded' : undefined,
		loadState === 'error' ? 'is-error' : undefined,
		loadState === 'empty' ? 'is-empty' : undefined
	];
	return styleSynced({ defaultStyles, propStyles: classProp }, props.overwriteDefaultStyles);
});
</script>

<svelte:element
	this={asProp ?? 'div'}
	role="img"
	aria-label={label}
	class={styleDerived}
	style:--avatar-size={`${sizePx}px`}
	{...props}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '_styles.scss' as avatar;

	.avatar-root {
		--avatar-shape-radius: 50%;
		--avatar-size: 40px;

		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: var(--avatar-size);
		height: var(--avatar-size);
		overflow: hidden;
		background-color: var(--muted, #71717a);
		border-radius: var(--avatar-shape-radius);
		vertical-align: middle;
		// Fallback (z-0) fade-out khi unmount do Fallback.svelte (transition:fade — scoped CSS
		// không cross-component); img nằm trên (z-1, style scoped trong Image.svelte).

		&.size-xs { --avatar-size: avatar.avatar-size-px('xs'); }
		&.size-sm { --avatar-size: avatar.avatar-size-px('sm'); }
		&.size-md { --avatar-size: avatar.avatar-size-px('md'); }
		&.size-lg { --avatar-size: avatar.avatar-size-px('lg'); }
		&.size-xl { --avatar-size: avatar.avatar-size-px('xl'); }
		// size 2xl+ (clamp): --avatar-size do inline style JS đặt (size map TS)

		&.shape-circle { --avatar-shape-radius: 50%; }
		&.shape-rounded { --avatar-shape-radius: var(--border-radius-lg, 0.5rem); }
		&.shape-square { --avatar-shape-radius: 0; }
	}
</style>
