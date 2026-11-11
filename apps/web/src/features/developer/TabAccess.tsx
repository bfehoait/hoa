import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { LockKeyhole, Eye, Pencil, Users } from "lucide-react";
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

export const recordScopeLabels: Record<string, string> = {
  own: "Their own household records",
  approved: "Published community information",
  assigned: "Records assigned to them",
  association: "Association records across members",
};

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
  livelihood: "Livelihood",
  transport: "Shuttle service",
  documents: "Documents",
  elections: "Election information",
  reports: "Reports",
  audit: "Activity history",
};

export default function TabAccess({
  member,
  onDirtyChange,
  onPendingChange,
  footerTarget,
  recordScope,
}: {
  member?: AccessMember;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  footerTarget?: HTMLElement | null;
  recordScope?: string;
}) {
  const auth = useAuth();
  const [kind, setKind] = useState("role");
  const [subject, setSubject] = useState("");
  const [localScope, setScope] = useState(
    member &&
      [member.role, ...(member.extra_roles ?? [])].some(
        (r) => r === "homeowner" || r === "renter",
      )
      ? "own"
      : "association",
  );
  const scope = recordScope ?? localScope;
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
      {!member && (
        <div className={styles.sectionHeading}>
          <div>
            <h3>Role & committee defaults</h3>
            <p>
              Choose one default access level. Individual member rules can
              override it; switching the toggle off restores inherited
              permissions.
            </p>
          </div>
        </div>
      )}
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
        {member && recordScope ? (
          <div>
            <p className={styles.note}>
              Showing access for: {recordScopeLabels[scope]}
            </p>
          </div>
        ) : (
          <label>
            Which records
            <span className={styles.reasonHint}>
              A permission is always about a kind of record. Pick which kind,
              then set each page below. Most office work is “association
              records”.
            </span>
            <select
              aria-label="Which records"
              disabled={dirty}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              {accessScopes.map((s) => (
                <option key={s} value={s}>
                  {
                    {
                      own: "Only their own household's records",
                      approved: "Published information everyone may read",
                      assigned: "Work assigned to them",
                      association: "Association records — everyone's",
                    }[s]
                  }
                </option>
              ))}
            </select>
          </label>
        )}
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
          onPendingChange={onPendingChange}
          footerTarget={footerTarget}
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
  onPendingChange,
  footerTarget,
}: {
  kind: string;
  subject: string;
  scope: string;
  isAdmin: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  footerTarget?: HTMLElement | null;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string> | null>(null),
    [baseline, setBaseline] = useState<Record<string, string> | null>(null),
    [moduleSearch, setModuleSearch] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  // The server refuses a permission change without a reason of three to 200
  // characters (bfe_save_tab_access). Both buttons were disabled silently, so
  // a greyed-out Save read as broken rather than blocked.
  const noteBlocked = note.trim().length < 3;
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
  useEffect(() => {
    onPendingChange?.(mutation.isPending);
  }, [mutation.isPending, onPendingChange]);
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
  const reasonField = (
    <label className={styles.reason}>
      Reason for this change
      <input
        value={note}
        maxLength={200}
        required
        disabled={mutation.isPending}
        onChange={(event) => setNote(event.target.value)}
        placeholder="For example: assigned to booking requests"
      />
      {draft && note.trim().length < 3 && (
        <small>Enter at least 3 characters to save.</small>
      )}
    </label>
  );
  const saveControls = (
    <div className={footerTarget ? styles.footerTools : styles.actions}>
      {footerTarget && draft && reasonField}
      {footerTarget && <Feedback error={mutation.error} message={message} />}
      <div className={styles.footerButtons}>
        <Button
          disabled={!draft || note.trim().length < 3}
          pending={mutation.isPending}
          onClick={() => mutation.mutate(null)}
        >
          {footerTarget ? "Save changes" : "Save tab permissions"}
        </Button>
        {draft && (
          <Button
            secondary
            disabled={mutation.isPending}
            onClick={() => {
              setDraft(null);
              setBaseline(null);
            }}
          >
            Discard changes
          </Button>
        )}
      </div>
    </div>
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
        <p>
          {kind === "user"
            ? "Switches show saved access. Changes apply after saving."
            : "Individual member rules can override these group defaults."}
        </p>
        <details className={styles.legend}>
          <summary>How access levels work</summary>
          <ul>
            {ruleChoices.map(({ value, label, hint }) => (
              <li key={value}>
                <strong>{label}:</strong> {hint}.
              </li>
            ))}
          </ul>
          <p>
            Defaults follow role and committee permissions. Approval,
            publication and export are granted separately. Limited access is
            labelled with the actions allowed.
          </p>
        </details>
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
          // Defaults are a rule source, not a fourth access level. Display the
          // server's effective level until an explicit change is drafted.
          // Limited edits use a more precise label on the active edit switch.
          const currentLevel = effective
            ? !effective.read && edits === 0
              ? "hidden"
              : effective.read && edits === 0
                ? "view"
                : effective.read && edits > 0
                  ? "edit"
                  : null
            : null;
          const shownMode = changed
            ? mode === "inherit"
              ? null
              : mode
            : kind === "user"
              ? currentLevel
              : mode;
          const limitedCurrent =
            kind === "user" &&
            !changed &&
            effective?.read &&
            edits > 0 &&
            edits < 3;
          const limitedLabel =
            edits === 1
              ? effective?.create
                ? "Read & create"
                : effective?.reply
                  ? "Read & reply"
                  : "Read & update"
              : "Read & edit (limited)";
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
                    ? "From defaults"
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
                    data-selected={shownMode === value || undefined}
                  >
                    <input
                      type="checkbox"
                      role="switch"
                      value={value}
                      aria-label={
                        name +
                        ": " +
                        (value === "edit" && limitedCurrent
                          ? limitedLabel
                          : label)
                      }
                      aria-describedby={
                        kind + subject + scope + module + value + "-hint"
                      }
                      checked={shownMode === value}
                      disabled={mutation.isPending}
                      onChange={(event) =>
                        change(
                          event.target.checked
                            ? value
                            : value === "edit" && limitedCurrent
                              ? "view"
                              : "inherit",
                        )
                      }
                    />
                    <span>
                      {value === "edit" && limitedCurrent
                        ? limitedLabel
                        : label}
                      <small
                        className={styles.toggleHint}
                        id={kind + subject + scope + module + value + "-hint"}
                      >
                        {value === "edit" && limitedCurrent
                          ? "Only the actions shown in Current permissions are allowed"
                          : hint}
                      </small>
                    </span>
                    <span className={styles.toggleState} aria-hidden="true">
                      <span className={styles.toggleTrack} />
                      {shownMode === value ? "On" : "Off"}
                    </span>
                  </label>
                ))}
                <div className={styles.defaultRule}>
                  {mode === "inherit" ? (
                    <small>
                      {changed ? "Defaults after saving" : "Using defaults"}
                    </small>
                  ) : (
                    <Button
                      tone="quiet"
                      size="sm"
                      disabled={mutation.isPending}
                      aria-label={name + ": Use defaults"}
                      onClick={() => change("inherit")}
                    >
                      <Users size={16} aria-hidden="true" /> Use defaults
                    </Button>
                  )}
                </div>
                {kind === "user" && !shownMode && (
                  <p className={styles.levelExplanation}>
                    {changed && mode === "inherit"
                      ? "Save to apply defaults and refresh the current access level."
                      : effective
                        ? "This member has limited action permissions. See Current permissions; no single access level describes them."
                        : "Current access hasn't been reported. Choose a level only if you want to set a new rule."}
                  </p>
                )}
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
        Approval, publishing and export need separate permissions. Account
        restrictions still apply.
      </p>
      {!footerTarget && reasonField}
      {footerTarget ? (
        createPortal(saveControls, footerTarget)
      ) : (
        <>
          <Feedback error={mutation.error} message={message} />
          {draft && saveControls}
        </>
      )}
      {kind === "user" &&
        isAdmin &&
        auth.member &&
        memberRoles(auth.member).includes("developer") && (
          <details className={styles.delegation}>
            <summary>
              Manage other members' access
              <span>{data.manager ? "Allowed" : "Not allowed"}</span>
            </summary>
            <p className={styles.note}>
              Lets this office admin manage roles and permissions within their
              own authority. Changes here apply immediately after confirmation
              by the server.
            </p>
            {draft ? (
              <p className={styles.note}>Save or discard page changes first.</p>
            ) : (
              footerTarget && reasonField
            )}
            <Button
              secondary
              disabled={!!draft || note.trim().length < 3}
              pending={mutation.isPending}
              onClick={() => mutation.mutate(!data.manager)}
            >
              {data.manager
                ? "Remove access management"
                : "Allow access management"}
            </Button>
            {noteBlocked && !draft && (
              <p className={styles.reasonHint}>
                Enter a reason of at least 3 characters to continue.
              </p>
            )}
          </details>
        )}
    </>
  );
}
