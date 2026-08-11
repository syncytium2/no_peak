import { useEffect, useRef, useState } from "react";

/**
 * A numeric settings field that can actually be typed into.
 *
 * The obvious implementation — `<input type="number" value={String(n)}
 * onChange={e => set(Number(e.target.value))}` — has a trap. Clearing the field
 * makes `e.target.value` the empty string, `Number("")` is 0, and the field is
 * immediately rewritten to "0" underneath the caret. The next keystroke lands
 * against that stray zero, so typing "1" into a cleared field yields 10 or 01
 * depending on where the caret ended up, and the field appears to refuse the
 * value. Every intermediate state a person types through — "", "-", "1." — has
 * the same problem.
 *
 * So the text being edited is kept as text, and only committed when it parses
 * to a number that satisfies min/max/integer. An unparseable or out-of-range
 * draft is left alone and marked invalid rather than being corrected mid-word;
 * leaving the field restores the last good value.
 *
 * Keyboard, so a parameter sweep does not need the mouse:
 *   Tab        move on, selecting the next field's contents so typing replaces
 *   Up / Down  step by `step`; hold Shift for ten steps
 *   Enter      commit and select, ready for the next value
 *   Escape     revert to the last committed value
 */
export interface NumFieldProps {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Reject fractional entries (window widths are counts of points). */
  integer?: boolean;
  /** Shown under the field: units, or what the number means. */
  hint?: React.ReactNode;
  title?: string;
  className?: string;
}

const round = (v: number) => Number(v.toPrecision(12));

export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  integer = false,
  hint,
  title,
  className,
}: NumFieldProps) {
  const [draft, setDraft] = useState(() => String(value));
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // Track the value from outside (a loaded file, a reset) but never overwrite
  // what someone is in the middle of typing.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  /** The number a draft represents, or null if it is not one we can accept. */
  function parse(raw: string): number | null {
    const t = raw.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    if (integer && !Number.isInteger(n)) return null;
    if (min !== undefined && n < min) return null;
    if (max !== undefined && n > max) return null;
    return n;
  }

  const parsed = parse(draft);
  const invalid = editing && parsed === null;

  function type(raw: string) {
    setDraft(raw);
    const n = parse(raw);
    if (n !== null && n !== value) onChange(n);
  }

  function nudge(direction: 1 | -1, big: boolean) {
    const base = parsed ?? value;
    let next = round(base + direction * step * (big ? 10 : 1));
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (integer) next = Math.round(next);
    setDraft(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <label className={className} title={title}>
      {label}
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        aria-invalid={invalid || undefined}
        className={invalid ? "badnum" : undefined}
        onFocus={(e) => {
          setEditing(true);
          e.target.select(); // tab in, type, done — no select-all first
        }}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          setEditing(false);
          setDraft(String(parse(draft) ?? value));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault(); // otherwise the caret jumps to an end
            nudge(e.key === "ArrowUp" ? 1 : -1, e.shiftKey);
          } else if (e.key === "Enter") {
            e.preventDefault();
            setDraft(String(parse(draft) ?? value));
            ref.current?.select();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(String(value));
            ref.current?.select();
          }
        }}
      />
      {hint && <span className="fieldhint">{hint}</span>}
    </label>
  );
}
