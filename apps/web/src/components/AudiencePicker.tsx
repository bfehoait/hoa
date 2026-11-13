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
  const id = useId();
  return (
    <fieldset
      className={styles.picker}
      disabled={disabled}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend>Audience</legend>
      <label className={styles.all}>
        <input
          type="checkbox"
          name="audience"
          value="members"
          checked={all}
          onChange={(event) => {
            setAll(event.target.checked);
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
              disabled={all}
              onChange={onChange}
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
