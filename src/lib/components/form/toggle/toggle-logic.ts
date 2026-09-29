export interface ToggleState {
  isChecked: boolean;
  isDisabled: boolean;
  isLoading: boolean;
}

export interface ToggleActions {
  toggle: () => void;
  setChecked: (checked: boolean) => void;
  disable: (disabled: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export function createToggleState(
  initialChecked: boolean = false,
  initialDisabled: boolean = false
): ToggleState & ToggleActions {
  let state: ToggleState = {
    isChecked: initialChecked,
    isDisabled: initialDisabled,
    isLoading: false,
  };

  return {
    get isChecked() {
      return state.isChecked;
    },
    get isDisabled() {
      return state.isDisabled;
    },
    get isLoading() {
      return state.isLoading;
    },
    toggle() {
      if (!state.isDisabled && !state.isLoading) {
        state.isChecked = !state.isChecked;
      }
    },
    setChecked(checked: boolean) {
      if (!state.isDisabled && !state.isLoading) {
        state.isChecked = checked;
      }
    },
    disable(disabled: boolean) {
      state.isDisabled = disabled;
    },
    setLoading(loading: boolean) {
      state.isLoading = loading;
    },
  };
}

export function toggleOption(state: ToggleState): boolean {
  return !state.isChecked;
}

export function isToggleDisabled(state: ToggleState): boolean {
  return state.isDisabled || state.isLoading;
}
