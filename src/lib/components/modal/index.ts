import { default as Root } from './Main.svelte';
import { default as Header } from './Header/Main.svelte';
import { default as Body } from './Body/Main.svelte';
import { default as Footer } from './Footer/Main.svelte';
import { default as Container } from './Container/Main.svelte';

export {
	setModalContext,
	getModalContext,
	setModalContainerContext,
	getModalContainerContext,
	useModalContext,
	createModalPortal,
	generateModalId,
	resolveTransition,
	modalTransition,
	getFocusableElements,
	isTopLayer,
	getLayerIndex,
	getTotalLayers,
	type ModalTransition,
	type TransitionParams,
	type PortalReturn
} from './useModalContext.svelte';

export { releaseModalContainter } from './utils';

export const Modal = Object.assign(Root, {
	Container: Object.assign(Container, { Header, Body, Footer })
});

export type { ModalProps, ModalContainerProps, ModalHeaderProps, ModalBodyProps, ModalFooterProps } from './_interface';
