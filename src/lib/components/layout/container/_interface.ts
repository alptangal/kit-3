import type { BasicConfigs, BasicProps } from '$components/interface';

export interface ContainerProps extends BasicProps {
	/**Width of the container in pixels. */
	width?: string | number;
	/**Height of the container in pixels. */
	height?: string | number;
	/** Safe-area height compensation (viewport-fit=cover): height number được bọc
	 *  `calc(h - env(safe-area-inset-top) - env(safe-area-inset-bottom))` để Container
	 *  root KHÔNG tràn viewport khi có notch/tai tai (body padding env từ theme.scss
	 *  đẩy Container vào vùng an toàn, height trừ env giữ tổng = viewport khả dụng).
	 *  Chỉ bật ở Container root layout — Container lồng nhau (modal, panel) tự quản lý. */
	safeArea?: boolean;
	/** Tắt transition (height/width/animate) — Container root layout bật để height
	 *  sync tức thì khi iOS address bar thu giãn (transition 300ms + debounce = lag
	 *  cảm nhận ~600ms, height "kẹt" sai viewport giữa chừng). Mặc định giữ transition. */
	transitionDisabled?: boolean;
}
export interface ContainerConfigs extends BasicConfigs{
  /**
   * duration in seconds
   */
duration?:number
}
