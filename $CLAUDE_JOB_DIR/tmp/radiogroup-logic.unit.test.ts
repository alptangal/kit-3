import { describe, it, expect } from 'vitest';
import {
  createRadioGroupState,
  selectOption,
  focusOption,
  moveFocusNext,
  moveFocusPrevious,
  handleKeydown,
  setDisabled,
  addOption,
  removeOption,
  clearSelection,
  type RadioOption,
  type RadioGroupState,
} from './radiogroup-logic';

describe('RadioGroup State Logic', () => {
  const mockOptions: RadioOption[] = [
    { id: 'opt1', label: 'Option 1' },
    { id: 'opt2', label: 'Option 2' },
    { id: 'opt3', label: 'Option 3', disabled: true },
    { id: 'opt4', label: 'Option 4' },
  ];

  describe('createRadioGroupState', () => {
    it('should create initial state with defaults', () => {
      const state = createRadioGroupState(mockOptions);
      expect(state.options).toEqual(mockOptions);
      expect(state.selectedId).toBeNull();
      expect(state.disabled).toBe(false);
      expect(state.name).toBe('radio-group');
      expect(state.orientation).toBe('vertical');
      expect(state.focusedId).toBeNull();
    });

    it('should create state with initial selection', () => {
      const state = createRadioGroupState(mockOptions, 'opt2');
      expect(state.selectedId).toBe('opt2');
    });

    it('should apply custom config', () => {
      const state = createRadioGroupState(mockOptions, 'opt1', {
        disabled: true,
        name: 'payment-method',
        orientation: 'horizontal',
      });
      expect(state.disabled).toBe(true);
      expect(state.name).toBe('payment-method');
      expect(state.orientation).toBe('horizontal');
    });
  });

  describe('selectOption', () => {
    it('should select an enabled option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = selectOption(state, 'opt1');
      expect(updated.selectedId).toBe('opt1');
      expect(updated.focusedId).toBe('opt1');
    });

    it('should not select a disabled option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = selectOption(state, 'opt3');
      expect(updated.selectedId).toBeNull();
      expect(updated).toEqual(state);
    });

    it('should not select when group is disabled', () => {
      const state = createRadioGroupState(mockOptions, null, { disabled: true });
      const updated = selectOption(state, 'opt1');
      expect(updated).toEqual(state);
    });

    it('should deselect previous selection on new select', () => {
      let state = createRadioGroupState(mockOptions, 'opt1');
      state = selectOption(state, 'opt2');
      expect(state.selectedId).toBe('opt2');
    });

    it('should not change state for non-existent option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = selectOption(state, 'opt-invalid');
      expect(updated).toEqual(state);
    });
  });

  describe('focusOption', () => {
    it('should focus an enabled option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = focusOption(state, 'opt2');
      expect(updated.focusedId).toBe('opt2');
      expect(updated.selectedId).toBeNull();
    });

    it('should not focus a disabled option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = focusOption(state, 'opt3');
      expect(updated).toEqual(state);
    });

    it('should not focus when group is disabled', () => {
      const state = createRadioGroupState(mockOptions, null, { disabled: true });
      const updated = focusOption(state, 'opt1');
      expect(updated).toEqual(state);
    });

    it('should move focus without changing selection', () => {
      const state = createRadioGroupState(mockOptions, 'opt1');
      const updated = focusOption(state, 'opt2');
      expect(updated.selectedId).toBe('opt1');
      expect(updated.focusedId).toBe('opt2');
    });
  });

  describe('moveFocusNext', () => {
    it('should move focus to next enabled option', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt1');
      state = moveFocusNext(state);
      expect(state.focusedId).toBe('opt2');
    });

    it('should skip disabled options', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');
      state = moveFocusNext(state);
      expect(state.focusedId).toBe('opt4');
    });

    it('should wrap to first enabled option at end', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt4');
      state = moveFocusNext(state);
      expect(state.focusedId).toBe('opt1');
    });

    it('should focus first enabled option if no focus set', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = moveFocusNext(state);
      expect(updated.focusedId).toBe('opt1');
    });

    it('should not move focus when group is disabled', () => {
      const state = createRadioGroupState(mockOptions, null, { disabled: true });
      const updated = moveFocusNext(state);
      expect(updated).toEqual(state);
    });

    it('should not move if all options disabled', () => {
      const allDisabled = mockOptions.map(opt => ({ ...opt, disabled: true }));
      const state = createRadioGroupState(allDisabled);
      const updated = moveFocusNext(state);
      expect(updated).toEqual(state);
    });
  });

  describe('moveFocusPrevious', () => {
    it('should move focus to previous enabled option', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');
      state = moveFocusPrevious(state);
      expect(state.focusedId).toBe('opt1');
    });

    it('should skip disabled options', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt4');
      state = moveFocusPrevious(state);
      expect(state.focusedId).toBe('opt2');
    });

    it('should wrap to last enabled option at start', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt1');
      state = moveFocusPrevious(state);
      expect(state.focusedId).toBe('opt4');
    });

    it('should focus last enabled option if no focus set', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = moveFocusPrevious(state);
      expect(updated.focusedId).toBe('opt4');
    });

    it('should not move focus when group is disabled', () => {
      const state = createRadioGroupState(mockOptions, null, { disabled: true });
      const updated = moveFocusPrevious(state);
      expect(updated).toEqual(state);
    });
  });

  describe('handleKeydown', () => {
    it('should move next on ArrowDown', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt1');
      state = handleKeydown(state, 'ArrowDown');
      expect(state.focusedId).toBe('opt2');
    });

    it('should move next on ArrowRight', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt1');
      state = handleKeydown(state, 'ArrowRight');
      expect(state.focusedId).toBe('opt2');
    });

    it('should move previous on ArrowUp', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');
      state = handleKeydown(state, 'ArrowUp');
      expect(state.focusedId).toBe('opt1');
    });

    it('should move previous on ArrowLeft', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');
      state = handleKeydown(state, 'ArrowLeft');
      expect(state.focusedId).toBe('opt1');
    });

    it('should select focused option on Space', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');
      state = handleKeydown(state, ' ');
      expect(state.selectedId).toBe('opt2');
    });

    it('should not select on Space if no focused option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = handleKeydown(state, ' ');
      expect(updated.selectedId).toBeNull();
    });

    it('should ignore unknown keys', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt1');
      const updated = handleKeydown(state, 'Enter');
      expect(updated).toEqual(state);
    });
  });

  describe('setDisabled', () => {
    it('should disable the group', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = setDisabled(state, true);
      expect(updated.disabled).toBe(true);
    });

    it('should clear focus when disabling', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt1');
      state = setDisabled(state, true);
      expect(state.focusedId).toBeNull();
      expect(state.selectedId).toBeNull();
    });

    it('should preserve selection when disabling', () => {
      let state = createRadioGroupState(mockOptions, 'opt1');
      state = setDisabled(state, true);
      expect(state.selectedId).toBe('opt1');
    });

    it('should enable the group', () => {
      let state = createRadioGroupState(mockOptions, null, { disabled: true });
      state = setDisabled(state, false);
      expect(state.disabled).toBe(false);
    });

    it('should preserve focus when enabling', () => {
      let state = createRadioGroupState(mockOptions, null, { disabled: true });
      state.focusedId = 'opt1';
      state = setDisabled(state, false);
      expect(state.focusedId).toBe('opt1');
    });
  });

  describe('addOption', () => {
    it('should add option at end by default', () => {
      const state = createRadioGroupState(mockOptions);
      const newOption: RadioOption = { id: 'opt5', label: 'Option 5' };
      const updated = addOption(state, newOption);
      expect(updated.options).toHaveLength(5);
      expect(updated.options[4]).toEqual(newOption);
    });

    it('should add option at specific index', () => {
      const state = createRadioGroupState(mockOptions);
      const newOption: RadioOption = { id: 'opt-new', label: 'New Option' };
      const updated = addOption(state, newOption, 2);
      expect(updated.options).toHaveLength(5);
      expect(updated.options[2]).toEqual(newOption);
      expect(updated.options[3]).toEqual(mockOptions[2]);
    });

    it('should not change selection or focus', () => {
      let state = createRadioGroupState(mockOptions, 'opt1');
      state = focusOption(state, 'opt2');
      const newOption: RadioOption = { id: 'opt5', label: 'Option 5' };
      state = addOption(state, newOption);
      expect(state.selectedId).toBe('opt1');
      expect(state.focusedId).toBe('opt2');
    });
  });

  describe('removeOption', () => {
    it('should remove option by id', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = removeOption(state, 'opt2');
      expect(updated.options).toHaveLength(3);
      expect(updated.options.every(opt => opt.id !== 'opt2')).toBe(true);
    });

    it('should clear selection if selected option removed', () => {
      const state = createRadioGroupState(mockOptions, 'opt2');
      const updated = removeOption(state, 'opt2');
      expect(updated.selectedId).toBeNull();
    });

    it('should clear focus if focused option removed', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');
      state = removeOption(state, 'opt2');
      expect(state.focusedId).toBeNull();
    });

    it('should preserve other selections', () => {
      const state = createRadioGroupState(mockOptions, 'opt1');
      const updated = removeOption(state, 'opt2');
      expect(updated.selectedId).toBe('opt1');
    });

    it('should handle removing non-existent option', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = removeOption(state, 'opt-invalid');
      expect(updated.options).toHaveLength(4);
    });
  });

  describe('clearSelection', () => {
    it('should clear selected option', () => {
      const state = createRadioGroupState(mockOptions, 'opt1');
      const updated = clearSelection(state);
      expect(updated.selectedId).toBeNull();
    });

    it('should not affect focus', () => {
      let state = createRadioGroupState(mockOptions, 'opt1');
      state = focusOption(state, 'opt2');
      state = clearSelection(state);
      expect(state.focusedId).toBe('opt2');
      expect(state.selectedId).toBeNull();
    });

    it('should handle clearing when already empty', () => {
      const state = createRadioGroupState(mockOptions);
      const updated = clearSelection(state);
      expect(updated.selectedId).toBeNull();
    });
  });

  describe('Complex workflows', () => {
    it('should handle full user interaction: focus, navigate, select', () => {
      let state = createRadioGroupState(mockOptions);

      // User tabs in, first option gets focus
      state = moveFocusNext(state);
      expect(state.focusedId).toBe('opt1');
      expect(state.selectedId).toBeNull();

      // User presses arrow down
      state = handleKeydown(state, 'ArrowDown');
      expect(state.focusedId).toBe('opt2');

      // User presses space to select
      state = handleKeydown(state, ' ');
      expect(state.selectedId).toBe('opt2');
      expect(state.focusedId).toBe('opt2');

      // User presses arrow down (skip disabled)
      state = handleKeydown(state, 'ArrowDown');
      expect(state.focusedId).toBe('opt4');

      // User presses space to select new option
      state = handleKeydown(state, ' ');
      expect(state.selectedId).toBe('opt4');
    });

    it('should handle dynamic option management during focus', () => {
      let state = createRadioGroupState(mockOptions);
      state = focusOption(state, 'opt2');

      // Add option before focused
      const newOpt = { id: 'opt-new', label: 'New' };
      state = addOption(state, newOpt, 1);
      expect(state.focusedId).toBe('opt2');

      // Remove focused option
      state = removeOption(state, 'opt2');
      expect(state.focusedId).toBeNull();

      // Focus is cleared, next focus works
      state = moveFocusNext(state);
      expect(state.focusedId).toBe('opt1');
    });

    it('should handle group disable/enable with state preservation', () => {
      let state = createRadioGroupState(mockOptions, 'opt1');
      state = focusOption(state, 'opt2');

      // Disable group
      state = setDisabled(state, true);
      expect(state.disabled).toBe(true);
      expect(state.selectedId).toBe('opt1');
      expect(state.focusedId).toBeNull();

      // Try to interact (should do nothing)
      state = handleKeydown(state, 'ArrowDown');
      expect(state.focusedId).toBeNull();

      // Re-enable
      state = setDisabled(state, false);
      expect(state.disabled).toBe(false);
      expect(state.selectedId).toBe('opt1');
      expect(state.focusedId).toBeNull();

      // Can interact again
      state = moveFocusNext(state);
      expect(state.focusedId).toBe('opt2');
    });
  });
});
