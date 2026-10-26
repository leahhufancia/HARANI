import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';

export default function QuantityStepper({ value, onChange, max, label, disabled = false, invalid = false, describedBy }) {
  const id = useId();
  const count = Number(value);
  return <div className="quantity-stepper">
    <label htmlFor={id} className="sr-only">{label}</label>
    <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || count <= 1} onClick={() => onChange(String(Math.max(1, Math.min(max, Math.ceil(count) - 1))))}><Minus size={16} aria-hidden="true" /></button>
    <input id={id} type="number" inputMode="numeric" min="1" max={max} step="1" required value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} />
    <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || count >= max} onClick={() => onChange(String(Math.min(max, Math.max(1, Math.floor(count) + 1))))}><Plus size={16} aria-hidden="true" /></button>
  </div>;
}
