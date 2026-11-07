import { NavigationGroup } from "../../components/Navigation";
import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Download,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  CarFront,
  Wrench,
} from "lucide-react";
import {
  baselineModules,
  baselineModule,
  baselineSchema,
  relatedField,
  relatedModule,
  tripSteps,
  type BaselineModule,
  type BaselineField,
} from "../../../../../packages/shared/src/baseline";
import {
  proposedTransitions,
  type WorkItem,
  type WorkStatus,
} from "../../../../../packages/shared/src/workspace";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../../data/workspace";
import { downloadCsv } from "../../data/download";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Field,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import {
  MetricStrip,
  ProgressTimeline,
  WorkspaceNote,
} from "../../components/WorkspaceUI";
import { BaselineImports, BillingCalculator } from "./ImportTools";
import {
  publishableModules,
  garageItems,
} from "../../../../../packages/shared/src/integration";
import styles from "./FeatureBaseline.module.css";
import { useAuth } from "../../data/auth";
import LiveFeature from "../connected/LiveFeature";
import Shuttle from "../transport/Shuttle";
import RequestDesk from "../services/RequestDesk";
import LotRegister from "../registry/LotRegister";
import ParticipationDesk from "../connected/ParticipationDesk";
import { canOpenPath } from "../../../../../packages/shared/src/auth";

const icons: Record<string, typeof Store> = {
  Livelihood: Store,
  Learning: Users,
  Transport: CarFront,
  Support: MessageSquare,
  Security: ShieldCheck,
  Property: Building2,
  Community: CalendarDays,
  Governance: BriefcaseBusiness,
  Finance: Wallet,
  Administration: Wrench,
};
export default function FeatureBaseline() {
  const auth = useAuth();
  const { module: id } = useParams();
  const [pageQuery, setPageQuery] = useSearchParams();
  const requestedPage = Math.max(0, Number(pageQuery.get("page")) || 0);
  const data = useWorkspace();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All areas");
  if (id === "imports") return <BaselineImports />;
  if (id === "calculator") return <BillingCalculator />;
  if (id) {
    const definition = baselineModules.find((item) => item.id === id);
    if (!auth.preview && !auth.rolePreview) {
      if (
        id === "booth-applications" ||
        id === "participation" ||
        id === "carpool-interests"
      )
        return (
          <ParticipationDesk
            module={
              id === "booth-applications"
                ? "booth-events"
                : id === "participation"
                  ? "workshops"
                  : "carpools"
            }
            office={pageQuery.get("view") === "review"}
          />
        );
      if (id === "ride-requests") return <Shuttle />;
      if (id === "unit-register") return <LotRegister />;
      if (["complaints", "concerns", "tickets", "messages"].includes(id))
        return <RequestDesk />;
    }
    if (definition && !auth.preview && !auth.rolePreview)
      return <LiveFeature key={id} module={id} />;
    return definition ? (
      <ModuleWorkspace key={id} definition={definition} />
    ) : (
      <Empty title="Feature not found.">
        Choose a feature from <Link to="/explore">the baseline directory</Link>.
      </Empty>
    );
  }
  const modules = baselineModules.filter(
    (item) =>
      (auth.preview ||
        auth.rolePreview ||
        (!!auth.member && canOpenPath(auth.member, "/explore/" + item.id))) &&
      (group === "All areas" || item.group === group) &&
      `${item.title} ${item.summary} ${item.fields.map((field) => field.label).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const lastPage = Math.max(0, Math.ceil(modules.length / 6) - 1);
  const page = Math.min(requestedPage, lastPage);
  return (
    <>
      <PageIntro
        eyebrow={
          auth.preview || auth.rolePreview
            ? "FEATURE BASELINE · SYNTHETIC WORKFLOWS"
            : "CONNECTED FEATURE WORKFLOWS"
        }
        title={
          auth.preview || auth.rolePreview
            ? "Everything has its place."
            : "Service directory"
        }
        description={
          auth.preview || auth.rolePreview
            ? "Prepare sample records and follow local reviews."
            : "Open protected submission workflows and dedicated services. Permissions are checked by the server."
        }
      />
      {(auth.preview || auth.rolePreview) && (
        <>
          <div className={styles.hero}>
            <div>
              <span className={styles.heroIcon}>
                <Layers3 size={28} />
              </span>
              <h2>A working foundation for the whole community.</h2>
              <p>
                {auth.preview || auth.rolePreview
                  ? "These workflows use synthetic details. Local sample actions do not grant HOA approval."
                  : "New submissions use protected server services. Existing source test records and example business policies have not been imported."}
              </p>
            </div>
            <Link className="text-link" to="/developer/source">
              Inspect source evidence <ArrowRight size={20} />
            </Link>
          </div>
          <MetricStrip
            items={[
              {
                label: "Structured modules",
                value: baselineModules.length,
                detail:
                  auth.preview || auth.rolePreview
                    ? "Local sample drafts"
                    : "Dedicated services and structured submissions",
              },
              {
                label: "Source families",
                value: 16,
                detail: "Inventoried at the frozen snapshot",
              },
              {
                label: "Real authority",
                value:
                  auth.preview || auth.rolePreview
                    ? "Not connected"
                    : "Service-specific",
                detail:
                  "Accounting, certified voting and files remain incomplete",
              },
            ]}
          />
        </>
      )}
      <div className={styles.toolbar}>
        <div className="search">
          <Search size={20} />
          <input
            aria-label="Search feature baseline"
            placeholder="Find a feature or field…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageQuery({});
            }}
          />
        </div>
        <select
          aria-label="Filter feature area"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            setPageQuery({});
          }}
        >
          {[
            "All areas",
            ...new Set(baselineModules.map((item) => item.group)),
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <p className="small muted" role="status">
        {modules.length} services shown
        {(auth.preview || auth.rolePreview) && (
          <>
            {" "}
            ·{" "}
            {data.data?.items.filter((item) => item.kind === "baseline")
              .length ?? 0}{" "}
            locally saved records
          </>
        )}
      </p>
      <div className={styles.grid}>
        {modules.slice(page * 6, page * 6 + 6).map((item) => {
          const Icon = icons[item.group] ?? Layers3;
          return (
            <Link
              className={styles.card}
              key={item.id}
              to={`/explore/${item.id}`}
            >
              <span className={styles.icon}>
                <Icon size={24} />
              </span>
              <Badge>{item.group}</Badge>
              <h2>{item.title}</h2>
              <p>
                {auth.preview || auth.rolePreview
                  ? item.summary
                  : "View records and available actions for this service."}
              </p>
              <span className={styles.foot}>
                {item.fields.length} structured fields <ArrowRight size={20} />
              </span>
            </Link>
          );
        })}
      </div>
      {lastPage > 0 && (
        <nav className="form-actions" aria-label="Feature directory pages">
          <Button
            secondary
            disabled={page === 0}
            onClick={() => setPageQuery({ page: String(page - 1) })}
          >
            Previous modules
          </Button>
          <span role="status">
            Page {page + 1} of {lastPage + 1}
          </span>
          <Button
            secondary
            disabled={page === lastPage}
            onClick={() => setPageQuery({ page: String(page + 1) })}
          >
            Next modules
          </Button>
        </nav>
      )}
      {!modules.length && (
        <Empty title="No matching features.">Try another search or area.</Empty>
      )}
      {(auth.preview || auth.rolePreview) && (
        <div className={styles.grid}>
          <Link className={styles.card} to="/explore/imports">
            <Download size={28} />
            <h2>Import staging & templates</h2>
            <p>
              Map CSV columns, validate synthetic rows and stage local drafts.
            </p>
            <span className={styles.foot}>
              Units, payment evidence and expenses <ArrowRight size={20} />
            </span>
          </Link>
          <Link className={styles.card} to="/explore/calculator">
            <Wallet size={28} />
            <h2>Assessment calculator</h2>
            <p>
              Compare flat and area-based sample assessments without issuing
              bills.
            </p>
            <span className={styles.foot}>
              Transparent sample math <ArrowRight size={20} />
            </span>
          </Link>
        </div>
      )}
      <Feedback error={data.error} />
      {(auth.preview || auth.rolePreview) && (
        <WorkspaceNote>
          Browser workspaces are inspectable demonstrations, not permissions.
          Production access, protected files, official records and all real
          approvals remain server work.
        </WorkspaceNote>
      )}
    </>
  );
}

function ModuleWorkspace({ definition }: { definition: BaselineModule }) {
  const data = useWorkspace();
  const [query] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All states");
  const [form, setForm] = useState<WorkItem | "new" | null>(() =>
    query.get("new") === "1" ? "new" : null,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (data.isPending) return <Skeleton />;
  if (data.error)
    return (
      <>
        <PageIntro eyebrow="FEATURE BASELINE" title="Local data unavailable" />
        <Feedback error={data.error} />
        <Link className="text-link" to="/developer">
          Open recovery tools <ArrowRight size={20} />
        </Link>
      </>
    );
  const records = data.data.items.filter(
    (item) =>
      item.kind === "baseline" && item.metadata.module === definition.id,
  );
  const visible = records.filter(
    (item) =>
      (filter === "All states" || filter === item.status) &&
      `${item.title} ${item.id} ${Object.values(item.metadata).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = records.find((item) => item.id === selected);
  const Icon = icons[definition.group] ?? Layers3;
  function exportRows() {
    downloadCsv(`SAMPLE-${definition.id}.csv`, [
      ["SYNTHETIC LOCAL RECORDS — not official HOA data"],
      [
        "Reference",
        "Title",
        "Local state",
        ...definition.fields.map((field) => field.label),
      ],
      ...visible.map((item) => [
        item.id,
        item.title,
        item.status,
        ...definition.fields.map((field) => item.metadata[field.key] ?? ""),
      ]),
    ]);
    setMessage(
      "Sample CSV prepared from the filtered local records. No real HOA export was requested.",
    );
  }
  return (
    <>
      <Link className="text-link back-link" to="/explore">
        <ArrowLeft size={20} /> Feature baseline
      </Link>
      <PageIntro
        eyebrow={`${definition.group.toUpperCase()} · LOCAL WORKFLOW`}
        title={definition.title}
        description={definition.summary}
        action={
          <Button onClick={() => setForm("new")}>
            <Plus size={20} /> Prepare sample
          </Button>
        }
      />
      <div className={styles.steps}>
        {definition.steps.map((step, index) => (
          <div className={styles.step} key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>
      <NavigationGroup aria-label="Connected feature views">
        <Link to={`/office/review?module=${definition.id}`}>
          Office review desk
        </Link>
        {(publishableModules as readonly string[]).includes(definition.id) && (
          <Link to="/directory">Resident sample directory</Link>
        )}
        {["messages", "complaints", "concerns", "tickets"].includes(
          definition.id,
        ) && <Link to="/services/inbox">Resident conversations</Link>}
      </NavigationGroup>
      <div className="two-column">
        <section>
          <div className={styles.toolbar}>
            <div className="search">
              <Search size={20} />
              <input
                aria-label="Search local feature records"
                placeholder="Search title, reference or details…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter local feature state"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["All states", ...Object.keys(proposedTransitions)].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </div>
          <div className="split-heading">
            <h2>
              Local records <span className="muted">({visible.length})</span>
            </h2>
            <Button secondary onClick={exportRows} disabled={!visible.length}>
              <Download size={18} /> Export sample CSV
            </Button>
          </div>
          <div className={styles.records} style={{ marginTop: 16 }}>
            {visible.map((item) => (
              <button
                className={styles.record}
                key={item.id}
                onClick={() => setSelected(item.id)}
              >
                <span className={styles.icon}>
                  <Icon size={22} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.id}</small>
                  <small>
                    {definition.fields
                      .slice(0, 2)
                      .map((field) => item.metadata[field.key])
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <Badge>{item.status}</Badge>
                <ChevronRight size={20} />
              </button>
            ))}
          </div>
          {!visible.length && (
            <Empty
              title={
                records.length
                  ? "No records match this filter."
                  : "Ready for your first sample."
              }
            >
              {records.length
                ? "Try another search or state."
                : "Prepare a synthetic record to inspect the complete local draft and review flow."}
            </Empty>
          )}
          <Feedback message={message} />
        </section>
        <aside className="panel">
          <span className={styles.icon}>
            <LockKeyhole size={24} />
          </span>
          <h2 style={{ marginTop: 16 }}>Before this can go live</h2>
          <ProgressTimeline
            items={definition.server.map((label) => ({
              label,
              detail: "Server or approved policy required",
            }))}
          />
          <p className="small muted">
            Source evidence: snapshot lines {definition.evidence.join(", ")}.
            These descriptions do not adopt the source policies.
          </p>
          {definition.id === "billing-proposals" && (
            <Link className="text-link" to="/explore/calculator">
              Open sample calculator <ArrowRight size={20} />
            </Link>
          )}
          {relatedModule[definition.id] && (
            <Link
              className="text-link"
              to={`/explore/${relatedModule[definition.id]}`}
            >
              Prepare a linked parent record <ArrowRight size={20} />
            </Link>
          )}
        </aside>
      </div>
      <WorkspaceNote>
        All records and review steps on this page are local samples. No official
        approval, delivery, enrollment, gate permission, payment or role change
        occurs.
      </WorkspaceNote>
      {form && (
        <StructuredForm
          key={form === "new" ? "new" : form.id}
          definition={definition}
          initialParent={query.get("parent") ?? undefined}
          item={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}
      {current && !form && (
        <RecordDetail
          item={current}
          definition={definition}
          onClose={() => setSelected(null)}
          onEdit={() => setForm(current)}
        />
      )}
    </>
  );
}

function sampleValue(spec: BaselineField) {
  if (spec.options) return spec.options[0];
  if (spec.type === "date") return "2026-11-20";
  if (spec.type === "time")
    return spec.key === "end"
      ? "12:00"
      : spec.key === "setup"
        ? "09:00"
        : "10:00";
  if (spec.type === "email") return "sample@example.invalid";
  if (spec.type === "url") return "https://example.invalid/sample";
  if (spec.type === "number")
    return String(
      Math.max(spec.min ?? 0, ["capacity", "seats"].includes(spec.key) ? 4 : 1),
    );
  return spec.key === "items"
    ? "Sample table\nSample chair"
    : `Demo ${spec.key}`;
}
export function StructuredForm({
  definition,
  item,
  onClose,
  initialParent,
}: {
  definition: BaselineModule;
  item?: WorkItem;
  onClose: () => void;
  initialParent?: string;
}) {
  const data = useWorkspace();
  const mutation = useWorkspaceAction(workspaceRepository.baseline);
  const [values, setValues] = useState<Record<string, string>>({
    title: item?.title ?? "",
    detail: item?.detail ?? "",
    ...Object.fromEntries(
      definition.fields.map((spec) => [
        spec.key,
        item?.metadata[spec.key] ??
          (spec.key === relatedField[definition.id]
            ? (initialParent ?? "")
            : ""),
      ]),
    ),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<WorkItem | null>(null);
  const parentId = relatedModule[definition.id];
  const parents =
    data.data?.items.filter(
      (row) =>
        row.kind === "baseline" &&
        row.metadata.module === parentId &&
        !["Archived", "Cancelled"].includes(row.status),
    ) ?? [];
  const update = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      module: definition.id,
      id: item?.id,
      title: values.title,
      detail: values.detail,
      fields: Object.fromEntries(
        definition.fields.map((spec) => [spec.key, values[spec.key]]),
      ),
    };
    const result = baselineSchema(definition.id).safeParse(input);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues)
        next[String(issue.path.at(-1))] = issue.message;
      setErrors(next);
      requestAnimationFrame(() =>
        document.getElementById(`baseline-${Object.keys(next)[0]}`)?.focus(),
      );
      return;
    }
    setErrors({});
    try {
      setSaved((await mutation.mutateAsync(input)) as WorkItem);
    } catch {
      /* shown inline */
    }
  }
  const attrs = (key: string) => ({
    id: `baseline-${key}`,
    value: values[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => update(key, e.target.value),
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `baseline-${key}-error` : undefined,
  });
  return (
    <Modal
      title={
        saved
          ? "Sample draft saved"
          : `${item ? "Edit" : "Prepare"} ${definition.title.toLowerCase()}`
      }
      description="Use invented details only. Nothing is sent to the HOA."
      onClose={onClose}
    >
      {saved ? (
        <>
          <Feedback
            message={`Saved locally as ${saved.id}. This is a synthetic draft, not an approved record.`}
          />
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <Button
            type="button"
            secondary
            onClick={() =>
              setValues({
                title: `Sample ${definition.title.toLowerCase()}`,
                detail:
                  "Synthetic workflow example for local review. No real person or transaction is represented.",
                ...Object.fromEntries(
                  definition.fields.map((spec) => [
                    spec.key,
                    spec.key === relatedField[definition.id]
                      ? (parents.find((parent) => parent.id === initialParent)
                          ?.id ??
                        parents[0]?.id ??
                        "")
                      : sampleValue(spec),
                  ]),
                ),
              })
            }
          >
            Fill synthetic example
          </Button>
          <Field label="Sample title" error={errors.title}>
            <input {...attrs("title")} maxLength={100} required />
          </Field>
          <Field label="Sample details" error={errors.detail}>
            <textarea {...attrs("detail")} maxLength={2000} required />
          </Field>
          {definition.fields.map((spec) => (
            <Field
              key={spec.key}
              label={`${spec.label}${spec.required ? "" : " (optional)"}`}
              error={errors[spec.key]}
            >
              {spec.options || spec.key === relatedField[definition.id] ? (
                <select {...attrs(spec.key)} required={spec.required}>
                  <option value="">Choose a sample option</option>
                  {spec.options
                    ? spec.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))
                    : parents.map((parent) => (
                        <option value={parent.id} key={parent.id}>
                          {parent.title} · {parent.id}
                        </option>
                      ))}
                </select>
              ) : spec.type === "textarea" ? (
                <textarea
                  {...attrs(spec.key)}
                  maxLength={300}
                  required={spec.required}
                />
              ) : (
                <input
                  {...attrs(spec.key)}
                  type={spec.type ?? "text"}
                  maxLength={300}
                  min={spec.min}
                  max={spec.max}
                  step={
                    spec.type === "number"
                      ? [
                          "price",
                          "rate",
                          "fee",
                          "amount",
                          "planned",
                          "actual",
                        ].includes(spec.key)
                        ? ".01"
                        : "1"
                      : undefined
                  }
                  required={spec.required}
                />
              )}
            </Field>
          ))}
          {parentId && !parents.length && (
            <p className="note">
              Prepare an active local{" "}
              {baselineModule(parentId).title.toLowerCase()} record first.
            </p>
          )}
          <Feedback error={mutation.error} />
          <div className="form-actions">
            <Button type="button" secondary onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.isPending}>
              Save local draft
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function RecordDetail({
  item,
  definition,
  onClose,
  onEdit,
  allowPublication = false,
}: {
  item: WorkItem;
  definition: BaselineModule;
  onClose: () => void;
  onEdit?: () => void;
  allowPublication?: boolean;
}) {
  const data = useWorkspace();
  const transition = useWorkspaceAction(workspaceRepository.transition);
  const note = useWorkspaceAction(workspaceRepository.note);
  const simulate = useWorkspaceAction(workspaceRepository.simulate);
  const publish = useWorkspaceAction(workspaceRepository.publishContent);
  const garage = useWorkspaceAction(workspaceRepository.reviewGarageItem);
  const attachment = useWorkspaceAction(workspaceRepository.sampleAttachment);
  const [text, setText] = useState("");
  const [booth, setBooth] = useState("");
  const [reason, setReason] = useState("");
  const active = !["Cancelled", "Archived"].includes(item.status);
  const options = proposedTransitions[item.status].filter(
    (value) => value !== "Preview published",
  );
  const children =
    data.data?.items.filter(
      (row) =>
        row.kind === "baseline" &&
        relatedModule[row.metadata.module] === definition.id &&
        row.metadata[relatedField[row.metadata.module]] === item.id &&
        !["Cancelled", "Archived"].includes(row.status),
    ) ?? [];
  const requested = children.reduce(
    (total, row) => total + Number(row.metadata.places ?? 1),
    0,
  );
  const capacity = Number(item.metadata.capacity ?? item.metadata.seats);
  return (
    <Modal
      title={item.title}
      description={`${item.id} · synthetic local record`}
      onClose={onClose}
    >
      <Badge>{item.status}</Badge>
      <p className="note">{item.detail}</p>
      {item.attachments.length > 0 && (
        <section className="panel">
          <h2>Synthetic media references</h2>
          {item.attachments.map((file) => (
            <div className={styles.callout} key={file.id}>
              <Download size={20} />
              <p>
                <strong>{file.name}</strong>
                <br />
                {file.kind} · {file.caption}
              </p>
            </div>
          ))}
        </section>
      )}
      {["Draft", "Changes requested"].includes(item.status) && (
        <div className="form-actions">
          {(
            [
              "Document reference",
              "Image reference",
              "QR content reference",
            ] as const
          ).map((kind) => (
            <Button
              secondary
              key={kind}
              pending={attachment.isPending}
              onClick={() => attachment.mutate({ id: item.id, kind })}
            >
              Add sample {kind.toLowerCase()}
            </Button>
          ))}
        </div>
      )}
      <dl className={styles.detail}>
        {definition.fields.map((spec) => (
          <div key={spec.key}>
            <dt>{spec.label}</dt>
            <dd>{item.metadata[spec.key] || "Not supplied"}</dd>
          </div>
        ))}
      </dl>
      {["booth-events", "workshops", "carpools"].includes(definition.id) && (
        <div className={styles.callout}>
          <Users size={24} />
          <p>
            {requested} local{" "}
            {definition.id === "booth-events"
              ? "vendor proposals"
              : "place interests"}{" "}
            / {Number.isFinite(capacity) ? capacity : "unspecified"} sample
            capacity.{" "}
            {requested > capacity ? "Interest exceeds sample capacity. " : ""}No
            places are reserved.
          </p>
        </div>
      )}
      {definition.id === "budgets" && (
        <div className={styles.callout}>
          <Wallet size={24} />
          <p>
            Sample variance: PHP{" "}
            {(
              Number(item.metadata.planned) - Number(item.metadata.actual)
            ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            . Planned minus actual; unverified figures.
          </p>
        </div>
      )}
      {definition.id === "ride-requests" && (
        <section className="panel">
          <h2>Dispatch simulation</h2>
          <ProgressTimeline
            items={tripSteps.map((step, index) => ({
              label: step,
              done:
                index <=
                tripSteps.findIndex(
                  (value) => value === (item.metadata.tripStep ?? tripSteps[0]),
                ),
            }))}
          />
          <Button
            secondary
            disabled={!active || item.metadata.tripStep === tripSteps.at(-1)}
            pending={simulate.isPending}
            onClick={() => simulate.mutate({ id: item.id, action: "trip" })}
          >
            Simulate next trip step
          </Button>
          <p className="small muted">
            No actual driver, notification or trip confirmation.
          </p>
        </section>
      )}
      {definition.id === "booth-applications" && (
        <section className="panel">
          <h2>Booth proposal</h2>
          <p className="small muted">
            Current local proposal: {item.metadata.booth ?? "None"}. No real
            allocation.
          </p>
          <Field label="Sample booth number">
            <input
              id="sample-booth"
              type="number"
              min={1}
              step={1}
              value={booth}
              onChange={(e) => setBooth(e.target.value)}
            />
          </Field>
          <Button
            secondary
            disabled={!active}
            pending={simulate.isPending}
            onClick={() =>
              simulate.mutate({ id: item.id, action: "booth", value: booth })
            }
          >
            Save local booth proposal
          </Button>
        </section>
      )}
      {active && (
        <>
          <Field
            label={
              definition.id === "messages"
                ? "Local message (not sent)"
                : "Local follow-up note"
            }
          >
            <textarea
              id="local-feature-note"
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <Button
            secondary
            pending={note.isPending}
            onClick={async () => {
              try {
                await note.mutateAsync({ id: item.id, text });
                setText("");
              } catch {
                /* shown inline */
              }
            }}
          >
            Add local note
          </Button>
        </>
      )}
      <h2 style={{ marginTop: 24 }}>Local history</h2>
      <ProgressTimeline
        items={item.events.map((event) => ({
          label: event.label,
          detail: new Date(event.at).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
          }),
          done: true,
        }))}
      />
      {options.length > 0 && (
        <>
          <Field label="Reason for local review change">
            <input
              id="baseline-review-reason"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {definition.id === "garage-sales" && (
            <section className="panel">
              <h2>Sample item review</h2>
              <p className="note">
                Every current item needs a local review before directory
                publication. This never approves a real item.
              </p>
              {garageItems(item.metadata.items ?? "").map((name, index) => {
                const review = item.garageReviews.find(
                  (row) => row.index === index && row.item === name,
                );
                return (
                  <div
                    key={`${index}-${name}`}
                    style={{
                      padding: "16px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <strong>{name}</strong>
                    <p>
                      <Badge>
                        {review?.decision ?? "Awaiting local review"}
                      </Badge>
                    </p>
                    {allowPublication && item.status === "In review" && (
                      <div className="form-actions">
                        <Button
                          secondary
                          pending={garage.isPending}
                          onClick={() =>
                            garage.mutate(
                              {
                                id: item.id,
                                index,
                                decision: "Preview reviewed",
                                reason,
                              },
                              { onSuccess: () => publish.reset() },
                            )
                          }
                        >
                          Mark {name} reviewed locally
                        </Button>
                        <Button
                          secondary
                          pending={garage.isPending}
                          onClick={() =>
                            garage.mutate(
                              {
                                id: item.id,
                                index,
                                decision: "Changes requested",
                                reason,
                              },
                              { onSuccess: () => publish.reset() },
                            )
                          }
                        >
                          Request changes for {name}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          <div className="form-actions">
            {options.map((next) => (
              <Button
                key={next}
                secondary
                pending={transition.isPending}
                onClick={() =>
                  transition.mutate({
                    id: item.id,
                    next: next as WorkStatus,
                    reason,
                  })
                }
              >
                {
                  (
                    {
                      "Submitted locally": "Submit locally",
                      "In review": "Start local review",
                      "Changes requested": "Request changes locally",
                      Archived: "Archive locally",
                      Cancelled: "Cancel locally",
                    } as Record<string, string>
                  )[next]
                }
              </Button>
            ))}
          </div>
          {allowPublication &&
            item.status === "In review" &&
            (publishableModules as readonly string[]).includes(
              item.metadata.module,
            ) && (
              <Button
                pending={publish.isPending}
                onClick={() => publish.mutate({ id: item.id, reason })}
              >
                Publish to local sample views
              </Button>
            )}
        </>
      )}
      <Feedback
        error={
          transition.error ??
          note.error ??
          simulate.error ??
          publish.error ??
          attachment.error ??
          garage.error
        }
      />
      <Feedback
        message={
          transition.isSuccess ||
          note.isSuccess ||
          simulate.isSuccess ||
          publish.isSuccess ||
          attachment.isSuccess ||
          garage.isSuccess
            ? "Local sample updated. No message was delivered or real authorization granted."
            : undefined
        }
      />
      <WorkspaceNote>
        These review controls demonstrate workflow only. They grant no role,
        approval, payment status or election authority.
      </WorkspaceNote>
      <div className="form-actions">
        {onEdit && ["Draft", "Changes requested"].includes(item.status) && (
          <Button secondary onClick={onEdit}>
            Edit sample details
          </Button>
        )}
        <Button onClick={onClose}>Close record</Button>
      </div>
    </Modal>
  );
}
