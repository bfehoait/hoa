import { NavigationGroup } from "../../components/Navigation";
import { useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Download,
  FileText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  aging,
  balance,
  invoiceStatus,
  money,
  type Invoice,
} from "../../../../../packages/shared/src";
import { AS_OF, householdLedger, type LocalRecord } from "../../data/fixtures";
import { downloadCsv } from "../../data/download";
import { repository } from "../../data/repository";
import { usePortal, usePortalMutation } from "../../data/usePortal";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Modal,
  PageIntro,
  Field,
} from "../../components/UI";
import styles from "./Admin.module.css";

const ledger: Invoice[] = householdLedger.map((row, i) => ({
  ...row,
  id: row.unit,
  period: "Sample ledger",
  unit: row.unit,
  index: i,
}));
const total = ledger.reduce((s, r) => s + r.amount, 0);
const collected = ledger.reduce((s, r) => s + r.received, 0);
const remaining = total - collected;
const buckets = aging(ledger, AS_OF);
const pct = Math.round((collected / total) * 100);
const paid = ledger.filter((r) => balance(r) === 0).length;
const agingRows = [
  { label: "Not yet due", value: buckets.current, tone: "current" },
  { label: "1–30 days overdue", value: buckets.days1to30, tone: "late" },
  { label: "31–60 days overdue", value: buckets.days31to60, tone: "later" },
  { label: "61+ days overdue", value: buckets.days61plus, tone: "oldest" },
];

export default function Admin({
  section,
  embedded = false,
}: { section?: string; embedded?: boolean } = {}) {
  const params = useParams();
  const path = section ?? params["*"] ?? "";
  const [filter, setFilter] = useState("All households");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [request, setRequest] = useState<LocalRecord | null>(null);
  const [message, setMessage] = useState("");
  const portal = usePortal();
  const review = usePortalMutation(repository.review);
  const assign = usePortalMutation(repository.assign);
  const [assignee, setAssignee] = useState("Unassigned");
  const rows = ledger.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All households" ||
        (filter === "Fully paid"
          ? balance(r) === 0
          : filter === "Part paid"
            ? r.received > 0 && balance(r) > 0
            : r.received === 0)),
  );
  const requests =
    portal.data?.records.filter((r) => r.kind === "request") ?? [];
  const exportReport = () => {
    downloadCsv("SAMPLE-bellefort-collections.csv", [
      ["SYNTHETIC PREVIEW — NOT AN OFFICIAL HOA REPORT"],
      ["Snapshot", AS_OF],
      ["Scope", "Six synthetic billed households; unbilled households unknown"],
      [
        "Unit",
        "Billed PHP",
        "Received PHP",
        "Outstanding PHP",
        "Due date",
        "State",
      ],
      ...ledger.map((r) => [
        r.id,
        r.amount / 100,
        r.received / 100,
        balance(r) / 100,
        r.due,
        invoiceStatus(r, AS_OF),
      ]),
      [],
      ["Total", total / 100, collected / 100, remaining / 100],
    ]);
    setMessage(
      "Sample collection report prepared. Check your browser’s downloads.",
    );
  };
  return (
    <>
      <PageIntro
        eyebrow="OFFICE PREVIEW · SYNTHETIC RECORDS"
        title={
          path === "operations"
            ? "A closer look at what needs care."
            : path === "access"
              ? "The right access. For the right reason."
              : path === "audit"
                ? "A record of what changed."
                : "A clearer picture of the community."
        }
        description="Management preview. This view grants no real account permissions."
        action={
          !path || path === "households" ? (
            <Button secondary onClick={exportReport}>
              <Download size={20} />
              Export sample report
            </Button>
          ) : undefined
        }
      />
      {!embedded && (
        <NavigationGroup aria-label="Office navigation">
          {[
            { path: "", title: "Financial overview" },
            { path: "households", title: "Households" },
            { path: "operations", title: "Office requests" },
            { path: "access", title: "Roles & access" },
            { path: "audit", title: "Local activity" },
          ].map((t) => (
            <NavLink
              key={t.path}
              end
              to={`/admin${t.path ? "/" + t.path : ""}`}
              className={({ isActive }) => (isActive ? styles.active : "")}
            >
              {t.title}
            </NavLink>
          ))}
        </NavigationGroup>
      )}
      <Feedback message={message} />
      {!path && (
        <>
          <div className={styles.snapshot}>
            <span>
              <span className={styles.dot} />
              Sample ledger snapshot
            </span>
            <span>As of 4 November 2026 · 6 billed households</span>
          </div>
          <div className={styles.metrics}>
            <section>
              <p>Total billed</p>
              <strong>{money(total)}</strong>
              <span>Across the sample ledger</span>
            </section>
            <section>
              <p>Recorded collections</p>
              <strong>{money(collected)}</strong>
              <span>{pct}% of billed amount</span>
            </section>
            <section>
              <p>Still outstanding</p>
              <strong>{money(remaining)}</strong>
              <span>Includes part-paid bills</span>
            </section>
            <section>
              <p>Fully paid households</p>
              <strong>
                {paid}
                <small> / {ledger.length}</small>
              </strong>
              <span>1 part paid · 3 unpaid</span>
            </section>
          </div>
          <div className={styles.charts}>
            <section className="panel">
              <div className="section-title">
                <h2>Where collections stand</h2>
                <Badge>Sample</Badge>
              </div>
              <div className={styles.collectionChart}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={styles.collectionValue}>{pct}%</p>
                  <label htmlFor="collection-meter">
                    Collected from sample billing
                  </label>
                  <progress
                    id="collection-meter"
                    className={styles.collectionMeter}
                    value={collected}
                    max={total || 1}
                    aria-label="Collected from sample billing"
                  />
                </div>
                <div className={styles.legend}>
                  <p>
                    <span />
                    Recorded payments<strong>{money(collected)}</strong>
                  </p>
                  <p>
                    <span />
                    Outstanding<strong>{money(remaining)}</strong>
                  </p>
                </div>
              </div>
              <p className="note">
                Collection rate = recorded receipts ÷ billed amount. This is an
                amount-based rate.
              </p>
            </section>
            <section className="panel">
              <div className="section-title">
                <h2>Outstanding by age</h2>
                <span className="small muted">PHP</span>
              </div>
              <div className={styles.aging}>
                {agingRows.map((row) => (
                  <div key={row.label}>
                    <div>
                      <span>{row.label}</span>
                      <strong>{money(row.value)}</strong>
                    </div>
                    <div className={styles.barTrack}>
                      <span
                        className={styles[row.tone]}
                        style={{ width: `${(row.value / remaining) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="note">
                Calculated from due dates as of the snapshot date. Part payments
                reduce each balance.
              </p>
            </section>
          </div>
          <div className={styles.reportNote}>
            <ShieldCheck size={20} />
            <p>
              <strong>A complete report starts with complete records.</strong>
              <br />
              Unbilled households, expenses, opening balances, credits and bank
              reconciliation are unavailable. They are not shown as zero.
            </p>
          </div>
        </>
      )}
      {(!path || path === "households") && (
        <section>
          <div className="section-title">
            <h2>Household collection ledger</h2>
            <Badge>6 sample units</Badge>
          </div>
          <div className={styles.tableTools}>
            <div className="search">
              <Search size={20} />
              <input
                aria-label="Find sample household"
                placeholder="Find a household…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filters" aria-label="Filter households">
              {["All households", "Fully paid", "Part paid", "Unpaid"].map(
                (f) => (
                  <button
                    className="filter"
                    key={f}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className={styles.households}>
            {rows.length ? (
              rows.map((r) => (
                <button key={r.id} onClick={() => setSelected(r)}>
                  <span className={styles.unitIcon}>
                    <Users size={20} />
                  </span>
                  <span className={styles.unit}>
                    <strong>{r.id}</strong>
                    <span>Due {r.due}</span>
                  </span>
                  <span className={styles.householdState}>
                    <Badge
                      tone={
                        balance(r) === 0
                          ? "green"
                          : invoiceStatus(r, AS_OF) === "Overdue"
                            ? "red"
                            : "amber"
                      }
                    >
                      {balance(r) === 0
                        ? "Fully paid"
                        : r.received > 0
                          ? "Part paid"
                          : invoiceStatus(r, AS_OF)}
                    </Badge>
                  </span>
                  <span className={styles.unitAmount}>
                    <strong>{money(balance(r))}</strong>
                    <span>outstanding</span>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
              ))
            ) : (
              <Empty title="No matching households.">
                Try another unit or clear the filter.
              </Empty>
            )}
          </div>
        </section>
      )}
      {path === "operations" && (
        <>
          <div className="notice-note">
            <FileText size={20} />
            <p>
              Review sample requests created in this tab. Status changes below
              are local demonstrations, not actual office actions.
            </p>
          </div>
          <div className={styles.households}>
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  review.reset();
                  assign.reset();
                  setAssignee(r.assignedTo ?? "Unassigned");
                  setRequest(r);
                }}
              >
                <span className={styles.unit}>
                  <strong>{r.title}</strong>
                  <span>
                    {r.id} · {r.category}
                  </span>
                </span>
                <Badge tone={r.status === "Resolved" ? "green" : "amber"}>
                  {r.status}
                </Badge>
                <ArrowUpRight size={20} />
              </button>
            ))}
          </div>
          {!requests.length && (
            <Empty title="No local requests yet.">
              Create a sample request under Services to review it here.
            </Empty>
          )}
        </>
      )}
      {path === "access" && (
        <>
          <div className="notice-note">
            <ShieldCheck size={20} />
            <p>
              These are role descriptions from the brief, not an implemented
              authorization system. Main roles, extra roles, per-page overrides,
              and view-only restrictions need approved database policies.
            </p>
          </div>
          <div className={styles.roleList}>
            {[
              [
                "Admin / staff",
                "Office administration and approved operational duties.",
              ],
              [
                "Homeowner",
                "Household information and approved resident services.",
              ],
              [
                "Renter",
                "Approved tenant access; ownership rights remain separate.",
              ],
              ["Board", "Approved governance and oversight duties."],
              ["Security", "Approved visitor, gate and incident workflows."],
              ["Driver", "Approved transport and trip workflows."],
            ].map(([name, desc]) => (
              <div key={name}>
                <ShieldCheck size={20} />
                <div>
                  <h2>{name}</h2>
                  <p>{desc}</p>
                </div>
                <Badge>Policy pending</Badge>
              </div>
            ))}
          </div>
          <p className="note">
            Super-admin powers, financial exports, and cross-household access
            remain undefined. No role-changing control is offered.
          </p>
        </>
      )}
      {path === "audit" && (
        <>
          <div className="notice-note">
            <ShieldCheck size={20} />
            <p>
              This is a browser activity history, not a tamper-proof security
              audit. Production audit entries must be server-owned and protected
              from editing.
            </p>
          </div>
          {portal.data?.audit.length ? (
            <div className={styles.audit}>
              {portal.data.audit.map((entry) => (
                <div key={entry.id}>
                  <span>
                    <Check size={20} />
                  </span>
                  <div>
                    <strong>{entry.title}</strong>
                    <p>
                      {new Date(entry.at).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                      })}{" "}
                      · Local preview
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No local changes yet.">
              Create a request or edit your sample profile to see confirmed
              local activity here.
            </Empty>
          )}
        </>
      )}
      {!["", "households", "operations", "access", "audit"].includes(path) && (
        <Empty title="This office page isn’t available.">
          Choose a section above.
        </Empty>
      )}
      <Feedback error={portal.error} />
      {selected && (
        <Modal
          title={selected.id}
          description="Synthetic household ledger · sample amounts only"
          onClose={() => setSelected(null)}
        >
          <dl className="detail-list">
            <div>
              <dt>Billed</dt>
              <dd>{money(selected.amount)}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{money(selected.received)}</dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{money(balance(selected))}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{selected.due}</dd>
            </div>
            <div>
              <dt>Owner / resident</dt>
              <dd>Not supplied</dd>
            </div>
          </dl>
          <p className="note">
            Payment changes are unavailable in this preview. A verified payment
            record and audit trail will be required.
          </p>
          <Button secondary onClick={() => setSelected(null)}>
            Close household
          </Button>
        </Modal>
      )}
      {request && (
        <Modal
          title={request.title}
          description={`${request.id} · local office preview`}
          onClose={() => setRequest(null)}
        >
          <p>{request.detail}</p>
          <Field label="Sample assignee">
            <select
              id="sample-assignee"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              {["Unassigned", "Demo staff A", "Demo staff B"].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Button
            secondary
            pending={assign.isPending}
            onClick={() => assign.mutate({ id: request.id, assignee })}
          >
            Assign locally
          </Button>
          <p className="note">
            Current local assignee:{" "}
            {portal.data?.records.find((row) => row.id === request.id)
              ?.assignedTo ?? "Unassigned"}
            . These are synthetic staff labels, not real access grants.
          </p>
          <Feedback
            error={assign.error}
            message={
              assign.isSuccess
                ? "Sample request assigned locally. No staff notification was sent."
                : undefined
            }
          />
          <p className="note">
            Sample status changes are saved in this browser tab and recorded in
            Local activity.
          </p>
          <Feedback
            error={review.error}
            message={
              review.isSuccess
                ? "Sample request status updated locally."
                : undefined
            }
          />
          <div className="form-actions">
            <Button
              secondary
              pending={review.isPending}
              onClick={() =>
                review.mutate({ id: request.id, status: "In progress" })
              }
            >
              Mark in progress locally
            </Button>
            <Button
              pending={review.isPending}
              onClick={() =>
                review.mutate({ id: request.id, status: "Resolved" })
              }
            >
              Resolve locally
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
