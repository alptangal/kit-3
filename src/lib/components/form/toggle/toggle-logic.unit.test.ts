import { describe, it, expect } from 'vitest';
import {
  createToggleState,
  toggle,
  turnOn,
  turnOff,
  setState,
  setDisabled,
  setFocused,
  handleKeydown,
  setLabel,
  setAriaLabel,
  setAriaDescription,
  type ToggleState,
} from './toggle-logic';

describe('Toggle State Logic', () => {
  describe('createToggleState', () => {
    it('should create initial state with defaults', () => {
      const state = createToggleState();
      expect(state.isOn).toBe(false);
      expect(state.disabled).toBe(false);
      expect(state.isFocused).toBe(false);
      expect(state.label).toBe('Toggle');
      expect(state.ariaLabel).toBeUndefined();
      expect(state.ariaDescription).toBeUndefined();
    });

    it('should create state with initial on value', () => {
      const state = createToggleState(true);
      expect(state.isOn).toBe(true);
    });

    it('should apply custom config', () => {
      const state = createToggleState(true, {
        disabled: true,
        label: 'Dark Mode',
        ariaLabel: 'Toggle dark mode',
        ariaDescription: 'Switch between light and dark theme',
      });
      expect(state.isOn).toBe(true);
      expect(state.disabled).toBe(true);
      expect(state.label).toBe('Dark Mode');
      expect(state.ariaLabel).toBe('Toggle dark mode');
      expect(state.ariaDescription).toBe('Switch between light and dark theme');
    });
  });

  describe('toggle', () => {
    it('should toggle from off to on', () => {
      const state = createToggleState(false);
      const updated = toggle(state);
      expect(updated.isOn).toBe(true);
    });

    it('should toggle from on to off', () => {
      const state = createToggleState(true);
      const updated = toggle(state);
      expect(updated.isOn).toBe(false);
    });

    it('should not toggle when disabled', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = toggle(state);
      expect(updated).toEqual(state);
      expect(updated.isOn).toBe(false);
    });

    it('should preserve other state when toggling', () => {
      let state = createToggleState(false, {
        label: 'Feature X',
        ariaLabel: 'Toggle Feature X',
      });
      state = setFocused(state, true);
      state = toggle(state);
      expect(state.label).toBe('Feature X');
      expect(state.ariaLabel).toBe('Toggle Feature X');
      expect(state.isFocused).toBe(true);
    });
  });

  describe('turnOn', () => {
    it('should turn on when off', () => {
      const state = createToggleState(false);
      const updated = turnOn(state);
      expect(updated.isOn).toBe(true);
    });

    it('should not change when already on', () => {
      const state = createToggleState(true);
      const updated = turnOn(state);
      expect(updated).toEqual(state);
    });

    it('should not turn on when disabled', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = turnOn(state);
      expect(updated).toEqual(state);
    });
  });

  describe('turnOff', () => {
    it('should turn off when on', () => {
      const state = createToggleState(true);
      const updated = turnOff(state);
      expect(updated.isOn).toBe(false);
    });

    it('should not change when already off', () => {
      const state = createToggleState(false);
      const updated = turnOff(state);
      expect(updated).toEqual(state);
    });

    it('should not turn off when disabled', () => {
      const state = createToggleState(true, { disabled: true });
      const updated = turnOff(state);
      expect(updated).toEqual(state);
    });
  });

  describe('setState', () => {
    it('should set state to true', () => {
      const state = createToggleState(false);
      const updated = setState(state, true);
      expect(updated.isOn).toBe(true);
    });

    it('should set state to false', () => {
      const state = createToggleState(true);
      const updated = setState(state, false);
      expect(updated.isOn).toBe(false);
    });

    it('should not change if already in target state', () => {
      const state = createToggleState(true);
      const updated = setState(state, true);
      expect(updated).toEqual(state);
    });

    it('should not change when disabled', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = setState(state, true);
      expect(updated).toEqual(state);
    });

    it('should preserve all state when setting', () => {
      let state = createToggleState(false, { label: 'Notifications' });
      state = setFocused(state, true);
      state = setState(state, true);
      expect(state.label).toBe('Notifications');
      expect(state.isFocused).toBe(true);
      expect(state.isOn).toBe(true);
    });
  });

  describe('setDisabled', () => {
    it('should disable the toggle', () => {
      const state = createToggleState();
      const updated = setDisabled(state, true);
      expect(updated.disabled).toBe(true);
    });

    it('should enable the toggle', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = setDisabled(state, false);
      expect(updated.disabled).toBe(false);
    });

    it('should clear focus when disabling', () => {
      let state = createToggleState();
      state = setFocused(state, true);
      state = setDisabled(state, true);
      expect(state.disabled).toBe(true);
      expect(state.isFocused).toBe(false);
    });

    it('should preserve focus when enabling', () => {
      let state = createToggleState(false, { disabled: true });
      state.isFocused = true;
      state = setDisabled(state, false);
      expect(state.disabled).toBe(false);
      expect(state.isFocused).toBe(true);
    });

    it('should preserve on/off state', () => {
      const state = createToggleState(true);
      const updated = setDisabled(state, true);
      expect(updated.isOn).toBe(true);
    });
  });

  describe('setFocused', () => {
    it('should set focused state to true', () => {
      const state = createToggleState();
      const updated = setFocused(state, true);
      expect(updated.isFocused).toBe(true);
    });

    it('should set focused state to false', () => {
      let state = createToggleState();
      state = setFocused(state, true);
      state = setFocused(state, false);
      expect(state.isFocused).toBe(false);
    });

    it('should not focus when disabled', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = setFocused(state, true);
      expect(updated).toEqual(state);
    });

    it('should preserve on/off state when focusing', () => {
      const state = createToggleState(true);
      const updated = setFocused(state, true);
      expect(updated.isOn).toBe(true);
    });
  });

  describe('handleKeydown', () => {
    it('should toggle on Space key', () => {
      let state = createToggleState(false);
      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(true);
    });

    it('should toggle on Enter key', () => {
      let state = createToggleState(false);
      state = handleKeydown(state, 'Enter');
      expect(state.isOn).toBe(true);
    });

    it('should ignore other keys', () => {
      const state = createToggleState(false);
      const updated = handleKeydown(state, 'a');
      expect(updated).toEqual(state);
    });

    it('should not toggle on Space when disabled', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = handleKeydown(state, ' ');
      expect(updated).toEqual(state);
    });

    it('should not toggle on Enter when disabled', () => {
      const state = createToggleState(false, { disabled: true });
      const updated = handleKeydown(state, 'Enter');
      expect(updated).toEqual(state);
    });
  });

  describe('setLabel', () => {
    it('should update label', () => {
      const state = createToggleState();
      const updated = setLabel(state, 'Notifications');
      expect(updated.label).toBe('Notifications');
    });

    it('should preserve other state when updating label', () => {
      const state = createToggleState(true, { disabled: true });
      const updated = setLabel(state, 'New Label');
      expect(updated.isOn).toBe(true);
      expect(updated.disabled).toBe(true);
      expect(updated.label).toBe('New Label');
    });
  });

  describe('setAriaLabel', () => {
    it('should set aria-label', () => {
      const state = createToggleState();
      const updated = setAriaLabel(state, 'Toggle notifications');
      expect(updated.ariaLabel).toBe('Toggle notifications');
    });

    it('should clear aria-label', () => {
      const state = createToggleState(false, { ariaLabel: 'Toggle' });
      const updated = setAriaLabel(state, undefined);
      expect(updated.ariaLabel).toBeUndefined();
    });

    it('should preserve state when updating aria-label', () => {
      const state = createToggleState(true);
      const updated = setAriaLabel(state, 'Enable feature');
      expect(updated.isOn).toBe(true);
    });
  });

  describe('setAriaDescription', () => {
    it('should set aria-description', () => {
      const state = createToggleState();
      const updated = setAriaDescription(
        state,
        'Enable notifications for new messages'
      );
      expect(updated.ariaDescription).toBe(
        'Enable notifications for new messages'
      );
    });

    it('should clear aria-description', () => {
      const state = createToggleState(false, {
        ariaDescription: 'Description',
      });
      const updated = setAriaDescription(state, undefined);
      expect(updated.ariaDescription).toBeUndefined();
    });

    it('should preserve state when updating aria-description', () => {
      const state = createToggleState(true);
      const updated = setAriaDescription(state, 'New description');
      expect(updated.isOn).toBe(true);
    });
  });

  describe('Complex workflows', () => {
    it('should handle full user interaction: focus, toggle, blur', () => {
      let state = createToggleState(false, { label: 'Dark Mode' });

      // User tabs to the toggle
      state = setFocused(state, true);
      expect(state.isFocused).toBe(true);
      expect(state.isOn).toBe(false);

      // User presses space to activate
      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(true);
      expect(state.isFocused).toBe(true);

      // User presses space again to deactivate
      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(false);

      // User tabs away
      state = setFocused(state, false);
      expect(state.isFocused).toBe(false);
      expect(state.isOn).toBe(false);
    });

    it('should handle enable/disable cycle with state preservation', () => {
      let state = createToggleState(true, {
        label: 'Feature X',
        ariaLabel: 'Toggle Feature X',
      });

      // User disables the toggle
      state = setDisabled(state, true);
      expect(state.disabled).toBe(true);
      expect(state.isOn).toBe(true);

      // Try to interact (should do nothing)
      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(true);

      // Re-enable
      state = setDisabled(state, false);
      expect(state.disabled).toBe(false);
      expect(state.isOn).toBe(true);
      expect(state.label).toBe('Feature X');

      // Can interact again
      state = handleKeydown(state, 'Enter');
      expect(state.isOn).toBe(false);
    });

    it('should handle programmatic state changes with user interaction', () => {
      let state = createToggleState(false);

      // Programmatically turn on
      state = setState(state, true);
      expect(state.isOn).toBe(true);

      // User focuses
      state = setFocused(state, true);

      // User turns off via keyboard
      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(false);

      // Programmatically turn on again
      state = turnOn(state);
      expect(state.isOn).toBe(true);
      expect(state.isFocused).toBe(true);

      // Programmatically turn off
      state = turnOff(state);
      expect(state.isOn).toBe(false);
    });

    it('should maintain accessibility attributes during state changes', () => {
      let state = createToggleState(false, {
        label: 'Notifications',
        ariaLabel: 'Toggle notifications',
        ariaDescription: 'Control notification settings',
      });

      state = toggle(state);
      expect(state.label).toBe('Notifications');
      expect(state.ariaLabel).toBe('Toggle notifications');
      expect(state.ariaDescription).toBe('Control notification settings');

      state = setState(state, false);
      expect(state.label).toBe('Notifications');
      expect(state.ariaLabel).toBe('Toggle notifications');
      expect(state.ariaDescription).toBe('Control notification settings');
    });

    it('should handle rapid toggling', () => {
      let state = createToggleState(false);

      // Rapid user input
      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(true);

      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(false);

      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(true);

      state = handleKeydown(state, ' ');
      expect(state.isOn).toBe(false);
    });

    it('should handle focus during disabled state', () => {
      let state = createToggleState(true);
      state = setFocused(state, true);
      expect(state.isFocused).toBe(true);

      // Disable while focused
      state = setDisabled(state, true);
      expect(state.isFocused).toBe(false);
      expect(state.disabled).toBe(true);

      // Re-enable
      state = setDisabled(state, false);
      expect(state.disabled).toBe(false);

      // Focus again
      state = setFocused(state, true);
      expect(state.isFocused).toBe(true);
      expect(state.isOn).toBe(true);
    });
  });
});
