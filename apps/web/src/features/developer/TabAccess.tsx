import { useCallback, useEffect, useState } from "react";
import {
  Code2,
  ShieldCheck as ProtectedIcon,
  Building2,
  Landmark,
  ShieldCheck,
  Bus,
  Home,
  Globe,
  Layers3,
  ChevronDown,
  Info,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../data/auth";
import type { AccessMember } from "../../data/access-control";
import { featureRpc } from "../../data/feature-records";
import { roles } from "../../../../../packages/shared/src/auth";
import {
  accessEditorSchema,
  accessGroups,
  moduleLabels,
  moduleActions,
  actionLabel,
  effectiveAccessSummary,
  moduleAccessChecks,
  checkboxActionDraft,
  type AccessSnapshot,
} from "../../../../../packages/shared/src/access-editor";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { committees } from "./AccessManager";
import styles from "./WorkspaceAccess.module.css";

const operationsModules = new Set([
  "property",
  "requests",
  "messages",
  "operations",
  "calendar",
  "security",
  "transport",
  "hotlines",
]);
function moduleSection(module: string) {
  return operationsModules.has(module)
    ? "Community & operations"
    : "Administration & publishing";
}

function PermissionCheckbox({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.permissionCheck}>
      <input
        type="checkbox"
        checked={value === true}
        disabled={disabled}
        ref={(input) => {
          if (input) input.indeterminate = value === undefined;
        }}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className={styles.srOnly}>{label}</span>
    </label>
  );
}

export const recordScopeLabels: Record<string, string> = {
  own: "Their own household records",
  approved: "Published community information",
  assigned: "Records assigned to them",
  association: "Association records across members",
};
const roleLabels: Record<string, string> = {
  admin: "Office",
  board: "Board of Directors",
  security: "Security",
  driver: "Transport",
  homeowner: "Homeowner",
  renter: "Renter",
  finance: "Finance",
  grievance: "Grievance",
  maintenance: "Maintenance",
};
export default function TabAccess({
  member,
  onDirtyChange,
  onPendingChange,
  footerTarget,
  searchTarget,
}: {
  member?: AccessMember;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  footerTarget?: HTMLElement | null;
  searchTarget?: HTMLElement | null;
  recordScope?: string;
}) {
  const auth = useAuth();
  const [kind, setKind] = useState("role"),
    [subject, setSubject] = useState("admin"),
    [dirty, setDirty] = useState(false);
  const reportDirty = useCallback(
    (value: boolean) => {
      setDirty(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );
  if (auth.memberPreview)
    return (
      <p>
        Account preview is read-only. Sign in directly to manage permissions.
      </p>
    );
  return (
    <section aria-label="Workspace access">
      {!member && (
        <div className={styles.filters}>
          <label>
            Set defaults for
            <select
              aria-label="Set defaults for"
              value={kind}
              disabled={dirty}
              onChange={(e) => {
                setKind(e.target.value);
                setSubject(
                  e.target.value === "role" ? "admin" : committees[0][0],
                );
              }}
            >
              <option value="role">Role</option>
              <option value="committee">Committee</option>
            </select>
          </label>
          <label>
            {kind === "role" ? "Role" : "Committee"}
            <select
              aria-label={kind === "role" ? "Role" : "Committee"}
              value={subject}
              disabled={dirty}
              onChange={(e) => setSubject(e.target.value)}
            >
              {(kind === "role"
                ? roles
                    .filter((r) => r !== "developer")
                    .map((r) => [r, roleLabels[r] ?? r])
                : committees
              ).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <WorkspaceEditor
        key={member?.user_id ?? kind + subject}
        kind={member ? "user" : kind}
        subject={member?.user_id ?? subject}
        onDirtyChange={reportDirty}
        onPendingChange={onPendingChange}
        footerTarget={footerTarget}
        searchTarget={searchTarget}
      />
    </section>
  );
}
function WorkspaceEditor({
  kind,
  subject,
  onDirtyChange,
  onPendingChange,
  footerTarget,
  searchTarget,
}: {
  kind: string;
  subject: string;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  footerTarget?: HTMLElement | null;
  searchTarget?: HTMLElement | null;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [draft, setDraft] = useState<AccessSnapshot | null>(null),
    [baseline, setBaseline] = useState<AccessSnapshot | null>(null),
    [search, setSearch] = useState(""),
    [workspace, setWorkspace] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [review, setReview] = useState(false),
    [delegationNext, setDelegationNext] = useState<boolean | null>(null),
    [delegationBase, setDelegationBase] = useState<boolean | null>(null),
    [delegationReason, setDelegationReason] = useState(""),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["workspace-access", auth.userId, kind, subject],
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      accessEditorSchema.parse(
        await featureRpc("bfe_access_editor", {
          p_kind: kind,
          p_subject: subject,
        }),
      ),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (kind === "user" && query.data?.roles.includes("developer"))
        throw new Error(
          "Developer access is protected. Use the system recovery procedures.",
        );
      return accessEditorSchema.parse(
        await featureRpc("bfe_save_access_editor", {
          p_kind: kind,
          p_subject: subject,
          p_expected: baseline,
          p_next: draft,
          p_note: reason.trim(),
        }),
      );
    },
    onSuccess: async (data) => {
      cache.setQueryData(
        ["workspace-access", auth.userId, kind, subject],
        data,
      );
      setDraft(null);
      setBaseline(null);
      setReview(false);
      setNotice(
        kind === "user"
          ? "Permissions saved. Current access below has been checked by the server."
          : "Defaults saved. Individual restrictions still apply.",
      );
      await Promise.all(
        ["permissions", "tab-access", "workspace-access", "access-control"].map(
          (key) => cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
  const delegation = useMutation({
    mutationFn: async () => {
      if (query.data?.roles.includes("developer"))
        throw new Error(
          "Developer accounts do not need Office access delegation.",
        );
      if (delegationNext === null || delegationReason.trim().length < 3)
        throw new Error(
          "Choose a change and enter a reason before confirming.",
        );
      if (query.data?.manager !== delegationBase)
        throw new Error(
          "Access has changed. Cancel this change and check the current setting.",
        );
      return featureRpc("bfe_set_access_manager", {
        p_user: subject,
        p_active: delegationNext,
        p_note: delegationReason.trim(),
      });
    },
    onSuccess: async () => {
      setNotice("Access management updated.");
      await cache.invalidateQueries({ queryKey: ["workspace-access"] });
      setDelegationNext(null);
      setDelegationBase(null);
      setDelegationReason("");
    },
  });
  const busy = save.isPending || delegation.isPending;
  useEffect(() => {
    onDirtyChange(!!draft || delegationNext !== null);
    return () => onDirtyChange(false);
  }, [draft, delegationNext, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(busy);
    return () => onPendingChange?.(false);
  }, [busy, onPendingChange]);
  if (query.isPending) return <Skeleton />;
  if (query.isError) return <Feedback error={query.error} />;
  const data = query.data,
    current = draft ?? data.snapshot,
    developer = kind === "user" && data.roles.includes("developer");
  const held = kind === "role" ? [subject] : data.roles;
  const actorDeveloper =
    !!auth.member &&
    [auth.member.role, ...(auth.member.extra_roles ?? [])].includes(
      "developer",
    );
  const groups = accessGroups(held, kind, current);
  const selected =
    groups.find((g) => g.id === workspace) ??
    groups.find((g) => !g.advanced) ??
    groups[0];
  const workspaceIcons = {
    developer: Code2,
    office: Building2,
    board: Landmark,
    security: ShieldCheck,
    driver: Bus,
    home: Home,
    published: Globe,
  };
  const workspaceButton = (group: (typeof groups)[number]) => {
    const Icon =
      workspaceIcons[group.id as keyof typeof workspaceIcons] ?? Layers3;
    return (
      <button
        type="button"
        key={group.id}
        aria-pressed={selected.id === group.id}
        aria-label={group.label}
        onClick={() => {
          setWorkspace(group.id);
          setSearch("");
        }}
      >
        <Icon size={20} aria-hidden="true" />
        <span>
          <strong>{group.label}</strong>
          <small>
            {group.protected
              ? "Protected system access"
              : developer && !group.advanced
                ? "Read-only reference"
                : group.advanced
                  ? recordScopeLabels[group.scope]
                  : kind === "user"
                    ? "Role assigned"
                    : "Group defaults"}
          </small>
        </span>
      </button>
    );
  };
  const change = (
    module: string,
    scope: string,
    value: string,
    action?: string,
  ) => {
    if (developer || busy || delegationNext !== null) return;
    if (!baseline) setBaseline(data.snapshot);
    let next: AccessSnapshot = {
      rules: [...current.rules],
      actions: [...current.actions],
    };
    if (action && value !== "inherit") {
      next = checkboxActionDraft(
        current,
        module,
        scope,
        action,
        value === "allow",
        data.effective?.[module + ":" + scope],
      );
    } else if (action) {
      next.actions = next.actions.filter(
        (r) =>
          !(r.module === module && r.scope === scope && r.action === action),
      );
      if (value !== "inherit")
        next.actions.push({
          module,
          scope,
          action,
          effect: value as "allow" | "deny",
        });
    } else {
      next.rules = next.rules.filter(
        (r) => !(r.module === module && r.scope === scope),
      );
      if (value !== "inherit")
        next.rules.push({
          module,
          scope,
          mode: value as "hidden" | "view" | "edit",
        });
    }
    const canonical = (v: AccessSnapshot) =>
      JSON.stringify({
        rules: [...v.rules].sort((a, b) =>
          (a.scope + a.module).localeCompare(b.scope + b.module),
        ),
        actions: [...v.actions].sort((a, b) =>
          (a.scope + a.module + a.action).localeCompare(
            b.scope + b.module + b.action,
          ),
        ),
      });
    const same = canonical(next) === canonical(data.snapshot);
    setDraft(same ? null : next);
    if (same) setBaseline(null);
    setReview(false);
    setNotice("");
  };
  const changes = [
    ...current.rules
      .filter(
        (r) =>
          !data.snapshot.rules.some(
            (s) => JSON.stringify(r) === JSON.stringify(s),
          ),
      )
      .map(
        (r) =>
          `${moduleLabels[r.module]}: ${r.mode === "hidden" ? "No access" : r.mode === "view" ? "View only" : "Manage"} (${recordScopeLabels[r.scope]})`,
      ),
    ...current.actions
      .filter(
        (r) =>
          !data.snapshot.actions.some(
            (s) => JSON.stringify(r) === JSON.stringify(s),
          ),
      )
      .map(
        (r) =>
          `${moduleLabels[r.module]}: ${actionLabel(r.module, r.action)} — ${r.effect === "allow" ? "Allow" : "Block"}`,
      ),
    ...data.snapshot.rules
      .filter(
        (r) =>
          !current.rules.some(
            (s) => s.module === r.module && s.scope === r.scope,
          ),
      )
      .map((r) => `${moduleLabels[r.module]}: reset module to defaults`),
    ...data.snapshot.actions
      .filter(
        (r) =>
          !current.actions.some(
            (s) =>
              s.module === r.module &&
              s.scope === r.scope &&
              s.action === r.action,
          ),
      )
      .map(
        (r) =>
          `${moduleLabels[r.module]}: reset ${actionLabel(r.module, r.action)} to defaults`,
      ),
  ];
  const footer = (
    <div className={`${styles.footer} ${!review ? styles.compactFooter : ""}`}>
      <Feedback error={save.error} message={notice} />
      {developer && (
        <p className={styles.note} role="status">
          Protected account. Page access is read-only here.
        </p>
      )}
      {developer && draft && (
        <Button
          secondary
          disabled={busy}
          onClick={() => {
            setDraft(null);
            setBaseline(null);
            setReview(false);
          }}
        >
          Discard changes
        </Button>
      )}
      {draft && !developer && (
        <>
          <p className={styles.pendingCount} role="status">
            {changes.length} unsaved{" "}
            {changes.length === 1 ? "change" : "changes"}
          </p>
          {review && (
            <label>
              Reason for changes
              <input
                value={reason}
                maxLength={200}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
                placeholder="For example: assigned to booking approvals"
              />
            </label>
          )}
          {review && (
            <div
              className={styles.review}
              role="region"
              aria-label="Review access changes"
            >
              <strong>Changes to save</strong>
              <ul>
                {changes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p>
                Restrictions and required roles still apply. The server
                recalculates current access after saving.
              </p>
            </div>
          )}
          <div className={styles.buttons}>
            <Button
              secondary
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setBaseline(null);
                setReview(false);
              }}
            >
              Discard changes
            </Button>
            <Button
              disabled={(review && reason.trim().length < 3) || developer}
              pending={save.isPending}
              onClick={() => (review ? save.mutate() : setReview(true))}
            >
              {review ? "Confirm and save" : "Review changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
  return (
    <>
      <p className={styles.note}>
        {developer
          ? "Developer access is protected. Select another workspace to view its permissions for reference."
          : kind === "user"
            ? "Choose a workspace. Turn a page on so this person can open it, then tick the actions they may use."
            : "These defaults apply to this role or committee. Individual overrides and explicit restrictions still apply."}{" "}
        {!developer && "Review and save to apply changes."}
      </p>
      <details className={styles.ruleGuide}>
        <summary>
          <Info size={18} aria-hidden="true" /> How access rules work{" "}
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <p>
          {developer
            ? "Developer recovery access is protected. Saved page rules cannot restrict it; required roles and service checks still apply."
            : "Roles decide which workspaces a person can use. The page switch lets them open a page; the action checkboxes decide what they may do there. An empty checkbox means the action is not allowed. A dash means its current setting could not be checked."}
        </p>
        <p>
          Default means the saved role or committee settings apply. A specific
          rule for this person can replace a default, but a committee block
          still prevents that action. Changes apply only after you review and
          save.
        </p>
      </details>
      {!actorDeveloper && !developer && (
        <p className={styles.note}>
          Restoring an existing override to defaults requires a developer. Other
          changes stay within your own authority.
        </p>
      )}
      {groups.some((group) => !group.advanced) && (
        <nav className={styles.workspacePicker} aria-label="Choose workspace">
          {groups.filter((group) => !group.advanced).map(workspaceButton)}
        </nav>
      )}
      {groups.some((group) => group.advanced) && (
        <details className={styles.advanced}>
          <summary>Advanced permissions</summary>
          <p className={styles.note}>
            Viewing published content and saved exceptions. These are permission
            settings, not roles.
          </p>
          <nav
            className={styles.workspacePicker}
            aria-label="Advanced permission scopes"
          >
            {groups.filter((group) => group.advanced).map(workspaceButton)}
          </nav>
        </details>
      )}
      {!selected.protected &&
        (searchTarget ? (
          createPortal(
            <label className={styles.search}>
              <span className={searchTarget ? styles.srOnly : undefined}>
                Find a module
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a module"
              />
            </label>,
            searchTarget,
          )
        ) : (
          <label className={styles.search}>
            <span className={searchTarget ? styles.srOnly : undefined}>
              Find a module
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a module"
            />
          </label>
        ))}
      {groups.map((group) => {
        if (group.protected)
          return selected.id === group.id && !search.trim() ? (
            <section
              className={styles.protectedPanel}
              key={group.id}
              aria-label="Developer protected access"
            >
              <ProtectedIcon size={28} aria-hidden="true" />
              <div>
                <h3>Protected system access</h3>
                <p>
                  Recovery access is protected and cannot be edited here.
                  Changes to Developer access must follow the system recovery
                  procedures.
                </p>
                <p>
                  Other workspaces are available as read-only references.
                  Required roles and workflow checks still apply.
                </p>
                <p>
                  Developer accounts do not need the Office delegation for
                  managing other users' access.
                </p>
              </div>
            </section>
          ) : null;
        if (!search.trim() && group.id !== selected.id) return null;
        const modules = group.modules.filter((m) =>
          `${moduleLabels[m]} ${m === "calendar" ? "bookings" : ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        );
        if (!modules.length) return null;
        return (
          <section
            className={styles.workspace}
            key={group.id}
            aria-label={group.label + " pages"}
          >
            <header className={styles.workspaceHeader}>
              <span>{group.label}</span>
              <small>
                {modules.length} {modules.length === 1 ? "module" : "modules"} ·{" "}
                {recordScopeLabels[group.scope]}
                {developer && " - Read-only reference"}
              </small>
            </header>

            <div>
              {group.id === "home" && (
                <p className={styles.note} style={{ padding: "0 16px" }}>
                  Homeowners can submit requests and listings for review where
                  allowed. Submission does not grant publishing permission.
                  Carpool follows its existing automatic publishing rule.
                </p>
              )}
              {group.id === "published" && (
                <p className={styles.note} style={{ padding: "0 16px" }}>
                  Controls viewing approved announcements, documents and
                  listings. This does not allow publishing them.
                </p>
              )}
              {group.id === "office" && !search && (
                <p className={styles.note} style={{ padding: "0 16px" }}>
                  Review inbox uses each page's approval actions. Managing other
                  users' access is a separate setting.
                </p>
              )}
              {[...modules]
                .sort(
                  (a, b) =>
                    Number(!operationsModules.has(a)) -
                    Number(!operationsModules.has(b)),
                )
                .map((module, index, ordered) => {
                  const rule = current.rules.find(
                      (r) => r.module === module && r.scope === group.scope,
                    ),
                    effective = data.effective?.[module + ":" + group.scope],
                    sources = data.sources.filter(
                      (s) => s.module === module && s.scope === group.scope,
                    );
                  const checks = moduleAccessChecks(rule?.mode, effective);
                  return (
                    <section
                      className={styles.module}
                      key={module}
                      aria-label={group.label + ": " + moduleLabels[module]}
                    >
                      {(index === 0 ||
                        moduleSection(ordered[index - 1]) !==
                          moduleSection(module)) && (
                        <h3 className={styles.sectionHeading}>
                          {moduleSection(module)}
                        </h3>
                      )}
                      <div className={styles.heading}>
                        <div>
                          <h4>{moduleLabels[module]}</h4>
                          <p>
                            {kind === "user"
                              ? `Current: ${effectiveAccessSummary(module, effective)}`
                              : rule
                                ? "Custom default"
                                : "Using defaults"}
                          </p>
                          {kind === "user" && sources.length > 0 && (
                            <p className={styles.sourceLine}>
                              Source (saved):{" "}
                              {sources.some((s) => s.subject_kind === "user")
                                ? "Individual override"
                                : sources.length > 1
                                  ? "Multiple rules"
                                  : sources[0]?.subject_kind === "role"
                                    ? (roleLabels[sources[0].subject_id] ??
                                        sources[0].subject_id) + " default"
                                    : sources[0]?.subject_kind === "committee"
                                      ? "Committee rule"
                                      : "Role permissions"}
                            </p>
                          )}
                        </div>
                        {developer ? (
                          <span className={styles.readOnlyBadge}>
                            Read-only reference
                          </span>
                        ) : (
                          <div className={styles.moduleVisibility}>
                            <span>Tab visibility</span>
                            <label className={styles.visibilityToggle}>
                              <input
                                type="checkbox"
                                role="switch"
                                aria-label={
                                  group.label +
                                  " " +
                                  moduleLabels[module] +
                                  " Tab visibility"
                                }
                                checked={checks.view === true}
                                disabled={busy || delegationNext !== null}
                                onChange={(event) =>
                                  change(
                                    module,
                                    group.scope,
                                    event.currentTarget.checked
                                      ? current.actions.some(
                                          (r) =>
                                            r.module === module &&
                                            r.scope === group.scope &&
                                            r.effect === "allow",
                                        ) ||
                                        checks.changes ||
                                        Object.entries(effective ?? {}).some(
                                          ([action, allowed]) =>
                                            action !== "view" &&
                                            allowed &&
                                            !current.actions.some(
                                              (r) =>
                                                r.module === module &&
                                                r.scope === group.scope &&
                                                r.action === action &&
                                                r.effect === "deny",
                                            ),
                                        )
                                        ? "edit"
                                        : "view"
                                      : "hidden",
                                  )
                                }
                              />
                              <span
                                aria-hidden="true"
                                className={styles.toggleTrack}
                              />
                              <span>
                                {checks.view === undefined
                                  ? "Not reported"
                                  : checks.view
                                    ? "On"
                                    : "Off"}
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                      {!!moduleActions[module]?.length &&
                        (developer || checks.view === true) && (
                          <div
                            className={styles.permissionActions}
                            role="group"
                            aria-label={
                              group.label +
                              " " +
                              moduleLabels[module] +
                              " actions"
                            }
                          >
                            <div className={styles.permissionCaption}>
                              <span>Actions</span>
                              <span>
                                {developer ? "Saved access" : "Allow"}
                              </span>
                            </div>
                            {(moduleActions[module] ?? []).map((action) => {
                              const override = current.actions.find(
                                (r) =>
                                  r.module === module &&
                                  r.scope === group.scope &&
                                  r.action === action,
                              );
                              const configured = override
                                ? override.effect === "allow"
                                : effective?.[action];
                              const checked = configured;
                              return (
                                <div
                                  className={styles.permissionRow}
                                  key={action}
                                >
                                  <div className={styles.permissionLabel}>
                                    <span>{actionLabel(module, action)}</span>
                                    {typeof effective?.[action] !==
                                      "boolean" && (
                                      <small>Saved access not reported</small>
                                    )}
                                  </div>
                                  <div className={styles.permissionControls}>
                                    {developer ? (
                                      <span
                                        className={styles.actionStatus}
                                        data-allowed={
                                          effective?.[action] === true
                                        }
                                      >
                                        {typeof effective?.[action] !==
                                        "boolean"
                                          ? "Not reported"
                                          : effective[action]
                                            ? "Allowed"
                                            : "Not allowed"}
                                      </span>
                                    ) : (
                                      <PermissionCheckbox
                                        label={
                                          group.label +
                                          " " +
                                          moduleLabels[module] +
                                          " " +
                                          actionLabel(module, action)
                                        }
                                        value={checked}
                                        disabled={
                                          busy ||
                                          delegationNext !== null ||
                                          checks.view !== true
                                        }
                                        onChange={(allow) =>
                                          change(
                                            module,
                                            group.scope,
                                            allow ? "allow" : "deny",
                                            action,
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {module === "calendar" && (
                              <p className={styles.note}>
                                Booking approval needs Finance payment approval
                                too.
                              </p>
                            )}
                          </div>
                        )}
                      {kind === "user" &&
                        (sources.some(
                          (s) =>
                            s.subject_kind === "user" ||
                            ["deny", "hidden"].includes(s.value),
                        ) ||
                          new Set(
                            sources.map(
                              (s) => s.subject_kind + ":" + s.subject_id,
                            ),
                          ).size > 1) && (
                          <details
                            className={`${styles.details} ${styles.moduleDisclosure}`}
                          >
                            <summary>
                              <Info size={18} aria-hidden="true" />
                              <span>Where this access comes from</span>
                              <ChevronDown size={18} aria-hidden="true" />
                            </summary>
                            {sources.length ? (
                              <ul>
                                {sources.map((source, i) => (
                                  <li key={i}>
                                    {source.subject_kind === "user"
                                      ? "Individual rule"
                                      : source.subject_kind === "role"
                                        ? `${roleLabels[source.subject_id] ?? source.subject_id} role`
                                        : `${source.subject_id} committee`}
                                    :{" "}
                                    {source.action
                                      ? actionLabel(module, source.action)
                                      : "Module access"}{" "}
                                    —{" "}
                                    {{
                                      hidden: "No access",
                                      view: "View only",
                                      edit: "Manage",
                                      allow: "Allow",
                                      deny: "Block",
                                    }[source.value] ?? source.value}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>
                                Existing role permissions apply. No additional
                                saved rule.
                              </p>
                            )}
                          </details>
                        )}
                    </section>
                  );
                })}
            </div>
          </section>
        );
      })}
      {!developer && (
        <details className={styles.advanced}>
          <summary>Reset custom access</summary>
          <p className={styles.note}>
            Reset removes a custom setting and uses role and committee defaults.
            Review and save to apply.
          </p>
          {!current.rules.length && !current.actions.length ? (
            <p className={styles.note}>No custom settings to reset.</p>
          ) : (
            <div className={styles.resetList}>
              {Array.from(
                new Set(
                  [...current.rules, ...current.actions].map(
                    (r) => r.module + ":" + r.scope,
                  ),
                ),
              ).map((key) => {
                const [module, scope] = key.split(":");
                const rule = current.rules.find(
                  (r) => r.module === module && r.scope === scope,
                );
                return (
                  <section
                    key={key}
                    aria-label={moduleLabels[module] + " defaults " + scope}
                  >
                    <h4>
                      {moduleLabels[module]}{" "}
                      <span>? {recordScopeLabels[scope] ?? scope}</span>
                    </h4>
                    <div className={styles.defaultActions}>
                      {rule && (
                        <button
                          type="button"
                          className={styles.resetLink}
                          disabled={
                            busy ||
                            delegationNext !== null ||
                            (!actorDeveloper &&
                              data.snapshot.rules.some(
                                (r) => r.module === module && r.scope === scope,
                              ))
                          }
                          onClick={() => change(module, scope, "inherit")}
                        >
                          Reset visibility
                        </button>
                      )}
                      {current.actions
                        .filter((r) => r.module === module && r.scope === scope)
                        .map((r) => (
                          <button
                            key={r.action}
                            type="button"
                            className={styles.resetLink}
                            disabled={
                              busy ||
                              delegationNext !== null ||
                              (!actorDeveloper &&
                                data.snapshot.actions.some(
                                  (saved) =>
                                    saved.module === module &&
                                    saved.scope === scope &&
                                    saved.action === r.action,
                                ))
                            }
                            onClick={() =>
                              change(module, scope, "inherit", r.action)
                            }
                          >
                            {"Reset " +
                              actionLabel(module, r.action) +
                              " to defaults"}
                          </button>
                        ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </details>
      )}
      {!selected.protected &&
        !groups.some((g) =>
          g.modules.some((m) =>
            `${moduleLabels[m]} ${m === "calendar" ? "bookings" : ""}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ),
        ) && <p>No matching modules.</p>}
      {kind === "user" &&
        !developer &&
        held.includes("admin") &&
        auth.member &&
        [auth.member.role, ...(auth.member.extra_roles ?? [])].includes(
          "developer",
        ) && (
          <section
            className={styles.delegation}
            aria-label="Manage other users’ access"
          >
            <div className={styles.delegationHeading}>
              <div>
                <h4>Manage other users’ access</h4>
                <p>
                  Allow this admin to change other users’ roles and permissions
                  within their own access.
                </p>
              </div>
              <label className={styles.visibilityToggle}>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Manage other users’ access"
                  aria-controls={
                    delegationNext !== null
                      ? "access-management-confirmation"
                      : undefined
                  }
                  checked={delegationNext ?? data.manager}
                  disabled={busy || !!draft}
                  onChange={(event) => {
                    const next = event.currentTarget.checked;
                    setDelegationNext(next === data.manager ? null : next);
                    setDelegationBase(data.manager);
                    setDelegationReason("");
                    delegation.reset();
                    setNotice("");
                  }}
                />
                <span className={styles.toggleTrack} aria-hidden="true" />
                <span aria-hidden="true">
                  {(delegationNext ?? data.manager) ? "On" : "Off"}
                </span>
              </label>
            </div>
            {!!draft && (
              <p className={styles.note}>
                Save or discard page access changes first.
              </p>
            )}
            {delegationNext !== null && (
              <div
                id="access-management-confirmation"
                className={styles.delegationConfirmation}
              >
                <p role="status">
                  Not saved · Access management will be turned{" "}
                  {delegationNext ? "on" : "off"} after you confirm.
                </p>
                <label>
                  Reason for this change
                  <input
                    value={delegationReason}
                    onChange={(e) => setDelegationReason(e.target.value)}
                    minLength={3}
                    maxLength={200}
                    disabled={busy}
                    autoComplete="off"
                  />
                </label>
                <Feedback error={delegation.error} />
                <div className={styles.delegationActions}>
                  <Button
                    secondary
                    disabled={busy}
                    onClick={() => {
                      setDelegationNext(null);
                      setDelegationBase(null);
                      setDelegationReason("");
                      delegation.reset();
                    }}
                  >
                    Cancel change
                  </Button>
                  <Button
                    disabled={busy || delegationReason.trim().length < 3}
                    onClick={() => delegation.mutate()}
                  >
                    {delegation.isPending ? "Saving…" : "Confirm change"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      {footerTarget ? createPortal(footer, footerTarget) : footer}
    </>
  );
}
