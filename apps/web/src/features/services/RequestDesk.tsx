import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Wrench,
} from "lucide-react";
import {
  Badge,
  Button,
  Feedback,
  Field,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import {
  liveRequestInput,
  requestCategories,
  requestStatuses,
  helpdeskCategories,
  requestCategoryLabel,
  type LiveRequest,
} from "../../../../../packages/shared/src/requests";
import {
  useRequestActions,
  useRequests,
  useRequestThread,
} from "../../data/requests";
import { RequestStatusVisual } from "../../components/RecordVisuals";
import styles from "./RequestDesk.module.css";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { hasCapability } from "../../../../../packages/shared/src/permissions";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
export default function RequestDesk({ office = false }: { office?: boolean }) {
  const [params] = useSearchParams();
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(() => !office && params.has("new"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const query = useRequests(office, page, status, category);
  const records = query.isError ? [] : (query.data?.records ?? []);
  const selected = records.find((record) => record.id === selectedId);
  const canNext =
    query.data?.total === null
      ? records.length === 20
      : (page + 1) * 20 < (query.data?.total ?? 0);
  return (
    <>
      <PageIntro
        eyebrow={
          sample
            ? "REQUEST PREVIEW"
            : office
              ? "OFFICE · RESIDENT SUPPORT"
              : "HELPDESK"
        }
        title={office ? "Resident requests" : "How can we help?"}
        description={
          office
            ? "Review requests, respond and keep residents informed."
            : "Report an issue, file a complaint, raise a concern or share an idea. Follow the conversation here."
        }
        icon={<Wrench size={28} />}
        action={
          !office && (
            <Button
              onClick={() => setCreating(true)}
              disabled={query.isError || query.isPending}
            >
              <Plus size={20} />
              New request
            </Button>
          )
        }
      />
      <div className={styles.toolbar}>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
              setSelectedId(null);
            }}
          >
            <option value="">All statuses</option>
            {requestStatuses.map((value) => (
              <option key={value} value={value}>
                {requestCategoryLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(0);
              setSelectedId(null);
            }}
          >
            <option value="">All categories</option>
            {requestCategories.map((value) => (
              <option key={value} value={value}>
                {requestCategoryLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <Button
          secondary
          pending={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={20} />
          Refresh
        </Button>
      </div>
      <Feedback message={notice} />
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Feedback error={query.error} />
      ) : (
        <>
          <RequestStatusVisual
            records={records}
            label="Current filtered page only"
          />
          <p className={styles.source}>
            <CheckCircle2 size={18} />
            <span>
              {sample ? "Sample data · This tab only" : "Database records"} ·{" "}
              {query.data?.total === null
                ? `${records.length} on this page`
                : `${query.data?.total ?? 0} matching`}{" "}
              · Updated{" "}
              {new Date(query.dataUpdatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
          {!records.length ? (
            <section className={styles.empty}>
              <MessageSquare size={36} />
              <h2>
                {status || category
                  ? "No matching requests"
                  : "A clear place to follow up"}
              </h2>
              <p>
                {office
                  ? "Requests submitted through this app will appear here when your account is authorized to read them."
                  : "Your submitted requests and office replies will appear here. Other residents’ requests stay outside this view."}
              </p>
            </section>
          ) : (
            <ul className={styles.requests}>
              {records.map((record) => (
                <li key={record.id}>
                  <button
                    onClick={() => setSelectedId(record.id)}
                    aria-label={`Open ${record.title}`}
                  >
                    <span className={styles.requestIcon}>
                      <Wrench size={24} />
                    </span>
                    <span className={styles.requestInfo}>
                      <strong>{record.title}</strong>
                      <span>
                        {requestCategoryLabel(record.category)}
                        {office && record.unit_snapshot
                          ? ` · Recorded unit: ${record.unit_snapshot}`
                          : ""}
                      </span>
                      <time dateTime={record.updated_at}>
                        {dateLabel(record.updated_at)}
                      </time>
                    </span>
                    <Badge
                      tone={
                        record.status === "Resolved"
                          ? "green"
                          : record.status === "In progress"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {record.status}
                    </Badge>
                    <ChevronRight size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <nav className={styles.pagination} aria-label="Request pages">
            <Button
              secondary
              disabled={!page || query.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              <ArrowLeft size={18} />
              Previous
            </Button>
            <span>Page {page + 1}</span>
            <Button
              secondary
              disabled={!canNext || query.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
              <ArrowRight size={18} />
            </Button>
          </nav>
        </>
      )}
      {creating && !!query.data && (
        <NewRequest
          initialCategory={
            helpdeskCategories.find(
              (option) =>
                option.value.toLowerCase() ===
                (params.get("new") ?? "").toLowerCase(),
            )?.value ?? "Maintenance"
          }
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setPage(0);
            setStatus("");
            setCategory("");
            setNotice(
              sample
                ? "Sample request saved in this browser tab. No message was sent."
                : "Request saved. The office can now review it.",
            );
          }}
        />
      )}
      {selected && (
        <Thread
          key={selected.id}
          request={selected}
          office={office}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function NewRequest({
  onClose,
  onSaved,
  initialCategory,
}: {
  onClose: () => void;
  onSaved: () => void;
  initialCategory: string;
}) {
  const auth = useAuth();
  const actions = useRequestActions();
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: initialCategory,
  });
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  function change(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setClientId(crypto.randomUUID());
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = liveRequestInput.safeParse(draft);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      const first = String(parsed.error.issues[0]?.path[0]);
      document
        .getElementById(
          first === "title"
            ? "request-title"
            : first === "description"
              ? "request-details"
              : "request-category",
        )
        ?.focus();
      return;
    }
    setErrors({});
    try {
      await actions.create.mutateAsync({ clientId, input: parsed.data });
      onSaved();
    } catch {
      /* Kept visible, with the same idempotency key for retry. */
    }
  }
  return (
    <Modal
      title="New request"
      busy={actions.create.isPending}
      description={
        auth.rolePreview || auth.preview
          ? "Synthetic local request. Nothing is sent to the office."
          : "Tell the office what you need. Your account and recorded unit are attached by the server."
      }
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <Field label="Category">
          <select
            id="request-category"
            value={draft.category}
            onChange={(event) => change("category", event.target.value)}
            disabled={actions.create.isPending}
          >
            {helpdeskCategories.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <p className={styles.source}>
          {helpdeskCategories.find((c) => c.value === draft.category)?.detail}{" "}
          Your request is visible to you and authorized handlers, not the
          community feed.
        </p>
        <Field label="Title" error={errors.title}>
          <input
            id="request-title"
            value={draft.title}
            maxLength={120}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "request-title-error" : undefined}
            onChange={(event) => change("title", event.target.value)}
            disabled={actions.create.isPending}
          />
        </Field>
        <Field label="Details" error={errors.description}>
          <textarea
            id="request-details"
            value={draft.description}
            maxLength={5000}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? "request-details-error" : undefined
            }
            onChange={(event) => change("description", event.target.value)}
            disabled={actions.create.isPending}
          />
        </Field>
        <Feedback error={actions.create.error} />
        <div className="form-actions">
          <Button pending={actions.create.isPending} type="submit">
            <Send size={20} />
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Thread({
  request,
  office,
  onClose,
}: {
  request: LiveRequest;
  office: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const messages = useRequestThread(request.id, page);
  const actions = useRequestActions(office);
  const auth = useAuth();
  const permissions = usePermissions();
  const sample = auth.preview || !!auth.rolePreview;
  const canReply =
    sample ||
    (!permissions.isError &&
      hasCapability(permissions.data, {
        module: "requests",
        action: "reply",
        scope: office ? "association" : "own",
      }));
  const canStatus =
    sample ||
    (!permissions.isError &&
      hasCapability(permissions.data, {
        module: "requests",
        action: "status",
        scope: "association",
      }));
  const [body, setBody] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState("");
  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      await actions.reply.mutateAsync({
        requestId: request.id,
        clientId,
        body,
      });
      setBody("");
      setClientId(crypto.randomUUID());
      setPage(0);
      setNotice(
        sample ? "Sample reply saved in this tab. Not sent." : "Reply saved.",
      );
    } catch {
      /* The user can retry the unchanged payload without duplication. */
    }
  }
  const rows = messages.isError ? [] : (messages.data?.records ?? []);
  return (
    <Modal
      title={request.title}
      busy={actions.reply.isPending || actions.status.isPending}
      description={`${request.category} · ${request.status}`}
      onClose={onClose}
    >
      <p className={styles.description}>{request.description}</p>
      <p className="note">
        Submitted {dateLabel(request.created_at)}
        {request.unit_snapshot
          ? ` · Recorded unit: ${request.unit_snapshot}`
          : ""}
        . Recorded unit text is not proof of property ownership.
      </p>
      {office && canStatus && (
        <section
          className={styles.statusActions}
          aria-label="Office status actions"
        >
          {requestStatuses.map((status) => (
            <Button
              secondary
              key={status}
              disabled={status === request.status || actions.status.isPending}
              onClick={async () => {
                try {
                  await actions.status.mutateAsync({ request, value: status });
                  setNotice(
                    sample ? "Sample status saved locally." : "Status saved.",
                  );
                } catch {
                  /* Error shown below. */
                }
              }}
            >
              {status === "Open"
                ? "Reopen"
                : status === "Resolved"
                  ? "Resolve"
                  : "Start work"}
            </Button>
          ))}
        </section>
      )}
      <Feedback message={notice} error={actions.status.error} />
      <div className={styles.threadTitle}>
        <h2>Conversation</h2>
        <Button
          secondary
          pending={messages.isFetching}
          onClick={() => void messages.refetch()}
        >
          <RefreshCw size={18} />
          Refresh replies
        </Button>
      </div>
      {messages.isPending ? (
        <Skeleton />
      ) : messages.isError ? (
        <Feedback error={messages.error} />
      ) : (
        <>
          {!rows.length && <p className="note">No replies yet.</p>}
          <ol className={styles.messages}>
            {rows.map((message) => (
              <li
                key={message.id}
                className={
                  message.author_kind === "Office" ? styles.officeReply : ""
                }
              >
                <div>
                  <strong>{message.author_kind}</strong>
                  <time dateTime={message.created_at}>
                    {dateLabel(message.created_at)}
                  </time>
                </div>
                <p>{message.body}</p>
              </li>
            ))}
          </ol>
          <nav className={styles.pagination} aria-label="Conversation pages">
            <Button
              secondary
              disabled={
                messages.isFetching ||
                (messages.data?.total === null
                  ? rows.length < 20
                  : (page + 1) * 20 >= (messages.data?.total ?? 0))
              }
              onClick={() => setPage((value) => value + 1)}
            >
              Older replies
            </Button>
            <span>Page {page + 1}</span>
            <Button
              secondary
              disabled={!page || messages.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Newer replies
            </Button>
          </nav>
        </>
      )}
      {request.status === "Resolved" ? (
        <p className="note">
          Resolved. The office must reopen this request before another reply can
          be sent.
        </p>
      ) : !canReply ? (
        <p className="note">
          Read-only access. Reply permission is required to send a message.
        </p>
      ) : (
        <form className={styles.form} onSubmit={reply}>
          <Field label="Your reply">
            <textarea
              id="request-reply"
              value={body}
              maxLength={5000}
              onChange={(event) => {
                setBody(event.target.value);
                setClientId(crypto.randomUUID());
              }}
              disabled={actions.reply.isPending}
            />
          </Field>
          <Feedback error={actions.reply.error} />
          <div className="form-actions">
            <Button
              type="submit"
              pending={actions.reply.isPending}
              disabled={!body.trim() || messages.isPending || messages.isError}
            >
              <Send size={20} />
              Send reply
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
