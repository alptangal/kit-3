import { test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LoginPage from './+page.svelte';

test('checkbox checked then reset button should clear form without validation errors', async () => {
    render(LoginPage);

    // Get form elements
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const rememberCheckbox = screen.getByLabelText('Remember me');
    const resetButton = screen.getByRole('button', { name: /Reset/i });

    // Fill username and password
    fireEvent.input(usernameInput, { target: { value: 'testuser' } });
    fireEvent.input(passwordInput, { target: { value: 'testpass123' } });

    // Check "Remember me" checkbox
    fireEvent.click(rememberCheckbox);
    expect(rememberCheckbox).toBeChecked();

    // Click Reset button (first click)
    fireEvent.click(resetButton);

    // Wait for reset to complete
    await waitFor(() => {
        expect(usernameInput).toHaveValue('');
        expect(passwordInput).toHaveValue('');
        expect(rememberCheckbox).not.toBeChecked();
    });

    // Verify NO validation errors on any field
    // Check that inputs don't have error classes
    const usernameField = usernameInput.closest('.input-root');
    const passwordField = passwordInput.closest('.input-root');

    if (usernameField) {
        expect(usernameField).not.toHaveClass('color-error');
    }
    if (passwordField) {
        expect(passwordField).not.toHaveClass('color-error');
    }
});

test('reset button disables when form is pristine', async () => {
    render(LoginPage);

    const resetButton = screen.getByRole('button', { name: /Reset/i });

    // Reset button should be disabled initially
    expect(resetButton).toBeDisabled();

    // Fill username
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.input(usernameInput, { target: { value: 'test' } });

    // Reset button should be enabled
    expect(resetButton).not.toBeDisabled();

    // Click reset
    fireEvent.click(resetButton);

    // Form should be pristine again, reset button disabled
    await waitFor(() => {
        expect(resetButton).toBeDisabled();
    });
});