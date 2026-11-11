import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, ClipboardCheck, RefreshCw } from "lucide-react";
import {
  officeReviewPath,
  officeReviewSchema,
  type OfficeReviewQueue,
} from "../../../../../packages/shared/src/office-review";
import { accountingForms } from "../../../../../packages/shared/src/accounting-forms";
import { baselineModules } from "../../../../../packages/shared/src/baseline";
import { makeClient, useAuth } from "../../data/auth";
import {
  Button,
  Empty,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import { Link } from "../../components/AccessLink";
import styles from "./OfficeReviewInbox.module.css";
import OfficeWorkload from "./OfficeWorkload";

function label(queue: OfficeReviewQueue) {
  if (queue.kind === "garage_items") return "Garage sale item review";
  if (queue.kind === "accounting")
    return (
      accountingForms.find((f) => f.id === queue.module)?.title ??
      "Accounting review"
    );
  if (queue.kind === "household") return "Verified household relationships";
  if (queue.kind === "issuance")
    return queue.module === "vehicles"
      ? "Vehicle / sticker issuance"
      : "Permit / clearance issuance";
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
}: {
  compact?: boolean;
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
            ? "The Office review inbox needs database update 038. Existing review desks are still available."
            : "Review queues could not be loaded. Refresh or check your Office permissions.",
        );
      return officeReviewSchema.parse(result.data);
    },
  });
  const queues = query.isError
    ? []
    : (query.data?.queues.filter((q) => q.pending + q.in_review > 0) ?? []);
  const decisions = queues.filter(
    (q) => !["requests", "shuttle", "issuance", "household"].includes(q.kind),
  );
  const followUp = queues.filter((q) =>
    ["requests", "shuttle", "issuance", "household"].includes(q.kind),
  );
  const render = (rows: OfficeReviewQueue[]) => (
    <ul className={styles.list}>
      {rows.map((q) => (
        <li key={`${q.kind}:${q.module}`}>
          <Link to={officeReviewPath(q)}>
            <span>
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
      ))}
    </ul>
  );
  return (
    <section className={styles.inbox} aria-label="Office review inbox">
      {compact ? (
        <div className={styles.heading}>
          <h2>Needs attention</h2>
          <Link className="text-link" to="/office/approvals">
            Review inbox <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <PageIntro
          title="Review inbox"
          description="Resident submissions awaiting a decision, with follow-up work kept separate. Counts include only queues you may view."
          icon={<ClipboardCheck size={28} />}
        />
      )}
      {sample ? (
        <p>
          Real review queues are unavailable in account previews. No sample
          approvals are sent.
        </p>
      ) : (
        <>
          <div className={styles.heading}>
            <p>
              Checks every 30 seconds while open. Decisions stay in their
              authorized review desk.
            </p>
            <Button
              secondary
              pending={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={18} />
              Refresh
            </Button>
          </div>
          {query.isPending ? (
            <Skeleton />
          ) : query.isError ? (
            <Feedback error={query.error} />
          ) : (
            <>
              {query.data?.accounting_available === false && (
                <p className="note">
                  Accounting review queues need database update 054. Existing
                  request queues remain available.
                </p>
              )}
              {compact ? (
                <OfficeWorkload queues={queues} label={label} />
              ) : decisions.length ? (
                render(decisions)
              ) : (
                <Empty
                  icon={<ClipboardCheck size={28} />}
                  title="No approvals waiting"
                >
                  No pending submissions were returned by your accessible review
                  queues.
                </Empty>
              )}
              {compact && decisions.length > 6 && (
                <Link className="text-link" to="/office/approvals">
                  {decisions.length - 6} more review queues{" "}
                  <ArrowRight size={18} />
                </Link>
              )}
              {!compact && !!followUp.length && (
                <>
                  <h3>Follow-up & dispatch</h3>
                  {render(followUp)}
                </>
              )}
              {!compact && params.get("queue") === "lots" && (
                <PendingLotLinks />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

const lotSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      id: z.uuid(),
      physical_id: z.string(),
      pending: z.number().int().positive(),
    }),
  ),
});
function PendingLotLinks() {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["office-pending-lots", auth.userId, page],
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      const r = await makeClient()!
        .rpc("bfe_pending_lot_links", { p_page: page })
        .abortSignal(signal);
      if (r.error)
        throw new Error(
          "Pending lot links could not be loaded. Check your property review access.",
        );
      return lotSchema.parse(r.data);
    },
  });
  return (
    <section>
      <h3>Pending lot links</h3>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Feedback error={query.error} />
      ) : (
        <>
          <ul className={styles.list}>
            {query.data.rows.map((l) => (
              <li key={l.id}>
                <Link to={`/office/lots/${l.id}`}>
                  <strong>{l.physical_id}</strong>
                  <span>{l.pending} waiting</span>
                  <ArrowRight size={20} />
                </Link>
              </li>
            ))}
          </ul>
          {!query.data.total && <p>No pending lot links returned.</p>}
          <nav className={styles.heading} aria-label="Pending lot pages">
            <Button
              secondary
              disabled={!page || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>Page {page + 1}</span>
            <Button
              secondary
              disabled={(page + 1) * 20 >= query.data.total || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
