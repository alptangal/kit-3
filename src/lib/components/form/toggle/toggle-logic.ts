/**
 * Toggle State Logic
 * Manages toggle/switch on/off state with accessibility
 */

export interface ToggleState {
  isOn: boolean;
  disabled: boolean;
  isFocused: boolean;
  label: string;
  ariaLabel?: string;
  ariaDescription?: string;
}

export const createToggleState = (
  isOn: boolean = false,
  config?: {
    disabled?: boolean;
    label?: string;
    ariaLabel?: string;
    ariaDescription?: string;
  }
): ToggleState => ({
  isOn,
  disabled: config?.disabled ?? false,
  isFocused: false,
  label: config?.label ?? 'Toggle',
  ariaLabel: config?.ariaLabel,
  ariaDescription: config?.ariaDescription,
});

export const toggle = (state: ToggleState): ToggleState => {
  if (state.disabled) return state;

  return {
    ...state,
    isOn: !state.isOn,
  };
};

export const turnOn = (state: ToggleState): ToggleState => {
  if (state.disabled || state.isOn) return state;

  return {
    ...state,
    isOn: true,
  };
};

export const turnOff = (state: ToggleState): ToggleState => {
  if (state.disabled || !state.isOn) return state;

  return {
    ...state,
    isOn: false,
  };
};

export const setState = (
  state: ToggleState,
  isOn: boolean
): ToggleState => {
  if (state.disabled) return state;

  if (state.isOn === isOn) return state;

  return {
    ...state,
    isOn,
  };
};

export const setDisabled = (
  state: ToggleState,
  disabled: boolean
): ToggleState => ({
  ...state,
  disabled,
  isFocused: disabled ? false : state.isFocused,
});

export const setFocused = (
  state: ToggleState,
  isFocused: boolean
): ToggleState => {
  if (state.disabled) return state;

  return {
    ...state,
    isFocused,
  };
};

export const handleKeydown = (
  state: ToggleState,
  key: string
): ToggleState => {
  if (state.disabled) return state;

  if (key === ' ' || key === 'Enter') {
    return toggle(state);
  }

  return state;
};

export const setLabel = (
  state: ToggleState,
  label: string
): ToggleState => ({
  ...state,
  label,
});

export const setAriaLabel = (
  state: ToggleState,
  ariaLabel: string | undefined
): ToggleState => ({
  ...state,
  ariaLabel,
});

export const setAriaDescription = (
  state: ToggleState,
  ariaDescription: string | undefined
): ToggleState => ({
  ...state,
  ariaDescription,
});
