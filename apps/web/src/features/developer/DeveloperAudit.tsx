import { useState } from "react";
import { FileText, ArrowRight, RefreshCw } from "lucide-react";
import { useModuleMonitor } from "../../data/monitoring";
import { useAuth } from "../../data/auth";
import { Button, ButtonLink, Feedback, Skeleton } from "../../components/UI";
import { Link } from "../../components/AccessLink";
import DeveloperPage from "./DeveloperPage";
import styles from "./DeveloperScreens.module.css";

export function AuditFeed({ compact = false }: { compact?: boolean }) {
  const [page, setPage] = useState(0);
  const auth = useAuth();
  const query = useModuleMonitor("bfe_request_audit", compact ? 0 : page);
  const rows = compact ? query.data?.rows.slice(0, 4) : query.data?.rows;
  if (auth.preview || auth.rolePreview)
    return (
      <p className={styles.notice}>
        Real audit history is unavailable in synthetic previews.
      </p>
    );
  return (
    <>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Retry audit history
          </Button>
        </>
      ) : (
        <>
          {!compact && (
            <div className={styles.result}>
              <span>
                {query.data?.total?.toLocaleString("en-PH") ??
                  "Unknown number of"}{" "}
                request audit events
              </span>
              <Button
                secondary
                pending={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={18} />
                Refresh
              </Button>
            </div>
          )}
          <section
            className={styles.feed}
            aria-label="Recorded request audit history"
          >
            {compact && (
              <header>
                <h3>Request audit history</h3>
                <Link
                  to="/developer/activity"
                  aria-label="Open recorded audit history"
                >
                  <ArrowRight size={20} />
                </Link>
              </header>
            )}
            {!rows?.length ? (
              <p className={styles.empty}>
                No request audit events were returned.
              </p>
            ) : (
              rows.map((row) => (
                <article key={row.reference} className={styles.event}>
                  <span className={styles.icon}>
                    <FileText size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>
                      {typeof row.fields.action === "string"
                        ? row.fields.action
                        : row.label}
                    </strong>
                    <p>{row.status || "Recorded request activity"}</p>
                  </div>
                  <time dateTime={row.recorded_at ?? undefined}>
                    {row.recorded_at &&
                    Number.isFinite(Date.parse(row.recorded_at))
                      ? new Date(row.recorded_at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Time unavailable"}
                  </time>
                </article>
              ))
            )}
          </section>
          {!compact && (
            <nav className={styles.pagination} aria-label="Audit history pages">
              <Button
                secondary
                disabled={!page || query.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <span>Page {page + 1}</span>
              <Button
                secondary
                disabled={
                  query.isFetching ||
                  (page + 1) * 20 >= (query.data?.total ?? 0)
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      <p className={styles.note}>
        Source: request workflow audit. Other available record histories remain
        in <Link to="/developer/modules/audit">audit monitoring</Link>; this is
        not a unified infrastructure log.
      </p>
    </>
  );
}

export default function DeveloperAudit() {
  return (
    <DeveloperPage
      title="Diagnostics & audit"
      description="Recorded system activity and the tools to inspect it."
    >
      <AuditFeed />
      <div className={styles.toolLinks}>
        <ButtonLink to="/developer/modules/audit">
          Open audit monitoring
        </ButtonLink>
        <ButtonLink to="/developer/modules">All record diagnostics</ButtonLink>
        <ButtonLink to="/developer/previews">Role previews</ButtonLink>
      </div>
    </DeveloperPage>
  );
}
