import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Search,
  Users,
  ShieldCheck,
  ChevronRight,
  UserRound,
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
import TabAccess, { recordScopeLabels } from "./TabAccess";
import DeleteAccount from "../office/DeleteAccount";
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
export default function AccessManager({
  overlayOnly = false,
}: {
  overlayOnly?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const office = useLocation().pathname.startsWith("/office");
  const [roleFilter, setRoleFilter] = useState("");
  const requested = params.get("accountSearch") ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [previousRequest, setPreviousRequest] = useState(requested);
  if (previousRequest !== requested) {
    setPreviousRequest(requested);
    setSelected(null);
    setDirty(false);
    setBusy(false);
    setDiscard(false);
  }
  const query = useAccessMembers(
    requested || search,
    requested ? 0 : page,
    requested ? "" : roleFilter,
  );
  const resolved =
    requested &&
    !query.isError &&
    query.data?.lookup_mode === "email_exact" &&
    query.data.total === 1 &&
    query.data.rows.length === 1
      ? query.data.rows[0]
      : undefined;
  const member = query.isError
    ? undefined
    : (resolved ?? query.data?.rows.find((item) => item.user_id === selected));
  const opened = !!requested || !!selected || picking;
  const needsSetup = !!requested && query.data?.lookup_mode !== "email_exact";
  const ambiguous = !!requested && (query.data?.total ?? 0) > 1;
  const clearRequest = () => {
    if (!requested) return;
    const next = new URLSearchParams(params);
    next.delete("accountSearch");
    setParams(next, { replace: true });
  };
  const close = () => {
    setBusy(false);
    setSelected(null);
    setPicking(false);
    setDirty(false);
    setDiscard(false);
    clearRequest();
  };
  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else close();
  };
  const chooseManually = () => {
    setPicking(true);
    setSelected(null);
    setSearch("");
    setPage(0);
    clearRequest();
  };
  const picker = (
    <div className={styles.picker}>
      {office && !requested && (
        <label className={styles.roleFilter}>
          Assigned role
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.search}>
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Find a member by name or unit</span>
        <input
          value={search}
          maxLength={100}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search name or unit"
        />
      </label>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <div className={styles.lookupState}>
          <h3>Members couldn't be loaded</h3>
          <p>Your access or the connection may need attention.</p>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !query.data?.rows.length ? (
        <div className={styles.lookupState}>
          <Users size={28} aria-hidden="true" />
          <h3>No matching members</h3>
          <p>
            Try another name or unit. Only members with a linked sign-in account
            appear here.
          </p>
          {search && (
            <Button secondary onClick={() => setSearch("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul className={styles.members}>
            {query.data.rows.map((item) => (
              <li key={item.user_id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(item.user_id);
                    setPicking(false);
                  }}
                >
                  <Users size={22} aria-hidden="true" />
                  <span>
                    <strong>{item.name || "Unnamed member"}</strong>
                    <small>
                      {item.unit || "No recorded unit"} ? {item.role}
                    </small>
                  </span>
                  <Badge>{item.status}</Badge>
                  <ChevronRight size={18} aria-hidden="true" />
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
              disabled={(page + 1) * 20 >= query.data.total || query.isFetching}
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </div>
  );
  return (
    <>
      {!overlayOnly && (
        <section className={styles.manager} id="account-access">
          <div className="section-title">
            <h2>Member access</h2>
            <ShieldCheck size={24} />
          </div>
          <p>Choose a member to view or change their permissions.</p>
          {!opened && picker}
        </section>
      )}
      {opened && (
        <Modal
          title={
            member
              ? `Access for ${member.name || "this member"}`
              : picking
                ? "Choose a member"
                : "Member access"
          }
          description={
            member ? "Manage page access, role and account status." : undefined
          }
          className={styles.accessDrawer}
          size="lg"
          busy={busy}
          onClose={requestClose}
          footer={
            <>
              <div ref={setFooterTarget} className={styles.permissionActions} />
              {dirty && (
                <span className={styles.unsaved} role="status">
                  Unsaved changes
                </span>
              )}
              <Button secondary disabled={busy} onClick={requestClose}>
                {dirty ? "Cancel" : "Done"}
              </Button>
            </>
          }
        >
          {requested && query.isPending ? (
            <div className={styles.lookupState} role="status">
              <h3>Opening member access?</h3>
              <Skeleton />
            </div>
          ) : requested && query.isError ? (
            <div className={styles.lookupState}>
              <ShieldCheck size={32} aria-hidden="true" />
              <h3>We couldn't open this account</h3>
              <p>
                Check your connection and permission to manage members, then try
                again.
              </p>
              <Feedback error={query.error} />
              <div className="btn-row">
                <Button onClick={() => void query.refetch()}>Try again</Button>
                <Button secondary onClick={chooseManually}>
                  Choose another member
                </Button>
              </div>
            </div>
          ) : requested && !resolved ? (
            <div className={styles.lookupState}>
              <UserRound size={32} aria-hidden="true" />
              <h3>
                {needsSetup
                  ? "Account lookup needs an update"
                  : ambiguous
                    ? "This account needs review"
                    : "No linked account found"}
              </h3>
              <p>
                {needsSetup
                  ? "The database update for direct member lookup hasn't been installed yet. You can still search by name or unit."
                  : ambiguous
                    ? "More than one account matches this member. Ask the system owner to check the records before changing access."
                    : "We couldn't find a linked sign-in account for this member. Check their account details or choose another member."}
              </p>
              <Button onClick={chooseManually}>Find a member</Button>
              <details className={styles.lookupHelp}>
                <summary>Details for the system owner</summary>
                <p>
                  {needsSetup
                    ? "Apply migration 024, then retry Manage access."
                    : "The lookup requires an exact email match and one unique member-to-Auth link. No permissions were changed."}
                </p>
              </details>
            </div>
          ) : member ? (
            <MemberAccessEditor
              key={member.user_id}
              member={member}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              footerTarget={footerTarget}
              onDeleted={close}
            />
          ) : (
            picker
          )}
        </Modal>
      )}
      {discard && (
        <Modal
          title="Discard your changes?"
          description="These permission changes haven't been saved."
          onClose={() => setDiscard(false)}
          footer={
            <>
              <Button secondary onClick={() => setDiscard(false)}>
                Keep editing
              </Button>
              <Button tone="danger" onClick={close}>
                Discard changes
              </Button>
            </>
          }
        >
          <p>The member's saved permissions will stay as they are.</p>
        </Modal>
      )}
    </>
  );
}
function MemberAccessEditor({
  member,
  onDirtyChange,
  onBusyChange,
  footerTarget,
  onDeleted,
}: {
  member: AccessMember;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  footerTarget: HTMLElement | null;
  onDeleted: () => void;
}) {
  const [snapshot, setSnapshot] = useState(member);
  const editorId = useId();
  const [section, setSection] = useState<"pages" | "account">("pages");
  const [roleReference, setRoleReference] = useState("");
  const [tabDirty, setTabDirty] = useState(false);
  const [tabBusy, setTabBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [recordScope, setRecordScope] = useState(
    [member.role, ...(member.extra_roles ?? [])].some(
      (role) => role === "homeowner" || role === "renter",
    )
      ? "own"
      : "association",
  );
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
  const advancedFields = JSON.stringify([
    primary,
    extra,
    status,
    reference,
    roleReference,
    committee,
    module,
    action,
    scope,
    effect,
  ]);
  const [savedFields, setSavedFields] = useState(advancedFields);
  useEffect(() => {
    onDirtyChange(tabDirty || advancedFields !== savedFields);
  }, [tabDirty, advancedFields, savedFields, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy || tabBusy || deleteBusy);
  }, [busy, tabBusy, deleteBusy, onBusyChange]);
  const roleChanged =
    primary !== snapshot.role ||
    status !== snapshot.status ||
    JSON.stringify([...extra].sort()) !==
      JSON.stringify([...(snapshot.extra_roles ?? [])].sort());
  const unsaved = tabDirty || advancedFields !== savedFields;
  function resetAdvanced() {
    const [p, e, s, r, rr, c, m, a, sc, ef] = JSON.parse(savedFields) as [
      string,
      string[],
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    setPrimary(p);
    setExtra(e);
    setStatus(s);
    setReference(r);
    setRoleReference(rr);
    setCommittee(c);
    setModule(m);
    setAction(a);
    setScope(sc);
    setEffect(ef);
    setError(null);
  }
  function roleName(role: string) {
    const labels: Record<string, string> = {
      homeowner: "Homeowner",
      renter: "Renter",
      admin: "Office admin",
      board: "Board member",
      security: "Security",
      driver: "Driver",
      developer: "Developer",
    };
    return labels[role] ?? role;
  }
  const roleDescriptions: Record<string, string> = {
    homeowner:
      "Uses household services, submits requests and views their own statements where available.",
    renter:
      "Uses resident services and submits requests for their household. Access depends on the permissions assigned.",
    admin:
      "Handles day-to-day office work in the pages and records assigned to them. Managing other members' access requires separate authorization.",
    board:
      "Reviews approved community summaries and documents. Private household records need separate permission.",
    security:
      "Handles gate and visitor duties within their assigned permissions.",
    driver:
      "Handles assigned shuttle duties within their transport permissions.",
    developer:
      "Maintains the system and its technical tools. This role has broad system access.",
  };
  function review(event: FormEvent, kind: string) {
    event.preventDefault();
    setError(null);
    if ((kind === "roles" ? roleReference : reference).trim().length < 3) {
      setError(new Error("Enter a reason of at least three characters."));
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
          reference: roleReference,
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
      if (intent === "roles")
        setSnapshot({ ...snapshot, role: primary, extra_roles: extra, status });
      setSavedFields(advancedFields);
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
      <div className={styles.memberSummary}>
        <span className={styles.memberIcon}>
          <UserRound size={26} aria-hidden="true" />
        </span>
        <div>
          <strong>{snapshot.name || "Member"}</strong>
          <p>{snapshot.unit || "No recorded unit"}</p>
          <p>
            {[snapshot.role, ...(snapshot.extra_roles ?? [])]
              .map(roleName)
              .join(" / ")}
          </p>
        </div>
        <Badge>{snapshot.status}</Badge>
      </div>
      <div
        className={styles.editorTabs}
        role="tablist"
        aria-label="Member settings"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button[role="tab"]:not(:disabled)',
            ),
          );
          const current = tabs.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (current < 0 || !tabs.length) return;
          event.preventDefault();
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (current +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
          tabs[index].focus();
          tabs[index].click();
        }}
      >
        {(
          [
            ["pages", "Page access"],
            ["account", "Role & status"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={editorId + "-tab-" + id}
            aria-controls={editorId + "-" + id}
            aria-selected={section === id}
            disabled={
              section !== id && (busy || tabBusy || deleteBusy || unsaved)
            }
            onClick={() => {
              setSection(id);
              setError(null);
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {unsaved && (
        <p className="note" role="status">
          Save or reset your changes before switching sections.
        </p>
      )}
      <section
        className={styles.tabSection}
        role="tabpanel"
        id={editorId + "-pages"}
        aria-labelledby={editorId + "-tab-pages"}
        hidden={section !== "pages"}
      >
        <TabAccess
          member={snapshot}
          recordScope={recordScope}
          onDirtyChange={setTabDirty}
          onPendingChange={setTabBusy}
          footerTarget={section === "pages" ? footerTarget : null}
        />
      </section>
      <section
        className={styles.tabSection}
        role="tabpanel"
        id={editorId + "-account"}
        aria-labelledby={editorId + "-tab-account"}
        hidden={section !== "account"}
      >
        <Feedback message={notice} error={error} />
        <div className={styles.accountForm}>
          <form onSubmit={(event) => review(event, "roles")}>
            <h3>Role & status</h3>
            <p className="note">
              Choose their main role and whether the account is active.
            </p>
            <Field label="Role">
              <select
                id="access-primary"
                aria-describedby={editorId + "-role-description"}
                value={primary}
                onChange={(event) => setPrimary(event.target.value)}
              >
                {roles
                  .filter((role) => role !== "developer")
                  .map((role) => (
                    <option value={role} key={role}>
                      {roleName(role)}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="note" id={editorId + "-role-description"}>
              {roleDescriptions[primary]}
            </p>

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
            <Field label="Reason for the change (required)">
              <input
                id="access-role-reference"
                value={roleReference}
                maxLength={200}
                disabled={busy}
                onChange={(event) => setRoleReference(event.target.value)}
                placeholder="Why is their role or status changing?"
              />
            </Field>
            {roleChanged && roleReference.trim().length < 3 && (
              <p className="note">
                Enter at least 3 characters to review this change.
              </p>
            )}
            <details className={styles.extraRoles}>
              <summary>Additional roles ({extra.length})</summary>
              <p className="note">
                For members who have more than one responsibility. Existing
                roles are kept unless you change them.
              </p>
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
                    {roleName(role)}
                  </label>
                ))}
              </fieldset>
            </details>
            <div className={styles.accountActions}>
              <Button
                disabled={
                  busy || !roleChanged || roleReference.trim().length < 3
                }
                type="submit"
              >
                Review role & status
              </Button>
              <Button
                secondary
                type="button"
                disabled={busy || advancedFields === savedFields}
                onClick={resetAdvanced}
              >
                Reset changes
              </Button>
            </div>
          </form>
        </div>
        <details className={styles.accountDetails}>
          <summary>Records covered by page permissions</summary>
          <p className="note">
            Choose which records to review in Page access. This selection does
            not grant access or change their role. Save permission changes in
            Page access to apply them.
          </p>
          <Field label="Records to review">
            <select
              value={recordScope}
              disabled={busy || tabBusy || unsaved}
              onChange={(event) => setRecordScope(event.target.value)}
            >
              {accessScopes.map((value) => (
                <option key={value} value={value}>
                  {recordScopeLabels[value]}
                </option>
              ))}
            </select>
          </Field>
          <Button
            secondary
            disabled={busy || tabBusy || unsaved}
            onClick={() => setSection("pages")}
          >
            Review page access
          </Button>
        </details>
        <details className={styles.accountDetails}>
          <summary>Special committee permissions</summary>
          <form onSubmit={(event) => review(event, "grant")}>
            <h3>Special permission</h3>
            <p className="note">
              For specific committee duties such as approval or publication.
            </p>
            <Field label="Reason or approved decision reference">
              <input
                id="access-reference"
                value={reference}
                maxLength={200}
                disabled={busy}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Why is this permission needed?"
              />
            </Field>
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
                      {committees.find(
                        ([id]) => id === item.committee_id,
                      )?.[1] ?? item.committee_id}
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
                        setError(
                          new Error("Enter an approval reference first."),
                        );
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
        <DeleteAccount
          member={snapshot}
          disabled={busy || tabBusy || unsaved}
          onBusyChange={setDeleteBusy}
          onDeleted={onDeleted}
        />
      </section>
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
              <dt>Reason</dt>
              <dd>{intent === "roles" ? roleReference : reference}</dd>
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
