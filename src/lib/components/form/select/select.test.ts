// src/lib/components/form/select/select.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SelectExample from './select.example.svelte';

describe('Select Component', () => {
	it('renders trigger with placeholder', () => {
		render(SelectExample, { props: { placeholder: 'Choose option' } });
		expect(screen.getByText('Choose option')).toBeInTheDocument();
	});

	it('opens dropdown on trigger click', async () => {
		const user = userEvent.setup();
		render(SelectExample);

		const trigger = screen.getByRole('button');
		await user.click(trigger);

		const listbox = screen.getByRole('listbox');
		expect(listbox).toBeVisible();
	});

	it('selects item on click', async () => {
		const user = userEvent.setup();
		render(SelectExample);

		const trigger = screen.getByRole('button');
		await user.click(trigger);

		const options = screen.getAllByRole('option');
		await user.click(options[0]);

		expect(screen.getByText('Option 1')).toBeInTheDocument();
	});

	it('closes dropdown after selection', async () => {
		const user = userEvent.setup();
		render(SelectExample);

		const trigger = screen.getByRole('button');
		await user.click(trigger);

		const options = screen.getAllByRole('option');
		await user.click(options[0]);

		const listbox = screen.queryByRole('listbox');
		expect(listbox).not.toBeInTheDocument();
	});

	it('navigates with keyboard arrows', async () => {
		const user = userEvent.setup();
		render(SelectExample);

		const trigger = screen.getByRole('button');
		await user.click(trigger);

		await user.keyboard('{ArrowDown}');

		const options = screen.getAllByRole('option');
		expect(options[0]).toHaveClass('highlighted');
	});

	it('closes on escape key', async () => {
		const user = userEvent.setup();
		render(SelectExample);

		const trigger = screen.getByRole('button');
		await user.click(trigger);

		await user.keyboard('{Escape}');

		const listbox = screen.queryByRole('listbox');
		expect(listbox).not.toBeInTheDocument();
	});

	it('supports multiple selection', async () => {
		const user = userEvent.setup();
		render(SelectExample, { props: { multiple: true } });

		const trigger = screen.getByRole('button');
		await user.click(trigger);

		const options = screen.getAllByRole('option');
		await user.click(options[0]);
		await user.click(options[1]);

		// Dropdown stays open in multiple mode
		expect(screen.getByRole('listbox')).toBeVisible();
	});
});
