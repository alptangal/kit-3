// src/lib/components/element/avatar/_interface.ts
// Avatar — composite: Avatar (Root) + Image + Fallback.
// Root giữ load-state (empty/loading/loaded/error) + Symbol context;
// Image báo loaded/error về Root, Fallback hiện khi state !== 'loaded'.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs, Size } from '$components/interface';

export type AvatarLoadState = 'empty' | 'loading' | 'loaded' | 'error';
export type AvatarShape = 'circle' | 'rounded' | 'square';

export interface AvatarProps extends BasicProps {
	/** Kích thước (default 'md') → --avatar-size: xs 24 / sm 32 / md 40 / lg 48 / xl 64 px (size còn lại clamp 24–96). */
	size?: Size;
	/** Dáng: 'circle' (50%) / 'rounded' (--border-radius) / 'square' (0). Default 'circle'. */
	shape?: AvatarShape;
	/** Text accessible của ảnh (fallback của Image.alt). */
	alt?: string;
	/** Label riêng cho root (role="img"); nếu không có → dùng alt. */
	'aria-label'?: string;
}

export interface AvatarConfigs extends BasicConfigs {
	readonly state: AvatarLoadState;
	readonly size: Size;
	readonly shape: AvatarShape;
	readonly alt?: string;
	/** px resolved của size (từ size map). */
	readonly sizePx: number;
	notifyLoaded: () => void;
	notifyError: () => void;
	notifyEmpty: () => void;
}

export interface AvatarImageProps extends BasicProps {
	/** Nguồn ảnh (URL / data-URI). Không có → Root giữ state 'empty'. */
	src?: string;
	/** Alt của <img>; fallback context.alt. */
	alt?: string;
}

export interface AvatarFallbackProps extends BasicProps {
	/** Nội dung fallback tùy chỉnh (icon/emoji/text). Không có slot → tự sinh initials từ alt. */
	children?: Snippet;
}
