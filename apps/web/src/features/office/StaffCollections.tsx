import { ArrowRight, Banknote, CalendarDays } from "lucide-react";
import { money } from "../../../../../packages/shared/src";
import { hasCapability } from "../../../../../packages/shared/src/permissions";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { useReceipts } from "../../data/registry";
import { collectionMonthLabel } from "./CollectionCharts";
import styles from "./StaffCollections.module.css";

/** Same authorized receipt projection used by Collections. No inferred debt,
 * collection-rate denominator, zero-filled months or extra financial authority. */
export default function StaffCollections() {
  const auth = useAuth();
  const access = usePermissions();
  const enabled =
    !auth.preview &&
    !auth.rolePreview &&
    !auth.memberPreview &&
    access.allowsPath("/office/finance") &&
    hasCapability(access.data, {
      module: "finance",
      action: "view",
      scope: "association",
    });
  const query = useReceipts(
    {
      p_lot: null,
      p_from: null,
      p_to: null,
      p_page: 0,
      p_export: false,
    },
    enabled,
  );
  if (!enabled) return null;
  const data = query.data;
  const months = [...(data?.monthly ?? [])].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const recent = months.slice(-6);
  const latest = recent.at(-1);
  const maximum = Math.max(1, ...recent.map((m) => m.amount_centavos));
  const allPhases = [...(data?.phases ?? [])].sort((a, b) => a.phase - b.phase);
  const phases = allPhases
    .slice(0, 3)
    .map((p) => ({ label: `Phase ${p.phase}`, amount: p.amount_centavos }));
  if (allPhases.length > 3)
    phases.push({
      label: "Other phases",
      amount: allPhases.slice(3).reduce((sum, p) => sum + p.amount_centavos, 0),
    });
  const circumference = 2 * Math.PI * 42;
  return (
    <section
      className={styles.section}
      aria-labelledby="office-collections-heading"
    >
      <header className={styles.heading}>
        <h2 id="office-collections-heading">Collections</h2>
        <Link className="text-link" to="/office/finance/collections">
          View receipts <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <div>
          <Feedback error={query.error} />
          <Button
            secondary
            pending={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry collections
          </Button>
        </div>
      ) : data ? (
        <>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3>
                <Banknote size={20} aria-hidden="true" />
                Recorded collections
              </h3>
              <strong className={styles.value}>
                {money(data.total_centavos)}
              </strong>
              <p>
                {data.total.toLocaleString("en-PH")} imported receipts across{" "}
                {data.lots.length.toLocaleString("en-PH")} properties.
              </p>
              <span className={styles.caption}>
                All available receipt dates
              </span>
            </article>
            <article className={styles.card}>
              <h3>
                <CalendarDays size={20} aria-hidden="true" />
                Latest reported month
              </h3>
              <strong className={styles.value}>
                {latest ? money(latest.amount_centavos) : "Not recorded"}
              </strong>
              <p>
                {latest
                  ? collectionMonthLabel(latest.month)
                  : "No monthly receipts are available."}
              </p>
              {!!recent.length && (
                <div
                  className={styles.bars}
                  role="img"
                  aria-label={recent
                    .map(
                      (m) =>
                        `${collectionMonthLabel(m.month)}: ${money(m.amount_centavos)}`,
                    )
                    .join("; ")}
                >
                  {recent.map((m) => (
                    <span
                      key={m.month}
                      title={`${collectionMonthLabel(m.month)}: ${money(m.amount_centavos)}`}
                    >
                      <i
                        style={{
                          height: `${Math.max(4, (m.amount_centavos / maximum) * 100)}%`,
                        }}
                      />
                      <small>{collectionMonthLabel(m.month)}</small>
                    </span>
                  ))}
                </div>
              )}
            </article>
            <article className={styles.card}>
              <h3>Collections by phase</h3>
              {data.total_centavos > 0 ? (
                <div className={styles.breakdown}>
                  <svg
                    viewBox="0 0 112 112"
                    className={styles.donut}
                    role="img"
                    aria-label="Receipt amount by phase; amounts are listed alongside"
                  >
                    <circle cx="56" cy="56" r="42" className={styles.track} />
                    {phases.map((p, index) => {
                      const length =
                        (p.amount / data.total_centavos) * circumference;
                      const start =
                        (phases
                          .slice(0, index)
                          .reduce((sum, phase) => sum + phase.amount, 0) /
                          data.total_centavos) *
                        circumference;
                      return (
                        <circle
                          key={p.label}
                          cx="56"
                          cy="56"
                          r="42"
                          className={styles.segment}
                          style={{
                            stroke: `var(--console-chart-${index})`,
                            strokeDasharray: `${Math.max(0, length - 2)} ${circumference}`,
                            strokeDashoffset: -start,
                          }}
                        />
                      );
                    })}
                    <text x="56" y="54" className={styles.donutLabel}>
                      Receipts
                    </text>
                    <text x="56" y="71" className={styles.donutCount}>
                      {data.total.toLocaleString("en-PH")}
                    </text>
                  </svg>
                  <ul className={styles.legend}>
                    {phases.map((p, index) => (
                      <li key={p.label}>
                        <span>
                          <i
                            style={{
                              background: `var(--console-chart-${index})`,
                            }}
                          />
                          {p.label}
                        </span>
                        <strong>{money(p.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={styles.noData}>No recorded collections yet.</p>
              )}
            </article>
          </div>
          <p className={styles.note}>
            Receipt evidence only. Collection rates and dues aging require
            verified billing records; missing months are not treated as unpaid.
          </p>
        </>
      ) : null}
    </section>
  );
}
