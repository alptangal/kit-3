// src/lib/components/navigation/team-switcher/_interface.ts
// TeamSwitcher (shadcn team-switcher) — chọn team/tổ chức trong sidebar header.
// Render bằng DropdownMenu (element/dropdown-menu). `value` bindable = id team hiện.
import type { Snippet } from 'svelte';
import type { BasicProps } from '$components/interface';

export interface TeamSwitcherTeam {
	/** id duy nhất (khoa binding `value`) */
	id: string;
	name: string;
	/** mã ngắn hiển thị trong avatar (vd "AC", tối đa 2 ký tự được khuyến nghị) */
	abbr: string;
	/** group trong menu (phân nhóm "Công ty"/"Cá nhân") */
	group?: string;
}

export interface TeamSwitcherProps extends BasicProps {
	/** danh sách team */
	teams?: TeamSwitcherTeam[];
	/** id team hiện tại (bindable) */
	value?: string;
	/** sự kiện chọn team (gọi trước khi value cập nhật) */
	onselect?: (team: TeamSwitcherTeam) => void;
	/** sự kiện bấm "Tạo team" (mặc định undefined — page tự xử lý) */
	oncreate?: () => void;
	/** nhãn nút tạo team */
	createLabel?: string;
	/** aria-label cho menu (SR) */
	'aria-label'?: string;
	/** tùy chọn: thay trigger mặc định (tên team + chevron) */
	trigger?: Snippet;
	/** tùy chọn: thay nội dung menu mặc định */
	content?: Snippet;
}
