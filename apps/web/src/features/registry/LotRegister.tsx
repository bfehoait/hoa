import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  Download,
  FileText,
  House,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { z } from "zod";
import {
  type Lot,
  type LotDetail,
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
}: {
  office?: boolean;
  account?: boolean;
}) {
  const path = useParams()["*"] ?? "";
  const id = account ? (path.startsWith("lots/") ? path.slice(5) : "") : path;
  const root = office
    ? "/office/lots"
    : account
      ? "/account/lots"
      : "/more/lots";
  if (id) return <LotProfile key={id} id={id} root={root} />;
  return <LotList root={root} office={office} />;
}
function LotList({ root, office }: { root: string; office: boolean }) {
  const { sample, can } = useAccess();
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
            <Button onClick={() => setClaim(true)}>Request a lot link</Button>
          ) : undefined
        }
      />
      {sample && <Badge tone="amber">Synthetic records only</Badge>}
      {office && (
        <div className={styles.actions}>
          <Link to="/office/residents" className="text-link">
            Member directory
          </Link>
          <Link to="/office/registry" className="text-link">
            Property change drafts
          </Link>
        </div>
      )}
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
        {can("property", "view") && (
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
          <p className={styles.note}>
            {data.total} matching {office ? "lots" : "permitted lots"}
          </p>
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
        </>
      )}
      {claim && <ClaimDialog onClose={() => setClaim(false)} />}
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
    <>
      <Link to={root} className="text-link">
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
          <div className={styles.tabs} aria-label="Lot sections">
            {[
              "Overview",
              "People",
              "Receipts",
              ...(data.evidence ? ["Review", "History"] : []),
            ].map((t) => (
              <Button
                key={t}
                secondary={tab !== t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          {tab === "Overview" && (
            <section className={styles.panel}>
              <h2>Property overview</h2>
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
                  <div className={styles.member} key={m.id}>
                    <strong>{m.name || "Linked account"}</strong>
                    <p>
                      {m.relationship} · <Badge>{m.state}</Badge>
                    </p>
                    <p className={styles.note}>
                      From {m.starts_at.slice(0, 10)} ·{" "}
                      {m.expires_at
                        ? `Until ${m.expires_at.slice(0, 10)}`
                        : "No expiry recorded"}
                    </p>
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
          {tab === "Overview" && (
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
              <h2>Provenance and history</h2>
              <p>
                {data.source.source_name || "Imported source"} ·{" "}
                {data.source.imported_at.slice(0, 10)}
              </p>
              <p className={styles.note}>Batch {data.source.batch_id}</p>
              {data.history.length === 0 ? (
                <p>No audit entries are available under your current access.</p>
              ) : (
                data.history.map((h, i) => (
                  <div className={styles.member} key={i}>
                    <strong>{h.action}</strong>
                    <p>
                      {h.actor_label} · {h.at}
                    </p>
                    <p className={styles.note}>{JSON.stringify(h.details)}</p>
                  </div>
                ))
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
    </>
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
}: {
  lot?: string | null;
  memberships?: LotDetail["memberships"];
  sourceReceiptCount?: unknown;
}) {
  const { sample, can } = useAccess();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [entitle, setEntitle] = useState<string | null>(null);
  const query = useReceipts(
    {
      p_lot: lot,
      p_from: from || null,
      p_to: to || null,
      p_page: page,
      p_export: false,
    },
    !from || !to || from <= to,
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
        p_from: from || null,
        p_to: to || null,
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
        `Bellefort-recorded-collections-${from || "start"}-${to || "latest"}.csv`,
        receiptCsv(all, from, to),
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
  return (
    <section className={styles.panel}>
      <h2>Receipts & monthly totals</h2>
      <p className={styles.note}>
        Imported receipts, not bills or bank-cleared payments. Residents see
        only receipts approved for their account.
      </p>
      <fieldset disabled={exporting} className={styles.toolbar}>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
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
              setPage(0);
            }}
          />
        </label>
        {can("finance", "export") && (
          <Button pending={exporting} onClick={() => void exportRows()}>
            <Download size={20} />
            Download CSV
          </Button>
        )}
      </fieldset>
      {from && to && from > to && (
        <p role="alert">Choose an end date on or after the start date.</p>
      )}
      {sample ? (
        <p>Synthetic preview. No imported receipts are loaded here.</p>
      ) : query.isPending ? (
        <Skeleton />
      ) : null}
      <Feedback error={query.error ?? error} />
      {data && (
        <>
          <div className={styles.metrics}>
            <div>
              Visible receipts<strong>{data.total}</strong>
            </div>
            <div>
              Recorded amount<strong>{money(data.total_centavos)}</strong>
            </div>
          </div>
          {data.monthly.length > 0 && (
            <div aria-label="Monthly recorded collections">
              {data.monthly.map((m) => (
                <div key={m.month}>
                  <strong>{m.month}</strong> · {money(m.amount_centavos)} ·{" "}
                  {m.count} receipts
                  <div className={styles.bar} aria-hidden="true">
                    <span
                      style={{ width: `${(m.amount_centavos / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.phases.length > 0 && (
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
          {data.rows.map((r) => (
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
          ))}
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
        </>
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
