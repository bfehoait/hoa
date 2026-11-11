import { Banknote, FileText, Building2, CalendarDays } from "lucide-react";
import { money } from "../../../../../packages/shared/src";
import type { ReceiptPage } from "../../../../../packages/shared/src/registry";
import styles from "./CollectionCharts.module.css";

export function collectionMonthLabel(month: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

export default function CollectionCharts({
  data,
  selected,
  onSelect,
  disabled,
}: {
  data: ReceiptPage;
  selected: string;
  onSelect: (month: string) => void;
  disabled: boolean;
}) {
  const months = [...data.monthly].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const max = Math.max(1, ...months.map((m) => m.amount_centavos));
  const phases = [...data.phases].sort(
    (a, b) => b.amount_centavos - a.amount_centavos,
  );
  const phaseMax = Math.max(1, ...phases.map((p) => p.amount_centavos));
  const metrics = [
    {
      label: "Recorded collections",
      value: money(data.total_centavos),
      detail: "Imported receipt amounts",
      icon: Banknote,
    },
    {
      label: "Receipts",
      value: data.total.toLocaleString("en-PH"),
      detail: "Within your date range",
      icon: FileText,
    },
    {
      label: "Properties with receipts",
      value: data.lots.length.toLocaleString("en-PH"),
      detail: "Not a count of paid-up properties",
      icon: Building2,
    },
    {
      label: "Months with receipts",
      value: months.length.toLocaleString("en-PH"),
      detail: "Months represented in the import",
      icon: CalendarDays,
    },
  ];
  return (
    <div className={styles.dashboard}>
      <div className={styles.metrics} aria-label="Recorded collections summary">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <div className={styles.metric} key={label}>
            <div className={styles.metricLabel}>
              <span>{label}</span>
              <Icon size={20} aria-hidden="true" />
            </div>
            <strong>{value}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </div>
      <div className={styles.charts}>
        <section
          className={styles.chart}
          aria-labelledby="collections-monthly-title"
        >
          <div className={styles.heading}>
            <h3 id="collections-monthly-title">Monthly collections</h3>
            <span>PHP · receipt date</span>
          </div>
          <p className={styles.note}>
            Select a month to inspect its receipts. Missing months are not
            treated as zero collections.
          </p>
          {months.length ? (
            <>
              <div
                className={styles.bars}
                aria-label="Monthly amounts; select a month to filter the receipt list"
              >
                {months.map((m) => (
                  <button
                    key={m.month}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected === m.month}
                    onClick={() =>
                      onSelect(selected === m.month ? "" : m.month)
                    }
                    title={`${collectionMonthLabel(m.month)}: ${money(m.amount_centavos)}; ${m.count} receipts`}
                  >
                    <span className={styles.plot} aria-hidden="true">
                      <span
                        style={{
                          height: `${Math.max(0, (m.amount_centavos / max) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className={styles.month}>
                      {collectionMonthLabel(m.month)}
                    </span>
                    <span className={styles.barAmount}>
                      {money(m.amount_centavos)}
                    </span>
                    <span className={styles.count}>
                      {m.count.toLocaleString("en-PH")} receipts
                    </span>
                  </button>
                ))}
              </div>
              <p className={styles.note}>
                Bar height compares recorded amounts with the largest month in
                this range.
              </p>
            </>
          ) : (
            <p className={styles.empty}>
              No monthly receipt data for this date range.
            </p>
          )}
        </section>
        <section
          className={styles.chart}
          aria-labelledby="collections-phase-title"
        >
          <div className={styles.heading}>
            <h3 id="collections-phase-title">Collections by phase</h3>
            <span>Same date range</span>
          </div>
          <p className={styles.note}>
            Recorded amounts across the properties represented in the import.
          </p>
          {phases.length ? (
            <ul className={styles.phases}>
              {phases.map((p) => (
                <li key={p.phase}>
                  <div>
                    <strong>Phase {p.phase}</strong>
                    <strong>{money(p.amount_centavos)}</strong>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.max(0, (p.amount_centavos / phaseMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className={styles.note}>
                    {p.count.toLocaleString("en-PH")} receipts
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              No phase breakdown for this date range.
            </p>
          )}
          <p className={styles.note}>
            These charts show receipt evidence, not outstanding dues or bank
            reconciliation.
          </p>
        </section>
      </div>
    </div>
  );
}
