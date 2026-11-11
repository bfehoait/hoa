import { useId, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accountingDashboardSchema,
  accountingForms,
  type AccountingForm,
  type accountingEntrySchema,
} from "../../../../../packages/shared/src/accounting-forms";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import { NavigationGroup } from "../../components/Navigation";
import { downloadCsv } from "../../data/download";
import styles from "./MemberWorkspace.module.css";
import table from "../registry/LotRegister.module.css";
type Entry = z.infer<typeof accountingEntrySchema>;
const amount = (value: string) => {
  const n = BigInt(value);
  return `₱${new Intl.NumberFormat("en-PH").format(n / 100n)}.${String(n % 100n).padStart(2, "0")}`;
};
export default function AccountingWorkbench() {
  const auth = useAuth(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const form =
    accountingForms.find((f) => f.id === params.get("kind")) ??
    accountingForms[0];
  const status = params.get("status") ?? "",
    search = params.get("q") ?? "",
    rawPage = Number(params.get("page") ?? 0),
    page =
      Number.isInteger(rawPage) && rawPage >= 0 && rawPage <= 10000
        ? rawPage
        : 0;
  const [draft, setDraft] = useState<Entry | null | false>(false),
    [client, setClient] = useState(() => crypto.randomUUID()),
    [decision, setDecision] = useState<{ entry: Entry; status: string } | null>(
      null,
    ),
    [notice, setNotice] = useState("");
  const formId = useId();
  const query = useQuery({
    queryKey: ["accounting", auth.userId, form.id, status, page, search],
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      accountingDashboardSchema.parse(
        await featureRpc("bfe_accounting_dashboard", {
          p_kind: form.id,
          p_status: status,
          p_page: page,
          p_search: search,
        }),
      ),
  });
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["accounting"] });
    await cache.invalidateQueries({ queryKey: ["registry"] });
    await cache.invalidateQueries({ queryKey: ["office-review-inbox"] });
    await cache.invalidateQueries({ queryKey: ["booking-charge"] });
  };
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      return featureRpc("bfe_save_accounting_draft", {
        p_id: draft ? draft.id : client,
        p_version: draft ? draft.version : 0,
        p_kind: form.id,
        p_fields: Object.fromEntries(
          form.fields.map((q) => [q.key, String(f.get(q.key) ?? "")]),
        ),
        p_reference: f.get("sourceReference"),
      });
    },
    onSuccess: async () => {
      setDraft(false);
      setClient(crypto.randomUUID());
      setNotice("Accounting draft saved; no posting has occurred.");
      await refresh();
    },
  });
  const decide = useMutation({
    mutationFn: async (f: FormData) => {
      if (!decision) throw new Error("Reopen the decision.");
      return featureRpc("bfe_decide_accounting_entry", {
        p_id: decision.entry.id,
        p_version: decision.entry.version,
        p_status: decision.status,
        p_reference: f.get("reference"),
      });
    },
    onSuccess: async () => {
      setDecision(null);
      setNotice("Accounting decision recorded by the server.");
      await refresh();
    },
  });
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { preventScrollReset: true });
  };
  const begin = (entry: Entry | null) => {
    setDraft(entry);
    setClient(crypto.randomUUID());
    save.reset();
  };
  const openDecision = (entry: Entry, status: string) => {
    setDecision({ entry, status });
    decide.reset();
  };
  const exportPage = useMutation({
    mutationFn: async (input: {
      definition: AccountingForm;
      status: string;
      page: number;
      search: string;
    }) => {
      const result = accountingDashboardSchema.parse(
        await featureRpc("bfe_export_accounting_page", {
          p_kind: input.definition.id,
          p_status: input.status,
          p_page: input.page,
          p_search: input.search,
        }),
      );
      downloadCsv("Bellefort-accounting-visible-page.csv", [
        ["Status", ...input.definition.fields.map((f) => f.label)],
        ...result.rows.map((r) => [
          r.status,
          ...input.definition.fields.map((f) => r.fields[f.key] ?? ""),
        ]),
      ]);
    },
  });
  return (
    <>
      <PageIntro
        title="Finance"
        description="Prepare accounting records, obtain independent review and inspect recorded postings."
        action={
          query.data?.can_create ? (
            <Button onClick={() => begin(null)}>
              New {form.title.toLowerCase()}
            </Button>
          ) : undefined
        }
      />
      <NavigationGroup aria-label="Finance workspace">
        <NavLink to="/office/finance">Imported receipts</NavLink>
        <NavLink to="/office/finance/accounting">Accounting records</NavLink>
      </NavigationGroup>
      <p className="notice-note">
        This workbench covers newly recorded accounting entries. Imported
        receipts remain separate. Posted records do not independently prove bank
        clearance. Late fee rules are recorded; no automatic late fee accrual is
        performed.
      </p>
      <p className={styles.note}>
        HOA setup: verify the lot’s billing start and any opening arrears, post
        its approved rate and monthly billing runs, then record new payments or
        allocate imported receipts to the months they actually cover. Use the
        appropriate ₱800/₱900 rate and a reviewed lot scope; do not apply one
        flat rate to mixed classifications. No billing is generated by opening a
        customer page.
      </p>
      <div className={table.toolbar}>
        <label>
          Business form
          <select
            value={form.id}
            onChange={(e) => filter("kind", e.target.value)}
          >
            {accountingForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => filter("status", e.target.value)}
          >
            {["", "Draft", "Submitted", "Posted", "Rejected", "Reversed"].map(
              (s) => (
                <option key={s} value={s}>
                  {s || "All statuses"}
                </option>
              ),
            )}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            filter(
              "q",
              String(new FormData(e.currentTarget).get("search") ?? ""),
            );
          }}
        >
          <label>
            Search records
            <input
              key={search}
              name="search"
              type="search"
              maxLength={100}
              defaultValue={search}
            />
          </label>
          <Button type="submit" secondary>
            Search
          </Button>
        </form>
        <Button
          secondary
          pending={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      <Feedback error={query.error} message={notice} />
      {query.isPending && <Skeleton />}
      {query.data && (
        <>
          <div className={table.metrics}>
            <div>
              Current invoices<strong>{query.data.summary.invoices}</strong>
            </div>
            <div>
              Recorded billing
              <strong>{amount(query.data.summary.billed_centavos)}</strong>
            </div>
            <div>
              Allocated payments
              <strong>{amount(query.data.summary.allocated_centavos)}</strong>
            </div>
            <div>
              Unallocated payments
              <strong>{amount(query.data.summary.unallocated_centavos)}</strong>
            </div>
            <div>
              Recorded expenses
              <strong>{amount(query.data.summary.expenses_centavos)}</strong>
            </div>
          </div>
          <p>
            {query.data.total} matching records · Page {page + 1}
          </p>
          {!query.data.rows.length && (
            <section className="panel">
              <h2>No records in this view</h2>
              <p>
                Choose another form or status, or prepare a draft when you have
                the verified source information.
              </p>
            </section>
          )}
          {query.data.rows.map((r) => (
            <article className={`panel ${styles.record}`} key={r.id}>
              <Badge>{r.status}</Badge>
              <h2>
                {r.fields.name ||
                  r.fields.category ||
                  r.fields.reference ||
                  r.fields.period ||
                  form.title}
              </h2>
              <p className={styles.note}>
                Prepared{" "}
                {new Date(r.created_at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </p>
              <details>
                <summary>Record details</summary>
                <dl className={styles.details}>
                  {form.fields
                    .filter((f) => r.fields[f.key])
                    .map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>
                          {f.key === "rule"
                            ? (query.data?.rules.find(
                                (rule) => rule.id === r.fields.rule,
                              )?.name ?? "Previously selected rate")
                            : r.fields[f.key]}
                        </dd>
                      </div>
                    ))}
                </dl>
                {r.review_note && <p>Decision reference: {r.review_note}</p>}
              </details>
              <AccountingEntryHistory id={r.id} />
              <div className={styles.actions}>
                {query.data?.can_create &&
                  r.creator_id === auth.userId &&
                  ["Draft", "Rejected"].includes(r.status) && (
                    <Button secondary onClick={() => begin(r)}>
                      Edit draft
                    </Button>
                  )}
                {query.data?.can_create &&
                  r.creator_id === auth.userId &&
                  r.status === "Draft" && (
                    <Button onClick={() => openDecision(r, "Submitted")}>
                      Submit for review
                    </Button>
                  )}
                {query.data?.can_review &&
                  r.creator_id !== auth.userId &&
                  r.status === "Submitted" && (
                    <>
                      <Button onClick={() => openDecision(r, "Posted")}>
                        Review & post
                      </Button>
                      <Button
                        secondary
                        onClick={() => openDecision(r, "Rejected")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                {query.data?.can_reverse &&
                  r.creator_id !== auth.userId &&
                  r.status === "Posted" && (
                    <Button
                      tone="danger"
                      onClick={() => openDecision(r, "Reversed")}
                    >
                      Reverse posting
                    </Button>
                  )}
              </div>
            </article>
          ))}
          <div className={styles.actions}>
            <Button
              secondary
              disabled={!page}
              onClick={() => filter("page", String(page - 1))}
            >
              Previous records
            </Button>
            <Button
              secondary
              disabled={(page + 1) * 20 >= query.data.total}
              onClick={() => filter("page", String(page + 1))}
            >
              Next records
            </Button>
            {query.data.can_export && (
              <Button
                secondary
                disabled={!query.data.rows.length}
                pending={exportPage.isPending}
                onClick={() =>
                  exportPage.mutate({ definition: form, status, page, search })
                }
              >
                Export visible page
              </Button>
            )}
          </div>
          <Feedback error={exportPage.error} />
        </>
      )}
      {draft !== false && (
        <Modal
          title={
            draft
              ? `Edit ${form.title.toLowerCase()}`
              : `New ${form.title.toLowerCase()}`
          }
          presentation="task"
          size="lg"
          protectChanges
          busy={save.isPending}
          onClose={() => setDraft(false)}
          footer={
            <>
              <Button
                type="button"
                secondary
                disabled={save.isPending}
                onClick={() => setDraft(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form={formId} pending={save.isPending}>
                Save draft
              </Button>
            </>
          }
        >
          <p>{form.effect}</p>
          <form
            id={formId}
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
          >
            <fieldset disabled={save.isPending}>
              {form.fields.map((q) => (
                <label key={q.key}>
                  {q.label}
                  {q.key === "rule" ? (
                    <select
                      name={q.key}
                      required
                      defaultValue={draft ? draft.fields[q.key] : ""}
                    >
                      <option value="">Choose a posted rate</option>
                      {draft &&
                        draft.fields.rule &&
                        !query.data?.rules.some(
                          (r) => r.id === draft.fields.rule,
                        ) && (
                          <option value={draft.fields.rule}>
                            Previously selected rate (review availability)
                          </option>
                        )}
                      {query.data?.rules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : q.key === "category" && form.id === "expense" ? (
                    <select
                      name={q.key}
                      required
                      defaultValue={draft ? draft.fields[q.key] : ""}
                    >
                      <option value="">Choose a posted category</option>
                      {query.data?.categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  ) : q.options ? (
                    <select
                      name={q.key}
                      required={q.required}
                      defaultValue={draft ? draft.fields[q.key] : ""}
                    >
                      <option value="">Choose</option>
                      {q.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : q.type === "textarea" ? (
                    <textarea
                      name={q.key}
                      required={q.required}
                      maxLength={2000}
                      defaultValue={draft ? draft.fields[q.key] : ""}
                    />
                  ) : (
                    <input
                      name={q.key}
                      type={q.type ?? "text"}
                      required={q.required}
                      min={q.type === "number" ? 0 : undefined}
                      step={
                        q.type === "number"
                          ? ["dueDay", "phase"].includes(q.key)
                            ? "1"
                            : "0.01"
                          : undefined
                      }
                      maxLength={2000}
                      defaultValue={
                        draft
                          ? draft.fields[q.key]
                          : ["booking", "charge"].includes(q.key)
                            ? (params.get(q.key) ?? "")
                            : ""
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                Preparation or source reference
                <input
                  name="sourceReference"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </label>
              <Feedback error={save.error} />
            </fieldset>
          </form>
        </Modal>
      )}
      {decision && (
        <Modal
          title={
            decision.status === "Posted"
              ? "Confirm accounting posting"
              : decision.status === "Reversed"
                ? "Reverse this posting?"
                : decision.status === "Rejected"
                  ? "Reject this submission?"
                  : "Submit for independent review"
          }
          presentation="task"
          busy={decide.isPending}
          onClose={() => setDecision(null)}
        >
          <p>{form.effect}</p>
          <dl className={styles.details}>
            {form.fields
              .filter((q) => decision.entry.fields[q.key])
              .map((q) => (
                <div key={q.key}>
                  <dt>{q.label}</dt>
                  <dd>
                    {q.key === "rule"
                      ? (query.data?.rules.find(
                          (r) => r.id === decision.entry.fields.rule,
                        )?.name ?? "Previously selected rate")
                      : decision.entry.fields[q.key]}
                  </dd>
                </div>
              ))}
          </dl>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              decide.mutate(new FormData(e.currentTarget));
            }}
          >
            <fieldset disabled={decide.isPending}>
              <label>
                Review reference or reason
                <input
                  name="reference"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </label>
              <label className={styles.check}>
                <input type="checkbox" required />I checked the source evidence,
                scope and intended accounting effect.
              </label>
              <Feedback error={decide.error} />
              <div className={styles.actions}>
                <Button
                  type="button"
                  secondary
                  onClick={() => setDecision(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" pending={decide.isPending}>
                  {decision.status === "Posted"
                    ? "Post record"
                    : decision.status === "Reversed"
                      ? "Confirm reversal"
                      : decision.status === "Rejected"
                        ? "Confirm rejection"
                        : "Submit for review"}
                </Button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

const entryDetailSchema = z.object({
  invoice_total: z.number().int(),
  invoices: z.array(
    z.object({
      id: z.uuid(),
      physical_id: z.string(),
      period: z.string(),
      due_date: z.string(),
      amount_centavos: z.string(),
      reversed: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      reference: z.string(),
      at: z.string(),
      actor_name: z.string(),
    }),
  ),
});
function AccountingEntryHistory({ id }: { id: string }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["accounting", auth.userId, "entry", id, page],
    enabled: open,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      entryDetailSchema.parse(
        await featureRpc("bfe_accounting_entry_detail", {
          p_id: id,
          p_page: page,
        }),
      ),
  });
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Posting history and generated invoices</summary>
      <Feedback error={query.error} />
      {query.isPending && open && <Skeleton />}
      {query.data && (
        <>
          {query.data.invoices.length > 0 && (
            <>
              <h3>Generated invoices</h3>
              <div className={table.list}>
                {query.data.invoices.map((i) => (
                  <div className={table.receipt} key={i.id}>
                    <strong>{i.physical_id}</strong>
                    <span>{i.period}</span>
                    <span>Due {i.due_date}</span>
                    <span>
                      {amount(i.amount_centavos)}
                      {i.reversed ? " ? Reversed" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {query.data.invoice_total > 20 && (
            <div className={styles.actions}>
              <Button
                secondary
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                Previous invoices
              </Button>
              <span>Page {page + 1}</span>
              <Button
                secondary
                disabled={(page + 1) * 20 >= query.data.invoice_total}
                onClick={() => setPage(page + 1)}
              >
                Next invoices
              </Button>
            </div>
          )}
          <h3>Latest 30 actions</h3>
          <ol>
            {query.data.history.map((h) => (
              <li key={h.id}>
                {h.action} ? {h.actor_name}
                <p>{h.reference}</p>
                <small>
                  {new Date(h.at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </small>
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
