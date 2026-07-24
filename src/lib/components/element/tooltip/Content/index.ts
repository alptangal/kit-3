import type { DistanceUnits, Positions } from '$components/interface';
import { convertToPixels } from '$modules';
import { client } from '$store/basic.svelte';
import type { Snippet } from 'svelte';

export interface Content {
	as?: keyof HTMLElementTagNameMap;
	children?: Snippet;
	portal?: HTMLElement | `#${string}` | 'body';
	content?:
		| string
		| {
				main: string;
				description?: string;
		  };
	position?: Positions | 'auto';
	ui?: string | string[];
	size?: 'auto' | 'maximum';
	transition?: 'fade' | 'fly';
	/**offset in pixels */
	offset?: number | `${number}`;
	class?: string | string[];
}

//--------------------------------BEGIN DEFAULTS----------------------
export const defaults: Content = {
	ui: 'w-fit fixed'
};

//--------------------------------END DEFAULTS----------------------

export function getMetaSide(
	targetRef: HTMLElement,
	contentRef: HTMLElement,
	arrowRef: HTMLElement | undefined,
	propsOffset: number | undefined,
	defaultOffset: number | undefined,
	mousePosition: { x: number; y: number }
) {
	if (!propsOffset) propsOffset = 0;
	if (!defaultOffset) defaultOffset = 0;
	const targetRect = targetRef.getBoundingClientRect();
	const contentRect = contentRef.getBoundingClientRect();
	let arrowSize: undefined | number = 0;
	if (arrowRef)
		arrowSize =
			(convertToPixels(getComputedStyle(arrowRef).getPropertyValue('--size') as DistanceUnits) ??
				0) / 2;

	return {
		get top() {
			return {
				get acreage() {
					return (
						(targetRect.top - propsOffset - defaultOffset - arrowSize) *
						((client.browser?.width ?? 0) - defaultOffset * 2)
					);
				},
				get ready() {
					return contentRect.height + arrowSize + defaultOffset <= targetRect.top;
				},
				get mousePositionToSide() {
					return mousePosition.y - targetRect.top;
				}
			};
		},
		get bottom() {
			return {
				get acreage() {
					return (
						((client.browser?.height ?? 0) -
							targetRect.bottom -
							propsOffset -
							defaultOffset -
							arrowSize) *
						((client.browser?.width ?? 0) - defaultOffset * 2)
					);
				},
				get ready() {
					return (
						contentRect.height + arrowSize + defaultOffset <=
						(client.browser?.height ?? 0) - targetRect.bottom
					);
				},
				get mousePositionToSide() {
					return targetRect.bottom - mousePosition.y;
				}
			};
		},
		get left() {
			return {
				get acreage() {
					return (
						(targetRect.left - propsOffset - defaultOffset - arrowSize) *
						((client.browser?.height ?? 0) - defaultOffset * 2)
					);
				},
				get ready() {
					return contentRect.width + arrowSize + defaultOffset <= targetRect.left;
				},
				get mousePositionToSide() {
					return mousePosition.x - targetRect.left;
				}
			};
		},
		get right() {
			return {
				get acreage() {
					return (
						((client.browser?.width ?? 0) -
							targetRect.right -
							propsOffset -
							defaultOffset -
							arrowSize) *
						((client.browser?.height ?? 0) - defaultOffset * 2)
					);
				},
				get ready() {
					return (
						contentRect.width + arrowSize + defaultOffset <=
						(client.browser?.width ?? 0) - targetRect.right
					);
				},
				get mousePositionToSide() {
					return targetRect.right - mousePosition.x;
				}
			};
		}
	};
}
