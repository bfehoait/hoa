import { BarChart3, ArrowRight } from "lucide-react";
import { useRequestSummary } from "../data/requests";
import { usePermissions } from "../data/permissions";
import { useAuth } from "../data/auth";
import { Link } from "./AccessLink";
import styles from "./RequestVisual.module.css";

export function RequestVisual() {
  const auth = useAuth();
  const access = usePermissions();
  const query = useRequestSummary();
  const sample = auth.preview || !!auth.rolePreview;
  if (!sample && !access.allowsPath("/office/requests")) return null;
  const known =
    !!query.data &&
    !query.isError &&
    query.data.every((item) => item.count !== null);
  const total = known
    ? query.data!.reduce((sum, item) => sum + (item.count ?? 0), 0)
    : null;
  return (
    <section
      className={styles.visual}
      aria-labelledby="request-workload-heading"
    >
      <header>
        <span className={styles.icon}>
          <BarChart3 size={24} />
        </span>
        <div>
          <h2 id="request-workload-heading">Request workload</h2>
          <p>
            {sample
              ? "Synthetic request statuses"
              : "Current authorized request statuses"}
          </p>
        </div>
        <Link to="/office/requests">
          Request desk
          <ArrowRight size={18} />
        </Link>
      </header>
      {known ? (
        <>
          <div className={styles.total}>
            <strong>{total}</strong>
            <span>recorded requests</span>
          </div>
          <div
            className={styles.bar}
            role="img"
            aria-label={query
              .data!.map((item) => `${item.status}: ${item.count}`)
              .join(", ")}
          >
            {query.data!.map((item, index) => (
              <span
                key={item.status}
                className={styles[`segment${index}`]}
                style={{
                  width: `${total ? ((item.count ?? 0) / total) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {query.data!.map((item, index) => (
              <li key={item.status}>
                <i className={styles[`segment${index}`]} />
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
          {!total && <p className={styles.empty}>No requests recorded yet.</p>}
        </>
      ) : (
        <p className={styles.empty}>
          {query.isPending
            ? "Loading request activity…"
            : "Request activity is unavailable. No estimated counts are shown."}
        </p>
      )}
    </section>
  );
}
