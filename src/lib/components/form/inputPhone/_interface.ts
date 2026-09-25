import type { InputProps } from '../input/_interface';

/** PhoneInput — wrapper mỏng quanh Input với type='phone' hardcode. */
export type PhoneInputProps = Omit<InputProps, 'type'>;
