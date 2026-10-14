import type { BasicProps, Color } from '$components/interface';

export interface MessageComponent extends BasicProps {
	nameComponent: string;
	// 'accent' | 'danger' là tên cũ pre-token — switch trong component đọc trực tiếp
	color?: Color | 'accent' | 'danger';
	description: string;
	nameComponentClass?: string | string[];
	descriptionClass?: string | string[];
	icon?: string;
}
