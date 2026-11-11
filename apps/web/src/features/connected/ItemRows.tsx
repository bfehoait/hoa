import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../../components/UI";
import styles from "./LiveFeature.module.css";

/**
 * A list of things, entered one row at a time.
 *
 * The stored value is unchanged — newline-separated text in a single field, as
 * the server already validates — so this is a way of entering the same record,
 * not a new shape. A hidden input carries the joined value so the surrounding
 * form keeps working exactly as before.
 *
 * Asking for "one per line" in a text box puts the formatting burden on the
 * person listing eight bags of cement on a phone.
 */
export default function ItemRows({
  id,
  name,
  label,
  required,
  defaultValue = "",
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [rows, setRows] = useState<string[]>(() => {
    const existing = defaultValue
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean);
    return existing.length ? existing : [""];
  });
  const joined = rows
    .map((row) => row.trim())
    .filter(Boolean)
    .join("\n");
  const set = (index: number, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? value : row)));
  return (
    <div className={styles.itemRows}>
      <input type="hidden" name={name} value={joined} />
      {/* The hidden input is what submits; these carry no name of their own. */}
      {rows.map((row, index) => (
        <div className={styles.itemRow} key={index}>
          <input
            id={index === 0 ? id : undefined}
            value={row}
            aria-label={`${label} ${index + 1}`}
            placeholder={placeholder}
            maxLength={200}
            onChange={(event) => set(index, event.target.value)}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            disabled={rows.length === 1 && !rows[0]}
            onClick={() =>
              setRows((prev) =>
                prev.length === 1 ? [""] : prev.filter((_, i) => i !== index),
              )
            }
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        tone="quiet"
        size="sm"
        onClick={() => setRows((prev) => [...prev, ""])}
      >
        <Plus size={16} aria-hidden="true" />
        Add another
      </Button>
      {required && !joined && (
        <p className={styles.formHelp} role="status">
          Add at least one.
        </p>
      )}
    </div>
  );
}
