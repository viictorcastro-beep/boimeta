import { parseNumberBr } from './number-format.ts';

/** Focus followed by scroll/blur is not permission to rewrite a stored value. */
export function numericBlurValue(draft: string, dirty: boolean, min: number, max: number) {
  if (!dirty) return null;
  const parsed = parseNumberBr(draft);
  return parsed === null || parsed < min || parsed > max ? null : parsed;
}

/** Do not interpret scrolling, touch or stylus gestures as slider edits. */
export function ignoreSliderGesture(event: { type: string; pointerType?: string }) {
  return event.type === 'wheel' || event.type.startsWith('touch') ||
    (Boolean(event.pointerType) && event.pointerType !== 'mouse');
}

/** One explicit click = one existing step; no acceleration or altered model precision. */
export function stepParameter(value: number, direction: -1 | 1, step: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0 || min > max) return value;
  return Math.min(max, Math.max(min, Number((value + direction * step).toFixed(12))));
}
