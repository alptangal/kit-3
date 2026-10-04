//$components/element/tag/_interface.ts
import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

/** Kiểu nền/màu bề mặt của tag — đồng bộ ngôn ngữ variant của Button. */
export type TagVariant = 'soft' | 'solid' | 'outline' | 'ghost';

export interface TagProps extends BasicProps {
	/** Nội dung hiển thị của tag. */
	label?: TranslateContent | string;
	/** Số ký tự tối đa trước khi cắt + ellipsis. */
	maxChars?: number;
	/** Kích thước (default 'sm'). */
	size?: Size;
	/** Màu nền (default 'secondary'). */
	color?: Color;
	/** Kiểu bề mặt (default 'soft'). */
	variant?: TagVariant;
	/** Hiện nút × để bỏ tag. */
	removable?: boolean;
	/** Accessible label cho nút × (default "Remove"). */
	removeLabel?: TranslateContent | string;
	/** Callback khi bấm nút × (thẻ × chỉ emit — cha tự xử lý bỏ chọn). */
	onRemove?: (e: Event) => void;
}

export interface TagConfigs extends BasicConfigs {
	size: Size;
	color: Color;
	variant: TagVariant;
	removable: boolean;
	/** Nội dung đã resolve theo ngôn ngữ + truncate. */
	text: string;
	removeLabel: string;
}
