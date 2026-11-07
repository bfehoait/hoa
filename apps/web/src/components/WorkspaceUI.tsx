import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "./AccessLink";
import { money } from "../../../../packages/shared/src";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  CarFront,
  ClipboardCheck,
  Plus,
  Search,
} from "lucide-react";
import {
  workInputSchema,
  type WorkInput,
  type WorkItem,
  type WorkKind,
  type WorkStatus,
  proposedTransitions,
} from "../../../../packages/shared/src/workspace";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../data/workspace";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Field,
  formValues,
  Modal,
  Skeleton,
} from "./UI";
import styles from "./WorkspaceUI.module.css";
import { DetailDisclosure } from "./Navigation";

export function WorkspaceNote({ children }: { children: ReactNode }) {
  return (
    <DetailDisclosure title="Preview details & limits">
      <p>{children}</p>
    </DetailDisclosure>
  );
}
export function MetricStrip({
  items,
}: {
  items: { label: string; value: string | number; detail: string }[];
}) {
  return (
    <div className={styles.metrics}>
      {items.map((item) => (
        <section key={item.label}>
          <p>{item.label}</p>
          <strong
            className={
              String(item.value).length > 7 ? styles.compactValue : undefined
            }
          >
            {item.value}
          </strong>
          <span>{item.detail}</span>
        </section>
      ))}
    </div>
  );
}
export function ProgressTimeline({
  items,
}: {
  items: { label: string; detail?: string; done?: boolean }[];
}) {
  return (
    <ol className={styles.timeline}>
      {items.map((item, index) => (
        <li key={`${index}-${item.label}`}>
          <span className={item.done ? styles.done : ""}>
            {item.done ? <Check size={16} /> : index + 1}
          </span>
          <div>
            <strong>{item.label}</strong>
            {item.detail && <p>{item.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
export function Requirements({
  items,
}: {
  items: { label: string; state: string }[];
}) {
  return (
    <dl className={styles.requirements}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <Badge tone={item.state === "Supplied" ? "green" : "amber"}>
              {item.state}
            </Badge>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function LinkedCard({
  title,
  detail,
  to,
  icon,
}: {
  title: string;
  detail: string;
  to: string;
  icon: ReactNode;
}) {
  return (
    <Link className={styles.linkedCard} to={to}>
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <ArrowRight size={20} />
    </Link>
  );
}
export function Queue({
  kind,
  title,
  empty = "No local records yet.",
  createLabel,
  description,
  allowReview = false,
}: {
  kind: WorkKind;
  title: string;
  empty?: string;
  createLabel?: string;
  description?: string;
  allowReview?: boolean;
}) {
  const data = useWorkspace();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const rows =
    data.data?.items.filter(
      (row) =>
        row.kind === kind &&
        `${row.title} ${row.id} ${row.detail}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "All" || row.status === filter),
    ) ?? [];
  const item = data.data?.items.find((row) => row.id === selected);
  const Icon =
    kind === "vehicle"
      ? CarFront
      : kind === "permit"
        ? ClipboardCheck
        : FileText;
  return (
    <section>
      <div className={styles.queueHeader}>
        <h2>
          {title} <span className={styles.queueCount}>{rows.length}</span>
        </h2>
        {createLabel && (
          <Button onClick={() => setForm(true)}>
            <Plus size={20} aria-hidden="true" />
            {createLabel}
          </Button>
        )}
      </div>
      {description && <p className="note">{description}</p>}
      <div className={styles.queueTools}>
        <div className="search">
          <Search size={20} />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="standalone-control"
          aria-label={`Filter ${title.toLowerCase()}`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {(["announcement", "listing", "document"].includes(kind)
            ? [
                "All",
                "Draft",
                "Submitted locally",
                "In review",
                "Changes requested",
                "Preview published",
                "Archived",
              ]
            : [
                "All",
                "Submitted locally",
                "In review",
                "Changes requested",
                "Cancelled",
                "Archived",
              ]
          ).map((value) => (
            <option key={value} value={value}>
              {value === "All" ? "All states" : value}
            </option>
          ))}
        </select>
      </div>
      <Feedback error={data.error} />
      {data.isPending && <Skeleton />}
      <div className={styles.queue}>
        {rows.map((row) => (
          <button key={row.id} onClick={() => setSelected(row.id)}>
            <span className={styles.queueIcon}>
              <Icon size={24} aria-hidden="true" />
            </span>
            <span>
              <strong>{row.title}</strong>
              <small>{row.id}</small>
              {kind === "expense" && (
                <strong>
                  {row.amount === undefined
                    ? "Amount unavailable"
                    : money(row.amount)}
                </strong>
              )}
            </span>
            <Badge
              tone={
                row.status === "Preview published"
                  ? "green"
                  : row.status === "In review"
                    ? "amber"
                    : "neutral"
              }
            >
              {row.status}
            </Badge>
            <ChevronRight size={20} />
          </button>
        ))}
      </div>
      {!data.isPending && !data.error && !rows.length && (
        <Empty title={empty} icon={<Icon size={32} />}>
          {search || filter !== "All"
            ? "Try another search or status."
            : "Your sample requests will appear here."}
        </Empty>
      )}
      {form && (
        <WorkForm
          kind={kind}
          title={createLabel ?? "New sample record"}
          onClose={() => setForm(false)}
        />
      )}{" "}
      {item && (
        <WorkDetail
          item={item}
          review={allowReview}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
export function WorkForm({
  kind,
  title,
  onClose,
  initialTitle = "",
}: {
  kind: WorkKind;
  title: string;
  onClose: () => void;
  initialTitle?: string;
}) {
  const mutation = useWorkspaceAction(workspaceRepository.create);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<WorkItem | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    const values = formValues(event);
    const input: WorkInput = {
      kind,
      title: String(values.title ?? ""),
      detail: String(values.detail ?? ""),
      metadata: {},
    };
    if (values.date) input.date = String(values.date);
    if (values.amount) {
      const value = Number(values.amount);
      input.amount = Math.round(value * 100);
    }
    const result = workInputSchema.safeParse(input);
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach((i) => (next[String(i.path[0])] = i.message));
      setErrors(next);
      requestAnimationFrame(() =>
        document
          .getElementById(String(result.error.issues[0]?.path[0]))
          ?.focus(),
      );
      return;
    }
    setErrors({});
    try {
      setSaved((await mutation.mutateAsync(result.data)) as WorkItem);
    } catch {
      /* Mutation failure is shown inline. */
    }
  }
  const attr = (id: string) => ({
    id,
    name: id,
    "aria-invalid": !!errors[id],
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });
  return (
    <Modal
      title={saved ? "Sample record saved" : title}
      description="Synthetic details only · local browser storage"
      onClose={onClose}
    >
      {saved ? (
        <>
          <Feedback
            message={`${saved.title} saved locally. Reference ${saved.id}. No real approval, payment or delivery occurred.`}
          />
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field label="Title" error={errors.title}>
            <input
              {...attr("title")}
              defaultValue={initialTitle}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Details" error={errors.detail}>
            <textarea {...attr("detail")} maxLength={2000} required />
          </Field>
          {["expense", "listing"].includes(kind) && (
            <Field
              label="Sample amount in PHP (optional)"
              error={errors.amount}
            >
              <input
                {...attr("amount")}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
              />
            </Field>
          )}
          {["enrollment", "ride", "permit", "incident"].includes(kind) && (
            <Field label="Date (optional)" error={errors.date}>
              <input {...attr("date")} type="date" />
            </Field>
          )}
          <Feedback error={mutation.error} />
          <div className="form-actions">
            <Button type="button" secondary onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.isPending}>
              {mutation.isPending ? "Saving locally…" : "Save sample record"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
export function WorkDetail({
  item,
  review,
  onClose,
}: {
  item: WorkItem;
  review?: boolean;
  onClose: () => void;
}) {
  const mutation = useWorkspaceAction(workspaceRepository.transition);
  const [reason, setReason] = useState("");
  const next = review
    ? proposedTransitions[item.status]
    : proposedTransitions[item.status].filter((value) => value === "Cancelled");
  return (
    <Modal
      title={item.title}
      description={`${item.id} · synthetic local record`}
      onClose={onClose}
    >
      <Badge tone={item.status === "In review" ? "amber" : "neutral"}>
        {item.status}
      </Badge>
      <p className="note">{item.detail}</p>
      {item.attachments.map((file) => (
        <div className="notice-note" key={file.id}>
          <FileText size={20} />
          <p>
            {file.name} · {file.kind}. Synthetic metadata only; no upload or
            hosted file.
          </p>
        </div>
      ))}
      {(item.date || ["expense", "listing"].includes(item.kind)) && (
        <dl className="detail-list">
          {item.date && (
            <div>
              <dt>Sample date</dt>
              <dd>{item.date}</dd>
            </div>
          )}
          {["expense", "listing"].includes(item.kind) && (
            <div>
              <dt>Sample amount</dt>
              <dd>
                {item.amount === undefined
                  ? "Not supplied"
                  : money(item.amount)}
              </dd>
            </div>
          )}
        </dl>
      )}
      {Object.keys(item.metadata).length > 0 && (
        <dl className="detail-list">
          {Object.entries(item.metadata).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ProgressTimeline
        items={item.events.map((event) => ({
          label: event.label,
          detail: new Date(event.at).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
          }),
          done: true,
        }))}
      />
      {review && (
        <Requirements
          items={[
            { label: "Identity / authority", state: "Not verified" },
            { label: "Supporting files", state: "Not supplied" },
            { label: "Approved business rules", state: "Pending" },
          ]}
        />
      )}
      <WorkspaceNote>
        No real approval or secure audit is performed. Sample review changes are
        editable local history, not a server authorization.
      </WorkspaceNote>
      {next.length > 0 && (
        <>
          <Field label="Reason for local change">
            <input
              id="review-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
          </Field>
          <div className="form-actions">
            {next.map((status) => (
              <Button
                key={status}
                secondary
                pending={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    id: item.id,
                    next: status as WorkStatus,
                    reason,
                  })
                }
              >
                {status === "Preview published"
                  ? "Publish in preview"
                  : `${status} · local`}
              </Button>
            ))}
          </div>
        </>
      )}
      <Feedback
        error={mutation.error}
        message={
          mutation.isSuccess
            ? "Local state updated. No external system was changed."
            : undefined
        }
      />
      <div className="form-actions">
        <Button secondary onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
