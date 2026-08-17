import { SERVED_COUNTRIES, US_STATES, DEFAULT_COUNTRY } from "@contracts/geo";

const baseClass =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c47a45]/40 focus:border-[#c47a45]";

/**
 * Country selector — United States preselected by default, all served
 * European countries selectable. Matches the styling of the surrounding
 * form inputs.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  className,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      required={required}
      value={value || DEFAULT_COUNTRY}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? baseClass}
    >
      {SERVED_COUNTRIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

/** Selector for all 50 US states + the District of Columbia. */
export function USStateSelect({
  id,
  value,
  onChange,
  className,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? baseClass}
    >
      <option value="">Select a state</option>
      {US_STATES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
