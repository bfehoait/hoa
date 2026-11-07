import { useState, type FormEvent } from "react";
import {
  Search,
  Users,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import {
  Button,
  Field,
  Feedback,
  Modal,
  Badge,
  Skeleton,
} from "../../components/UI";
import {
  useAccessMembers,
  useAccessControlActions,
  useMemberAssignments,
  type AccessMember,
  type GrantInput,
} from "../../data/access-control";
import {
  accessModules,
  accessActions,
  accessScopes,
} from "../../../../../packages/shared/src/permissions";
import { roles } from "../../../../../packages/shared/src/auth";
import styles from "./AccessManager.module.css";
import TabAccess from "./TabAccess";
export const committees = [
  ["finance", "Finance"],
  ["audit_inventory", "Audit & Inventory"],
  ["grievance", "Grievance"],
  ["peace_order", "Peace & Order"],
  ["maintenance", "Maintenance"],
  ["livelihood", "Livelihood"],
  ["events_education", "Events & Education"],
  ["environment", "Environment"],
  ["youth_gad", "Youth, Sports & GAD"],
  ["disaster", "Disaster Management"],
  ["election", "Election"],
  ["data_governance", "Data Governance"],
];
export default function AccessManager() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useAccessMembers(search, page);
  const member = query.data?.rows.find((item) => item.user_id === selected);
  return (
    <section className={styles.manager}>
      <div className="section-title">
        <h2>{member ? "Account access" : "Choose a member"}</h2>
        <ShieldCheck size={24} />
      </div>
      <p>Open a name to manage their tabs, roles and committee permissions.</p>
      {!member && (
        <label className={styles.search}>
          <Search size={20} />
          <span className="sr-only">Find account by name or unit</span>
          <input
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
              setSelected(null);
            }}
            placeholder="Find an account by name or unit…"
          />
        </label>
      )}
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Feedback error={query.error} />
      ) : member ? (
        <MemberAccessEditor
          key={member.user_id}
          member={member}
          close={() => setSelected(null)}
        />
      ) : (
        <>
          <ul className={styles.members}>
            {query.data?.rows.map((item) => (
              <li key={item.user_id}>
                <button onClick={() => setSelected(item.user_id)}>
                  <Users size={22} />
                  <span>
                    <strong>{item.name || "Unnamed member"}</strong>
                    <small>
                      {item.unit || "No recorded unit"} · {item.role}
                    </small>
                  </span>
                  <Badge>{item.status}</Badge>
                  <ChevronRight size={18} />
                </button>
              </li>
            ))}
          </ul>
          <nav className={styles.pager} aria-label="Account pages">
            <Button
              secondary
              disabled={!page || query.isFetching}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous
            </Button>
            <span>Page {page + 1}</span>
            <Button
              secondary
              disabled={
                (page + 1) * 20 >= (query.data?.total ?? 0) || query.isFetching
              }
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
function MemberAccessEditor({
  member,
  close,
}: {
  member: AccessMember;
  close: () => void;
}) {
  const [snapshot] = useState(member);
  const [tabDirty, setTabDirty] = useState(false);
  const [primary, setPrimary] = useState(member.role);
  const [extra, setExtra] = useState(member.extra_roles ?? []);
  const [status, setStatus] = useState(member.status);
  const [reference, setReference] = useState("");
  const [committee, setCommittee] = useState("maintenance");
  const [module, setModule] = useState("requests");
  const [action, setAction] = useState("view");
  const [scope, setScope] = useState("association");
  const [effect, setEffect] = useState("allow");
  const [intent, setIntent] = useState<"roles" | "grant" | string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const actions = useAccessControlActions();
  const assignments = useMemberAssignments(member.user_id);
  const busy =
    actions.roles.isPending ||
    actions.grant.isPending ||
    actions.revoke.isPending;
  function review(event: FormEvent, kind: string) {
    event.preventDefault();
    setError(null);
    if (reference.trim().length < 3) {
      setError(
        new Error("Enter an approval reference of at least three characters."),
      );
      return;
    }
    setIntent(kind);
  }
  async function confirm() {
    if (!intent) return;
    setError(null);
    try {
      if (intent === "roles")
        await actions.roles.mutateAsync({
          member: snapshot,
          role: primary,
          extra,
          status,
          reference,
        });
      else if (intent === "grant")
        await actions.grant.mutateAsync({
          userId: member.user_id,
          committee,
          module,
          action,
          scope,
          effect,
          reference,
        } satisfies GrantInput);
      else await actions.revoke.mutateAsync({ id: intent, reference });
      setIntent(null);
      setNotice("Access change confirmed by the server.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e
          : new Error("The change could not be confirmed."),
      );
    }
  }
  return (
    <>
      <Button secondary disabled={tabDirty} onClick={close}>
        <ArrowLeft size={18} />
        Account list
      </Button>
      <h3>{snapshot.name || "Member"}</h3>
      <p className="note">
        {snapshot.unit || "No recorded unit"} ·{" "}
        {[snapshot.role, ...(snapshot.extra_roles ?? [])].join(" · ")}
      </p>
      <TabAccess member={snapshot} onDirtyChange={setTabDirty} />
      <details className={styles.accountDetails}>
        <summary>Roles, account status & committee permissions</summary>
        <Feedback message={notice} error={error} />
        <Field label="Approval reference">
          <input
            id="access-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={200}
            placeholder="Approved request or decision reference"
          />
        </Field>
        <div className={styles.forms}>
          <form onSubmit={(event) => review(event, "roles")}>
            <h3>Roles & account status</h3>
            <Field label="Primary role">
              <select
                id="access-primary"
                value={primary}
                onChange={(event) => setPrimary(event.target.value)}
              >
                {roles
                  .filter((role) => role !== "developer")
                  .map((role) => (
                    <option key={role}>{role}</option>
                  ))}
              </select>
            </Field>
            <fieldset className={styles.roles}>
              <legend>Additional roles</legend>
              {roles.map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    checked={extra.includes(role)}
                    onChange={(event) =>
                      setExtra(
                        event.target.checked
                          ? [...extra, role]
                          : extra.filter((value) => value !== role),
                      )
                    }
                  />
                  {role}
                </label>
              ))}
            </fieldset>
            <Field label="Account status">
              <select
                id="access-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option>Active</option>
                <option>Suspended</option>
                {!["Active", "Suspended"].includes(status) && (
                  <option disabled>{status}</option>
                )}
              </select>
            </Field>
            <Button disabled={busy} type="submit">
              Review account change
            </Button>
          </form>
          <form onSubmit={(event) => review(event, "grant")}>
            <h3>Committee permissions</h3>
            <Field label="Committee">
              <select
                id="access-committee"
                value={committee}
                onChange={(event) => setCommittee(event.target.value)}
              >
                {committees.map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Module">
              <select
                id="access-module"
                value={module}
                onChange={(event) => setModule(event.target.value)}
              >
                {accessModules
                  .filter((value) => value !== "technical")
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </Field>
            <div className={styles.pair}>
              <Field label="Action">
                <select
                  id="access-action"
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                >
                  {accessActions
                    .filter((value) => value !== "monitor")
                    .map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                </select>
              </Field>
              <Field label="Scope">
                <select
                  id="access-scope"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  {accessScopes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Permission effect">
              <select
                id="access-effect"
                value={effect}
                onChange={(event) => setEffect(event.target.value)}
              >
                <option value="allow">Allow this action</option>
                <option value="deny">Deny this action</option>
              </select>
            </Field>
            <p className="note">
              Office access also needs an admin or developer role. Assigned-work
              handlers are not implemented by this grant alone. Expired or
              revoked assignments require a separate owner review.
            </p>
            <Button type="submit" disabled={busy || member.status !== "Active"}>
              Review permission change
            </Button>
          </form>
        </div>
        <h3>Committee assignments</h3>
        {assignments.isError ? (
          <Feedback error={assignments.error} />
        ) : assignments.isPending ? (
          <p className="note" role="status">
            Loading assignments...
          </p>
        ) : !assignments.data?.length ? (
          <p className="note">No committee assignments recorded.</p>
        ) : (
          <ul className={styles.assignments}>
            {assignments.data.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>
                    {committees.find(([id]) => id === item.committee_id)?.[1] ??
                      item.committee_id}
                  </strong>
                  <small>
                    {item.grants} grants ·{" "}
                    {item.revoked_at
                      ? "Revoked"
                      : item.expires_at
                        ? `Expires ${new Date(item.expires_at).toLocaleDateString()}`
                        : "No expiry"}
                  </small>
                </span>
                <Button
                  secondary
                  disabled={busy || !!item.revoked_at}
                  onClick={() => {
                    if (reference.trim().length < 3)
                      setError(new Error("Enter an approval reference first."));
                    else setIntent(item.id);
                  }}
                >
                  Revoke assignment
                </Button>
              </li>
            ))}
          </ul>
        )}
      </details>
      {intent && (
        <Modal
          busy={busy}
          title="Confirm account access change"
          onClose={() => {
            if (!busy) setIntent(null);
          }}
        >
          <p>
            This changes real access for{" "}
            <strong>{snapshot.name || "this account"}</strong>.
          </p>
          <dl className="detail-list">
            <div>
              <dt>Operation</dt>
              <dd>
                {intent === "roles"
                  ? `${primary} · ${status} · extras: ${extra.join(", ") || "none"}`
                  : intent === "grant"
                    ? `${committee}: ${effect} ${module} / ${action} / ${scope}`
                    : `Revoke ${assignments.data?.find((item) => item.id === intent)?.committee_id ?? "committee"} assignment`}
              </dd>
            </div>
            <div>
              <dt>Approval reference</dt>
              <dd>{reference}</dd>
            </div>
          </dl>
          <Feedback error={error} />
          <div className="form-actions">
            <Button pending={busy} onClick={() => void confirm()}>
              Confirm access change
            </Button>
            <Button secondary disabled={busy} onClick={() => setIntent(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
