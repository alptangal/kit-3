import type { BasicConfigs, BasicProps, Size } from '$components/interface';

export interface ModalContainerProps extends Omit<BasicProps, 'size'> {
	placement?: ModalProps['placement'];
	size?: ModalProps['size'];
}
export interface ModalContainerConfigs extends Omit<BasicConfigs, 'size'> {
	size: ModalConfigs['size'];
	placement: ModalProps['placement'];
	children: {
		header?: ModalHeaderConfigs;
		body?: ModalBodyConfigs;
		footer?: ModalFooterConfigs;
	};
}
export interface ModalHeaderProps extends BasicProps {
	actionButtons?: {
		close?: {
			display: boolean;
		};
	};
	/**
	 * Ghim header khi body cuộn (position: sticky). Mặc định `false`.
	 *
	 * Lưu ý (2026-10-03): container giờ là flex column, scroll nằm ở
	 * `.modal-body-root` → header (flex sibling) ĐỨNG YÊN tự nhiên khi
	 * body cuộn, KHÔNG cần `position: sticky`. Prop này còn giữ để tương
	 * thích ngược (không phá code gọi `sticky` cũ); giá trị `true/false`
	 * giờ gần như no-op về mặt hiển thị.
	 */
	sticky?: boolean;
}
export interface ModalHeaderConfigs extends BasicConfigs {
	preventOutsideClose: boolean;
	sticky: boolean;
	actionButton: {
		close?: {
			display: boolean;
			size: Size;
			event?: BasicProps['events'];
		};
	};
}
export interface ModalBodyProps extends BasicProps {}
export interface ModalBodyConfigs extends BasicConfigs {}
export interface ModalFooterProps extends BasicProps {
	/**
	 * Ghim footer khi body cuộn (position: sticky). Mặc định `false`.
	 *
	 * Lưu ý (2026-10-03): container giờ là flex column, scroll nằm ở
	 * `.modal-body-root` → footer (flex sibling) ĐỨNG YÊN tự nhiên khi
	 * body cuộn, KHÔNG cần `position: sticky`. Prop này còn giữ để tương
	 * thích ngược (không phá code gọi `sticky` cũ); giá trị `true/false`
	 * giờ gần như no-op về mặt hiển thị.
	 */
	sticky?: boolean;
}
export interface ModalFooterConfigs extends BasicConfigs {
	sticky: boolean;
}
/**
 * Nguyên nhân modal chuyển từ mở → đóng:
 * - `escape`: user bấm phím Esc.
 * - `backdrop`: user click ra ngoài nền (backdrop).
 * - `close-button`: user bấm nút × trong Header.
 * - `programmatic`: code set `display = false` (bind:display / footer button…).
 */
export type ModalCloseReason = 'escape' | 'backdrop' | 'close-button' | 'programmatic';

export interface ModalProps extends Omit<BasicProps, 'size'> {
	display?: boolean;
	size?: Size | 'full';
	variant?: 'opaque' | 'blur' | 'transparent';
	placement?: 'auto' | 'top' | 'bottom' | 'center';
	isDimissable?: boolean;
	/**
	 * Ngăn user đóng modal bằng cách click ra ngoài (backdrop).
	 * Mặc định `false` — click backdrop đóng (đồng bộ `isDimissable`).
	 * Khi `true`, ESC + nút close vẫn hoạt động; chỉ backdrop click bị chặn.
	 */
	preventOutsideClose?: boolean;
	transitionType?: 'fly' | 'slide' | 'fade' | 'none';
	/** Gọi khi modal chuyển từ đóng → mở */
	onOpen?: () => void;
	/**
	 * Gọi khi modal chuyển từ mở → đóng (MỌI nguyên nhân), kèm `reason`:
	 * `escape` (phím Esc) · `backdrop` (click nền) · `close-button` (nút ×) ·
	 * `programmatic` (code set display = false).
	 */
	onClose?: (reason: ModalCloseReason) => void;
	/** Đóng bởi phím Esc — fire cùng `onClose('escape')`. */
	onCloseByEscape?: () => void;
	/** Đóng bởi click ra ngoài nền (backdrop) — fire cùng `onClose('backdrop')`. */
	onCloseByBackdrop?: () => void;
	/** Đóng bởi nút × trong Header — fire cùng `onClose('close-button')`. */
	onCloseByButton?: () => void;
	/** Đóng bởi code (`display = false`) — fire cùng `onClose('programmatic')`. */
	onCloseByProgrammatic?: () => void;
	/** Tự focus vào modal khi mở (mặc định `true`). `false` → giữ focus hiện tại */
	autoFocus?: boolean;
	/** CSS selector (trong modal) cần focus khi mở — ưu tiên hơn `autoFocus` */
	initialFocus?: string;
}
export interface ModalConfigs extends Omit<BasicConfigs, 'size'> {
	size: ModalProps['size'];
	placement: ModalProps['placement'];
	children: {
		container?: ModalContainerConfigs;
		contentWrapper?: HTMLElement;
	};
	isDimissable: boolean;
	preventOutsideClose: boolean;
	display?: boolean;
	transitionType?: ModalProps['transitionType'];
	ariaIds: {
		modalId: string;
		headerId: string;
		bodyId: string;
		footerId: string;
	};
	/**
	 * Internal: đóng modal kèm reason (Header gọi với `'close-button'`).
	 * Không phải prop public — không truyền từ bên ngoài.
	 */
	closeByReason?: (reason: ModalCloseReason) => void;
}
