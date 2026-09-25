import type { InputProps } from '../input/_interface';

/** PasswordInput — wrapper mỏng quanh Input với type='password' hardcode; showPassword action mặc định bật. */
export type PasswordInputProps = Omit<InputProps, 'type'>;
