import { getContext, mount, setContext, unmount } from 'svelte';
import type { ModalContainerConfigs } from '../_interface';
import { Modal } from '..';

const NAME = Symbol('modal-container-context');
export function setModalContainerContext(context: ModalContainerConfigs) {
	setContext(NAME, context);
}
export function getModalContainerContext(): ModalContainerConfigs | undefined {
	return getContext(NAME);
}
export function releaseModalHeader(data: ModalContainerConfigs) {
	if (!data.ref) return;
	mount(Modal.Header, { target: data.ref });
	return () => {
		unmount(Modal.Header);
	};
}
