import type { ButtonProps } from './_interface';

/** Alias tương thích ngược (Button type đã được đổi thành ButtonProps) */
export type Button = ButtonProps;

export const defaultButton: ButtonProps = {
	class: 'flex gap-1 justify-center items-center'
};
