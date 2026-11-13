import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import Sheet from "../../components/Sheet";
import styles from "./LiveFeature.module.css";
import { Link } from "../../components/AccessLink";
import {
  useNotificationTarget,
  useReadOpenedNotification,
} from "../../data/notification-target";
import NotificationTargetFeedback from "../../components/NotificationTargetFeedback";
const response = z.object({
  total: z.number(),
  can_create: z.boolean(),
  can_approve: z.boolean(),
  activities: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      capacity: z.number(),
      confirmed: z.number(),
    }),
  ),
  rows: z.array(
    z.object({
      id: z.uuid(),
      activity_title: z.string().nullable(),
      places: z.number(),
      details: z.string(),
      answers: z.record(z.string(), z.string()).optional(),
      status: z.string(),
      version: z.number(),
      history: z.array(
        z.object({ action: z.string(), note: z.string(), at: z.string() }),
      ),
    }),
  ),
});
export default function ParticipationDesk({
  module,
  office = false,
  pendingOnly = false,
  initialActivity,
  embedded = false,
}: {
  module: "booth-events" | "workshops" | "carpools";
  office?: boolean;
  pendingOnly?: boolean;
  initialActivity?: string;
  embedded?: boolean;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [page, setPage] = useState(0),
    [form, setForm] = useState(!!initialActivity),
    [selection, setReview] = useState<
      z.infer<typeof response>["rows"][number] | null
    >(null),
    [client, setClient] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState("");
  const target = useNotificationTarget(
    "participation",
    response.shape.rows.element,
    module,
    !office,
  );
  const review = target.requested
    ? target.isSuccess
      ? target.data
      : null
    : selection;
  const closeDetails = () => {
    setReview(null);
    target.clear();
  };
  useReadOpenedNotification(target.requested && !!review);
  const query = useQuery({
    queryKey: ["participation", auth.userId, module, office, page, pendingOnly],
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () =>
      response.parse(
        await featureRpc("bfe_business_participation_dashboard", {
          p_module: module,
          p_office: office,
          p_pending: pendingOnly,
          p_page: page,
        }),
      ),
  });
  const mutation = useMutation({
    mutationFn: ({
      name,
      args,
    }: {
      name: string;
      args: Record<string, unknown>;
    }) => featureRpc(name, args),
    onSuccess: async () => {
      await cache.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "account" &&
          query.queryKey.includes("notifications"),
      });
      await Promise.all(
        [
          "participation",
          "marketplace",
          "office-review-inbox",
          "notifications",
          "notification-target",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  const data = query.isError ? undefined : query.data;
  return (
    <div className={styles.participation}>
      <NotificationTargetFeedback target={target} />
      {office && (
        <Link
          className="text-link"
          to={
            pendingOnly
              ? `/office/participation/${module}?history=1`
              : `/office/participation/${module}`
          }
        >
          {pendingOnly
            ? "All applications & history"
            : "Pending applications only"}
        </Link>
      )}
      {!embedded && (
        <PageIntro
          eyebrow="ACTIVITY PARTICIPATION"
          title={
            module === "booth-events"
              ? "Booth applications"
              : module === "workshops"
                ? "Workshop participation"
                : "Private carpool interests"
          }
          description="Apply for an approved activity and follow the organizer’s decision. Payments are arranged separately."
        />
      )}
      {data?.can_create && !office && !embedded && (
        <Button
          onClick={() => {
            mutation.reset();
            setForm(true);
          }}
        >
          Apply to an activity
        </Button>
      )}
      {notice && <p role="status">{notice}</p>}
      <Feedback error={query.error ?? mutation.error} />
      {query.isError && (
        <Button secondary onClick={() => void query.refetch()}>
          Try again
        </Button>
      )}
      {query.isPending ? (
        <Skeleton />
      ) : (
        data && (
          <>
            {!embedded && (
              <>
                <h2 className={styles.sectionTitle}>Open activities</h2>
                {!data.activities.length && (
                  <p className={styles.sectionNote}>
                    No open activities right now. Published activities accepting
                    applications will appear here.
                  </p>
                )}
                <div className={styles.stack}>
                  {data.activities.map((a) => (
                    <article className={styles.card} key={a.id}>
                      <h3>{a.title}</h3>
                      <p>
                        {a.confirmed} confirmed of {a.capacity} places. Pending
                        applications do not guarantee a place.
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
            {!embedded && (
              <h2 className={styles.sectionTitle}>
                {office ? "Applications for review" : "My applications"}
              </h2>
            )}
            <div className={styles.stack}>
              {data.rows.map((r) => (
                <article className={styles.card} key={r.id}>
                  <Badge>{r.status}</Badge>
                  <h3>{r.activity_title || "Activity unavailable"}</h3>
                  <p>
                    {r.places} place(s) · {r.details}
                  </p>
                  {r.answers && (
                    <dl>
                      {Object.entries(r.answers)
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>
                              {(
                                {
                                  participant: "Applicant",
                                  phone: "Contact phone",
                                  business: "Business",
                                  products: "Products or services",
                                } as Record<string, string>
                              )[key] ?? key}
                            </dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  <details>
                    <summary>History</summary>
                    <ol>
                      {r.history.map((a, i) => (
                        <li key={i}>
                          {a.action}: {a.note}
                          <p>
                            {new Date(a.at).toLocaleString("en-PH", {
                              timeZone: "Asia/Manila",
                            })}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                  {((!office && ["Pending", "Confirmed"].includes(r.status)) ||
                    (data.can_approve && r.status === "Pending")) && (
                    <Button
                      secondary
                      onClick={() => {
                        mutation.reset();
                        setReview(r);
                      }}
                    >
                      Application actions
                    </Button>
                  )}
                </article>
              ))}
            </div>
            {!data.rows.length && (
              <Empty title="No applications yet.">
                {embedded
                  ? "Apply from an event in Browse. Your submitted applications appear here."
                  : "Your submitted applications appear here."}
              </Empty>
            )}
            {data.total > 20 && (
              <div className={styles.actions}>
                <Button
                  secondary
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  secondary
                  disabled={(page + 1) * 20 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
      {form && data && !data.can_create && initialActivity && (
        <Feedback
          error={
            new Error(
              "Activity applications are not available for your account. Please contact the HOA office for help.",
            )
          }
        />
      )}
      {form &&
        data?.can_create &&
        !office &&
        initialActivity &&
        !data.activities.some(
          (activity) => activity.id === initialActivity,
        ) && (
          <Feedback
            error={
              new Error(
                "This activity is no longer accepting applications. Choose another event in Browse.",
              )
            }
          />
        )}
      {form &&
        data?.can_create &&
        !office &&
        (!initialActivity ||
          data.activities.some(
            (activity) => activity.id === initialActivity,
          )) && (
          <Sheet
            title="Apply for an activity"
            busy={mutation.isPending}
            onClose={() => setForm(false)}
          >
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                mutation.mutate(
                  {
                    name: "bfe_request_business_participation",
                    args: {
                      p_client: client,
                      p_activity: f.get("activity"),
                      p_places: Number(f.get("places")),
                      p_details: f.get("details"),
                      p_answers: Object.fromEntries(
                        [
                          "participant",
                          "phone",
                          ...(module === "booth-events"
                            ? ["business", "products"]
                            : []),
                        ].map((key) => [key, String(f.get(key) ?? "")]),
                      ),
                    },
                  },
                  {
                    onSuccess: () => {
                      setClient(crypto.randomUUID());
                      setForm(false);
                      setNotice("Application saved. Confirmation is pending.");
                    },
                  },
                );
              }}
            >
              <p className={styles.sectionNote}>
                Applications need organizer approval. Payments are arranged
                separately.
              </p>
              <label>
                Activity
                <select
                  required
                  name="activity"
                  defaultValue={
                    data.activities.some((a) => a.id === initialActivity)
                      ? initialActivity
                      : ""
                  }
                >
                  <option value="">Choose an open activity</option>
                  {data.activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {module === "booth-events"
                  ? "Booths (one per application)"
                  : "Places"}
                <input
                  required
                  type="number"
                  name="places"
                  min={1}
                  max={module === "booth-events" ? 1 : 50}
                  defaultValue={1}
                />
              </label>
              <label>
                {module === "booth-events" ? "Vendor name" : "Participant name"}
                <input name="participant" required maxLength={120} />
              </label>
              <label>
                Contact phone
                <input name="phone" type="tel" required maxLength={40} />
              </label>
              {module === "booth-events" && (
                <>
                  <label>
                    Business name
                    <input name="business" required maxLength={120} />
                  </label>
                  <label>
                    Products or services
                    <textarea name="products" required maxLength={1000} />
                  </label>
                </>
              )}
              <label>
                Application details
                <textarea
                  required
                  name="details"
                  minLength={5}
                  maxLength={1000}
                />
              </label>
              <Feedback error={mutation.error} />
              <Button type="submit" pending={mutation.isPending}>
                Submit application
              </Button>
            </form>
          </Sheet>
        )}
      {review && (
        <Sheet
          title={office ? "Application decision" : "Application details"}
          busy={mutation.isPending}
          onClose={closeDetails}
        >
          <Badge>{review.status}</Badge>
          <h3>{review.activity_title || "Activity unavailable"}</h3>
          <p>
            {review.places} place(s) · {review.details}
          </p>
          {review.answers && (
            <dl className="detail-list">
              {Object.entries(review.answers)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {(
                        {
                          participant: "Applicant",
                          phone: "Contact phone",
                          business: "Business",
                          products: "Products or services",
                        } as Record<string, string>
                      )[key] ?? key}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          )}
          {review.history.length > 0 && (
            <details className={styles.applicationHistory}>
              <summary>Application history</summary>
              {review.history.map((entry, index) => (
                <p key={`${entry.at}-${index}`}>
                  {entry.action} · {entry.note}
                </p>
              ))}
            </details>
          )}
          {((office && data?.can_approve && review.status === "Pending") ||
            (!office && ["Pending", "Confirmed"].includes(review.status))) && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                mutation.mutate(
                  {
                    name: "bfe_decide_participation",
                    args: {
                      p_id: review.id,
                      p_version: review.version,
                      p_status: f.get("status"),
                      p_note: f.get("note"),
                    },
                  },
                  {
                    onSuccess: () => {
                      closeDetails();
                      setNotice("Application updated.");
                    },
                  },
                );
              }}
            >
              <label>
                Decision
                <select name="status">
                  {office ? (
                    <>
                      <option>Confirmed</option>
                      <option>Rejected</option>
                    </>
                  ) : (
                    <option>Withdrawn</option>
                  )}
                </select>
              </label>
              <label>
                Reason
                <textarea required name="note" minLength={5} maxLength={500} />
              </label>
              <Feedback error={mutation.error} />
              <Button type="submit" pending={mutation.isPending}>
                {office ? "Confirm decision" : "Withdraw application"}
              </Button>
            </form>
          )}
        </Sheet>
      )}
    </div>
  );
}
