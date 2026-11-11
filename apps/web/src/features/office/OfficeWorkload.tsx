import {
  ClipboardCheck,
  Clock3,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import type { OfficeReviewQueue } from "../../../../../packages/shared/src/office-review";
import { officeReviewPath } from "../../../../../packages/shared/src/office-review";
import { Link } from "../../components/AccessLink";
import styles from "./OfficeWorkload.module.css";

/** One projection of the inbox response, without another request or local totals. */
export default function OfficeWorkload({
  queues,
  label,
}: {
  queues: OfficeReviewQueue[];
  label: (queue: OfficeReviewQueue) => string;
}) {
  const followUp = queues.filter((q) =>
    ["requests", "shuttle", "issuance", "household"].includes(q.kind),
  );
  const decisions = queues.filter(
    (q) => !["requests", "shuttle", "issuance", "household"].includes(q.kind),
  );
  const waiting = decisions.reduce((sum, q) => sum + q.pending, 0);
  const reviewing = decisions.reduce((sum, q) => sum + q.in_review, 0);
  const followUpCount = followUp.reduce(
    (sum, q) => sum + q.pending + q.in_review,
    0,
  );
  const ranked = [...decisions]
    .sort(
      (a, b) =>
        b.pending + b.in_review - (a.pending + a.in_review) ||
        label(a).localeCompare(label(b)),
    )
    .slice(0, 6);
  const maximum = Math.max(1, ...ranked.map((q) => q.pending + q.in_review));
  const number = (value: number) =>
    new Intl.NumberFormat("en-PH").format(value);
  return (
    <>
      <dl className={styles.metrics} aria-label="Current workload totals">
        <div>
          <dt>
            <ClipboardCheck size={20} aria-hidden="true" />
            Awaiting review
          </dt>
          <dd>{number(waiting)}</dd>
        </div>
        <div>
          <dt>
            <Clock3 size={20} aria-hidden="true" />
            In review
          </dt>
          <dd>{number(reviewing)}</dd>
        </div>
        <div>
          <dt>
            <MessageSquare size={20} aria-hidden="true" />
            Follow-up & dispatch
          </dt>
          <dd>{number(followUpCount)}</dd>
        </div>
      </dl>
      <div className={followUp.length ? styles.columns : undefined}>
        <section aria-label="Workload by review queue">
          <div className={styles.chartHeading}>
            <h3>Workload by queue</h3>
            <div className={styles.legend}>
              {ranked.some((q) => q.pending > 0) && (
                <span>
                  <i className={styles.waiting} />
                  Waiting
                </span>
              )}
              {ranked.some((q) => q.in_review > 0) && (
                <span>
                  <i className={styles.reviewing} />
                  In review
                </span>
              )}
            </div>
          </div>
          {ranked.length ? (
            <ul className={styles.bars}>
              {ranked.map((q) => (
                <li key={`${q.kind}:${q.module}`}>
                  <Link
                    to={officeReviewPath(q)}
                    aria-label={`${label(q)}: ${q.pending} waiting, ${q.in_review} in review${q.can_decide ? "" : ", view only"}`}
                  >
                    <span className={styles.rowHeading}>
                      <strong>{label(q)}</strong>
                      <span>
                        {number(q.pending + q.in_review)}
                        <ArrowRight size={18} aria-hidden="true" />
                      </span>
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        className={styles.waiting}
                        style={{ width: `${(q.pending / maximum) * 100}%` }}
                      />
                      <span
                        className={styles.reviewing}
                        style={{ width: `${(q.in_review / maximum) * 100}%` }}
                      />
                    </span>
                    <span className={styles.rowNote}>
                      {q.pending} waiting · {q.in_review} in review
                      {q.can_decide ? "" : " · View only"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              No approvals waiting in your accessible queues.
            </p>
          )}
        </section>
        {!!followUp.length && (
          <section
            className={styles.followUp}
            aria-label="Follow-up and dispatch queues"
          >
            <h3>Follow-up & dispatch</h3>
            <p className={styles.note}>
              Requests to resolve and rides to follow up.
            </p>
            <ul>
              {followUp.map((q) => (
                <li key={q.kind}>
                  <Link to={officeReviewPath(q)}>
                    <span>
                      <strong>{label(q)}</strong>
                      <small>
                        {q.pending} waiting · {q.in_review} in progress
                      </small>
                    </span>
                    <span className={styles.count}>
                      {number(q.pending + q.in_review)}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className={styles.scope}>
        Current counts from the queues your account can view.
      </p>
    </>
  );
}
