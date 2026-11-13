import { useId } from "react";
import { Field } from "./UI";
import {
  lotAddressFields,
  lotLimitsForPhase,
} from "../../../../packages/shared/src/lot-address";

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
      {lotAddressFields.map(({ name, label, max: generalMax, width }) => {
        const max =
          name === "phase" ? generalMax : lotLimitsForPhase(value.phase)[name];
        const maxLabel = String(max).padStart(width, "0");
        return (
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
              pattern={Array.from(
                { length: max },
                (_, index) => `0{0,${width - 1}}${index + 1}`,
              ).join("|")}
              title={`Enter ${String(1).padStart(width, "0")}–${maxLabel}.`}
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
              {String(1).padStart(width, "0")}–{maxLabel}. Numbers only.
            </small>
          </Field>
        );
      })}
    </>
  );
}
