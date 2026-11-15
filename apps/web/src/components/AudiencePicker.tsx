import { useId, useState } from "react";
import { publicationAudienceOptions } from "../../../../packages/shared/src/publication-audiences";
import styles from "./AudiencePicker.module.css";

export default function AudiencePicker({
  error,
  disabled,
  onChange,
}: {
  error: string;
  disabled: boolean;
  onChange: () => void;
}) {
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const id = useId();
  return (
    <fieldset
      className={styles.picker}
      disabled={disabled}
      aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
    >
      <legend>Choose audience</legend>
      <p className={styles.help} id={`${id}-help`}>
        Choose one or more groups, or choose All members.
      </p>
      <label className={styles.all}>
        <input
          type="checkbox"
          name="audience"
          value="members"
          checked={all}
          onChange={(event) => {
            setAll(event.target.checked);
            setSelected([]);
            onChange();
          }}
        />
        <span>
          All members<small>Everyone with an active member account</small>
        </span>
      </label>
      <div className={styles.options}>
        {publicationAudienceOptions.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              name="audience"
              value={value}
              checked={selected.includes(value)}
              onChange={(event) => {
                const checked = event.target.checked;
                setAll(false);
                setSelected((current) =>
                  checked
                    ? [...current, value]
                    : current.filter((entry) => entry !== value),
                );
                onChange();
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
