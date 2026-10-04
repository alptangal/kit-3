// src/lib/components/element/separator/_interface.ts
// Separator — vạch ngăn cách (horizontal / vertical). Building block nhỏ của
// hệ layout (Sidebar, form, cards). Chạy qua design token, không hardcode màu.
import type { BasicProps, BasicConfigs } from '$components/interface';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends BasicProps {
	/** Hướng vạch: 'horizontal' (chia dọc) hay 'vertical' (chia ngang) */
	orientation?: SeparatorOrientation;
	/** Chế độ trang trí (role="presentation") thay vì 'separator' */
	decorative?: boolean;
}

export interface SeparatorConfigs extends BasicConfigs {
	readonly orientation: SeparatorOrientation;
	readonly decorative: boolean;
	get style(): (string | undefined)[];
}
