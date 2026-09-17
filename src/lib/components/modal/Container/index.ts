import { mount, unmount } from 'svelte';
import type { ModalContainerConfigs } from '../_interface';
import { Modal } from '..';

export {
	setModalContainerContext,
	getModalContainerContext
} from '../useModalContext.svelte';

export function releaseModalHeader(data: ModalContainerConfigs) {
	if (!data.ref) return;
	mount(Modal.Header, { target: data.ref });
	return () => {
		unmount(Modal.Header);
	};
}