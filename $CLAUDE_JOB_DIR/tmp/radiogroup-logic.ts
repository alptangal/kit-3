/**
 * RadioGroup State Logic
 * Manages single-selection radio button group state
 */

export interface RadioOption {
  id: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface RadioGroupState {
  selectedId: string | null;
  options: RadioOption[];
  disabled: boolean;
  name: string;
  orientation: 'vertical' | 'horizontal';
  focusedId: string | null;
}

export const createRadioGroupState = (
  options: RadioOption[],
  selectedId: string | null = null,
  config?: {
    disabled?: boolean;
    name?: string;
    orientation?: 'vertical' | 'horizontal';
  }
): RadioGroupState => ({
  selectedId,
  options,
  disabled: config?.disabled ?? false,
  name: config?.name ?? 'radio-group',
  orientation: config?.orientation ?? 'vertical',
  focusedId: null,
});

export const selectOption = (
  state: RadioGroupState,
  optionId: string
): RadioGroupState => {
  const option = state.options.find(opt => opt.id === optionId);

  if (!option || option.disabled || state.disabled) {
    return state;
  }

  return {
    ...state,
    selectedId: optionId,
    focusedId: optionId,
  };
};

export const focusOption = (
  state: RadioGroupState,
  optionId: string
): RadioGroupState => {
  const option = state.options.find(opt => opt.id === optionId);

  if (!option || option.disabled || state.disabled) {
    return state;
  }

  return {
    ...state,
    focusedId: optionId,
  };
};

export const moveFocusNext = (state: RadioGroupState): RadioGroupState => {
  if (state.disabled) return state;

  const enabledOptions = state.options.filter(opt => !opt.disabled);
  if (enabledOptions.length === 0) return state;

  const currentIndex = state.focusedId
    ? enabledOptions.findIndex(opt => opt.id === state.focusedId)
    : -1;

  const nextIndex = (currentIndex + 1) % enabledOptions.length;
  const nextId = enabledOptions[nextIndex].id;

  return {
    ...state,
    focusedId: nextId,
  };
};

export const moveFocusPrevious = (state: RadioGroupState): RadioGroupState => {
  if (state.disabled) return state;

  const enabledOptions = state.options.filter(opt => !opt.disabled);
  if (enabledOptions.length === 0) return state;

  const currentIndex = state.focusedId
    ? enabledOptions.findIndex(opt => opt.id === state.focusedId)
    : -1;

  const nextIndex = currentIndex <= 0
    ? enabledOptions.length - 1
    : currentIndex - 1;

  const nextId = enabledOptions[nextIndex].id;

  return {
    ...state,
    focusedId: nextId,
  };
};

export const handleKeydown = (
  state: RadioGroupState,
  key: string
): RadioGroupState => {
  const arrowDownKeys = ['ArrowDown', 'ArrowRight'];
  const arrowUpKeys = ['ArrowUp', 'ArrowLeft'];

  if (arrowDownKeys.includes(key)) {
    return moveFocusNext(state);
  }

  if (arrowUpKeys.includes(key)) {
    return moveFocusPrevious(state);
  }

  if (key === ' ' && state.focusedId) {
    return selectOption(state, state.focusedId);
  }

  return state;
};

export const setDisabled = (
  state: RadioGroupState,
  disabled: boolean
): RadioGroupState => ({
  ...state,
  disabled,
  focusedId: disabled ? null : state.focusedId,
});

export const addOption = (
  state: RadioGroupState,
  option: RadioOption,
  insertAt?: number
): RadioGroupState => {
  const newOptions = insertAt !== undefined
    ? [
        ...state.options.slice(0, insertAt),
        option,
        ...state.options.slice(insertAt),
      ]
    : [...state.options, option];

  return {
    ...state,
    options: newOptions,
  };
};

export const removeOption = (
  state: RadioGroupState,
  optionId: string
): RadioGroupState => {
  const newOptions = state.options.filter(opt => opt.id !== optionId);
  const selectedId = state.selectedId === optionId ? null : state.selectedId;
  const focusedId = state.focusedId === optionId ? null : state.focusedId;

  return {
    ...state,
    options: newOptions,
    selectedId,
    focusedId,
  };
};

export const clearSelection = (state: RadioGroupState): RadioGroupState => ({
  ...state,
  selectedId: null,
});
