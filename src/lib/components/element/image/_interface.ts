//$components/element/image/_interface.ts
import type { BasicConfigs, BasicProps, Size } from '$components/interface';

/** Aspect-ratio preset hoặc số tự do (width/height). Dùng để khoá box, tránh CLS. */
export type ImageRatio = 'square' | '1:1' | '4:3' | '3:2' | '16:9' | '21:9' | number;
/** CSS object-fit của ảnh trong box (default 'cover'). */
export type ImageObjectFit = 'cover' | 'contain' | 'fill' | 'scale-down';
/** Vòng đời nạp của src hiện tại. */
export type ImageLoadState = 'loading' | 'loaded' | 'error';

export interface ImageProps extends BasicProps {
	/** Nguồn ảnh (URL / data-URI). */
	src: string;
	/** Text accessible (bắt buộc về a11y trừ khi decorative). */
	alt?: string;
	/** Rộng box (số → px, string giữ nguyên). Default '100%'. */
	width?: number | string;
	/** Cao box (số → px, string giữ nguyên). */
	height?: number | string;
	/** Aspect-ratio → khoá box, chống CLS. */
	ratio?: ImageRatio;
	/** Kiểu crop (default 'cover'). */
	objectFit?: ImageObjectFit;
	/** CSS object-position (default 'center'). */
	objectPosition?: string;
	/** Bo góc (Size | 'full' | 'none'). Default theo size. */
	rounded?: Size | 'full' | 'none';
	/** Native loading="lazy" (default true). */
	lazy?: boolean;
	/** Skeleton shimmer khi loading (default true). */
	shimmer?: boolean;
	/** Fade-in khi load xong (default true). */
	fade?: boolean;
	/** Blur-up crossfade khi đổi src — giữ layer cũ (default true). */
	crossfade?: boolean;
	/** Hover-zoom, CHỈ thiết bị có hover (PC) (default true). */
	zoom?: boolean;
	/** Nguồn dự phòng, thử 1 lần khi lỗi. */
	fallback?: string;
	/** Gọi khi lỗi / fallback đã dùng. */
	onError?: (e: Event) => void;
}

export interface ImageConfigs extends BasicConfigs {}
