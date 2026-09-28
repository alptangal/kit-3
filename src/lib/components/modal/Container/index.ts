export { default as ModalContainer } from './Main.svelte';
export type { ModalContainerProps, ModalContainerConfigs } from '../_interface';
export {
	setModalContainerContext,
	getModalContainerContext
} from '../useModalContext.svelte';
export async function releaseModalHeader(data: ModalContainerConfigs) {
	if (!data.ref) return;
	const { mount } = await import('svelte');
	const { Modal } = await import('..');
	mount(Modal.Header, { target: data.ref });
	return async () => {
		const { unmount } = await import('svelte');
		unmount(Modal.Header);
	};
}