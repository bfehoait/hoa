import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useIsMutating,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ClipboardCheck,
  CalendarDays,
  Users,
  Car,
  Wrench,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  officeReviewPath,
  type OfficeReviewQueue,
} from "../../../../../packages/shared/src/office-review";
import { Badge, Button, Feedback, Skeleton } from "../../components/UI";
import { ReviewSurface, useReviewSurface } from "./ReviewSurface";
import styles from "./OfficeScreens.module.css";
import { useAuth } from "../../data/auth";
import { readInboxRecords, type InboxRecord } from "./inbox-records";
import RegistrationReview from "./RegistrationReview";
import { LotProfile } from "../registry/LotRegister";
import { isOfficeApprovalQueue } from "./office-approval-queues";

const OperationsDesk = lazy(() => import("../connected/OperationsDesk"));
const LiveFeature = lazy(() => import("../connected/LiveFeature"));
const ParticipationDesk = lazy(() => import("../connected/ParticipationDesk"));
const GarageSaleItems = lazy(() => import("../connected/GarageSaleItems"));
const AccountingWorkbench = lazy(() => import("./AccountingWorkbench"));
const queueKey = (queue: OfficeReviewQueue) => `${queue.kind}:${queue.module}`;
const PAGE_SIZE = 5;
const SOURCE_PAGE_SIZE = 20;
function QueueIcon({
  queue,
  size = 21,
}: {
  queue: OfficeReviewQueue;
  size?: number;
}) {
  if (queue.kind === "registrations")
    return <Users size={size} aria-hidden="true" />;
  if (queue.kind === "bookings")
    return <CalendarDays size={size} aria-hidden="true" />;
  if (queue.kind === "passes")
    return <ShieldCheck size={size} aria-hidden="true" />;
  if (queue.module === "vehicles")
    return <Car size={size} aria-hidden="true" />;
  if (queue.module === "permits")
    return <Wrench size={size} aria-hidden="true" />;
  return <ClipboardCheck size={size} aria-hidden="true" />;
}

function ReviewDesk({ queue }: { queue: OfficeReviewQueue }) {
  switch (queue.kind) {
    case "bookings":
    case "passes":
      return (
        <OperationsDesk
          office
          pendingReview
          kind={queue.kind === "bookings" ? "booking" : "visitor"}
        />
      );
    case "registrations":
      return <RegistrationReviewFromInbox />;
    case "requests":
    case "shuttle":
      return null;
    case "accounting":
      return <AccountingWorkbench initialKind={queue.module} />;
    case "garage_items":
      return <GarageSaleItems office />;
    case "lots":
      return <LotFromInbox />;
    case "participation":
      if (
        queue.module === "workshops" ||
        queue.module === "booth-events" ||
        queue.module === "carpools"
      )
        return <ParticipationDesk module={queue.module} office pendingOnly />;
      return <p>This application type is unavailable.</p>;
    default:
      return (
        <LiveFeature
          module={
            queue.kind === "household" ? "household-changes" : queue.module
          }
          initialView="review"
          pendingOnly
          reviewOnly
          hideHeading
          reviewFollowup={
            queue.kind === "issuance" || queue.kind === "household"
          }
        />
      );
  }
}

function RegistrationReviewFromInbox() {
  const surface = useReviewSurface();
  return surface?.recordId ? (
    <RegistrationReview id={surface.recordId} />
  ) : null;
}
function LotFromInbox() {
  const surface = useReviewSurface();
  return surface?.recordId ? (
    <LotProfile id={surface.recordId} root="/office/approvals" embedded />
  ) : null;
}

export default function OfficeQueueReview({
  queues,
  label,
}: {
  queues: OfficeReviewQueue[];
  label: (queue: OfficeReviewQueue) => string;
  preferred?: string | null;
}) {
  const auth = useAuth();
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [locked, setLocked] = useState(false);
  const mutating = useIsMutating();
  const [state] = useState(() => new Map<string, unknown>());
  const [lastSelected, setLastSelected] = useState<InboxRecord | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const rawPage = Number(params.get("inboxPage") ?? 0);
  const requestedPage =
    Number.isInteger(rawPage) && rawPage >= 0 && rawPage < 10000 ? rawPage : 0;
  const approvalQueues = queues.filter(isOfficeApprovalQueue);
  const requestedFilter = params.get("inboxType") ?? "";
  const filter = approvalQueues.some((q) => queueKey(q) === requestedFilter)
    ? requestedFilter
    : "";
  const visibleQueues = approvalQueues.filter(
    (q) => !filter || queueKey(q) === filter,
  );
  const query = useInfiniteQuery({
    queryKey: [
      "office-inbox-records",
      auth.userId,
      "paged-list",
      visibleQueues.map(queueKey),
    ],
    initialPageParam: { page: 0, queues: visibleQueues.map(queueKey) },
    queryFn: async ({ pageParam }) => ({
      sourcePage: pageParam.page,
      results: await Promise.all(
        visibleQueues
          .filter((queue) => pageParam.queues.includes(queueKey(queue)))
          .map(async (queue) => {
            try {
              return {
                queue,
                ...(await readInboxRecords(queue, pageParam.page)),
                error: null,
              };
            } catch (error) {
              return {
                queue,
                rows: [] as InboxRecord[],
                total: 0,
                error:
                  error instanceof Error
                    ? error
                    : new Error("This queue could not be loaded."),
              };
            }
          }),
      ),
    }),
    getNextPageParam: (last) =>
      last.results.some((result) => result.error) || last.sourcePage >= 9999
        ? undefined
        : last.results.some(
              (result) =>
                result.total > (last.sourcePage + 1) * SOURCE_PAGE_SIZE,
            )
          ? {
              page: last.sourcePage + 1,
              queues: last.results
                .filter(
                  (result) =>
                    result.total > (last.sourcePage + 1) * SOURCE_PAGE_SIZE,
                )
                .map((result) => queueKey(result.queue)),
            }
          : undefined,
    enabled:
      !!auth.userId &&
      !auth.checking &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview &&
      visibleQueues.length > 0,
    retry: false,
    staleTime: 15000,
    gcTime: 300000,
    refetchInterval: locked ? false : 30000,
  });
  useEffect(
    () =>
      cache.getMutationCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "success")
          void cache.invalidateQueries({
            queryKey: ["office-inbox-records", auth.userId, "paged-list"],
          });
      }),
    [cache, auth.userId],
  );
  // Preserve loaded batches when fetching the next one: adding records must not
  // reshuffle already-read pages. Original source-page references travel with
  // every row and are still used by each existing detail/decision reader.
  const seenRecords = new Set<string>();
  const records = (query.data?.pages ?? [])
    .flatMap((batch) =>
      batch.results
        .flatMap((result) => result.rows)
        .sort((a, b) => {
          const date = (value?: string | null) =>
            value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
          return (
            date(b.at) - date(a.at) ||
            queueKey(a.queue).localeCompare(queueKey(b.queue)) ||
            a.id.localeCompare(b.id)
          );
        }),
    )
    .filter((record) => {
      const key = `${queueKey(record.queue)}:${record.id}`;
      if (seenRecords.has(key)) return false;
      seenRecords.add(key);
      return true;
    });
  const seenErrors = new Set<string>();
  const errors = (query.data?.pages ?? []).flatMap((batch) =>
    batch.results.filter((result) => {
      const key = queueKey(result.queue);
      if (!result.error || seenErrors.has(key)) return false;
      seenErrors.add(key);
      return true;
    }),
  );
  const complete =
    !!query.data &&
    !query.hasNextPage &&
    !query.isFetching &&
    !query.isError &&
    !errors.length;
  const page = complete
    ? Math.min(
        requestedPage,
        Math.max(0, Math.ceil(records.length / PAGE_SIZE) - 1),
      )
    : requestedPage;
  const pageRecords = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const firstRecord = pageRecords[0];
  const firstId = firstRecord?.id;
  const firstQueue = firstRecord ? queueKey(firstRecord.queue) : "";
  const firstPath = firstRecord ? officeReviewPath(firstRecord.queue) : "";
  useEffect(() => {
    if (
      params.has("item") ||
      !firstId ||
      query.isFetching ||
      query.isError ||
      page !== requestedPage ||
      locked ||
      mutating > 0 ||
      !window.matchMedia("(min-width: 1024px)").matches ||
      document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
    )
      return;
    const next = new URLSearchParams(firstPath.split("?")[1] ?? "");
    if (filter) next.set("inboxType", filter);
    if (page) next.set("inboxPage", String(page));
    next.set("review", firstQueue);
    next.set("item", firstId);
    setParams(next, { replace: true, preventScrollReset: true });
  }, [
    params,
    firstId,
    firstQueue,
    firstPath,
    filter,
    page,
    requestedPage,
    query.isFetching,
    query.isError,
    locked,
    mutating,
    setParams,
  ]);
  useEffect(() => {
    if (!complete || page === requestedPage || locked || mutating > 0) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (page) next.set("inboxPage", String(page));
        else next.delete("inboxPage");
        next.delete("item");
        next.delete("review");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [complete, page, requestedPage, locked, mutating, setParams]);
  const needsMore = (requestedPage + 1) * PAGE_SIZE > records.length;
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (needsMore && hasNextPage && !isFetching && !isError && !locked)
      void fetchNextPage();
  }, [needsMore, hasNextPage, isFetching, isError, fetchNextPage, locked]);
  const selected =
    records.find(
      (r) =>
        queueKey(r.queue) === params.get("review") &&
        r.id === params.get("item"),
    ) ??
    (lastSelected &&
    isOfficeApprovalQueue(lastSelected.queue) &&
    lastSelected.id === params.get("item") &&
    queueKey(lastSelected.queue) === params.get("review")
      ? lastSelected
      : null);
  const blocked = () =>
    locked ||
    mutating > 0 ||
    !!document.querySelector(
      'dialog[open], [role="dialog"][aria-modal="true"]',
    );
  const select = (record: InboxRecord) => {
    if (blocked()) return;
    setLastSelected(record);
    const next = new URLSearchParams(
      officeReviewPath(record.queue).split("?")[1] ?? "",
    );
    if (filter) next.set("inboxType", filter);
    if (page) next.set("inboxPage", String(page));
    next.set("review", queueKey(record.queue));
    next.set("item", record.id);
    setParams(next, { preventScrollReset: true });
  };
  const clearRecord = () => {
    setLocked(false);
    const next = new URLSearchParams(params);
    next.delete("item");
    setParams(next, { replace: true, preventScrollReset: true });
  };
  const change = (name: string, value: string) => {
    if (blocked()) return;
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name === "inboxType") next.delete("inboxPage");
    next.delete("item");
    next.delete("review");
    setParams(next, { preventScrollReset: true });
    if (name === "inboxPage")
      listRef.current?.scrollIntoView({ block: "start" });
  };
  return (
    <>
      <div className={styles.inboxFilter}>
        <label>
          Submission type
          <select
            value={filter}
            disabled={locked || mutating > 0}
            onChange={(e) => change("inboxType", e.target.value)}
          >
            <option value="">All types</option>
            {approvalQueues.map((q) => (
              <option key={queueKey(q)} value={queueKey(q)}>
                {label(q)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.queueLayout}>
        <section
          className={styles.queueList}
          aria-label="Submissions awaiting review"
          ref={listRef}
          aria-busy={query.isFetching}
        >
          <h2 aria-live="polite">
            {pageRecords.length
              ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + pageRecords.length}${complete ? ` of ${records.length}` : ""} submissions`
              : query.isFetching
                ? "Loading submissions…"
                : "Submissions"}
          </h2>
          {query.isFetching && !pageRecords.length && <Skeleton />}
          {query.isError && <Feedback error={query.error} />}
          {errors.map((result) => (
            <div className={styles.queueError} key={queueKey(result.queue)}>
              <strong>{label(result.queue)}</strong>
              <Feedback error={result.error} />
              <Button
                secondary
                disabled={query.isFetching || locked || mutating > 0}
                onClick={() => void query.refetch()}
              >
                Retry
              </Button>
            </div>
          ))}
          <ul tabIndex={0} aria-label="Submissions awaiting review">
            {pageRecords.map((record) => {
              return (
                <li key={`${queueKey(record.queue)}:${record.id}`}>
                  <button
                    type="button"
                    disabled={locked || mutating > 0}
                    aria-pressed={
                      selected?.id === record.id &&
                      queueKey(selected.queue) === queueKey(record.queue)
                    }
                    onClick={() => select(record)}
                  >
                    <span className={styles.queueIcon}>
                      <QueueIcon queue={record.queue} />
                    </span>
                    <span>
                      <strong>{record.title}</strong>
                      <small>{label(record.queue)}</small>
                      {record.description && (
                        <small>{record.description}</small>
                      )}
                    </span>
                    <span className={styles.recordState}>
                      <Badge>{record.status}</Badge>
                      {record.at && (
                        <time dateTime={record.at}>
                          {new Date(record.at).toLocaleDateString("en-PH", {
                            timeZone: "Asia/Manila",
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!pageRecords.length && complete && (
            <p className={styles.queueError}>No submissions on this page.</p>
          )}
          <nav className={styles.inboxPagination} aria-label="Inbox pages">
            <Button
              secondary
              disabled={!page || locked || mutating > 0 || query.isFetching}
              onClick={() => change("inboxPage", String(page - 1))}
            >
              <ChevronLeft size={18} aria-hidden="true" /> Previous
            </Button>
            <span>
              Page {page + 1}
              {complete
                ? ` of ${Math.max(1, Math.ceil(records.length / PAGE_SIZE))}`
                : ""}
            </span>
            <Button
              secondary
              disabled={
                (records.length <= (page + 1) * PAGE_SIZE &&
                  !query.hasNextPage) ||
                locked ||
                mutating > 0 ||
                query.isFetching
              }
              onClick={() => change("inboxPage", String(page + 1))}
            >
              Next <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </nav>
        </section>
        <section
          className={styles.reviewDesk}
          aria-label="Selected submission"
          data-review-surface
        >
          {selected ? (
            <>
              <header className={styles.reviewHeading}>
                <span className={styles.queueIcon}>
                  <QueueIcon queue={selected.queue} size={24} />
                </span>
                <div>
                  <h2>{selected.title}</h2>
                  <p className={styles.selectedMeta}>
                    {label(selected.queue)} / {selected.status}
                  </p>
                </div>
              </header>
              {locked && (
                <p className="note" role="status">
                  Save or discard your changes before selecting another
                  submission.
                </p>
              )}
              <ReviewSurface.Provider
                value={{
                  state,
                  onLockChange: setLocked,
                  recordId: selected.id,
                  page: selected.page,
                  clearRecord,
                }}
              >
                <Suspense fallback={<Skeleton />}>
                  <ReviewDesk
                    key={`${queueKey(selected.queue)}:${selected.id}`}
                    queue={selected.queue}
                  />
                </Suspense>
              </ReviewSurface.Provider>
            </>
          ) : (
            <p role="status">
              Select a submission to check its details and available decisions.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
