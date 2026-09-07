'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatNumberBr } from '@/lib/number-format';
import { ignoreSliderGesture, stepParameter } from '@/lib/parameter-interaction';

type Props = {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

/** Touch uses explicit clicks, never track presses, pointer-down or auto-repeat. */
export function ParameterAdjustment({ label, value, suffix, min, max, step, onChange }: Props) {
  return (
    <>
      <fieldset className="parameter-stepper" aria-label={`Ajuste preciso: ${label}`}>
        <Button type="button" variant="outline" className="size-11" aria-label={`Diminuir ${label}`}
          disabled={value <= min} onClick={(event) => {
            // Safari may leave the numeric field focused after a tap. End its
            // draft before stepping so a later blur cannot restore old text.
            event.currentTarget.focus({ preventScroll: true });
            onChange(stepParameter(value, -1, step, min, max));
          }}>
          <Minus aria-hidden="true" />
        </Button>
        <span className="min-w-0 text-center text-xs text-muted-foreground">
          {formatNumberBr(step)} {suffix} por toque
        </span>
        <Button type="button" variant="outline" className="size-11" aria-label={`Aumentar ${label}`}
          disabled={value >= max} onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true });
            onChange(stepParameter(value, 1, step, min, max));
          }}>
          <Plus aria-hidden="true" />
        </Button>
      </fieldset>
      <div className="parameter-mouse-slider"
        onPointerDownCapture={(event) => {
          if (event.pointerType !== 'mouse') event.stopPropagation();
        }}
        onTouchStartCapture={(event) => event.stopPropagation()}>
        <Slider aria-label={label} min={min} max={max} step={step} value={[value]} thumbAlignment="center"
          onValueChange={(next, details) => {
            // Also protect hybrid hardware if its media-query capabilities lag.
            if (ignoreSliderGesture(details.event)) {
              details.cancel();
              return;
            }
            onChange(Number(typeof next === 'number' ? next : next[0]));
          }} />
      </div>
    </>
  );
}
