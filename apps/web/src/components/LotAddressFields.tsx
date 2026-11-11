import { useId } from "react";
import { Field } from "./UI";
import { lotAddressFields } from "../../../../packages/shared/src/lot-address";

export type LotParts = { phase: string; block: string; lot: string };

export function LotAddressFields({
  value,
  onChange,
  required = true,
}: {
  value: LotParts;
  onChange: (value: LotParts) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <>
      {lotAddressFields.map(({ name, label, max, width }) => (
        <Field
          key={name}
          label={`${label}${required ? "" : " (optional)"}`}
          htmlFor={`${id}-${name}`}
        >
          <input
            id={`${id}-${name}`}
            name={name}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value[name]}
            required={required}
            maxLength={width}
            placeholder={String(1).padStart(width, "0")}
            pattern={
              name === "phase"
                ? "[1-3]"
                : name === "block"
                  ? "(?:0?[1-9]|1[0-9])"
                  : "(?:0{0,2}[1-9]|0?[1-9][0-9]|10[0-9]|11[01])"
            }
            title={`Enter ${String(1).padStart(width, "0")}–${max}.`}
            aria-describedby={`${id}-${name}-guide`}
            onChange={(event) => {
              const next = event.target.value;
              if (/^[0-9]*$/.test(next)) onChange({ ...value, [name]: next });
            }}
            onBlur={(event) => {
              const next = event.target.value;
              const number = Number(next);
              if (next && number >= 1 && number <= max) {
                onChange({
                  ...value,
                  [name]: String(number).padStart(width, "0"),
                });
              }
            }}
          />
          <small id={`${id}-${name}-guide`}>
            {String(1).padStart(width, "0")}–{max}. Numbers only.
          </small>
        </Field>
      ))}
    </>
  );
}
