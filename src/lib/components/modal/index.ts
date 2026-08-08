import { default as Root } from './Main.svelte';
import { default as Header } from './Header/Main.svelte';
import { default as Body } from './Body/Main.svelte';
import { default as Footer } from './Footer/Main.svelte';
import { default as Container } from './Container/Main.svelte';
import { getContext, mount, setContext, unmount } from 'svelte';
import type { ModalConfigs } from './_interface';

export const Modal = Object.assign(Root, {
	Container: Object.assign(Container, { Header, Body, Footer })
});

export function releaseModalContainter(data: ModalConfigs) {
	if (!data.ref) return;
	mount(Container, { target: data.ref });
	return () => {
		unmount(Container);
	};
}
const NAME = Symbol('modal-context');
export function setModalContext(context: ModalConfigs) {
	setContext(NAME, context);
}
export function getModalContext(): ModalConfigs | undefined {
	return getContext(NAME);
}
