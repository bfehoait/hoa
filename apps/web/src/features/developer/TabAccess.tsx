import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Check, LockKeyhole, Eye, Pencil, Users } from "lucide-react";
import { useAuth } from "../../data/auth";
import type { AccessMember } from "../../data/access-control";
import { featureRpc } from "../../data/feature-records";
import {
  accessModules,
  accessScopes,
} from "../../../../../packages/shared/src/permissions";
import { roles, memberRoles } from "../../../../../packages/shared/src/auth";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { committees } from "./AccessManager";
import styles from "./TabAccess.module.css";

const settingsSchema = z.object({
  rules: z.record(z.string(), z.enum(["hidden", "view", "edit"])),
  manager: z.boolean(),
  effective: z
    .record(
      z.string(),
      z.object({
        read: z.boolean(),
        create: z.boolean(),
        reply: z.boolean(),
        status: z.boolean(),
      }),
    )
    .nullable()
    .optional(),
});
const ruleChoices = [
  {
    value: "hidden",
    label: "No access",
    hint: "Hide this tab and block changes",
  },
  {
    value: "view",
    label: "Read only",
    hint: "View records without changing them",
  },
  {
    value: "edit",
    label: "Read & edit",
    hint: "View, create and update records",
  },
] as const;
const moduleNames: Record<string, string> = {
  overview: "Overview",
  people: "People & accounts",
  registrations: "Applications",
  profiles: "Member profiles",
  property: "Properties & lots",
  requests: "Helpdesk",
  messages: "Messages",
  operations: "Office operations",
  finance: "Finance & payments",
  calendar: "Facilities & calendar",
  security: "Visitors & gate access",
  community: "Community updates",
  hotlines: "Emergency contacts",
  livelihood: "Marketplace",
  transport: "Shuttle service",
  documents: "Documents",
  elections: "Election information",
  reports: "Reports",
  audit: "Activity history",
};

export default function TabAccess({
  member,
  onDirtyChange,
}: {
  member?: AccessMember;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const auth = useAuth();
  const [kind, setKind] = useState("role");
  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState(
    member &&
      [member.role, ...(member.extra_roles ?? [])].some(
        (r) => r === "homeowner" || r === "renter",
      )
      ? "own"
      : "association",
  );
  const [dirty, setDirty] = useState(false);
  const reportDirty = useCallback(
    (value: boolean) => {
      setDirty(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );
  const options =
    kind === "role"
      ? roles.filter((r) => r !== "developer").map((r) => [r, r])
      : committees;
  if (auth.memberPreview)
    return <p>Access changes are disabled in account preview.</p>;
  return (
    <section
      className={member ? styles.memberPanel : styles.panel}
      aria-label="Tab access settings"
    >
      <div className={styles.sectionHeading}>
        <div>
          <h3>{member ? "Tab access" : "Role & committee defaults"}</h3>
          <p>
            {member
              ? "Choose one access level. Turning its toggle off restores defaults. Changes take effect after saving."
              : "Choose one default access level. Individual member rules can override it; switching the toggle off restores inherited permissions."}
          </p>
        </div>
      </div>
      <div className={styles.filters}>
        {!member && (
          <>
            <label>
              Configure
              <select
                aria-label="Configure"
                value={kind}
                disabled={dirty}
                onChange={(e) => {
                  setKind(e.target.value);
                  setSubject("");
                }}
              >
                <option value="role">Role defaults</option>
                <option value="committee">Committee defaults</option>
              </select>
            </label>
            <label>
              {kind === "role" ? "Role" : "Committee"}
              <select
                aria-label={kind === "role" ? "Role" : "Committee"}
                disabled={dirty}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">Choose one</option>
                {options.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Data scope
          <select
            aria-label="Data scope"
            disabled={dirty}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {accessScopes.map((s) => (
              <option key={s} value={s}>
                {
                  {
                    own: "Their own records",
                    approved: "Published member information",
                    assigned: "Assigned work",
                    association: "Association / office records",
                  }[s]
                }
              </option>
            ))}
          </select>
        </label>
      </div>
      {(member || subject) && (
        <Editor
          key={
            (member ? "user:" + member.user_id : kind + ":" + subject) +
            ":" +
            scope
          }
          kind={member ? "user" : kind}
          subject={member?.user_id ?? subject}
          scope={scope}
          onDirtyChange={reportDirty}
          isAdmin={
            !!member &&
            [member.role, ...(member.extra_roles ?? [])].includes("admin")
          }
        />
      )}
      {dirty && (
        <p className={styles.note}>
          Save or discard these changes before switching scope or account.
        </p>
      )}
    </section>
  );
}
function Editor({
  kind,
  subject,
  scope,
  isAdmin,
  onDirtyChange,
}: {
  kind: string;
  subject: string;
  scope: string;
  isAdmin: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string> | null>(null),
    [baseline, setBaseline] = useState<Record<string, string> | null>(null),
    [moduleSearch, setModuleSearch] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    onDirtyChange(draft !== null);
  }, [draft, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const query = useQuery({
    queryKey: ["tab-access", auth.userId, kind, subject, scope],
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      settingsSchema.parse(
        await featureRpc("bfe_tab_access", {
          p_kind: kind,
          p_subject: subject,
          p_scope: scope,
        }),
      ),
  });
  const mutation = useMutation({
    mutationFn: async (manager: boolean | null) => {
      if (note.trim().length < 3)
        throw new Error("Add a change reason of at least three characters.");
      if (manager !== null)
        return featureRpc("bfe_set_access_manager", {
          p_user: subject,
          p_active: manager,
          p_note: note,
        });
      return featureRpc("bfe_save_tab_access", {
        p_kind: kind,
        p_subject: subject,
        p_scope: scope,
        p_rules: draft ?? query.data?.rules,
        p_expected: baseline ?? query.data?.rules,
        p_note: note,
      });
    },
    onSuccess: async () => {
      setDraft(null);
      setBaseline(null);
      setMessage("Access change confirmed by the server.");
      await cache.invalidateQueries({ queryKey: ["tab-access"] });
      await cache.invalidateQueries({ queryKey: ["permissions"] });
    },
  });
  if (query.isPending) return <Skeleton />;
  if (query.isError) return <Feedback error={query.error} />;
  const data = query.data,
    rules = draft ?? data.rules;
  const modules = accessModules
    .filter((m) => !["access", "profile", "support", "technical"].includes(m))
    .filter((m) =>
      `${moduleNames[m] ?? m} ${m}`
        .toLowerCase()
        .includes(moduleSearch.toLowerCase()),
    );
  return (
    <>
      <label className={styles.tabSearch}>
        Find a tab
        <input
          type="search"
          value={moduleSearch}
          onChange={(e) => setModuleSearch(e.target.value)}
          placeholder="Search pages and services"
        />
      </label>
      <div className={styles.explanation}>
        <strong>
          {kind === "user"
            ? "Current permissions are separate from your changes"
            : "You are editing a group default"}
        </strong>
        <p>
          {kind === "user"
            ? "Current permissions come from the server for the selected data scope. Choosing a rule does not change them until you save."
            : "Members may have individual rules or committee permissions. Open a member to see their current access."}
        </p>
        {kind === "user" && !data.effective && (
          <p className={styles.unavailable}>
            Current permissions are not reported by this server yet. Saved rules
            are shown below; they do not confirm effective access. Ask the
            system administrator to enable permission summaries.
          </p>
        )}
      </div>
      <div
        className={`${styles.matrix} ${kind !== "user" ? styles.groupMatrix : ""}`}
        role="group"
        aria-label="Tab permission matrix"
      >
        <div className={styles.matrixHead} aria-hidden="true">
          <span>Page / tab</span>
          {kind === "user" && <span>Current permissions</span>}
          <span>Access rule · choose one</span>
        </div>
        {modules.map((module) => {
          const mode = rules[module] ?? "inherit";
          const name = moduleNames[module] ?? module;
          const effective = data.effective?.[module];
          const edits = effective
            ? [effective.create, effective.reply, effective.status].filter(
                Boolean,
              ).length
            : 0;
          const changed =
            (rules[module] ?? "inherit") !== (data.rules[module] ?? "inherit");
          const change = (value: string) => {
            if (!draft) setBaseline({ ...data.rules });
            const next = { ...rules };
            if (value === "inherit") delete next[module];
            else next[module] = value;
            const unchanged =
              Object.keys(next).length === Object.keys(data.rules).length &&
              Object.entries(next).every(
                ([key, value]) => data.rules[key] === value,
              );
            setDraft(unchanged ? null : next);
            if (unchanged) setBaseline(null);
            setMessage("");
          };
          return (
            <div
              className={styles.permissionRow}
              key={module}
              role="group"
              aria-label={name + " permissions"}
            >
              <div className={styles.moduleName}>
                <strong>{name}</strong>
                <small>
                  {mode === "inherit"
                    ? "Follows role & committee defaults"
                    : kind === "user"
                      ? "Individual rule"
                      : "Group rule"}
                </small>
                {changed && (
                  <span className={styles.unsaved}>Unsaved change</span>
                )}
              </div>
              {kind === "user" && (
                <div
                  className={styles.currentAccess}
                  aria-label={name + " current permissions"}
                >
                  <span className={styles.mobileLabel}>
                    Current permissions
                  </span>
                  {effective ? (
                    <>
                      <span
                        className={
                          effective.read ? styles.allowed : styles.blocked
                        }
                      >
                        {effective.read ? (
                          <Eye size={16} aria-hidden="true" />
                        ) : (
                          <LockKeyhole size={16} aria-hidden="true" />
                        )}
                        {effective.read ? "Can read" : "Cannot read"}
                      </span>
                      <span
                        className={
                          edits === 3
                            ? styles.allowed
                            : edits
                              ? styles.limited
                              : styles.blocked
                        }
                      >
                        {edits ? (
                          <Pencil size={16} aria-hidden="true" />
                        ) : (
                          <LockKeyhole size={16} aria-hidden="true" />
                        )}
                        {edits === 3
                          ? "Can edit"
                          : edits
                            ? "Some changes allowed"
                            : "Cannot edit"}
                      </span>
                      {edits > 0 && edits < 3 && (
                        <small>
                          {[
                            effective.create
                              ? "Create allowed"
                              : "Create blocked",
                            effective.reply
                              ? "Replies allowed"
                              : "Replies blocked",
                            effective.status
                              ? "Status updates allowed"
                              : "Status updates blocked",
                          ].join(" · ")}
                        </small>
                      )}
                    </>
                  ) : (
                    <span className={styles.notReported}>Not reported</span>
                  )}
                </div>
              )}
              <div
                className={styles.ruleOptions}
                role="group"
                aria-label={name + " access rule"}
              >
                {ruleChoices.map(({ value, label, hint }) => (
                  <label
                    key={value}
                    className={styles.ruleChoice}
                    data-selected={mode === value || undefined}
                  >
                    <input
                      type="checkbox"
                      role="switch"
                      value={value}
                      aria-label={name + ": " + label}
                      aria-describedby={
                        kind + subject + scope + module + value + "-hint"
                      }
                      checked={mode === value}
                      disabled={mutation.isPending}
                      onChange={(event) =>
                        change(event.target.checked ? value : "inherit")
                      }
                    />
                    <span>
                      {label}
                      <small
                        className={styles.toggleHint}
                        id={kind + subject + scope + module + value + "-hint"}
                      >
                        {hint}
                      </small>
                    </span>
                    <span className={styles.toggleState} aria-hidden="true">
                      <span className={styles.toggleTrack} />
                      {mode === value ? "On" : "Off"}
                    </span>
                  </label>
                ))}
                <div className={styles.defaultRule}>
                  <Button
                    secondary
                    size="sm"
                    disabled={mutation.isPending}
                    aria-label={name + ": Use defaults"}
                    aria-pressed={mode === "inherit"}
                    onClick={() => change("inherit")}
                  >
                    {mode === "inherit" ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Users size={16} aria-hidden="true" />
                    )}
                    Use defaults
                  </Button>
                  <small>
                    {mode === "inherit"
                      ? "Defaults selected"
                      : "Custom rule selected"}
                  </small>
                </div>
              </div>
            </div>
          );
        })}
        {!modules.length && (
          <p className={styles.noMatches}>
            No tabs match “{moduleSearch}”. Try another name.
          </p>
        )}
      </div>
      <p className={styles.note}>
        Editing includes creating, replying and updating records in this scope.
        Approval, publishing, export and permission management remain separate
        grants in the account settings below. Explicit denials and account
        restrictions still apply, even when a rule allows access.
      </p>
      <label className={styles.reason}>
        Reason for this change
        <input
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What access is needed and why?"
        />
      </label>
      <Feedback error={mutation.error} message={message} />
      {draft && (
        <div className={styles.actions}>
          <Button
            disabled={!draft || note.trim().length < 3}
            pending={mutation.isPending}
            onClick={() => mutation.mutate(null)}
          >
            Save tab permissions
          </Button>
          <Button
            secondary
            disabled={!draft || mutation.isPending}
            onClick={() => {
              setDraft(null);
              setBaseline(null);
            }}
          >
            Discard changes
          </Button>
        </div>
      )}
      {kind === "user" &&
        isAdmin &&
        auth.member &&
        memberRoles(auth.member).includes("developer") && (
          <section className={styles.delegation}>
            <h3>Permission management</h3>
            <p>
              {data.manager
                ? "This admin can manage access within their own authority."
                : "Allow this admin to manage roles, group defaults and user permissions within their own authority."}
            </p>
            <Button
              secondary
              disabled={!!draft || note.trim().length < 3}
              pending={mutation.isPending}
              onClick={() => mutation.mutate(!data.manager)}
            >
              {data.manager
                ? "Remove permission management"
                : "Allow permission management"}
            </Button>
          </section>
        )}
    </>
  );
}
