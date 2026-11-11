import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { DirectoryMember } from "../../../../../packages/shared/src/people";
import {
  memberDetailsInputSchema,
  memberWorkspaceSchema,
  type MemberWorkspace as Workspace,
} from "../../../../../packages/shared/src/member-management";
import { accountLotMatchSchema } from "../../../../../packages/shared/src/registry";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Modal, Skeleton } from "../../components/UI";
import { Link } from "../../components/AccessLink";
import styles from "./MemberWorkspace.module.css";
import PrivateHealthNote from "../more/PrivateHealthNote";
import HouseholdRoster from "./HouseholdRoster";

const labels = {
  name: "Recorded name",
  phone: "Mobile number",
  unit: "Recorded address",
  title: "Position",
} as const;
type Input = z.infer<typeof memberDetailsInputSchema>;
const date = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function MemberWorkspace({
  initial,
  onClose,
}: {
  initial: DirectoryMember;
  onClose: () => void;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [tab, setTab] = useState<"details" | "properties" | "history">(
    "details",
  );
  const [page, setPage] = useState(0),
    [editing, setEditing] = useState(false),
    [linking, setLinking] = useState(false),
    [linkBusy, setLinkBusy] = useState(false);
  const [notice, setNotice] = useState(""),
    [formError, setFormError] = useState<Error | null>(null);
  const [editBase, setEditBase] = useState<Workspace | null>(null);
  const [draft, setDraft] = useState<Input>({
    name: "",
    phone: "",
    unit: "",
    title: "",
    reason: "",
  });
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterEditing, setRosterEditing] = useState(false);
  const detailsFormId = useId();
  const key = ["office-member-workspace", auth.userId, initial.id, page];
  const query = useQuery({
    queryKey: key,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      memberWorkspaceSchema.parse(
        await featureRpc("bfe_office_member_workspace", {
          p_member: initial.id,
          p_page: page,
        }),
      ),
  });
  const data = query.data,
    member = data?.member ?? initial;
  const refreshRelated = async () => {
    await Promise.all(
      [
        "office-people",
        "office-member-workspace",
        "registry",
        "auth-member",
        "office-review-inbox",
        "office-pending-lots",
        "household-application",
        "calendar-bookings",
      ].map((family) => cache.invalidateQueries({ queryKey: [family] })),
    );
    await cache.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] === "account" && q.queryKey.includes("notifications"),
    });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!editBase) throw new Error("Reopen the correction form.");
      const input = memberDetailsInputSchema.parse(draft);
      return memberWorkspaceSchema.parse(
        await featureRpc("bfe_update_member_details", {
          p_member: initial.id,
          p_expected: editBase.expected,
          p_name: input.name,
          p_phone: input.phone,
          p_unit: input.unit,
          p_title: input.title,
          p_reason: input.reason,
        }),
      );
    },
    onSuccess: async (result) => {
      cache.setQueryData(
        ["office-member-workspace", auth.userId, initial.id, 0],
        result,
      );
      setPage(0);
      setEditing(false);
      setNotice("Recorded details updated by the server.");
      await refreshRelated();
    },
  });
  const busy = save.isPending || linkBusy || rosterBusy;
  return (
    <Modal
      title={member.name || "Member details"}
      size="lg"
      className={styles.workspace}
      presentation="task"
      busy={busy}
      protectChanges={editing || linking || rosterEditing}
      onClose={onClose}
      footer={
        !linking && !rosterEditing && !query.isPending ? (
          <div className={styles.footerBar}>
            {editing ? (
              <>
                <Feedback error={formError ?? save.error} />
                <div className={styles.footerActions}>
                  <Button type="submit" form={detailsFormId} pending={busy}>
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    secondary
                    disabled={busy}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {tab === "details" && data?.can_edit && (
                  <Button
                    type="button"
                    onClick={() => {
                      setEditBase(data);
                      setDraft({
                        name: member.name ?? "",
                        phone: member.phone ?? "",
                        unit: member.unit ?? "",
                        title: member.title ?? "",
                        reason: "",
                      });
                      setEditing(true);
                      setNotice("");
                      setFormError(null);
                      save.reset();
                    }}
                  >
                    Edit details
                  </Button>
                )}
              </>
            )}
            {!editing && !linking && (
              <div className={styles.footerActions}>
                <Button
                  secondary
                  disabled={busy || query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Refresh member
                </Button>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <div className={styles.tabs} role="group" aria-label="Member workspace">
        {(["details", "properties", "history"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            disabled={busy || editing || linking || rosterEditing}
            onClick={() => {
              setTab(value);
              setNotice("");
            }}
          >
            {value === "details"
              ? "Details"
              : value === "properties"
                ? "Properties"
                : "History"}
          </button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      <Feedback error={query.error} />
      {query.isPending ? (
        <Skeleton />
      ) : tab === "details" ? (
        <>
          <form
            id={detailsFormId}
            className={`${styles.form} ${styles.inlineDetails}`}
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing || busy) return;
              setFormError(null);
              const parsed = memberDetailsInputSchema.safeParse(draft);
              if (!parsed.success) {
                setFormError(
                  new Error(
                    parsed.error.issues[0]?.message ?? "Check the details.",
                  ),
                );
                return;
              }
              if (
                (Object.keys(labels) as (keyof typeof labels)[]).every(
                  (field) =>
                    parsed.data[field] === (editBase?.member[field] ?? ""),
                )
              ) {
                setFormError(new Error("No detail changes to save."));
                return;
              }
              save.mutate();
            }}
          >
            <dl className={styles.details}>
              {(["name", "email", "phone", "unit", "title"] as const).map(
                (field) => (
                  <div key={field}>
                    <dt>
                      {editing && field !== "email" ? (
                        <label htmlFor={`member-detail-${field}`}>
                          {labels[field]}
                        </label>
                      ) : field === "email" ? (
                        "Recorded email"
                      ) : (
                        labels[field]
                      )}
                    </dt>
                    <dd>
                      {editing && field !== "email" ? (
                        <input
                          id={`member-detail-${field}`}
                          aria-label={labels[field]}
                          required={field === "name"}
                          disabled={busy}
                          value={draft[field]}
                          type={field === "phone" ? "tel" : "text"}
                          maxLength={
                            field === "phone" ? 30 : field === "unit" ? 40 : 120
                          }
                          onChange={(e) =>
                            setDraft((current) => ({
                              ...current,
                              [field]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        member[field] || "Not supplied"
                      )}
                    </dd>
                  </div>
                ),
              )}
              <div>
                <dt>Roles / status</dt>
                <dd>
                  {[member.role, ...(member.extra_roles ?? [])].join(", ")} /{" "}
                  {member.status}
                </dd>
              </div>
              <div>
                <dt>Sign-in account</dt>
                <dd>
                  {!data
                    ? "Not checked"
                    : data.auth_state === "linked"
                      ? "Account exists"
                      : data.auth_state === "missing"
                        ? "Recorded account could not be found"
                        : "No account linked"}
                </dd>
              </div>
              {editing && (
                <div>
                  <dt>
                    <label htmlFor="member-correction-reason">
                      Reason for correction
                    </label>
                  </dt>
                  <dd>
                    <textarea
                      id="member-correction-reason"
                      required
                      disabled={busy}
                      minLength={3}
                      maxLength={200}
                      value={draft.reason}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          reason: e.target.value,
                        }))
                      }
                    />
                  </dd>
                </div>
              )}
            </dl>
            <p className={styles.note}>
              Address text does not establish property access. Login email,
              roles and status use their separate protected account flows.
            </p>

            {data?.profile && (
              <details className={styles.record}>
                <summary>Resident profile preferences</summary>
                <p>
                  Display name: {data.profile.display_name || "Not supplied"}
                </p>
                <p>Profile phone: {data.profile.phone || "Not supplied"}</p>
                <p className={styles.note}>
                  Maintained separately by the resident. These preferences do
                  not replace the recorded details above.
                </p>
              </details>
            )}
          </form>
          {data?.can_edit && data.member.user_id && !editing && (
            <PrivateHealthNote target={data.member.user_id} />
          )}
        </>
      ) : tab === "properties" ? (
        !data?.can_view_properties ? (
          <p>
            Property review access is required to view verified relationships.
          </p>
        ) : (
          <>
            <p className={styles.note}>
              Link a verified owner, renter or household relationship.
              Registered ownership and receipt access stay separate.
            </p>
            {data.properties.map((r) => (
              <article className={styles.record} key={r.membership_id}>
                <strong>{r.physical_id}</strong>
                <p>
                  {r.relationship} · {r.state}
                  {!r.active_import
                    ? " · inactive import"
                    : r.expires_at &&
                        new Date(r.expires_at).getTime() <= query.dataUpdatedAt
                      ? " · expired"
                      : ""}
                </p>
                <p className={styles.note}>
                  From {date(r.starts_at)}
                  {r.expires_at ? ` until ${date(r.expires_at)}` : ""}
                </p>
                {r.reference && (
                  <p className={styles.note}>Reference: {r.reference}</p>
                )}
                <Link className="text-link" to={`/office/lots/${r.lot_id}`}>
                  Open lot & relationship review
                </Link>
              </article>
            ))}
            {!data.properties.length && (
              <p>No property relationships recorded.</p>
            )}
            {!data.can_link && (
              <p className={styles.note}>
                {member.user_id === auth.userId
                  ? "Another authorized staff member must link your own account."
                  : "Linking requires an active sign-in account and account/property management permissions."}
              </p>
            )}
            {data.can_link && !linking && !rosterEditing && (
              <Button
                onClick={() => {
                  setLinking(true);
                  setNotice("");
                }}
              >
                {data.properties.some(
                  (relationship) =>
                    relationship.state === "approved" &&
                    relationship.active_import &&
                    new Date(relationship.starts_at).getTime() <=
                      query.dataUpdatedAt &&
                    (!relationship.expires_at ||
                      new Date(relationship.expires_at).getTime() >
                        query.dataUpdatedAt),
                )
                  ? "Link another property"
                  : "Link property"}
              </Button>
            )}
            {!linking && member.user_id && (
              <HouseholdRoster
                target={member.user_id}
                onBusy={setRosterBusy}
                onEditing={setRosterEditing}
              />
            )}
            {linking && member.user_id && (
              <PropertyLink
                target={member.user_id}
                memberId={member.id}
                expected={data.expected}
                onBusy={setLinkBusy}
                onCancel={() => setLinking(false)}
                onLinked={async () => {
                  setLinking(false);
                  setNotice(
                    "Verified property relationship confirmed by the server.",
                  );
                  await refreshRelated();
                }}
              />
            )}
          </>
        )
      ) : !data?.can_history ? (
        <p>
          Member management or audit access is required to view correction
          history.
        </p>
      ) : (
        <>
          <h3>Detail corrections</h3>
          {!data.history.length && <p>No recorded detail corrections.</p>}
          {data.history.map((h) => (
            <article className={styles.record} key={h.id}>
              <strong>{h.actor_name}</strong>
              <p className={styles.note}>{date(h.changed_at)}</p>
              <p>{h.reason}</p>
              <ul className={styles.changes}>
                {(Object.keys(labels) as (keyof typeof labels)[])
                  .filter(
                    (field) => h.before_values[field] !== h.after_values[field],
                  )
                  .map((field) => (
                    <li key={field}>
                      {labels[field]}:{" "}
                      {h.before_values[field] || "Not supplied"} →{" "}
                      {h.after_values[field] || "Not supplied"}
                    </li>
                  ))}
              </ul>
            </article>
          ))}
          {data.history_total > 20 && (
            <div className={styles.actions}>
              <Button
                secondary
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous corrections
              </Button>
              <span>Page {page + 1}</span>
              <Button
                secondary
                disabled={(page + 1) * 20 >= data.history_total}
                onClick={() => setPage(page + 1)}
              >
                Next corrections
              </Button>
            </div>
          )}
          <h3>Property link history</h3>
          <p className={styles.note}>
            Latest 50 permitted actions. Full lot history is available in the
            Lot register.
          </p>
          {!data.link_history.length && (
            <p>No permitted property-link history.</p>
          )}
          {data.link_history.map((h) => (
            <article className={styles.record} key={h.id}>
              <strong>{h.action}</strong>
              <p>
                {h.physical_id} · {h.relationship}
              </p>
              <p className={styles.note}>
                {h.actor_name} · {date(h.at)}
              </p>
              {h.reference && <p>{h.reference}</p>}
            </article>
          ))}
        </>
      )}
    </Modal>
  );
}

function PropertyLink({
  target,
  memberId,
  expected,
  onBusy,
  onCancel,
  onLinked,
}: {
  target: string;
  memberId: string;
  expected: Workspace["expected"];
  onBusy: (value: boolean) => void;
  onCancel: () => void;
  onLinked: () => Promise<void>;
}) {
  const [phase, setPhase] = useState(""),
    [block, setBlock] = useState(""),
    [lot, setLot] = useState("");
  const [match, setMatch] = useState<z.infer<
      typeof accountLotMatchSchema
    > | null>(null),
    [checking, setChecking] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const link = useMutation({
    mutationFn: async (f: FormData) => {
      if (!match?.candidate)
        throw new Error("Check the account and lot again.");
      return z
        .object({ membership_id: z.uuid(), already_linked: z.boolean() })
        .parse(
          await featureRpc("bfe_office_link_member_property", {
            p_member: memberId,
            p_expected: expected,
            p_lot: match.candidate.id,
            p_lot_version: match.candidate.version,
            p_relationship: f.get("relationship"),
            p_reference: f.get("reference"),
          }),
        );
    },
    onSuccess: onLinked,
  });
  const busy = checking || link.isPending;
  return (
    <div className={styles.form}>
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setChecking(true);
          onBusy(true);
          setError(null);
          setMatch(null);
          try {
            setMatch(
              accountLotMatchSchema.parse(
                await featureRpc("bfe_account_lot_match", {
                  p_target: target,
                  p_physical: `${Number(phase)}-${String(Number(block)).padStart(2, "0")}-${String(Number(lot)).padStart(3, "0")}`,
                }),
              ),
            );
          } catch (error) {
            setError(
              error instanceof Error
                ? error
                : new Error("The lot could not be checked."),
            );
          } finally {
            setChecking(false);
            onBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className={styles.address}>
            {[
              ["Phase", phase, setPhase, 9999],
              ["Block", block, setBlock, 99],
              ["Lot", lot, setLot, 999],
            ].map(([label, value, setter, max]) => (
              <label key={String(label)}>
                {String(label)}
                <input
                  type="number"
                  required
                  min={1}
                  max={Number(max)}
                  step={1}
                  value={String(value)}
                  onChange={(e) => {
                    (setter as (value: string) => void)(e.target.value);
                    setMatch(null);
                    link.reset();
                  }}
                />
              </label>
            ))}
          </div>
          <Button secondary type="submit" pending={checking}>
            Check property
          </Button>
        </fieldset>
      </form>
      <Feedback error={error ?? link.error} />
      {match && !match.candidate && (
        <div>
          <p>No matching lot was found in an active registry import.</p>
          <p className={styles.note}>
            Check the existing Lot register before linking. Entering an address
            does not create a lot.
          </p>
          <Link
            className="text-link"
            to={`/office/lots?search=${encodeURIComponent(match.physical_id ?? "")}`}
          >
            Check Lot register
          </Link>
        </div>
      )}
      {match?.candidate && (
        <form
          className={styles.form}
          onChange={() => {
            setError(null);
            link.reset();
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            // Snapshot enabled fields before the pending state disables them.
            // TanStack Query can run mutationFn after React commits that state.
            const values = new FormData(e.currentTarget);
            onBusy(true);
            try {
              await link.mutateAsync(values);
            } catch {
              /* Mutation feedback retains the checked snapshot and draft. */
            } finally {
              onBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <p>
              <strong>{match.candidate.physical_id}</strong>
              <br />
              Recorded homeowner:{" "}
              {match.candidate.recorded_homeowner || "Not supplied"}
            </p>
            <label>
              Verified relationship
              <select name="relationship" required>
                <option value="">Choose</option>
                <option value="owner">Owner relationship</option>
                <option value="renter">Renter</option>
                <option value="household">Household member</option>
              </select>
            </label>
            <label>
              Verification reference
              <input name="reference" required minLength={3} maxLength={200} />
            </label>
            <label className={styles.check}>
              <input type="checkbox" required />I verified this account, lot and
              relationship against supporting evidence.
            </label>
            <Button
              type="submit"
              disabled={!match.can_link}
              pending={link.isPending}
            >
              Confirm property link
            </Button>
          </fieldset>
        </form>
      )}
      <Button secondary disabled={busy} onClick={onCancel}>
        Cancel linking
      </Button>
    </div>
  );
}
