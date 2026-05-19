import { AlertCircle } from 'lucide-react';
import type React from 'react';
import { useId } from 'react';
import styles from './styles.module.css';

export interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: 'sm' | 'md';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoFocus?: boolean;
  id?: string;
  name?: string;
  maxLength?: number;
  type?: string;
}

export function TextInput({
  label,
  placeholder,
  value,
  onChange,
  error,
  helper,
  required = false,
  disabled = false,
  readOnly = false,
  size = 'md',
  inputMode,
  autoFocus = false,
  id: externalId,
  name,
  maxLength,
  type = 'text',
}: TextInputProps) {
  const generatedId = useId();
  const inputId = externalId ?? generatedId;
  const helperId = `${inputId}-helper`;
  const hasError = Boolean(error);
  const helperText = error ?? helper;

  return (
    <div className={styles.wrapper} data-size={size} data-error={hasError ? '' : undefined}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.requiredMark}> *</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-required={required ? 'true' : undefined}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={helperText ? helperId : undefined}
        inputMode={inputMode}
        // biome-ignore lint/a11y/noAutofocus: autoFocus is opt-in via prop; callers (e.g. modals) use it intentionally
        autoFocus={autoFocus}
        maxLength={maxLength}
        data-size={size}
      />
      {helperText && (
        <p id={helperId} className={styles.helperText} data-error={hasError ? '' : undefined}>
          {hasError && <AlertCircle size={14} className={styles.errorIcon} aria-hidden="true" />}
          {helperText}
        </p>
      )}
    </div>
  );
}

export default TextInput;
