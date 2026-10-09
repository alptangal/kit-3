//$components/element/error/_interface.ts
import type { BasicConfigs, BasicProps } from '$components/interface';

export interface ErrorPageProps extends Omit<BasicProps, 'size'> {
	/** Mã lỗi HTTP (400/401/403/404/500...). default '404'. */
	status?: number | string;
	/** Message lỗi cụ thể (override map mặc định theo status). */
	message?: string;
	/** Số cột matrix (default 40). */
	matrixCols?: number;
	/** Số hàng matrix (default 14). */
	matrixRows?: number;
	/** Tắt animation matrix (cells tĩnh). */
	staticMatrix?: boolean;
}

export interface ErrorPageConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	status: string;
	message: string;
	matrixCols: number;
	matrixRows: number;
	staticMatrix: boolean;
	/** Mã lỗi hiển thị to (vd "404"). */
	displayStatus: string;
	/** Mô tả lỗi theo map (vi/en fallback message prop). */
	displayMessage: string;
	/** Màu mã lỗi: 4xx → warning, 5xx → danger, khác → foreground. */
	statusColor: 'warning' | 'danger' | 'foreground';
	/** Tập ký tự matrix (0/1 + katakana). */
	matrixChars: string[];
}
