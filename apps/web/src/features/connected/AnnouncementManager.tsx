import { useState } from "react";
import managerStyles from "./AnnouncementManager.module.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  featureDashboardSchema,
  type FeatureRecord,
} from "../../../../../packages/shared/src/feature-records";
import { manilaInstant } from "../../../../../packages/shared/src/operations";
import { useAuth } from "../../data/auth";
import { featureRpc, useFeatureMutation } from "../../data/feature-records";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import ListingMedia from "./ListingMedia";
import FeatureSubmissionForm from "./FeatureSubmissionForm";
import WorkflowHistory from "./WorkflowHistory";
import styles from "./LiveFeature.module.css";

export default function AnnouncementManager() {
  const auth = useAuth(),
    cache = useQueryClient(),
    action = useFeatureMutation();
  const [view, setView] = useState("published"),
    [page, setPage] = useState(0),
    [search, setSearch] = useState("");
  const [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [publish, setPublish] = useState<FeatureRecord | null>(null),
    [unpublish, setUnpublish] = useState<FeatureRecord | null>(null),
    [history, setHistory] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["announcement-management", auth.userId, view, page, search],
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      featureDashboardSchema.parse(
        await featureRpc("bfe_announcement_dashboard", {
          p_view: view,
          p_page: page,
          p_search: search,
        }),
      ),
  });
  const writable =
    !auth.memberPreview &&
    !auth.preview &&
    !auth.rolePreview &&
    !!query.data?.can_publish;
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["announcement-management"] });
    await cache.invalidateQueries({ queryKey: ["feature-records"] });
  };
  return (
    <>
      <PageIntro
        eyebrow="COMMUNITY"
        title="Announcements"
        description="Post community notices or remove them from the customer view."
      />
      <div className={styles.toolbar}>
        <label>
          View
          <select
            value={view}
            onChange={(event) => {
              setView(event.target.value);
              setPage(0);
            }}
          >
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        {writable && query.data?.can_create && (
          <Button
            onClick={() => {
              setSaved(false);
              setCreate(true);
            }}
          >
            New announcement
          </Button>
        )}
      </div>
      <Feedback error={query.error ?? action.error} message={notice} />
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Button secondary onClick={() => void query.refetch()}>
          Try again
        </Button>
      ) : (
        query.data && (
          <>
            <p className={styles.formHelp}>
              {query.data.total} {view}{" "}
              {query.data.total === 1 ? "announcement" : "announcements"}
              {search ? " matching your search" : ""}
            </p>
            <div className={managerStyles.list}>
              {query.data.rows.map((record) => {
                const own = record.owner_id === auth.userId;
                const canPost =
                  writable &&
                  own &&
                  !!record.publication_consent &&
                  record.status !== "Rejected";
                return (
                  <article
                    className={`${styles.card} ${managerStyles.row}`}
                    key={record.id}
                  >
                    <div className={styles.cardHead}>
                      <Badge>
                        {view === "published" ? "Published" : "Unpublished"}
                      </Badge>
                      <time
                        className={styles.cardDate}
                        dateTime={record.created_at}
                      >
                        {new Date(record.created_at).toLocaleDateString(
                          "en-PH",
                          { timeZone: "Asia/Manila" },
                        )}
                      </time>
                    </div>
                    <h2 className={styles.cardTitle}>{record.title}</h2>
                    <details className={managerStyles.preview}>
                      <summary>Announcement text & image</summary>
                      <p>{record.detail}</p>
                      <ListingMedia
                        id={record.id}
                        announcement
                        alt={"Image for " + record.title}
                        editable={
                          writable &&
                          own &&
                          record.status === "Submitted" &&
                          !!record.publication_consent
                        }
                      />
                    </details>
                    <div
                      className={`${styles.actions} ${managerStyles.actions}`}
                    >
                      {view === "unpublished" && canPost && (
                        <Button onClick={() => setPublish(record)}>
                          Publish
                        </Button>
                      )}
                      {view === "published" && writable && (
                        <Button
                          secondary
                          onClick={() => {
                            action.reset();
                            setUnpublish(record);
                          }}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button secondary onClick={() => setHistory(record.id)}>
                        History
                      </Button>
                    </div>
                    {view === "unpublished" && !own && writable && (
                      <p className={styles.formHelp}>
                        The author can publish this saved announcement.
                      </p>
                    )}
                    {view === "unpublished" &&
                      own &&
                      !record.publication_consent && (
                        <p className={styles.formHelp}>
                          Publication consent is missing. This saved post cannot
                          be published.
                        </p>
                      )}
                    {view === "unpublished" && record.status === "Rejected" && (
                      <p className={styles.formHelp}>
                        This post was rejected. Its history is retained.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            {!query.data.rows.length && (
              <p>
                No {view} announcements{search ? " match your search" : " yet"}.
              </p>
            )}
            {query.data.total > 20 && (
              <div className={styles.actions}>
                <Button
                  secondary
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  secondary
                  disabled={(page + 1) * 20 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
      {create && (
        <Modal
          size="lg"
          title="New announcement"
          busy={busy}
          onClose={() => {
            setCreate(false);
            if (saved) {
              setRequestId(crypto.randomUUID());
              setView("unpublished");
              void refresh();
            }
          }}
        >
          <FeatureSubmissionForm
            module="publishing"
            editing={null}
            clientId={requestId}
            publishable
            directPublish
            onBusyChange={setBusy}
            onRecordSaved={() => setSaved(true)}
            onSaved={(message) => {
              setCreate(false);
              setSaved(false);
              setRequestId(crypto.randomUUID());
              setView("published");
              setPage(0);
              setNotice(message);
              void refresh();
            }}
          />
        </Modal>
      )}
      {publish && (
        <PublishSaved
          key={publish.id}
          record={publish}
          onClose={() => setPublish(null)}
          onSaved={() => {
            setPublish(null);
            setView("published");
            setPage(0);
            setNotice("Announcement published.");
            void refresh();
          }}
        />
      )}
      {unpublish && (
        <Modal
          title="Unpublish this announcement?"
          busy={action.isPending}
          onClose={() => setUnpublish(null)}
        >
          <p>
            This removes <strong>{unpublish.title}</strong> from the customer
            view. Its saved content, image and history are kept.
          </p>
          <Feedback error={action.error} />
          <div className={styles.actions}>
            <Button
              pending={action.isPending}
              onClick={() =>
                action.mutate(
                  {
                    name: "bfe_unpublish_announcement",
                    args: { p_id: unpublish.id, p_version: unpublish.version },
                  },
                  {
                    onSuccess: () => {
                      setUnpublish(null);
                      setNotice(
                        "Announcement unpublished. Saved content and history retained.",
                      );
                      void refresh();
                    },
                  },
                )
              }
            >
              Unpublish
            </Button>
            <Button
              secondary
              disabled={action.isPending}
              onClick={() => setUnpublish(null)}
            >
              Keep published
            </Button>
          </div>
        </Modal>
      )}
      {history && (
        <Modal title="Announcement history" onClose={() => setHistory(null)}>
          <WorkflowHistory kind="feature" id={history} />
        </Modal>
      )}
    </>
  );
}

function PublishSaved({
  record,
  onClose,
  onSaved,
}: {
  record: FeatureRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  return (
    <Modal title="Publish announcement" busy={busy} onClose={onClose}>
      <p>
        <strong>{record.title}</strong>
      </p>
      <p>
        Audience: {record.fields?.audience || "Not provided"}. This post will
        appear immediately.
      </p>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          const expiry = String(
            new FormData(event.currentTarget).get("expiry") ?? "",
          );
          setBusy(true);
          setError(null);
          try {
            const asset = z
              .object({ cover_path: z.string().nullable() })
              .parse(
                await featureRpc("bfe_listing_media", { p_record: record.id }),
              );
            await featureRpc("bfe_publish_announcement", {
              p_id: record.id,
              p_title: record.title,
              p_detail: record.detail,
              p_fields: record.fields,
              p_expires: manilaInstant(expiry),
              p_cover_path: asset.cover_path,
            });
            onSaved();
          } catch (e) {
            setError(
              e instanceof Error
                ? e
                : new Error(
                    "Publication was not confirmed. Refresh before retrying.",
                  ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Show until (Philippine time)
          <input name="expiry" type="datetime-local" required disabled={busy} />
          <span className={styles.formHelp}>
            Choose a future expiry within one year. Any image upload must be
            complete.
          </span>
        </label>
        <Feedback error={error} />
        <div className={styles.actions}>
          <Button type="submit" pending={busy}>
            Publish now
          </Button>
          <Button type="button" secondary disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
