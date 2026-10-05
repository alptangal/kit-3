// src/lib/components/element/date-picker/_interface.ts
// DatePicker — composite (shadcn date picker, PURE JS — KHÔNG date library).
// Root giữ `value` (bindable Date|null) + `open` (bindable) + tháng hiển thị +
// Symbol context. Trigger = button (aria-haspopup="dialog" + aria-expanded +
// aria-controls). Content = panel calendar (role="grid", 7 cột × 6 hàng, tuần
// bắt đầu thứ Hai — chuẩn VN/ISO) absolute dưới trigger (mẫu popover, KHÔNG
// portal). So sánh ngày LUÔN theo (y,m,d) địa phương — không getTime.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';

export interface DatePickerConfigs extends BasicConfigs {
	/** id nội bộ của Trigger (aria-controls fallback) */
	readonly triggerId: string;
	/** id nội bộ của Calendar panel (gắn lên panel + trigger aria-controls) */
	readonly contentId: string;
	/** tháng đang hiển thị (year, month — month 0-based) */
	readonly displayMonth: { year: number; month: number };
	/** ngày đã chọn (Date|null) — KHÔNG redeclare `value` (xung đột BasicConfigs.value) */
	readonly selected: Date | null;
	/** Date | null ban đầu (props) — khởi tạo tháng hiển thị */
	readonly initialMonth: Date | null;
	/** Date | undefined — giới hạn dưới (bao gồm ngày này) */
	readonly min: Date | undefined;
	/** Date | undefined — giới hạn trên (bao gồm ngày này) */
	readonly max: Date | undefined;
	/** placeholder khi chưa chọn (trigger) */
	readonly placeholder: string;
	/** open (getter — đọc state Root). TÊN KHÁC method `openPanel` để khỏi
	 *  collision (method cùng tên trong object literal sẽ CHE getter). */
	readonly open: boolean;
	/** disabled (getter — props.disabled của Root) */
	readonly disabled: boolean;
	/** ngày đang roving-focus trong lưới (null = chưa focus) */
	readonly focusDate: Date | null;
	/** aria-label trigger (fallback 'Chọn ngày') */
	readonly ariaLabel: string | undefined;
	/** style trigger (styleSynced — sub Trigger dùng) */
	readonly style: string[];
	/** mở panel (KHÔNG đặt tên `open` — trùng getter state, object literal
	 *  method sẽ che getter → ctx.open thành function) */
	openPanel: () => void;
	/** đóng panel */
	close: () => void;
	toggle: () => void;
	/** đóng + trả focus về trigger (Escape / outside-click / chọn xong) */
	closeAndFocusTrigger: () => void;
	/** chọn ngày (no-op nếu ngày bị min/max hoặc disabled chặn) */
	select: (date: Date) => void;
	/** chuyển tháng hiển thị ±n tháng */
	shiftMonth: (n: 1 | -1) => void;
	/** roving focus: set focusDate + đồng bộ displayMonth theo tháng của ngày */
	setFocus: (date: Date) => void;
	/** quick-jump về hôm nay (đổi tháng + focus hôm nay nếu hợp lệ) */
	jumpToToday: () => void;
}

export interface DatePickerRootProps extends BasicProps {
	/** ngày đã chọn (bindable). null = chưa chọn. */
	value?: Date | null;
	/** mở panel (bindable, controlled). Mặc định uncontrolled. */
	open?: boolean;
	/** open ban đầu khi chưa bind:open */
	defaultOpen?: boolean;
	/** giới hạn nhỏ nhất (bao gồm ngày này) */
	min?: Date;
	/** giới hạn lớn nhất (bao gồm ngày này) */
	max?: Date;
	/** tháng mở ban đầu (mặc định: tháng của value nếu có, ngược lại tháng hiện tại) */
	initialMonth?: Date;
	/** text khi chưa chọn (trigger) */
	placeholder?: string;
	/** aria-label cho trigger (mặc định 'Chọn ngày') */
	'aria-label'?: string;
	/** child element (Trigger + Content) */
	children?: Snippet;
}

export interface DatePickerTriggerProps extends BasicProps {
	onclick?: (e: MouseEvent) => void;
	/** aria-label riêng cho trigger (ghi đè fallback 'Chọn ngày') */
	'aria-label'?: string;
}

export interface DatePickerContentProps extends BasicProps {
	/** aria-label cho panel (role=dialog) */
	'aria-label'?: string;
}
