import type { ReactNode } from "react";
import styles from "./RecordFacts.module.css";

/** Display-only facts. Callers retain responsibility for authorized data. */
export default function RecordFacts({
  items,
  label = "Details",
}: {
  items: { label: string; value: ReactNode; key?: string }[];
  label?: string;
}) {
  if (!items.length) return null;
  return (
    <dl className={styles.facts} aria-label={label}>
      {items.map((item) => (
        <div key={item.key ?? item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
