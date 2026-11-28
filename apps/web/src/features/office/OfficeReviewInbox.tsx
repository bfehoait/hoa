import PageIntro from "../office/OfficePage";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  CalendarDays,
  Users,
  House,
  MessageSquare,
  Bus,
  ShieldCheck,
} from "lucide-react";
import {
  officeReviewPath,
  officeReviewSchema,
  type OfficeReviewQueue,
} from "../../../../../packages/shared/src/office-review";
import { accountingForms } from "../../../../../packages/shared/src/accounting-forms";
import { baselineModules } from "../../../../../packages/shared/src/baseline";
import { makeClient, useAuth } from "../../data/auth";
import { Empty, Feedback, Skeleton } from "../../components/UI";
import { Link } from "../../components/AccessLink";
import styles from "./OfficeReviewInbox.module.css";
import OfficeWorkload from "./OfficeWorkload";
import OfficeQueueReview from "./OfficeQueueReview";
import { isOfficeApprovalQueue } from "./office-approval-queues";

function label(queue: OfficeReviewQueue) {
  if (queue.kind === "garage_items") return "Garage sale item review";
  if (queue.kind === "accounting")
    return (
      accountingForms.find((f) => f.id === queue.module)?.title ??
      "Accounting review"
    );
  if (queue.kind === "household") return "Property link changes";
  if (queue.kind === "issuance")
    return queue.module === "vehicles"
      ? "Vehicle stickers to issue"
      : "Permits / clearances to issue";
  if (queue.kind === "feature")
    return (
      baselineModules.find((m) => m.id === queue.module)?.title ?? queue.module
    );
  if (queue.kind === "participation")
    return queue.module === "workshops"
      ? "Workshop applications"
      : queue.module === "booth-events"
        ? "Booth applications"
        : "Carpool interests";
  return {
    registrations: "Membership applications",
    lots: "Account & lot links",
    bookings: "Amenity bookings",
    passes: "Visitor, gate & delivery passes",
    requests: "Helpdesk requests",
    shuttle: "Shuttle dispatch",
  }[queue.kind];
}

export default function OfficeReviewInbox({
  compact = false,
  worklistOnly = false,
}: {
  compact?: boolean;
  worklistOnly?: boolean;
}) {
  const auth = useAuth();
  const [params] = useSearchParams();
  const sample = auth.preview || !!auth.rolePreview || !!auth.memberPreview;
  const query = useQuery({
    queryKey: ["office-review-inbox", auth.userId],
    enabled: !!auth.userId && !auth.checking && !sample,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      let result = await makeClient()!
        .rpc("bfe_office_business_review_inbox")
        .abortSignal(signal);
      if (result.error && ["PGRST202", "42883"].includes(result.error.code)) {
        result = await makeClient()!
          .rpc("bfe_office_review_inbox")
          .abortSignal(signal);
        if (!result.error)
          result.data = { ...result.data, accounting_available: false };
      }
      if (result.error)
        throw new Error(
          ["PGRST202", "42883"].includes(result.error.code)
            ? "The review inbox is not ready yet. Contact the system administrator. You can still use the individual review pages."
            : "Requests could not be loaded. Try again or ask the administrator to check your access.",
        );
      return officeReviewSchema.parse(result.data);
    },
  });
  const queues =
    query.isError && !query.data
      ? []
      : (query.data?.queues.filter(
          (q) =>
            q.pending + q.in_review > 0 ||
            `${q.kind}:${q.module}` === params.get("review") ||
            q.kind === params.get("queue"),
        ) ?? []);
  const decisions = queues.filter(isOfficeApprovalQueue);
  const render = (rows: OfficeReviewQueue[]) => (
    <ul className={styles.list}>
      {rows.map((q) => {
        const Icon =
          q.kind === "registrations"
            ? Users
            : q.kind === "lots"
              ? House
              : q.kind === "bookings"
                ? CalendarDays
                : q.kind === "requests"
                  ? MessageSquare
                  : q.kind === "shuttle"
                    ? Bus
                    : q.kind === "passes"
                      ? ShieldCheck
                      : ClipboardCheck;
        return (
          <li key={`${q.kind}:${q.module}`}>
            <Link to={officeReviewPath(q)}>
              <span className={styles.queueIcon} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className={styles.queueText}>
                <strong>{label(q)}</strong>
                <small>
                  {q.pending} waiting
                  {q.in_review ? ` · ${q.in_review} in progress` : ""}
                  {!q.can_decide && q.kind !== "shuttle" ? " · View only" : ""}
                </small>
              </span>
              <span className={styles.count}>{q.pending + q.in_review}</span>
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <section
      className={`${styles.inbox} ${compact ? styles.compact : ""}`}
      aria-label="Office review inbox"
    >
      {worklistOnly ? (
        <div className={styles.heading}>
          <h2>Current worklist</h2>
          <Link className="text-link" to="/office/approvals">
            Open review inbox <ArrowRight size={18} />
          </Link>
        </div>
      ) : compact ? (
        <div className={styles.heading}>
          <h2>Needs your attention</h2>
          <Link className="text-link" to="/office/approvals">
            Review inbox <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <PageIntro
          title="Review inbox"
          description="Select a submission to review and decide."
          icon={<ClipboardCheck size={28} />}
        />
      )}
      {sample ? (
        <p>
          Sample preview only. Live requests are not shown, and no real
          approvals are sent.
        </p>
      ) : (
        <>
          {query.isPending ? (
            <Skeleton />
          ) : query.isError && !query.data ? (
            <Feedback error={query.error} />
          ) : (
            <>
              {query.isError && (
                <Feedback
                  error={
                    new Error(
                      "Counts could not update. Showing the last available information; updates will retry automatically.",
                    )
                  }
                />
              )}
              {query.data?.accounting_available === false && (
                <p className="note">
                  Financial reviews are not ready yet. Contact the system
                  administrator. Other requests can still be reviewed.
                </p>
              )}
              {compact ? (
                <OfficeWorkload
                  summaryOnly
                  queues={query.data?.queues ?? []}
                  label={label}
                />
              ) : worklistOnly && queues.length ? (
                render(queues)
              ) : decisions.length || params.has("review") ? (
                <OfficeQueueReview
                  key={auth.userId}
                  queues={decisions}
                  label={label}
                  preferred={params.get("queue")}
                />
              ) : (
                <Empty
                  icon={<ClipboardCheck size={28} />}
                  title="No approvals waiting"
                >
                  No requests are waiting for review in the sections you can
                  view.
                </Empty>
              )}
              {compact && decisions.length > 6 && (
                <Link className="text-link" to="/office/approvals">
                  {decisions.length - 6} more sections to review{" "}
                  <ArrowRight size={18} />
                </Link>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
