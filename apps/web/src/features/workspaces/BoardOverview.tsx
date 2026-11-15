import { ArrowRight, FileText, Vote, BarChart3 } from "lucide-react";
import { useFeatureRecords } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, Skeleton } from "../../components/UI";
import OfficePage from "../office/OfficePage";
import styles from "./Board.module.css";
import { useWorkspaceMetrics, metricMoney } from "../../data/workspace-metrics";

export default function BoardOverview() {
  const auth = useAuth();
  const metrics = useWorkspaceMetrics("board");
  const reports = useFeatureRecords("board-reports", "published", 0, "");
  const documents = useFeatureRecords("board-records", "published", 0, "");
  const updates = useFeatureRecords("publishing", "published", 0, "");
  const sample = auth.preview || !!auth.rolePreview;
  const count = (query: typeof reports) =>
    sample || query.isError ? (
      "Unavailable"
    ) : query.isPending ? (
      <Skeleton variant="metric" label="Loading count" />
    ) : (
      (query.data?.total.toLocaleString("en-PH") ?? "Unavailable")
    );
  return (
    <>
      <OfficePage
        title="Overview"
        description="Review announcements, elections and financial reports."
      />
      <section className={styles.section}>
        <h2>Elections & reports</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>Election turnout</h3>
            <div className={styles.unavailableRing}>
              <Vote size={30} aria-hidden="true" />
              <span>Unavailable</span>
            </div>
            <p>
              Voter totals have not been confirmed yet, so turnout is
              unavailable.
            </p>
            <Link to="/board/elections">
              Election information <ArrowRight size={18} />
            </Link>
          </article>
          <article className={styles.card}>
            <h3>Payments applied to this year’s bills</h3>
            <div className={styles.unavailableRing}>
              <BarChart3 size={30} aria-hidden="true" />
              <span>
                {metrics.isFetching && !metrics.data ? (
                  <Skeleton variant="metric" label="Loading payments applied" />
                ) : metrics.data?.allocation_percent == null ? (
                  "Unavailable"
                ) : (
                  `${metrics.data.allocation_percent}%`
                )}
              </span>
            </div>
            <p>
              Recorded payments applied to approved bills for this year. Each
              bill counts up to its amount due. This does not confirm bank
              clearance.
            </p>
            <Link to="/board/reports">
              View published reports <ArrowRight size={18} />
            </Link>
          </article>
          <article className={styles.card}>
            <h3>Published reports</h3>
            <strong className={styles.value}>{count(reports)}</strong>
            <p>
              Published reports you can read. Reports awaiting approval are not
              included.
            </p>
            {reports.isError && <Feedback error={reports.error} />}
            <Link to="/board/reports">
              Open reports <ArrowRight size={18} />
            </Link>
          </article>
        </div>
      </section>
      <section className={styles.section}>
        <h2>Finances & documents</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>Expenses this year</h3>
            <strong
              className={
                metrics.data?.finance_available
                  ? styles.value
                  : styles.unavailable
              }
            >
              {metrics.isFetching && !metrics.data ? (
                <Skeleton variant="metric" label="Loading expenses" />
              ) : metrics.data?.expense_centavos === undefined ? (
                "Unavailable"
              ) : (
                metricMoney(metrics.data.expense_centavos)
              )}
            </strong>
            <p>
              Approved expenses recorded from January through today. Past
              collection receipts are not counted as expenses or proof of bank
              payment.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Expenses by category</h3>
            {metrics.isFetching && !metrics.data ? (
              <Skeleton variant="section" label="Loading expense categories" />
            ) : metrics.data?.expense_categories ? (
              <>
                <dl>
                  {metrics.data.expense_categories.map((c) => (
                    <div key={c.label}>
                      <dt>{c.label}</dt>
                      <dd>{metricMoney(c.amount_centavos)}</dd>
                    </div>
                  ))}
                </dl>
                {!metrics.data.expense_categories.length && (
                  <p>No approved expenses recorded for this year.</p>
                )}
              </>
            ) : (
              <>
                <strong className={styles.unavailable}>Unavailable</strong>
                <p>
                  You need permission to view these totals. You can still open
                  published reports.
                </p>
              </>
            )}
          </article>
          <article className={styles.card}>
            <h3>Board documents</h3>
            <strong className={styles.value}>{count(documents)}</strong>
            <p>
              Published documents you can read. Open a document to check its
              attached file.
            </p>
            {documents.isError && <Feedback error={documents.error} />}
            <Link to="/board/documents">
              Open document library <ArrowRight size={18} />
            </Link>
          </article>
        </div>
      </section>
      {metrics.isError && <Feedback error={metrics.error} />}
      {metrics.data?.finance_available === false && (
        <p className="notice-note" role="status">
          Your Board access is active, but you do not have permission to view
          financial totals. You can still open published reports.
        </p>
      )}
      {metrics.data?.finance_available &&
        metrics.data.allocation_percent === null && (
          <p className="note">
            No approved bills have been recorded for this year, so this
            percentage is unavailable.
          </p>
        )}
      {metrics.data?.finance_available && (
        <p className="note">
          Financial totals as of{" "}
          {new Date(metrics.data.as_of).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
          })}
          . Permission to view totals does not allow you to open or change
          individual financial records.
        </p>
      )}
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Recent announcements</h2>
          <Link to="/board/updates">
            See all <ArrowRight size={18} />
          </Link>
        </div>
        <div className={styles.feed}>
          {sample ? (
            <p className={styles.empty}>
              Sample preview only. Live announcements are not shown.
            </p>
          ) : updates.isPending ? (
            <Skeleton />
          ) : updates.isError ? (
            <div className={styles.empty}>
              <Feedback error={updates.error} />
              <Button secondary onClick={() => void updates.refetch()}>
                Retry announcements
              </Button>
            </div>
          ) : !updates.data?.rows.length ? (
            <p className={styles.empty}>No published announcements to show.</p>
          ) : (
            updates.data.rows.slice(0, 4).map((row) => (
              <Link
                className={styles.feedRow}
                key={row.id}
                to={`/board/updates?record=${encodeURIComponent(row.id)}`}
              >
                <span className={styles.icon}>
                  <FileText size={20} />
                </span>
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.detail}</small>
                </span>
                <time dateTime={row.created_at}>
                  {new Date(row.created_at).toLocaleDateString("en-PH", {
                    timeZone: "Asia/Manila",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <ArrowRight size={18} />
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
