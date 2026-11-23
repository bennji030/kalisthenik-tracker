import { useEffect, useState } from 'react';
import { parseNum } from '../util';

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/** Zahlenfeld mit iOS-Ziffernblock; behält Zwischenstände wie "22," beim Tippen. */
export function NumInput({ value, onChange, decimal, placeholder, className, ariaLabel }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  useEffect(() => {
    if (parseNum(text) !== value) setText(value == null ? '' : String(value).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={className ?? 'num'}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
    />
  );
}
