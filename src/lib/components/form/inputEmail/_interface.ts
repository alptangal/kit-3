import type { InputProps } from '../input/_interface';

/**
 * EmailInput — wrapper mỏng quanh Input với type='email' hardcode.
 * KHÔNG có instance exports (configs) — cần configs thì dùng Input trực tiếp.
 */
export type EmailInputProps = Omit<InputProps, 'type'>;
