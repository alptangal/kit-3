// src/lib/components/element/card/_interface.ts
// Card — composite surface (shadcn card): Card + Header/Title/Description/Content/Footer/Action.
// Root chỉ bọc `<div|{as}>` (p-0, elevation); spacing do sub-components quản lý.
import type { BasicProps, BasicConfigs } from '$components/interface';

export type CardElevation = 'none' | 'border' | 'raised';

export interface CardRootProps extends BasicProps {
	/** Elevation: 'border' (1px border + radius, mặc định) / 'raised' (thêm box-shadow) / 'none' (trong suốt). */
	elevation?: CardElevation;
	/** aria-label cho screen reader khi as != 'div'. */
	'aria-label'?: string;
}

export interface CardRootConfigs extends BasicConfigs {
	elevation: CardElevation;
}

export interface CardHeaderProps extends BasicProps {}
export interface CardTitleProps extends BasicProps {}
export interface CardDescriptionProps extends BasicProps {}
export interface CardContentProps extends BasicProps {}
export interface CardFooterProps extends BasicProps {}
export interface CardActionProps extends BasicProps {}
