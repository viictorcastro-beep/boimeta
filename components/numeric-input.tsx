'use client';
import { useId, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import {
  boundedNumber,
  formatNumberBr,
  parseNumberBr,
} from '@/lib/number-format';

type Props = Omit<
  ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step'
> & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
};

export function NumericInput({
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onValueChange,
  onFocus,
  onBlur,
  onKeyDown,
  className,
  ...props
}: Props) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const hintId = useId();
  const parsed = editing ? parseNumberBr(draft) : value;
  const invalid =
    editing &&
    draft.trim() !== '' &&
    (parsed === null || parsed < min || parsed > max);
  return (
    <span className="inline-flex min-w-0 flex-col">
      <Input
        {...props}
        title={
          props.title ??
          'Use vírgula para decimais e ponto para milhares: 1.234,56'
        }
        className={className}
        type="text"
        inputMode="decimal"
        lang="pt-BR"
        value={editing ? draft : formatNumberBr(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [props['aria-describedby'], editing ? hintId : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
        onFocus={(event) => {
          setDraft(formatNumberBr(value));
          setEditing(true);
          onFocus?.(event);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = parseNumberBr(event.target.value);
          if (next !== null && next >= min && next <= max) onValueChange(next);
        }}
        onBlur={(event) => {
          const next = parseNumberBr(draft);
          if (next !== null) onValueChange(boundedNumber(next, min, max));
          setEditing(false);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const next = boundedNumber(
              (parseNumberBr(draft) ?? value) +
                (event.key === 'ArrowUp' ? step : -step),
              min,
              max,
            );
            setDraft(formatNumberBr(next));
            onValueChange(next);
          }
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(formatNumberBr(value));
            setEditing(false);
          }
          onKeyDown?.(event);
        }}
      />
      {editing ? (
        <span
          id={hintId}
          className="mt-1 text-right text-[10px] text-muted-foreground"
        >
          {invalid
            ? 'Confira o número e os limites do campo.'
            : parsed === null
              ? 'Vazio: mantém o último valor.'
              : formatNumberBr(parsed)}
        </span>
      ) : null}
    </span>
  );
}
