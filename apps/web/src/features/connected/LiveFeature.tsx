import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fieldVisible,
  baselineModule,
} from "../../../../../packages/shared/src/baseline";
import {
  liveFieldLabel,
  type FeatureRecord,
} from "../../../../../packages/shared/src/feature-records";
import {
  useFeatureRecords,
  useFeatureMutation,
} from "../../data/feature-records";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./LiveFeature.module.css";
import WorkflowHistory from "./WorkflowHistory";
import GarageSaleItems from "./GarageSaleItems";
import { Link } from "../../components/AccessLink";
import { manilaInstant } from "../../../../../packages/shared/src/operations";
import ListingMedia, { listingModules } from "./ListingMedia";
import FeatureSubmissionForm from "./FeatureSubmissionForm";
import { useAuth } from "../../data/auth";
import DocumentAttachment from "./DocumentAttachment";
import RequestIssuance from "./RequestIssuance";
import HouseholdApplication from "./HouseholdApplication";

const residentDescriptions: Record<string, string> = {
  publishing: "Updates and notices from your HOA.",
  workshops: "Explore community training and workshops.",
  events: "Discover upcoming community events.",
  carpools: "Find shared rides with neighbours.",
  vehicles: "Register household vehicles and follow sticker requests.",
  permits: "Request clearances and follow the office’s decisions.",
  "board-records": "Read published community records.",
  "election-candidates": "Read published candidate information.",
};

export default function LiveFeature({
  module,
  initialView = "mine",
  resident = false,
  pendingOnly = false,
}: {
  module: string;
  initialView?: string;
  resident?: boolean;
  pendingOnly?: boolean;
}) {
  const definition = baselineModule(module);
  const isListing = listingModules.includes(module);
  const marketplaceListing = [
    "businesses",
    "buy-sell",
    "jobs",
    "garage-sales",
    "booth-events",
    "workshops",
  ].includes(module);
  const newLabel =
    module === "publishing"
      ? "New announcement"
      : isListing
        ? "Create listing"
        : module === "permits"
          ? "Request a permit"
          : module === "board-records"
            ? "Add document"
            : "Create request";
  const auth = useAuth();
  const [params] = useSearchParams();
  const [view, setView] = useState(initialView),
    [page, setPage] = useState(0),
    [search, setSearch] = useState("");
  const [form, setForm] = useState(() => params.get("new") === "1"),
    [review, setReview] = useState<FeatureRecord | null>(null),
    [notice, setNotice] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<FeatureRecord | null>(null);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const data = useFeatureRecords(
      module,
      view,
      page,
      search,
      category,
      pendingOnly,
      params.get("issuance") === "1" || params.get("application") === "1",
    ),
    mutation = useFeatureMutation();
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [opened, setOpened] = useState<string | null>(null);
  const openedRecord = data.isSuccess
    ? data.data.rows.find((row) => row.id === opened)
    : undefined;

  const renderRecord = (r: FeatureRecord) => (
    <article className={styles.card} key={r.id}>
      <div className={styles.cardHead}>
        <Badge>{statusLabel(r.status, module)}</Badge>
        {r.created_at && (
          <time className={styles.cardDate} dateTime={r.created_at}>
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Manila",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(r.created_at))}
          </time>
        )}
      </div>
      {(isListing ||
        module === "publishing" ||
        module === "election-candidates") &&
        view === "published" && (
          <ListingMedia
            id={r.id}
            editable={false}
            announcement={module === "publishing"}
            alt={
              module === "publishing" ? `Image for ${r.title}` : "Listing cover"
            }
          />
        )}
      <h2 className={styles.cardTitle}>{r.title}</h2>
      {isListing && view === "published" && r.fields?.price && (
        <strong className={styles.listingPrice}>
          {new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
          }).format(Number(r.fields.price))}
        </strong>
      )}
      <p className={styles.cardDetail}>{r.detail}</p>
      {(isListing ||
        module === "publishing" ||
        module === "election-candidates") &&
        view !== "published" && (
          <ListingMedia
            id={r.id}
            announcement={module === "publishing"}
            alt={
              module === "publishing" ? `Image for ${r.title}` : "Listing cover"
            }
            editable={
              view === "mine" &&
              r.status === "Submitted" &&
              !!data.data?.can_create &&
              !!r.publication_consent
            }
          />
        )}
      {module === "board-records" && <DocumentAttachment record={r.id} />}
      {module === "garage-sales" && (
        <GarageSaleItems
          recordId={r.id}
          office={view === "review"}
          readOnly={view === "published"}
        />
      )}
      {module === "household-changes" && r.status === "Reviewed" && (
        <HouseholdApplication record={r} office={view === "review"} />
      )}
      {["vehicles", "permits"].includes(module) && r.status === "Reviewed" && (
        <RequestIssuance record={r} office={view === "review"} />
      )}
      {view === "review" &&
        ["household-changes", "payment-evidence"].includes(module) && (
          <p>
            {module === "household-changes"
              ? "Review evidence, then apply the verified account-to-lot relationship. Registered ownership and receipt access require separate review."
              : "Review evidence here, then reconcile it against existing accounting records. This decision does not clear payment or change a balance."}{" "}
            <Link
              to={
                module === "household-changes"
                  ? "/office/lots"
                  : "/office/finance"
              }
            >
              {module === "household-changes"
                ? "Open Lot register"
                : "Open Finance"}
            </Link>
          </p>
        )}
      {view !== "published" && (
        <details>
          <summary>Record reference</summary>
          <p>{r.id}</p>
        </details>
      )}
      {r.fields && !(isListing && view === "published") && (
        <details>
          <summary>{resident ? "Request details" : "Submitted fields"}</summary>
          <dl className={styles.fields}>
            {/* Only the questions this record was actually asked.
                            Listing a field hidden by its showWhen condition
                            reported "Not supplied" for something nobody was
                            ever shown. */}
            {definition.fields
              .filter((f) => fieldVisible(f, r.fields ?? {}))
              .map((f) => (
                <div key={f.key}>
                  <dt>{liveFieldLabel(f.label)}</dt>
                  <dd>{r.fields?.[f.key] || "Not supplied"}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
      {r.version && !(resident && view === "published") && (
        <div className={styles.actions}>
          <Button secondary onClick={() => setHistory(r.id)}>
            Record history
          </Button>
          {view === "mine" &&
            ["businesses", "buy-sell", "jobs", "garage-sales"].includes(
              module,
            ) &&
            data.data?.can_create &&
            ["Submitted", "Published", "Rejected", "Withdrawn"].includes(
              r.status,
            ) && (
              <Button
                secondary
                onClick={() => {
                  setEditing(r);
                  setRecordSaved(false);
                  setForm(true);
                  mutation.reset();
                }}
              >
                Edit listing
              </Button>
            )}
          {view === "mine" &&
            data.data?.can_create &&
            !["Withdrawn", "Rejected"].includes(r.status) && (
              <Button
                secondary
                pending={mutation.isPending}
                onClick={() =>
                  mutation.mutate(
                    {
                      name: "bfe_review_feature",
                      args: {
                        p_id: r.id,
                        p_version: r.version,
                        p_status: "Withdrawn",
                        p_note: "Withdrawn by the submitting member",
                      },
                    },
                    {
                      onSuccess: () =>
                        setNotice("Withdrawal confirmed by the server."),
                    },
                  )
                }
              >
                Withdraw
              </Button>
            )}
          {view === "review" &&
            ((data.data?.can_review && r.status !== "Reviewed") ||
              (data.data?.can_publish &&
                r.publication_consent &&
                (marketplaceListing
                  ? ["Submitted", "In review", "Reviewed"]
                  : ["In review", "Reviewed"]
                ).includes(r.status))) &&
            ![
              "Withdrawn",
              "Rejected",
              ...(!data.data?.publishable ? ["Reviewed"] : []),
            ].includes(r.status) && (
              <Button
                secondary
                onClick={() => {
                  mutation.reset();
                  setReview(r);
                }}
              >
                Review submission
              </Button>
            )}
        </div>
      )}
    </article>
  );
  return (
    <>
      <PageIntro
        eyebrow={
          resident
            ? undefined
            : listingModules.includes(module)
              ? "LIVELIHOOD"
              : "COMMUNITY WORKFLOW"
        }
        title={
          module === "publishing"
            ? "Announcements"
            : liveFieldLabel(definition.title)
        }
        description={
          resident
            ? (residentDescriptions[module] ??
              "Community information and your submissions.")
            : liveFieldLabel(definition.summary)
        }
      />
      {auth.memberPreview && (
        <p className={styles.notice}>
          Read-only account preview. Sign in directly as this member to add or
          change listings.
        </p>
      )}
      {view === "review" && (
        <details className={styles.notice}>
          <summary>About submissions and approvals</summary>
          <p>
            A reviewed submission is a recorded review. Bookings, entry
            permission, payments, ownership, account access and election
            certification use their dedicated services.
          </p>
        </details>
      )}
      {["booth-events", "workshops", "carpools"].includes(module) && (
        <Link
          className="text-link"
          to={
            view === "review"
              ? `/office/participation/${module}`
              : module === "carpools"
                ? "/explore/carpool-interests"
                : `/directory/market?section=${module}&view=applications`
          }
        >
          {view === "review"
            ? "Review activity applications"
            : "Apply or view my activity applications"}
        </Link>
      )}
      <div className={styles.toolbar}>
        {resident && initialView === "published" && data.data?.can_create && (
          <div
            className={styles.readerViews}
            role="group"
            aria-label="Content view"
          >
            <Button
              secondary
              aria-pressed={view === "published"}
              onClick={() => {
                setView("published");
                setPage(0);
                setOpened(null);
              }}
            >
              Browse
            </Button>
            <Button
              secondary
              aria-pressed={view === "mine"}
              onClick={() => {
                setView("mine");
                setPage(0);
                setOpened(null);
              }}
            >
              {isListing ? "My listings" : "My submissions"}
            </Button>
          </div>
        )}
        {!resident && (
          <label>
            View
            <select
              value={view}
              onChange={(e) => {
                setView(e.target.value);
                setPage(0);
              }}
            >
              <option value="mine">
                {module === "publishing"
                  ? "Your announcements"
                  : isListing
                    ? "Your listings"
                    : "Your requests"}
              </option>
              <option value="published">Published</option>
              {(initialView === "review" ||
                data.data?.can_review ||
                data.data?.can_publish) && (
                <option value="review">Office review</option>
              )}
            </select>
          </label>
        )}
        <label>
          Search
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {isListing &&
          view === "published" &&
          definition.fields.find((f) => f.key === "category")?.options && (
            <label>
              Category
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All categories</option>
                {definition.fields
                  .find((f) => f.key === "category")!
                  .options!.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
          )}
        {!data.isError && data.data?.can_create && !auth.memberPreview && (
          <Button
            onClick={() => {
              mutation.reset();
              setEditing(null);
              setRecordSaved(false);
              setForm(true);
            }}
          >
            {newLabel}
          </Button>
        )}
      </div>
      {!data.isError &&
        data.data &&
        !data.data.can_create &&
        !auth.memberPreview &&
        (view !== "review" || params.get("new") === "1") && (
          <p className={styles.notice}>
            Contact the office if you need help submitting something here.
          </p>
        )}
      {notice && <p role="status">{notice}</p>}
      <Feedback error={data.error ?? mutation.error} />
      {data.isPending ? (
        <Skeleton />
      ) : (
        !data.isError &&
        data.data && (
          <>
            {!resident && (
              <StatusStrip
                total={data.data.total}
                rows={data.data.rows}
                module={module}
              />
            )}
            <div
              className={
                isListing && view === "published"
                  ? styles.listingGrid
                  : styles.stack
              }
            >
              {data.data.rows.map((r) =>
                resident && view === "published" ? (
                  <article className={styles.browseRecord} key={r.id}>
                    {(isListing ||
                      module === "publishing" ||
                      module === "election-candidates") && (
                      <ListingMedia
                        id={r.id}
                        alt={`Image for ${r.title}`}
                        coverOnly
                        hideEmpty
                      />
                    )}
                    <div>
                      <p className={styles.cardDate}>
                        {new Date(r.created_at).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <h2>
                        <button type="button" onClick={() => setOpened(r.id)}>
                          {r.title}
                          <ChevronRight size={20} aria-hidden="true" />
                        </button>
                      </h2>
                      <p>{r.detail}</p>
                    </div>
                  </article>
                ) : resident ? (
                  <button
                    type="button"
                    key={r.id}
                    className={styles.residentRecord}
                    onClick={() => setOpened(r.id)}
                  >
                    <span className={styles.residentRecordText}>
                      <strong>{r.title}</strong>
                      <span>
                        {new Date(r.created_at).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>{r.detail}</span>
                    </span>
                    <span className={styles.residentRecordEnd}>
                      <Badge>{statusLabel(r.status, module)}</Badge>
                      <ChevronRight size={20} aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  renderRecord(r)
                ),
              )}
            </div>
            {!data.data.rows.length && (
              <Empty
                title={emptyTitle(module, view)}
                action={
                  !resident && view === "review" && search ? (
                    <Button
                      secondary
                      onClick={() => {
                        setSearch("");
                        setPage(0);
                      }}
                    >
                      Clear search
                    </Button>
                  ) : !resident &&
                    view === "mine" &&
                    data.data.can_create &&
                    !auth.memberPreview ? (
                    <Button
                      onClick={() => {
                        mutation.reset();
                        setEditing(null);
                        setRecordSaved(false);
                        setForm(true);
                      }}
                    >
                      {newLabel}
                    </Button>
                  ) : undefined
                }
              >
                {!resident && view === "review"
                  ? search
                    ? "No submissions match this search. Clear it or choose another Area or Workflow above."
                    : "No submissions are waiting in this workflow. Choose another Area or Workflow above to check a different queue."
                  : emptyBody(module, view)}
              </Empty>
            )}
            {data.data.total > 20 && (
              <div className={styles.actions}>
                <Button
                  secondary
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  secondary
                  disabled={(page + 1) * 20 >= data.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
      {resident && openedRecord && (
        <Modal
          title={
            module === "publishing"
              ? "Announcement"
              : isListing
                ? "Listing details"
                : "Request details"
          }
          presentation="task"
          onClose={() => setOpened(null)}
        >
          {renderRecord(openedRecord)}
        </Modal>
      )}
      {history && (
        <Modal title="Record history" onClose={() => setHistory(null)}>
          <WorkflowHistory kind="feature" id={history} />
        </Modal>
      )}
      {form && data.data?.can_create && !auth.memberPreview && (
        <Modal
          size="lg"
          presentation={resident ? "task" : "sheet"}
          protectChanges={resident && !recordSaved}
          title={
            editing
              ? "Edit listing — review required"
              : module === "publishing"
                ? "New announcement"
                : newLabel
          }
          busy={submissionBusy}
          onClose={() => {
            setForm(false);
            if (recordSaved) {
              setNotice(
                module === "publishing"
                  ? "Announcement saved. Check its image and publication status before continuing."
                  : "Saved. Check your listing's photo and links before review.",
              );
              setClientId(crypto.randomUUID());
              setRecordSaved(false);
              setView("mine");
              void data.refetch();
            }
          }}
        >
          <FeatureSubmissionForm
            module={module}
            editing={editing}
            clientId={clientId}
            publishable={!!data.data?.publishable}
            directPublish={module === "publishing" && !!data.data?.can_publish}
            onBusyChange={setSubmissionBusy}
            onRecordSaved={() => setRecordSaved(true)}
            onSaved={(message) => {
              setClientId(crypto.randomUUID());
              setForm(false);
              setEditing(null);
              setRecordSaved(false);
              setView(
                module === "publishing" && data.data?.can_publish
                  ? "published"
                  : "mine",
              );
              setNotice(message);
            }}
          />
        </Modal>
      )}
      {review && (
        <Modal
          title="Review submission"
          busy={mutation.isPending}
          onClose={() => setReview(null)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const expiry = String(f.get("expiry") ?? "");
              mutation.mutate(
                {
                  name: "bfe_review_feature",
                  args: {
                    p_id: review.id,
                    p_version: review.version,
                    p_status: f.get("status"),
                    p_note: f.get("note"),
                    p_public_title: f.get("publicTitle"),
                    p_public_body: f.get("publicBody"),
                    p_audience: f.get("audience"),
                    p_expires: expiry ? manilaInstant(expiry) : null,
                  },
                },
                {
                  onSuccess: () => {
                    setReview(null);
                    setNotice("Review confirmed by the server.");
                  },
                },
              );
            }}
          >
            <label>
              Decision
              <p className={styles.formHelp}>
                {marketplaceListing
                  ? "Approve and publish the reviewed public information, or record a review decision."
                  : decisionHint(review.status)}
              </p>
              <select
                name="status"
                defaultValue={
                  marketplaceListing &&
                  data.data?.can_publish &&
                  review.publication_consent
                    ? "Published"
                    : undefined
                }
              >
                {(review.status === "Published"
                  ? ["Withdrawn"]
                  : [
                      ...(data.data?.can_review && review.status === "Submitted"
                        ? ["In review"]
                        : []),
                      ...(data.data?.can_publish &&
                      review.publication_consent &&
                      (marketplaceListing ||
                        ["In review", "Reviewed"].includes(review.status))
                        ? ["Published"]
                        : []),
                      ...(data.data?.can_review &&
                      review.status === "In review" &&
                      !marketplaceListing
                        ? ["Reviewed"]
                        : []),
                      ...(data.data?.can_review &&
                      ["Submitted", "In review"].includes(review.status)
                        ? ["Rejected"]
                        : []),
                    ]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s === "Reviewed" &&
                    ["household-changes", "payment-evidence"].includes(module)
                      ? "Review complete - follow-up required"
                      : decisionLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reason
              <textarea name="note" required minLength={5} maxLength={1000} />
            </label>
            {data.data?.can_publish &&
              review.publication_consent &&
              ["Submitted", "In review", "Reviewed"].includes(
                review.status,
              ) && (
                <>
                  <p>
                    For publication, write only information suitable for the
                    selected audience. Submitted fields are never copied into
                    the public record.
                  </p>
                  <label>
                    Public title
                    <input
                      name="publicTitle"
                      defaultValue={review.title}
                      minLength={3}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Public body
                    <textarea
                      name="publicBody"
                      defaultValue={review.detail}
                      minLength={10}
                      maxLength={5000}
                    />
                  </label>
                  <label>
                    Audience
                    <select name="audience">
                      {[
                        "members",
                        "homeowner",
                        "renter",
                        "board",
                        "security",
                        "driver",
                      ].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Publication expires
                    <input name="expiry" type="datetime-local" />
                  </label>
                </>
              )}
            <Feedback error={mutation.error} />
            <Button type="submit" pending={mutation.isPending}>
              Save review
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Each workflow is asked a different first question, so the empty state says
 *  what is missing here rather than "no records in this view" everywhere. */
function emptyTitle(module: string, view: string) {
  if (view === "published") return "Nothing published yet";
  if (view === "review") return "Nothing waiting for review";
  const titles: Record<string, string> = {
    incidents: "No incidents logged yet",
    "board-reports": "No reports drafted yet",
    vehicles: "No vehicle requests yet",
    permits: "No permit requests yet",
    "gate-passes": "No gate passes requested yet",
    businesses: "No business listed yet",
    "buy-sell": "Nothing listed for sale yet",
    jobs: "No job posts yet",
    workshops: "No sessions proposed yet",
  };
  return titles[module] ?? "Nothing submitted yet";
}
function emptyBody(module: string, view: string) {
  if (view === "published")
    return "Records appear here once a reviewer publishes them.";
  if (view === "review")
    return "Submissions appear here as residents send them in.";
  const bodies: Record<string, string> = {
    incidents:
      "Log what happened at the gate or in the community. The office reviews every record.",
    "board-reports":
      "Draft a report here. Only a reviewer can publish it to members.",
    vehicles:
      "Register a household vehicle or ask for a sticker. The office decides each request.",
    permits: "Ask for clearance before construction, renovation or a move.",
  };
  return (
    bodies[module] ??
    "What you submit appears here while the office reviews it."
  );
}

/** What this page is actually about, at a glance.
 *
 *  Counts come from the page already loaded, so this adds no request and never
 *  implies the server reported a total it did not. When more records exist than
 *  one page holds, the strip says so rather than presenting a partial count as
 *  the whole picture. */
function StatusStrip({
  total,
  rows,
  module,
}: {
  total: number;
  rows: FeatureRecord[];
  module: string;
}) {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const order = [
    "Submitted",
    "In review",
    "Reviewed",
    "Published",
    "Rejected",
    "Withdrawn",
  ].filter((status) => counts.has(status));
  const noun =
    module === "incidents"
      ? total === 1
        ? "incident"
        : "incidents"
      : module === "board-reports"
        ? total === 1
          ? "report"
          : "reports"
        : total === 1
          ? "record"
          : "records";
  return (
    <div className={styles.statusStrip}>
      <strong>
        {total} {noun}
      </strong>
      {order.map((status) => (
        <span key={status}>
          <b>{counts.get(status)}</b>{" "}
          {statusLabel(status, module).toLowerCase()}
        </span>
      ))}
      {rows.length < total && <small>counts cover this page</small>}
    </div>
  );
}

/** Review decisions describe their actual effect; fulfillment is separate. */
function decisionLabel(status: string) {
  const labels: Record<string, string> = {
    "In review": "In review — accept it for checking",
    Reviewed: "Approve request - fulfillment is recorded separately",
    Rejected: "Rejected — decline the request",
    Published: "Approve & publish - make reviewed information visible",
    Withdrawn: "Withdrawn — remove it from publication",
  };
  return labels[status] ?? status;
}
/** Approval is two steps by design, so say so rather than leaving a reviewer
 *  hunting for an Approve option that only appears at the second one. */
function decisionHint(status: string) {
  if (status === "Submitted")
    return "Start checking the request, or reject it with a reason.";
  if (status === "In review")
    return "Record the review decision. Stickers and permits require a separate issuance record; household changes and payment reconciliation use their dedicated records.";
  if (status === "Published")
    return "A published record can only be withdrawn.";
  return "Record the outcome and the reason for it.";
}

/** Preserve the difference between review, issuance and accounting follow-up. */
function statusLabel(status: string, module: string) {
  if (status !== "Reviewed") return status;
  if (["vehicles", "permits"].includes(module)) return "Approved";
  if (module === "payment-evidence") return "Reviewed - accounting follow-up";
  return "Reviewed";
}
