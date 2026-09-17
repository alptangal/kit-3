/**
 * Shared composables for form components (Svelte 5 runes: .svelte.ts)
 */

export { useFieldValidation } from './useFieldValidation.svelte';
export type { FieldValidationConfig } from './useFieldValidation.svelte';

export { useFieldState } from './useFieldState.svelte';
export type { FieldStateOptions } from './useFieldState.svelte';

export { useEmailAutocomplete } from './useEmailAutocomplete.svelte';

export { usePasswordStrength } from './usePasswordStrength.svelte';
export type { PasswordStrength } from './usePasswordStrength.svelte';

export { useNumberCalculator } from './useNumberCalculator.svelte';

export { useFocusTracking } from './useFocusTracking.svelte';
export { useMessageDisplay } from './useMessageDisplay.svelte';
export type { MessageEntry, MessagesMap } from './useMessageDisplay.svelte';
