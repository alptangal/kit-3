import type { ModalContainerConfigs } from '../_interface';

export { default as ModalContainer } from './Main.svelte';
export type { ModalContainerProps, ModalContainerConfigs } from '../_interface';
export {
	setModalContainerContext,
	getModalContainerContext
} from '../useModalContext.svelte';
export async function releaseModalHeader(data: ModalContainerConfigs) {
	if (!data.ref) return;
	const { mount } = await import('svelte');
	// Dynamic import tránh circular: Container/index → modal/index → Container/Main → Container/index
	const { Modal } = await import('..');
	// Modal.Container.Header là nested Object.assign — TS không infer qua 2 tầng
	const Header = (Modal as unknown as { Container: { Header: Parameters<typeof mount>[0] } })
		.Container.Header;
	mount(Header, { target: data.ref });
	return async () => {
		const { unmount } = await import('svelte');
		unmount(Header);
	};
}
