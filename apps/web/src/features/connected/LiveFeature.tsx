import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fieldVisible, baselineModule } from "../../../../../packages/shared/src/baseline";
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
import { Link } from "../../components/AccessLink";
import { manilaInstant } from "../../../../../packages/shared/src/operations";
import ListingMedia, { listingModules } from "./ListingMedia";
import FeatureSubmissionForm from "./FeatureSubmissionForm";
import { useAuth } from "../../data/auth";

export default function LiveFeature({
  module,
  initialView = "mine",
}: {
  module: string;
  initialView?: string;
}) {
  const definition = baselineModule(module);
  const auth = useAuth();
  const [params] = useSearchParams();
  const [view, setView] = useState(initialView),
    [page, setPage] = useState(0),
    [search, setSearch] = useState("");
  const [form, setForm] = useState(() => params.get("new") === "1"),
    [review, setReview] = useState<FeatureRecord | null>(null),
    [notice, setNotice] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [editing, setEditing] = useState<FeatureRecord | null>(null);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const data = useFeatureRecords(module, view, page, search),
    mutation = useFeatureMutation();
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  return (
    <>
      <PageIntro
        eyebrow={
          listingModules.includes(module)
            ? "LIVELIHOOD & MARKETPLACE"
            : "COMMUNITY WORKFLOW"
        }
        title={
          module === "publishing"
            ? "Announcements"
            : liveFieldLabel(definition.title)
        }
        description={liveFieldLabel(definition.summary)}
      />
      {auth.memberPreview && (
        <p className={styles.notice}>
          Read-only account preview. Sign in directly as this member to add or
          change listings.
        </p>
      )}
      <details className={styles.notice}>
        <summary>About submissions and approvals</summary>
        <p>
          A reviewed submission is a recorded review. Bookings, entry
          permission, payments, ownership, account access and election
          certification use their dedicated services.
        </p>
      </details>
      {["booth-events", "workshops", "carpools"].includes(module) && (
        <Link
          className="text-link"
          to={`/explore/${module === "booth-events" ? "booth-applications" : module === "workshops" ? "participation" : "carpool-interests"}${view === "review" ? "?view=review" : ""}`}
        >
          {view === "review"
            ? "Review activity applications"
            : "Apply or view my activity applications"}
        </Link>
      )}
      <div className={styles.toolbar}>
        <label>
          View
          <select
            value={view}
            onChange={(e) => {
              setView(e.target.value);
              setPage(0);
            }}
          >
            <option value="mine">My submissions</option>
            <option value="published">Published</option>
            {(data.data?.can_review || data.data?.can_publish) && (
              <option value="review">Office review</option>
            )}
          </select>
        </label>
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
        {!data.isError && data.data?.can_create && !auth.memberPreview && (
          <Button
            onClick={() => {
              mutation.reset();
              setEditing(null);
              setRecordSaved(false);
              setForm(true);
            }}
          >
            {module === "publishing" ? "New announcement" : "New submission"}
          </Button>
        )}
      </div>
      {!data.isError &&
        data.data &&
        !data.data.can_create &&
        !auth.memberPreview &&
        (view !== "review" || params.get("new") === "1") && (
          <p className={styles.notice}>
            Posting is not enabled for your account. Contact the office to
            request access.
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
            <StatusStrip
              total={data.data.total}
              rows={data.data.rows}
              module={module}
            />
            <div className={styles.stack}>
              {data.data.rows.map((r) => (
                <article className={styles.card} key={r.id}>
                  <div className={styles.cardHead}>
                    <Badge>{statusLabel(r.status)}</Badge>
                    {r.created_at && (
                      <time
                        className={styles.cardDate}
                        dateTime={r.created_at}
                      >
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Asia/Manila",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(r.created_at))}
                      </time>
                    )}
                  </div>
                  <h2 className={styles.cardTitle}>{r.title}</h2>
                  <p className={styles.cardDetail}>{r.detail}</p>
                  {listingModules.includes(module) && (
                    <ListingMedia
                      id={r.id}
                      editable={
                        view === "mine" &&
                        r.status === "Submitted" &&
                        !!data.data?.can_create &&
                        !!r.publication_consent
                      }
                    />
                  )}
                  <details>
                    <summary>Record reference</summary>
                    <p>{r.id}</p>
                  </details>
                  {r.fields && (
                    <details>
                      <summary>Submitted fields</summary>
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
                  {r.version && (
                    <div className={styles.actions}>
                      <Button secondary onClick={() => setHistory(r.id)}>
                        Record history
                      </Button>
                      {view === "mine" &&
                        [
                          "businesses",
                          "buy-sell",
                          "jobs",
                          "garage-sales",
                        ].includes(module) &&
                        data.data.can_create &&
                        [
                          "Submitted",
                          "Published",
                          "Rejected",
                          "Withdrawn",
                        ].includes(r.status) && (
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
                        data.data.can_create &&
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
                                    p_note:
                                      "Withdrawn by the submitting member",
                                  },
                                },
                                {
                                  onSuccess: () =>
                                    setNotice(
                                      "Withdrawal confirmed by the server.",
                                    ),
                                },
                              )
                            }
                          >
                            Withdraw
                          </Button>
                        )}
                      {view === "review" &&
                        data.data.can_review &&
                        !["Reviewed", "Withdrawn", "Rejected"].includes(
                          r.status,
                        ) && (
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
              ))}
            </div>
            {!data.data.rows.length && (
              <Empty title={emptyTitle(module, view)}>
                {emptyBody(module, view)}
              </Empty>
            )}
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
          </>
        )
      )}
      {history && (
        <Modal title="Record history" onClose={() => setHistory(null)}>
          <WorkflowHistory kind="feature" id={history} />
        </Modal>
      )}
      {form && data.data?.can_create && !auth.memberPreview && (
        <Modal
          size="lg"
          title={
            editing
              ? "Edit listing — review required"
              : module === "publishing"
                ? "New announcement"
                : "New submission"
          }
          busy={submissionBusy}
          onClose={() => {
            setForm(false);
            if (recordSaved) {
              setNotice(
                "Submission saved. Check the photo and links in My submissions; they may still need attention before review.",
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
            onBusyChange={setSubmissionBusy}
            onRecordSaved={() => setRecordSaved(true)}
            onSaved={(message) => {
              setClientId(crypto.randomUUID());
              setForm(false);
              setEditing(null);
              setRecordSaved(false);
              setView("mine");
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
              <p className={styles.formHelp}>{decisionHint(review.status)}</p>
              <select name="status">
                {(review.status === "Submitted"
                  ? ["In review", "Rejected"]
                  : review.status === "Published"
                    ? ["Withdrawn"]
                    : [
                        "Reviewed",
                        "Rejected",
                        ...(data.data?.can_publish && review.publication_consent
                          ? ["Published"]
                          : []),
                      ]
                ).map((s) => (
                  <option key={s} value={s}>
                    {decisionLabel(s)}
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
              review.status === "In review" && (
                <>
                  <p>
                    For publication, write only information suitable for the
                    selected audience. Submitted fields are never copied into
                    the public record.
                  </p>
                  <label>
                    Public title
                    <input name="publicTitle" minLength={3} maxLength={120} />
                  </label>
                  <label>
                    Public body
                    <textarea
                      name="publicBody"
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
    permits:
      "Ask for clearance before construction, renovation or a move.",
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
          <b>{counts.get(status)}</b> {statusLabel(status).toLowerCase()}
        </span>
      ))}
      {rows.length < total && <small>counts cover this page</small>}
    </div>
  );
}

/** The stored status values are the server's vocabulary, not the reviewer's.
 *  "Reviewed" is the approved state, which nobody would guess from the word. */
function decisionLabel(status: string) {
  const labels: Record<string, string> = {
    "In review": "In review — accept it for checking",
    Reviewed: "Approved — the request is granted",
    Rejected: "Rejected — decline the request",
    Published: "Published — make the public text visible to members",
    Withdrawn: "Withdrawn — remove it from publication",
  };
  return labels[status] ?? status;
}
/** Approval is two steps by design, so say so rather than leaving a reviewer
 *  hunting for an Approve option that only appears at the second one. */
function decisionHint(status: string) {
  if (status === "Submitted")
    return "Accept it for checking first. Approving or rejecting becomes available once it is in review.";
  if (status === "In review")
    return "Approve or reject it now. Approving grants the request; it does not publish anything.";
  if (status === "Published")
    return "A published record can only be withdrawn.";
  return "Record the outcome and the reason for it.";
}

/** What the viewer is told a record's state is. The server stores "Reviewed"
 *  for an approved request; showing that word to the person who asked for a
 *  sticker tells them nothing about whether they are getting one. */
function statusLabel(status: string) {
  return status === "Reviewed" ? "Approved" : status;
}
