import { money, balance, type Invoice } from "../../../../packages/shared/src";
import type { WorkItem } from "../../../../packages/shared/src/workspace";
import styles from "./RecordVisuals.module.css";

export function InvoiceVisual({
  records,
  compact = false,
}: {
  records: Invoice[];
  compact?: boolean;
}) {
  const known =
    records.length > 0 &&
    records.every(
      (row) => Number.isFinite(row.amount) && Number.isFinite(row.received),
    );
  if (!known)
    return (
      <p className="note">
        Billing history unavailable. No estimated amounts are shown.
      </p>
    );
  const billed = records.reduce((sum, row) => sum + row.amount, 0);
  const received = records.reduce((sum, row) => sum + row.received, 0);
  const rows = [...records].sort((a, b) => a.due.localeCompare(b.due));
  const maximum = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <section
      className={`${styles.visual} ${compact ? styles.compact : ""}`}
      aria-label="Synthetic billing history"
    >
      <header>
        <h2>{compact ? "Recent payments" : "Billing at a glance"}</h2>
        <span>Sample · {rows.length} recorded periods</span>
      </header>
      {!compact && (
        <>
          <div className={styles.totals}>
            <strong>{money(received)} recorded</strong>
            <span>{money(billed - received)} outstanding</span>
          </div>
          <progress
            aria-label="Sample billed amount covered by recorded payments"
            value={received}
            max={billed || 1}
          />
        </>
      )}
      <div className={styles.bars}>
        {rows.map((row) => (
          <div key={row.id}>
            <span>{row.period}</span>
            <div
              className={styles.track}
              role="img"
              aria-label={`${row.period}: billed ${money(row.amount)}, recorded ${money(row.received)}, outstanding ${money(balance(row))}`}
            >
              <i style={{ width: `${(row.amount / maximum) * 100}%` }} />
              <b style={{ width: `${(row.received / maximum) * 100}%` }} />
            </div>
            <strong>{money(row.received)}</strong>
          </div>
        ))}
      </div>
      <p>
        Filled = recorded payments · track = billed. Earlier periods and payment
        dates are unavailable.
      </p>
    </section>
  );
}

export function ExpenseVisual({ records }: { records: WorkItem[] }) {
  const expenses = records.filter(
    (row) => row.kind === "expense" && row.status !== "Archived",
  );
  const known = expenses.filter((row) => row.amount !== undefined);
  const categories = new Map<string, number>();
  for (const row of known) {
    const label = row.metadata.category || "Uncategorized";
    categories.set(label, (categories.get(label) ?? 0) + row.amount!);
  }
  const total = known.reduce((sum, row) => sum + row.amount!, 0);
  return (
    <section className={styles.visual} aria-label="Synthetic expense amounts">
      <header>
        <h2>Submitted expense amounts</h2>
        <span>Sample · not disbursements</span>
      </header>
      <div className={styles.totals}>
        <strong>{known.length ? money(total) : "Amount unavailable"}</strong>
        <span>
          {known.length} priced · {expenses.length - known.length} missing
          amounts
        </span>
      </div>
      {[...categories]
        .sort((a, b) => b[1] - a[1])
        .map(([label, amount]) => (
          <div className={styles.category} key={label}>
            <span>{label}</span>
            <strong>{money(amount)}</strong>
            <progress
              aria-label={`${label} share of known sample expenses`}
              value={amount}
              max={total || 1}
            />
          </div>
        ))}
      <p>
        Only supplied amounts are summed. Missing amounts, approved budgets and
        actual payments remain unavailable.
      </p>
    </section>
  );
}

export function RequestStatusVisual({
  records,
  label,
}: {
  records: { status: string }[];
  label: string;
}) {
  const statuses = ["Open", "In progress", "Resolved"];
  return (
    <section className={styles.visual} aria-label={label}>
      <header>
        <h2>Request progress</h2>
        <span>{label}</span>
      </header>
      <ol className={styles.steps}>
        {statuses.map((status) => (
          <li key={status}>
            <strong>
              {records.filter((row) => row.status === status).length}
            </strong>
            <span>{status}</span>
          </li>
        ))}
      </ol>
      <p>
        Counts describe these records. A request can be reopened; this is not a
        promised completion schedule.
      </p>
    </section>
  );
}
