// src/lib/components/element/kbd/_interface.ts
// Kbd — phím tắt / key (render <kbd>); Kbd.Combo gom nhiều phím + separator "&".
import type { BasicConfigs, BasicProps, Size } from '$components/interface';

export type KbdVariant = 'default' | 'outline';

export interface KbdProps extends BasicProps {
	/** Passthrough `data-*` attributes (vd `data-test`) — spread lên <kbd>. */
	'data-test'?: string;
	/** Bề mặt phím (default 'default': physical-key look). */
	variant?: KbdVariant;
	/** Kích thước (default 'sm'). */
	size?: Size;
	/** Thu gọn padding/width khi nằm trong Kbd.Combo. */
	single?: boolean;
}

export interface KbdConfigs extends BasicConfigs {
	size: Size;
	variant: KbdVariant;
	single: boolean;
}

export interface KbdComboProps extends BasicProps {
	/** Passthrough `data-*` attributes (vd `data-test`) — spread lên <span>. */
	'data-test'?: string;
	/** aria-label tổng hợp (vd "Command Shift K") — chỉ set khi truyền. */
	'aria-label'?: string;
}

export interface KbdComboConfigs extends BasicConfigs {
	/** aria-label tổng hợp (undefined nếu không truyền). */
	ariaLabel?: string;
}
