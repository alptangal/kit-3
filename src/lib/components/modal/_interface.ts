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
}
export interface ModalHeaderConfigs extends BasicConfigs {
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
export interface ModalFooterProps extends BasicProps {}
export interface ModalFooterConfigs extends BasicConfigs {}
export interface ModalProps extends Omit<BasicProps, 'size'> {
	display?: boolean;
	size?: Size | 'full';
	variant?: 'opaque' | 'blur' | 'transparent';
	placement?: 'auto' | 'top' | 'bottom' | 'center';
	isDimissable?: boolean;
}
export interface ModalConfigs extends Omit<BasicConfigs, 'size'> {
	size: ModalProps['size'];
	placement: ModalProps['placement'];
	children: {
		container?: ModalContainerConfigs;
		contentWrapper?: HTMLElement;
	};
	isDimissable: boolean;
	display?: boolean;
}
