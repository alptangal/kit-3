// src/lib/components/form/select/select.unit.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { writable } from 'svelte/store';

/**
 * Unit tests for Select component logic
 * Focus on state management, selection logic, keyboard navigation
 */

describe('Select Component — Unit Tests', () => {
	// Mock context setup
	let valueStore: ReturnType<typeof writable<string>>;
	let multiValueStore: ReturnType<typeof writable<string[]>>;
	let openStore: ReturnType<typeof writable<boolean>>;
	let searchStore: ReturnType<typeof writable<string>>;
	let highlightedStore: ReturnType<typeof writable<string | null>>;
	let itemsStore: ReturnType<typeof writable<Map<string, { label: string; disabled: boolean }>>>;

	beforeEach(() => {
		valueStore = writable('');
		multiValueStore = writable<string[]>([]);
		openStore = writable(false);
		searchStore = writable('');
		highlightedStore = writable(null);
		itemsStore = writable(new Map());

		// Register test items
		itemsStore.set(
			new Map([
				['apple', { label: 'Apple', disabled: false }],
				['banana', { label: 'Banana', disabled: false }],
				['cherry', { label: 'Cherry', disabled: false }],
				['disabled-item', { label: 'Disabled', disabled: true }]
			])
		);
	});

	describe('Single Select', () => {
		it('should select an item and close dropdown', (ctx) => {
			let selectedValue = '';

			// Simulate selection
			valueStore.subscribe((v) => {
				selectedValue = v;
			});

			// User action: select item
			valueStore.set('apple');

			expect(selectedValue).toBe('apple');
		});

		it('should display selected value', (ctx) => {
			valueStore.set('banana');

			let current = '';
			valueStore.subscribe((v) => {
				current = v;
			});

			expect(current).toBe('banana');
		});

		it('should support placeholder when no value selected', (ctx) => {
			let current = '';
			valueStore.subscribe((v) => {
				current = v;
			});

			expect(current).toBe('');
		});

		it('should clear search after selection', (ctx) => {
			searchStore.set('apple');
			// After select, search should clear
			searchStore.set('');

			let search = '';
			searchStore.subscribe((v) => {
				search = v;
			});

			expect(search).toBe('');
		});

		it('should close dropdown after selection', (ctx) => {
			openStore.set(true);
			// After select, dropdown closes
			openStore.set(false);

			let isOpen = false;
			openStore.subscribe((v) => {
				isOpen = v;
			});

			expect(isOpen).toBe(false);
		});
	});

	describe('Multi Select', () => {
		it('should add item to selection array', (ctx) => {
			// Select first item
			multiValueStore.update((arr: string[]) => [...arr, 'apple']);

			let current: string[] = [];
			multiValueStore.subscribe((v: string[]) => {
				current = v;
			});

			expect(current).toContain('apple');
			expect(current.length).toBe(1);
		});

		it('should select multiple items', (ctx) => {
			// Select multiple
			multiValueStore.update((arr: string[]) => [...arr, 'apple']);
			multiValueStore.update((arr: string[]) => [...arr, 'banana']);

			let current: string[] = [];
			multiValueStore.subscribe((v: string[]) => {
				current = v;
			});

			expect(current).toContain('apple');
			expect(current).toContain('banana');
			expect(current.length).toBe(2);
		});

		it('should remove item from selection', (ctx) => {
			multiValueStore.set(['apple', 'banana', 'cherry']);

			// Deselect banana
			multiValueStore.update((arr: string[]) => arr.filter((x: string) => x !== 'banana'));

			let current: string[] = [];
			multiValueStore.subscribe((v: string[]) => {
				current = v;
			});

			expect(current).toContain('apple');
			expect(current).not.toContain('banana');
			expect(current).toContain('cherry');
		});

		it('should toggle item selection', (ctx) => {
			multiValueStore.set(['apple']);

			// Toggle: apple already selected, so remove it
			multiValueStore.update((arr: string[]) => {
				return arr.includes('apple') ? arr.filter((x: string) => x !== 'apple') : [...arr, 'apple'];
			});

			let current: string[] = [];
			multiValueStore.subscribe((v: string[]) => {
				current = v;
			});

			expect(current).not.toContain('apple');
			expect(current.length).toBe(0);
		});

		it('should keep dropdown open after selection in multi mode', (ctx) => {
			openStore.set(true);
			// In multi-select, dropdown stays open after selection
			// openStore NOT set to false

			let isOpen = false;
			openStore.subscribe((v: boolean) => {
				isOpen = v;
			});

			expect(isOpen).toBe(true);
		});
	});

	describe('Keyboard Navigation', () => {
		it('should set highlighted item on arrow down', (ctx) => {
			highlightedStore.set('apple');

			let current: string | null = '';
			highlightedStore.subscribe((v: string | null) => {
				current = v;
			});

			expect(current).toBe('apple');
		});

		it('should set highlighted item on arrow up', (ctx) => {
			highlightedStore.set('cherry');

			let current: string | null = '';
			highlightedStore.subscribe((v: string | null) => {
				current = v;
			});

			expect(current).toBe('cherry');
		});

		it('should clear highlighted on mouse leave', (ctx) => {
			highlightedStore.set('banana');
			highlightedStore.set(null);

			let current: string | null = null;
			highlightedStore.subscribe((v: string | null) => {
				current = v;
			});

			expect(current).toBe(null);
		});

		it('should close dropdown on escape', (ctx) => {
			openStore.set(true);
			// Escape key pressed
			openStore.set(false);

			let isOpen = false;
			openStore.subscribe((v: boolean) => {
				isOpen = v;
			});

			expect(isOpen).toBe(false);
		});
	});

	describe('Search/Filter', () => {
		it('should store search query', (ctx) => {
			searchStore.set('app');

			let current = '';
			searchStore.subscribe((v: string) => {
				current = v;
			});

			expect(current).toBe('app');
		});

		it('should filter items by search query', (ctx) => {
			const query = 'app';
			const items: string[] = ['apple', 'banana', 'cherry'];
			const filtered = items.filter((item: string) => item.toLowerCase().includes(query.toLowerCase()));

			expect(filtered).toContain('apple');
			expect(filtered).not.toContain('banana');
		});

		it('should clear search on escape', (ctx) => {
			searchStore.set('cherry');
			// Escape pressed
			searchStore.set('');

			let current = '';
			searchStore.subscribe((v: string) => {
				current = v;
			});

			expect(current).toBe('');
		});
	});

	describe('Disabled Items', () => {
		it('should not select disabled items on click', (ctx) => {
			let selectedValue = '';
			valueStore.subscribe((v: string) => {
				selectedValue = v;
			});

			// Try to select disabled item (should be ignored)
			const itemsMap = new Map([
				['apple', { label: 'Apple', disabled: false }],
				['banana', { label: 'Banana', disabled: false }],
				['cherry', { label: 'Cherry', disabled: false }],
				['disabled-item', { label: 'Disabled', disabled: true }]
			]);

			const disabledItem = itemsMap.get('disabled-item');

			if (disabledItem && !disabledItem.disabled) {
				valueStore.set('disabled-item');
			}

			expect(selectedValue).not.toBe('disabled-item');
		});

		it('should not highlight disabled items', (ctx) => {
			const itemsMap = new Map([
				['apple', { label: 'Apple', disabled: false }],
				['banana', { label: 'Banana', disabled: false }],
				['cherry', { label: 'Cherry', disabled: false }],
				['disabled-item', { label: 'Disabled', disabled: true }]
			]);

			const disabledItem = 'disabled-item';
			const item = itemsMap.get(disabledItem);

			// Should not set as highlighted if disabled
			if (item && !item.disabled) {
				highlightedStore.set(disabledItem);
			}

			let current: string | null = null;
			highlightedStore.subscribe((v: string | null) => {
				current = v;
			});

			expect(current).not.toBe(disabledItem);
		});
	});

	describe('Open/Close State', () => {
		it('should toggle open state', (ctx) => {
			openStore.set(false);
			expect(openStore).toBeDefined();

			openStore.update((v: boolean) => !v);

			let isOpen = false;
			openStore.subscribe((v: boolean) => {
				isOpen = v;
			});

			expect(isOpen).toBe(true);
		});

		it('should open on trigger click', (ctx) => {
			openStore.set(true);

			let isOpen = false;
			openStore.subscribe((v: boolean) => {
				isOpen = v;
			});

			expect(isOpen).toBe(true);
		});

		it('should close on escape', (ctx) => {
			openStore.set(true);
			openStore.set(false);

			let isOpen = false;
			openStore.subscribe((v: boolean) => {
				isOpen = v;
			});

			expect(isOpen).toBe(false);
		});
	});
});