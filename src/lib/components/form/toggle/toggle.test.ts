import { describe, it, expect } from 'vitest';
import { createToggleState, toggleOption, isToggleDisabled } from './toggle-logic';

describe('Toggle Logic', () => {
  describe('Initial State', () => {
    it('should create toggle with default unchecked state', () => {
      const toggle = createToggleState();
      expect(toggle.isChecked).toBe(false);
    });

    it('should create toggle with initial checked state', () => {
      const toggle = createToggleState(true);
      expect(toggle.isChecked).toBe(true);
    });

    it('should be enabled by default', () => {
      const toggle = createToggleState();
      expect(toggle.isDisabled).toBe(false);
    });

    it('should support disabled initial state', () => {
      const toggle = createToggleState(false, true);
      expect(toggle.isDisabled).toBe(true);
    });

    it('should not be loading initially', () => {
      const toggle = createToggleState();
      expect(toggle.isLoading).toBe(false);
    });
  });

  describe('Toggle functionality', () => {
    it('should toggle from unchecked to checked', () => {
      const toggle = createToggleState(false);
      toggle.toggle();
      expect(toggle.isChecked).toBe(true);
    });

    it('should toggle from checked to unchecked', () => {
      const toggle = createToggleState(true);
      toggle.toggle();
      expect(toggle.isChecked).toBe(false);
    });

    it('should toggle multiple times', () => {
      const toggle = createToggleState(false);
      toggle.toggle();
      expect(toggle.isChecked).toBe(true);
      toggle.toggle();
      expect(toggle.isChecked).toBe(false);
      toggle.toggle();
      expect(toggle.isChecked).toBe(true);
    });

    it('should not toggle when disabled', () => {
      const toggle = createToggleState(false, true);
      toggle.toggle();
      expect(toggle.isChecked).toBe(false);
    });

    it('should not toggle when loading', () => {
      const toggle = createToggleState(false);
      toggle.setLoading(true);
      toggle.toggle();
      expect(toggle.isChecked).toBe(false);
    });
  });

  describe('setChecked method', () => {
    it('should set checked to true', () => {
      const toggle = createToggleState(false);
      toggle.setChecked(true);
      expect(toggle.isChecked).toBe(true);
    });

    it('should set checked to false', () => {
      const toggle = createToggleState(true);
      toggle.setChecked(false);
      expect(toggle.isChecked).toBe(false);
    });

    it('should not set checked when disabled', () => {
      const toggle = createToggleState(false, true);
      toggle.setChecked(true);
      expect(toggle.isChecked).toBe(false);
    });

    it('should not set checked when loading', () => {
      const toggle = createToggleState(false);
      toggle.setLoading(true);
      toggle.setChecked(true);
      expect(toggle.isChecked).toBe(false);
    });
  });

  describe('Disabled state', () => {
    it('should disable toggle', () => {
      const toggle = createToggleState();
      toggle.disable(true);
      expect(toggle.isDisabled).toBe(true);
    });

    it('should enable toggle', () => {
      const toggle = createToggleState(false, true);
      toggle.disable(false);
      expect(toggle.isDisabled).toBe(false);
    });

    it('should prevent toggle when disabled', () => {
      const toggle = createToggleState(false);
      toggle.disable(true);
      toggle.toggle();
      expect(toggle.isChecked).toBe(false);
    });
  });

  describe('Loading state', () => {
    it('should set loading state', () => {
      const toggle = createToggleState();
      toggle.setLoading(true);
      expect(toggle.isLoading).toBe(true);
    });

    it('should clear loading state', () => {
      const toggle = createToggleState();
      toggle.setLoading(true);
      toggle.setLoading(false);
      expect(toggle.isLoading).toBe(false);
    });

    it('should prevent toggle while loading', () => {
      const toggle = createToggleState(false);
      toggle.setLoading(true);
      toggle.toggle();
      expect(toggle.isChecked).toBe(false);
    });

    it('should allow toggle after loading completes', () => {
      const toggle = createToggleState(false);
      toggle.setLoading(true);
      toggle.setLoading(false);
      toggle.toggle();
      expect(toggle.isChecked).toBe(true);
    });
  });

  describe('Helper functions', () => {
    it('toggleOption should return opposite of current state', () => {
      const toggle = createToggleState(false);
      expect(toggleOption(toggle)).toBe(true);

      toggle.setChecked(true);
      expect(toggleOption(toggle)).toBe(false);
    });

    it('isToggleDisabled should return true when disabled', () => {
      const toggle = createToggleState(false, true);
      expect(isToggleDisabled(toggle)).toBe(true);
    });

    it('isToggleDisabled should return true when loading', () => {
      const toggle = createToggleState();
      toggle.setLoading(true);
      expect(isToggleDisabled(toggle)).toBe(true);
    });

    it('isToggleDisabled should return false when enabled and not loading', () => {
      const toggle = createToggleState();
      expect(isToggleDisabled(toggle)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid toggling', () => {
      const toggle = createToggleState(false);
      for (let i = 0; i < 100; i++) {
        toggle.toggle();
      }
      expect(toggle.isChecked).toBe(false);
    });

    it('should handle disable/enable cycles', () => {
      const toggle = createToggleState(false);
      toggle.disable(true);
      toggle.disable(false);
      toggle.toggle();
      expect(toggle.isChecked).toBe(true);
    });

    it('should handle loading/not loading cycles', () => {
      const toggle = createToggleState(false);
      toggle.setLoading(true);
      toggle.setLoading(false);
      toggle.toggle();
      expect(toggle.isChecked).toBe(true);
    });
  });
});
