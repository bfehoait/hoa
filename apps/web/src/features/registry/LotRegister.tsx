import { lazy, Suspense, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  Download,
  FileText,
  House,
  Search,
  ShieldCheck,
  Users,
  Plus,
} from "lucide-react";
import { z } from "zod";
import {
  type Lot,
  type LotDetail,
  type ReceiptPage,
  receiptPageSchema,
  receiptCsv,
} from "../../../../../packages/shared/src/registry";
import {
  hasCapability,
  type Capability,
} from "../../../../../packages/shared/src/permissions";
import { money } from "../../../../../packages/shared/src";
import { useAuth, makeClient } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import {
  useLots,
  useLot,
  useReceipts,
  useRegistryAction,
  registryError,
} from "../../data/registry";
import { downloadCsv } from "../../data/download";
import { useLinkedPropertyAddress } from "../../data/linked-properties";
import { Link } from "../../components/AccessLink";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./LotRegister.module.css";
import PayDues from "../account/PayDues";
const PropertyBusinessDetails = lazy(() => import("./PropertyBusinessDetails"));
const CollectionCharts = lazy(() => import("../office/CollectionCharts"));

const sampleId = "65000000-0000-4000-8000-000000000001";
const example: Lot = {
  id: sampleId,
  physical_id: "1-01-001",
  phase: 1,
  block: 1,
  lot: 1,
  admin_unit: "SYNTHETIC-001",
  registry_status: "Synthetic record",
  recorded_homeowner: "Sample homeowner",
  review_priority: "MEDIUM",
  version: 1,
};
function useAccess() {
  const auth = useAuth(),
    permissions = usePermissions();
  const sample = auth.preview || !!auth.rolePreview;
  const can = (
    module: Capability["module"],
    action: Capability["action"],
    scope: Capability["scope"] = "association",
  ) => !sample && hasCapability(permissions.data, { module, action, scope });
  return { sample, can };
}
export default function LotRegister({
  office = false,
  account = false,
  embedded = false,
}: {
  office?: boolean;
  account?: boolean;
  embedded?: boolean;
}) {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  const path = useParams()["*"] ?? "";
  const id = account ? (path.startsWith("lots/") ? path.slice(5) : "") : path;
  const root = office
    ? "/office/lots"
    : account
      ? "/account/lots"
      : "/more/lots";
  if (id) return <LotProfile key={id} id={id} root={root} />;
  if (!office && !sample)
    return <LinkedLotList root={root} embedded={embedded} />;
  return <LotList root={root} office={office} embedded={embedded} />;
}

// Customer lists come only from the account's current approved links. A failed
// link check must never become an unlinked state or a registry-search fallback.
function LinkedLotList({
  root,
  embedded,
}: {
  root: string;
  embedded: boolean;
}) {
  const links = useLinkedPropertyAddress(true, true);
  const [claim, setClaim] = useState(false);
  const ready = links.isSuccess && !links.isError;
  return (
    <>
      {!embedded && (
        <PageIntro
          title="Your lots"
          description="Your approved property links and permitted receipt history."
          icon={<Building2 size={28} />}
        />
      )}
      {links.isPending && <Skeleton />}
      {links.isError && (
        <>
          <Feedback error={links.error} />
          <Button
            secondary
            pending={links.isFetching}
            onClick={() => void links.refetch()}
          >
            Try again
          </Button>
        </>
      )}
      {ready &&
        (links.properties.length ? (
          <>
            <div className={`${styles.list} ${styles.linkedList}`}>
              {links.properties.map((property) => (
                <Link
                  key={property.lot_id}
                  to={`${root}/${property.lot_id}`}
                  className={`${styles.card} ${styles.linkedCard}`}
                >
                  <div className={styles.identity}>
                    <span className={styles.propertyIcon}>
                      <House size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <h2>{property.physical_id}</h2>
                      <p className={styles.note}>
                        Phase {property.phase} · Block {property.block} · Lot{" "}
                        {property.lot} ·{" "}
                        {property.relationships
                          .map(
                            (relationship) =>
                              ({
                                owner: "Homeowner",
                                renter: "Renter",
                                household: "Household member",
                              })[relationship],
                          )
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <Button
              secondary
              className={styles.linkAnother}
              onClick={() => setClaim(true)}
            >
              <Plus size={18} aria-hidden="true" />
              Link another property
            </Button>
          </>
        ) : (
          <div className={`${styles.panel} ${styles.empty}`}>
            <House size={36} aria-hidden="true" />
            <h2>No linked property yet</h2>
            <p>
              Request a link to your lot. The office must verify it before
              property records become available.
            </p>
            <Button onClick={() => setClaim(true)}>Request a lot link</Button>
          </div>
        ))}
      {claim && <ClaimDialog onClose={() => setClaim(false)} />}
    </>
  );
}

function LotList({
  root,
  office,
  embedded = false,
}: {
  root: string;
  office: boolean;
  embedded?: boolean;
}) {
  const { sample, can } = useAccess();
  const ownLinks = useLinkedPropertyAddress(!office);
  const linkLabel = ownLinks.properties.length
    ? "Link another property"
    : "Request a lot link";
  const [searchParams] = useSearchParams();
  const initialSearch = (searchParams.get("search") ?? "").slice(0, 100);
  const [draft, setDraft] = useState(initialSearch);
  const [filter, setFilter] = useState({
    p_search: initialSearch,
    p_phase: 0,
    p_status: "",
    p_review: "",
    p_page: 0,
  });
  const [claim, setClaim] = useState(false);
  const query = useLots(filter);
  const data = sample
    ? { rows: [example], total: 1 }
    : query.isError
      ? undefined
      : query.data;
  return (
    <>
      {embedded ? (
        <div className="section-title">
          <h2>Property records</h2>
          <Button secondary onClick={() => setClaim(true)}>
            {linkLabel}
          </Button>
        </div>
      ) : (
        <PageIntro
          eyebrow={sample ? "SYNTHETIC PREVIEW" : "PROPERTY RECORDS"}
          title={office ? "Lot register" : "Your lots"}
          icon={<Building2 size={28} />}
          description={
            office
              ? "Find a property and review its linked records."
              : "Your approved property links and permitted receipt history."
          }
          action={
            !office ? (
              <Button onClick={() => setClaim(true)}>{linkLabel}</Button>
            ) : undefined
          }
        />
      )}
      {sample && <Badge tone="amber">Synthetic records only</Badge>}
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setFilter({ ...filter, p_search: draft, p_page: 0 });
        }}
      >
        <label>
          Find a lot
          <input
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              can("property", "view")
                ? "Lot ID, unit or recorded homeowner"
                : "Physical lot ID or unit"
            }
          />
        </label>
        {!embedded && (
          <label>
            Phase
            <select
              value={filter.p_phase}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  p_phase: Number(e.target.value),
                  p_page: 0,
                })
              }
            >
              <option value={0}>All phases</option>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  Phase {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {!embedded && (
          <label>
            Registry status
            <input
              value={filter.p_status}
              maxLength={100}
              placeholder="All statuses"
              onChange={(e) =>
                setFilter({ ...filter, p_status: e.target.value, p_page: 0 })
              }
            />
          </label>
        )}
        {!embedded && can("property", "view") && (
          <label>
            Review priority
            <select
              value={filter.p_review}
              onChange={(e) =>
                setFilter({ ...filter, p_review: e.target.value, p_page: 0 })
              }
            >
              <option value="">All priorities</option>
              {["LOW", "MEDIUM", "HIGH"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit">
          <Search size={20} />
          Search
        </Button>
      </form>
      {!sample && query.isPending && <Skeleton />}
      <Feedback error={query.error} />
      {!sample && query.isError && (
        <Button secondary onClick={() => void query.refetch()}>
          Retry connection
        </Button>
      )}
      {data && (
        <>
          {(office || data.total > 0) && (
            <p className={styles.note}>
              {data.total} {office ? "matching lots" : "properties"}
            </p>
          )}
          {office && (
            <nav className={styles.actions} aria-label="Lot pages">
              <span>
                {data.rows.length
                  ? `Showing ${filter.p_page * 20 + 1}–${filter.p_page * 20 + data.rows.length} of ${data.total} lots`
                  : `${data.total} matching lots`}
              </span>
              <Button
                secondary
                disabled={!filter.p_page || query.isFetching}
                onClick={() =>
                  setFilter({ ...filter, p_page: filter.p_page - 1 })
                }
              >
                Previous
              </Button>
              <span>
                Page {filter.p_page + 1} of{" "}
                {Math.max(1, Math.ceil(data.total / 20))}
              </span>
              <Button
                secondary
                disabled={
                  (filter.p_page + 1) * 20 >= data.total || query.isFetching
                }
                onClick={() =>
                  setFilter({ ...filter, p_page: filter.p_page + 1 })
                }
              >
                Next
              </Button>
            </nav>
          )}
          <div className={styles.list}>
            {data.rows.map((l) => (
              <Link className={styles.card} key={l.id} to={`${root}/${l.id}`}>
                <div className={styles.identity}>
                  <House size={24} />
                  <div>
                    <h2>{l.physical_id}</h2>
                    <span>
                      Phase {l.phase} · Block {l.block} · Lot {l.lot}
                    </span>
                  </div>
                </div>
                <div>
                  <span>
                    {l.recorded_homeowner === null
                      ? "Recorded name restricted"
                      : l.recorded_homeowner || "Homeowner name not supplied"}
                  </span>
                  <p className={styles.note}>{l.admin_unit}</p>
                </div>
                <div>
                  <Badge>{l.registry_status}</Badge>
                  {l.recorded_homeowner && (
                    <p className={styles.note}>
                      Recorded name; ownership needs verification
                    </p>
                  )}
                </div>
                <ChevronRight size={20} />
              </Link>
            ))}
          </div>
          {data.rows.length === 0 && (
            <div className={`${styles.panel} ${styles.empty}`}>
              <House size={36} />
              <h2>
                {office ? "No matching lots" : "No approved lot links yet"}
              </h2>
              <p>
                {office
                  ? "An approved import must be installed before records appear here."
                  : "Request a link using the physical lot ID. The office must verify it before records become available."}
              </p>
            </div>
          )}
          {!office && data.total > 20 && (
            <div className={styles.actions}>
              <Button
                secondary
                disabled={filter.p_page === 0}
                onClick={() =>
                  setFilter({ ...filter, p_page: filter.p_page - 1 })
                }
              >
                Previous
              </Button>
              <span>Page {filter.p_page + 1}</span>
              <Button
                secondary
                disabled={(filter.p_page + 1) * 20 >= data.total}
                onClick={() =>
                  setFilter({ ...filter, p_page: filter.p_page + 1 })
                }
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {claim && <ClaimDialog onClose={() => setClaim(false)} />}
    </>
  );
}
export function LotLinkButton({ another = false }: { another?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button secondary onClick={() => setOpen(true)}>
        <Plus size={18} aria-hidden="true" />
        {another ? "Link another property" : "Request a lot link"}
      </Button>
      {open && <ClaimDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ClaimDialog({ onClose }: { onClose: () => void }) {
  const action = useRegistryAction();
  const [done, setDone] = useState(false);
  return (
    <Modal title="Request a lot link" onClose={onClose} busy={action.isPending}>
      {done ? (
        <>
          <p>
            Your request was processed. The office must check the lot reference
            and verify your relationship before access is granted.
          </p>
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action.mutate(
              {
                name: "bfe_claim_lot",
                args: {
                  p_physical_id: f.get("lot"),
                  p_relationship: f.get("relationship"),
                },
              },
              { onSuccess: () => setDone(true) },
            );
          }}
        >
          <p>
            A physical lot ID is a reference, not proof of ownership. No access
            is granted by this request.
          </p>
          <label>
            Physical lot ID
            <input
              name="lot"
              required
              pattern="[1-9][0-9]*-[0-9]{2}-[0-9]{3}"
              placeholder="1-01-001"
            />
          </label>
          <label>
            Your relationship
            <select name="relationship">
              <option value="owner">Homeowner</option>
              <option value="renter">Renter</option>
              <option value="household">Household member</option>
            </select>
          </label>
          <Feedback error={action.error} />
          <Button type="submit" pending={action.isPending}>
            Request verification
          </Button>
        </form>
      )}
    </Modal>
  );
}
function registryDate(value: string, includeTime = false) {
  const date = new Date(
    value.length === 10 ? `${value}T00:00:00+08:00` : value,
  );
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Manila",
  }).format(date);
}

function auditValue(value: unknown): string {
  if (value === null || value === undefined || value === "")
    return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return registryDate(value, true);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function LotProfile({ id, root }: { id: string; root: string }) {
  const { sample, can } = useAccess();
  const query = useLot(id);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(
    searchParams.get("section") === "receipts" ? "Receipts" : "Overview",
  );
  const [correct, setCorrect] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const data: LotDetail | undefined =
    sample && id === sampleId
      ? {
          ...example,
          original_homeowner: "Sample homeowner",
          evidence: {
            "HOA Eligibility (provisional)": "Synthetic; unverified",
            "Verified Monthly Rate": null,
          },
          memberships: [],
          history: [],
          source: {
            batch_id: sampleId,
            imported_at: "2026-01-01T00:00:00Z",
            source_name: "Synthetic preview",
          },
        }
      : query.isError
        ? undefined
        : query.data;
  if (!z.uuid().safeParse(id).success)
    return (
      <>
        <PageIntro eyebrow="PROPERTY" title="Lot unavailable" />
        <Link to={root}>Back to lots</Link>
      </>
    );
  return (
    <article className={styles.profile}>
      <Link to={root} className="text-link" data-page-back>
        ← Back to {root.startsWith("/office") ? "lot register" : "your lots"}
      </Link>
      <PageIntro
        eyebrow={sample ? "SYNTHETIC LOT PROFILE" : "LOT PROFILE"}
        title={data?.physical_id ?? "Property records"}
        icon={<House size={28} />}
        description="Property information, approved account links and permitted receipts."
      />
      {!sample && query.isPending && <Skeleton />}
      <Feedback error={query.error} />
      {query.isError && (
        <Button secondary onClick={() => void query.refetch()}>
          Retry connection
        </Button>
      )}
      {data && (
        <>
          <div
            className={styles.profileTabs}
            role="group"
            aria-label="Lot sections"
          >
            {[
              "Overview",
              "People",
              "Receipts",
              ...(data.evidence ? ["Review", "History"] : []),
            ].map((t) => (
              <button
                type="button"
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Overview" && (
            <section className={styles.panel}>
              <h2>Property details</h2>
              <dl>
                <div>
                  <dt>Phase / block / lot</dt>
                  <dd>
                    {data.phase} / {data.block} / {data.lot}
                  </dd>
                </div>
                <div>
                  <dt>Admin unit reference</dt>
                  <dd>{data.admin_unit}</dd>
                </div>
                <div>
                  <dt>Registry status</dt>
                  <dd>{data.registry_status}</dd>
                </div>
                {data.recorded_homeowner !== null && (
                  <div>
                    <dt>Recorded homeowner · verification pending</dt>
                    <dd>{data.recorded_homeowner || "Not supplied"}</dd>
                  </div>
                )}
                <div>
                  <dt>Billing and balance</dt>
                  <dd>Unavailable — approved billing records required</dd>
                </div>
              </dl>
              {can("property", "manage") && (
                <div className={styles.actions}>
                  <Button secondary onClick={() => setCorrect(true)}>
                    Correct recorded name
                  </Button>
                </div>
              )}
              <p className={styles.note}>
                Changing a recorded name does not approve ownership or transfer
                account access.
              </p>
              {data.evidence && (
                <p>
                  Imported receipt transactions:{" "}
                  {typeof data.evidence["Agency Receipt Transactions"] ===
                  "number"
                    ? data.evidence["Agency Receipt Transactions"]
                    : "Unavailable"}
                  . Open Receipts for permitted transactions and Review for all
                  supplied workbook fields.
                </p>
              )}
            </section>
          )}
          {tab === "Overview" && !sample && root.startsWith("/office") && (
            <Suspense fallback={<Skeleton />}>
              <PropertyBusinessDetails lotId={id} />
            </Suspense>
          )}
          {tab === "People" && (
            <section className={styles.panel}>
              <h2>Linked accounts and claims</h2>
              <p className={styles.note}>
                Only approved, current relationships permit access. BOD or staff
                roles do not establish ownership.
              </p>
              {data.memberships.length === 0 ? (
                <p>No visible account links or pending claims.</p>
              ) : (
                data.memberships.map((m) => (
                  <div className={styles.linkedMember} key={m.id}>
                    <div>
                      <strong>{m.name || "Linked account"}</strong>
                      <p>
                        {
                          {
                            owner: "Owner",
                            renter: "Renter",
                            household: "Household member",
                          }[m.relationship]
                        }{" "}
                        ·{" "}
                        <Badge>
                          {m.state.charAt(0).toUpperCase() + m.state.slice(1)}
                        </Badge>
                      </p>
                      <p className={styles.note}>
                        From {registryDate(m.starts_at)} ·{" "}
                        {m.expires_at
                          ? `Until ${registryDate(m.expires_at)}`
                          : "No expiry recorded"}
                      </p>
                    </div>
                    {can("property", "manage") &&
                      ["pending", "approved"].includes(m.state) && (
                        <Button secondary onClick={() => setReview(m.id)}>
                          Review account link
                        </Button>
                      )}
                  </div>
                ))
              )}
            </section>
          )}
          {tab === "Overview" && !root.startsWith("/office") && (
            <PayDues phase={data.phase} block={data.block} lot={data.lot} />
          )}
          {tab === "Receipts" && (
            <ReceiptPanel
              lot={id}
              memberships={data.memberships}
              sourceReceiptCount={
                data.evidence?.["Agency Receipt Transactions"]
              }
            />
          )}
          {tab === "Review" && data.evidence && (
            <section className={styles.panel}>
              <h2>Source evidence and review</h2>
              <p>
                Proposed rates, indicative differences and provisional
                eligibility are not verified charges.
              </p>
              <p className={styles.note}>
                Original recorded homeowner:{" "}
                {data.original_homeowner || "Not supplied"}
              </p>
              <div className={styles.evidence}>
                {Object.entries(data.evidence).map(([k, v]) => (
                  <div key={k}>
                    <strong>{k.trim()}</strong>
                    <span>
                      {v === null || v === "" ? "Not supplied" : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === "History" && (
            <section className={styles.panel}>
              <h2>Record history</h2>
              <div className={styles.sourceSummary}>
                <strong>{data.source.source_name || "Imported source"}</strong>
                <span className={styles.note}>
                  Imported {registryDate(data.source.imported_at)} · Philippine
                  time
                </span>
                <details>
                  <summary>Import reference</summary>
                  <p className={styles.note}>Batch {data.source.batch_id}</p>
                </details>
              </div>
              {data.history.length === 0 ? (
                <p>No audit entries are available under your current access.</p>
              ) : (
                <ol
                  className={styles.timeline}
                  aria-label="Property audit history"
                >
                  {data.history.map((h, i) => (
                    <li key={i}>
                      <div className={styles.historyHeading}>
                        <strong>{h.action}</strong>
                        <time dateTime={h.at}>{registryDate(h.at, true)}</time>
                      </div>
                      <p className={styles.note}>By {h.actor_label}</p>
                      {typeof h.details.reference === "string" && (
                        <p>Reference: {h.details.reference}</p>
                      )}
                      {Object.keys(h.details).length > 0 && (
                        <details className={styles.auditDetails}>
                          <summary>Change details</summary>
                          <dl>
                            {Object.entries(h.details).map(([key, value]) => (
                              <div key={key}>
                                <dt>
                                  {key
                                    .replace(/_/g, " ")
                                    .replace(/^./, (letter) =>
                                      letter.toUpperCase(),
                                    )}
                                </dt>
                                <dd>{auditValue(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          {correct && (
            <OperationDialog
              title="Correct recorded homeowner"
              onClose={() => setCorrect(false)}
              name="bfe_correct_homeowner"
              base={{ p_lot: id, p_expected: data.version }}
            >
              <p>
                Preserves the source name and audit history. Account links are
                unchanged.
              </p>
              <label>
                Corrected recorded name
                <input
                  name="p_name"
                  maxLength={500}
                  required
                  defaultValue={data.recorded_homeowner ?? ""}
                />
              </label>
            </OperationDialog>
          )}
          {review && (
            <OperationDialog
              title="Review account link"
              onClose={() => setReview(null)}
              name="bfe_review_lot_membership"
              base={{ p_membership: review }}
            >
              <p>
                Check ownership or occupancy evidence. You cannot approve your
                own link.
              </p>
              <label>
                Decision
                <select name="p_state">
                  {data.memberships.find((m) => m.id === review)?.state ===
                  "pending" ? (
                    <>
                      <option value="approved">
                        Approve verified relationship
                      </option>
                      <option value="rejected">Reject claim</option>
                    </>
                  ) : (
                    <option value="revoked">Revoke access</option>
                  )}
                </select>
              </label>
              <label>
                Expiry (optional)
                <input name="p_expires" type="datetime-local" />
              </label>
            </OperationDialog>
          )}
        </>
      )}
    </article>
  );
}
function OperationDialog({
  title,
  name,
  base,
  children,
  onClose,
}: {
  title: string;
  name: string;
  base: Record<string, unknown>;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const action = useRegistryAction();
  return (
    <Modal title={title} onClose={onClose} busy={action.isPending}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          const args: Record<string, unknown> = { ...base, ...values };
          if ("p_expires" in args)
            args.p_expires = args.p_expires
              ? new Date(String(args.p_expires)).toISOString()
              : null;
          if ("p_revoke" in args) args.p_revoke = args.p_revoke === "true";
          action.mutate({ name, args }, { onSuccess: onClose });
        }}
      >
        <fieldset disabled={action.isPending} className={styles.form}>
          {children}
          <label>
            Verification / approval reference
            <input
              name="p_reference"
              required
              minLength={3}
              maxLength={200}
              placeholder="Reference to the reviewed evidence"
            />
          </label>
          <Feedback error={action.error} />
          <Button type="submit" pending={action.isPending}>
            Save verified change
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
export function ReceiptPanel({
  lot = null,
  memberships = [],
  sourceReceiptCount,
  dashboard = false,
}: {
  lot?: string | null;
  memberships?: LotDetail["memberships"];
  sourceReceiptCount?: unknown;
  dashboard?: boolean;
}) {
  const office = useLocation().pathname.startsWith("/office");
  const { sample, can } = useAccess();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [entitle, setEntitle] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [receiptDetail, setReceiptDetail] = useState<
    ReceiptPage["rows"][number] | null
  >(null);
  const monthEnd = selectedMonth
    ? new Date(
        Date.UTC(
          Number(selectedMonth.slice(0, 4)),
          Number(selectedMonth.slice(5, 7)),
          0,
        ),
      ).getUTCDate()
    : 0;
  const selectedFrom = selectedMonth ? `${selectedMonth}-01` : "";
  const selectedTo = selectedMonth
    ? `${selectedMonth}-${String(monthEnd).padStart(2, "0")}`
    : "";
  const requestFrom =
    dashboard && selectedMonth
      ? from && from > selectedFrom
        ? from
        : selectedFrom
      : from;
  const requestTo =
    dashboard && selectedMonth ? (to && to < selectedTo ? to : selectedTo) : to;
  const validRange = !from || !to || from <= to;
  const overviewQuery = useReceipts(
    {
      p_lot: lot,
      p_from: from || null,
      p_to: to || null,
      p_page: 0,
      p_export: false,
    },
    dashboard && validRange,
  );
  const query = useReceipts(
    {
      p_lot: lot,
      p_from: requestFrom || null,
      p_to: requestTo || null,
      p_page: page,
      p_export: false,
    },
    validRange,
  );
  const data = sample
    ? {
        rows: [],
        total: 0,
        total_centavos: 0,
        monthly: [],
        phases: [],
        lots: [],
      }
    : query.isError
      ? undefined
      : query.data;
  const owners = memberships.filter(
    (m) => m.relationship === "owner" && m.state === "approved",
  );
  async function exportRows() {
    setExporting(true);
    setError(null);
    try {
      const api = makeClient();
      if (!api || sample)
        throw new Error("Real exports are unavailable in a role preview.");
      const args = {
        p_lot: lot,
        p_from: requestFrom || null,
        p_to: requestTo || null,
        p_export: true,
      };
      const first = await api.rpc("bfe_lot_receipts", { ...args, p_page: 0 });
      registryError(first.error);
      const all = receiptPageSchema.parse(first.data);
      for (let n = 1; n < Math.ceil(all.total / 500); n++) {
        const next = await api.rpc("bfe_lot_receipts", { ...args, p_page: n });
        registryError(next.error);
        const p = receiptPageSchema.parse(next.data);
        if (p.total !== all.total || p.total_centavos !== all.total_centavos)
          throw new Error("Receipts changed during export. Try again.");
        all.rows.push(...p.rows);
      }
      if (
        all.rows.length !== all.total ||
        new Set(all.rows.map((r) => r.id)).size !== all.total ||
        all.rows.reduce((s, r) => s + r.amount_centavos, 0) !==
          all.total_centavos
      )
        throw new Error(
          "Export reconciliation failed. Refresh before retrying.",
        );
      downloadCsv(
        `Bellefort-recorded-collections-${requestFrom || "start"}-${requestTo || "latest"}.csv`,
        receiptCsv(all, requestFrom, requestTo),
      );
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Export unavailable."));
    } finally {
      setExporting(false);
    }
  }
  const max = Math.max(
    1,
    ...(data?.monthly.map((m) => m.amount_centavos) ?? []),
  );
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat("en-PH", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`));
  return (
    <section
      className={dashboard ? styles.financePanel : styles.panel}
      aria-busy={query.isFetching || (dashboard && overviewQuery.isFetching)}
    >
      <h2>
        {dashboard ? "Collections overview" : "Receipts & monthly totals"}
      </h2>
      <p className={styles.note}>
        Imported receipts, not bills or bank-cleared payments. Visibility
        follows your current household relationships and receipt permissions.
      </p>
      <fieldset disabled={exporting} className={styles.toolbar}>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setSelectedMonth("");
              setPage(0);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setSelectedMonth("");
              setPage(0);
            }}
          />
        </label>
        {can("finance", "export") && (
          <Button
            pending={exporting}
            disabled={!validRange}
            onClick={() => void exportRows()}
          >
            <Download size={20} />
            Download CSV
          </Button>
        )}
        {office && (from || to) && (
          <Button
            secondary
            onClick={() => {
              setFrom("");
              setTo("");
              setSelectedMonth("");
              setPage(0);
            }}
          >
            Clear dates
          </Button>
        )}
      </fieldset>
      {dashboard &&
        !sample &&
        validRange &&
        (overviewQuery.isPending ? (
          <Skeleton />
        ) : overviewQuery.isError ? (
          <>
            <Feedback error={overviewQuery.error} />
            <Button secondary onClick={() => void overviewQuery.refetch()}>
              Retry overview
            </Button>
          </>
        ) : (
          overviewQuery.data && (
            <Suspense fallback={<Skeleton />}>
              <CollectionCharts
                data={overviewQuery.data}
                selected={selectedMonth}
                disabled={exporting}
                onSelect={(month) => {
                  setSelectedMonth(month);
                  setPage(0);
                }}
              />
            </Suspense>
          )
        ))}
      {from && to && from > to && (
        <p role="alert">Choose an end date on or after the start date.</p>
      )}
      {sample ? (
        <p>Synthetic preview. No imported receipts are loaded here.</p>
      ) : query.isPending && validRange ? (
        <Skeleton />
      ) : null}
      <Feedback error={query.error ?? error} />
      {dashboard && query.isError && (
        <Button secondary onClick={() => void query.refetch()}>
          Retry receipts
        </Button>
      )}
      {data && (
        <>
          {!dashboard && (
            <div className={styles.metrics}>
              <div>
                Visible receipts<strong>{data.total}</strong>
              </div>
              <div>
                Recorded amount<strong>{money(data.total_centavos)}</strong>
              </div>
            </div>
          )}
          {dashboard && (
            <div className={styles.financeRecordsHeading}>
              <div>
                <h3>Receipt records</h3>
                <p className={styles.note}>
                  {selectedMonth
                    ? `Filtered to ${monthLabel(selectedMonth)} within your date range`
                    : "All receipts in your date range"}
                </p>
              </div>
              {selectedMonth && (
                <Button
                  secondary
                  disabled={exporting}
                  onClick={() => {
                    setSelectedMonth("");
                    setPage(0);
                  }}
                >
                  Show all months
                </Button>
              )}
            </div>
          )}
          {!dashboard && data.monthly.length > 0 && (
            <div aria-label="Monthly recorded collections">
              {office && <h3>Recorded collections by month</h3>}
              {office && (
                <p className={styles.note}>
                  Select a month to filter receipts. Bar length compares
                  recorded amounts with the largest month shown; it does not
                  indicate unpaid balances.
                </p>
              )}
              {office ? (
                <div className={styles.monthGrid}>
                  {data.monthly.map((m) => (
                    <button
                      type="button"
                      className={styles.monthFilter}
                      key={m.month}
                      aria-label={`Show receipts for ${monthLabel(m.month)}`}
                      onClick={() => {
                        const last = new Date(
                          Date.UTC(
                            Number(m.month.slice(0, 4)),
                            Number(m.month.slice(5, 7)),
                            0,
                          ),
                        ).getUTCDate();
                        setFrom(`${m.month}-01`);
                        setTo(`${m.month}-${last}`);
                        setPage(0);
                      }}
                    >
                      <strong>{monthLabel(m.month)}</strong>
                      <span>
                        {money(m.amount_centavos)} · {m.count} receipts
                      </span>
                      <span className={styles.bar} aria-hidden="true">
                        <span
                          style={{
                            width: `${(m.amount_centavos / max) * 100}%`,
                          }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {data.monthly.map((m) => (
                    <div key={m.month}>
                      <strong>{m.month}</strong> · {money(m.amount_centavos)} ·{" "}
                      {m.count} receipts
                      <div className={styles.bar} aria-hidden="true">
                        <span
                          style={{
                            width: `${(m.amount_centavos / max) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {!dashboard && data.phases.length > 0 && (
            <details>
              <summary>Totals by phase and lot</summary>
              {data.phases.map((p) => (
                <p key={p.phase}>
                  Phase {p.phase}: {money(p.amount_centavos)} · {p.count}{" "}
                  receipts
                </p>
              ))}
              {data.lots.map((l) => (
                <p key={l.physical_id}>
                  <Link
                    className={styles.lotLink}
                    to={`/more/lots?search=${encodeURIComponent(l.physical_id)}`}
                  >
                    {l.physical_id}
                  </Link>
                  : {money(l.amount_centavos)} · {l.count} receipts
                </p>
              ))}
            </details>
          )}
          {data.rows.length === 0 && !sample && (
            <div className={styles.empty}>
              <FileText size={32} />
              <h3>
                {lot &&
                !from &&
                !to &&
                sourceReceiptCount === 0 &&
                can("finance", "view")
                  ? "No receipts supplied for this lot"
                  : "No permitted receipts in this period"}
              </h3>
              <p>
                This does not establish that the lot has no payments or
                outstanding charges.
              </p>
            </div>
          )}
          {office && (
            <p>
              {data.total
                ? `Showing ${page * 20 + 1}–${Math.min(page * 20 + data.rows.length, data.total)} of ${data.total} receipts`
                : "0 receipts"}
            </p>
          )}
          {office && (
            <nav className={styles.actions} aria-label="Receipt pages">
              <Button
                secondary
                disabled={!page || exporting || query.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page + 1} of {Math.max(1, Math.ceil(data.total / 20))}
              </span>
              <Button
                secondary
                disabled={
                  (page + 1) * 20 >= data.total || exporting || query.isFetching
                }
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </nav>
          )}
          {office ? (
            <div className="table-wrap">
              <table
                className={styles.receiptTable}
                aria-label="Recorded receipts"
              >
                <thead>
                  <tr>
                    <th scope="col">Receipt</th>
                    <th scope="col">Date</th>
                    <th scope="col">Lot</th>
                    <th scope="col">Recorded payer</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Source</th>
                    {can("finance", "approve") && owners.length > 0 && (
                      <th scope="col">Access</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        {dashboard ? (
                          <button
                            type="button"
                            className={styles.receiptOpen}
                            onClick={() => setReceiptDetail(r)}
                          >
                            OR {r.or_number}
                          </button>
                        ) : (
                          <>OR {r.or_number}</>
                        )}
                      </th>
                      <td>
                        {dashboard
                          ? registryDate(r.receipt_date)
                          : r.receipt_date}
                      </td>
                      <td>
                        {can("property", "view") ? (
                          <Link
                            className={styles.lotLink}
                            to={`/office/lots/${r.lot_id}?section=receipts`}
                          >
                            {r.physical_id}
                          </Link>
                        ) : (
                          r.physical_id
                        )}
                      </td>
                      <td>{r.payer}</td>
                      <td className={styles.amount}>
                        {money(r.amount_centavos)}
                      </td>
                      <td>
                        {r.source_file}
                        <small className={styles.sourceAccount}>
                          Account: {r.account_series}
                        </small>
                      </td>
                      {can("finance", "approve") && owners.length > 0 && (
                        <td>
                          <Button secondary onClick={() => setEntitle(r.id)}>
                            Receipt access
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            data.rows.map((r) => (
              <div className={styles.receipt} key={r.id}>
                <div>
                  <strong>OR {r.or_number}</strong>
                  <p>{r.receipt_date}</p>
                </div>
                <div>
                  <strong>{money(r.amount_centavos)}</strong>
                  <p>
                    <Link
                      className={styles.lotLink}
                      to={`/more/lots/${r.lot_id}?section=receipts`}
                    >
                      {r.physical_id}
                    </Link>
                  </p>
                </div>
                <div>
                  {r.payer}
                  <p className={styles.note}>Account: {r.account_series}</p>
                  <p className={styles.note}>{r.source_file}</p>
                </div>
                {can("finance", "approve") && owners.length > 0 && (
                  <Button secondary onClick={() => setEntitle(r.id)}>
                    <ShieldCheck size={20} />
                    Receipt access
                  </Button>
                )}
              </div>
            ))
          )}
          {!office && (
            <div className={styles.actions}>
              <Button
                secondary
                disabled={page === 0 || exporting}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>Page {page + 1}</span>
              <Button
                secondary
                disabled={(page + 1) * 20 >= data.total || exporting}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {dashboard && receiptDetail && (
        <Modal
          title={`Receipt ${receiptDetail.or_number}`}
          onClose={() => setReceiptDetail(null)}
        >
          <p className={styles.note}>
            Imported receipt evidence. This record does not establish bank
            clearance or a current balance.
          </p>
          <dl className={styles.receiptDetail}>
            <div>
              <dt>Recorded amount</dt>
              <dd>{money(receiptDetail.amount_centavos)}</dd>
            </div>
            <div>
              <dt>Receipt date</dt>
              <dd>{registryDate(receiptDetail.receipt_date)}</dd>
            </div>
            <div>
              <dt>Property</dt>
              <dd>{receiptDetail.physical_id}</dd>
            </div>
            <div>
              <dt>Recorded payer</dt>
              <dd>{receiptDetail.payer || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Account series</dt>
              <dd>{receiptDetail.account_series || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{receiptDetail.source_file || "Not supplied"}</dd>
            </div>
          </dl>
        </Modal>
      )}
      {entitle && (
        <OperationDialog
          title="Historical receipt access"
          name="bfe_entitle_receipt"
          base={{ p_receipt: entitle }}
          onClose={() => setEntitle(null)}
        >
          <p>
            Verify the selected owner's entitlement to this specific receipt
            before granting access.
          </p>
          <label>
            Approved owner link
            <select name="p_membership">
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.user_id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Decision
            <select name="p_revoke">
              <option value="false">Grant verified entitlement</option>
              <option value="true">Revoke entitlement</option>
            </select>
          </label>
        </OperationDialog>
      )}
    </section>
  );
}
export function Collections() {
  return (
    <>
      <PageIntro
        eyebrow="FINANCE"
        title="Recorded collections"
        description="Imported receipts, grouped by receipt date."
        icon={<Users size={28} />}
      />
      <ReceiptPanel />
    </>
  );
}
