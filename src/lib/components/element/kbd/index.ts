// src/lib/components/element/kbd/index.ts
// Kbd — phím tắt / key (<kbd>). Kbd.Combo gom nhiều key + separator "&".
// Object.assign để user dùng `<Kbd.Combo />` (mirror DropdownMenu).
import KbdRoot from './Main.svelte';
import KbdCombo from './Combo.svelte';

export const Kbd = Object.assign(KbdRoot, {
	Combo: KbdCombo
});

export type {
	KbdConfigs,
	KbdComboConfigs,
	KbdComboProps,
	KbdProps,
	KbdVariant
} from './_interface';
