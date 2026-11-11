import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { accountLotMatchSchema } from "../../../../../packages/shared/src/registry";
import type { FeatureRecord } from "../../../../../packages/shared/src/feature-records";
import { useAuth } from "../../data/auth";
import { featureRpc, useFeatureMutation } from "../../data/feature-records";
import { Button, Feedback, Modal } from "../../components/UI";
import styles from "./LiveFeature.module.css";

const outcomeSchema = z.object({
  can_apply: z.boolean(),
  application: z
    .object({
      physical_id: z.string(),
      relationship: z.string(),
      state: z.string(),
      applied_at: z.string(),
    })
    .nullable(),
});
export default function HouseholdApplication({
  record,
  office,
}: {
  record: FeatureRecord;
  office: boolean;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["household-application", auth.userId, record.id, record.version],
    enabled: !!auth.userId && !auth.checking && !auth.memberPreview,
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () =>
      outcomeSchema.parse(
        await featureRpc("bfe_household_application", { p_id: record.id }),
      ),
  });
  if (auth.memberPreview)
    return <p>Sign in directly to view the applied relationship.</p>;
  return (
    <>
      <Feedback error={query.error} />
      {query.data?.application ? (
        <p>
          <strong>Relationship applied</strong> ·{" "}
          {query.data.application.physical_id} ·{" "}
          {query.data.application.relationship} · Current membership:{" "}
          {query.data.application.state}
        </p>
      ) : query.data ? (
        <p>
          Review complete; the verified relationship has not been applied yet.
        </p>
      ) : null}
      {office && query.data?.can_apply && !query.data.application && (
        <Button secondary onClick={() => setOpen(true)}>
          Apply verified relationship
        </Button>
      )}
      {open && (
        <Modal
          title="Apply verified relationship"
          size="lg"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <ApplicationForm
            onBusyChange={setBusy}
            record={record}
            onSaved={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
function ApplicationForm({
  record,
  onSaved,
  onBusyChange,
}: {
  record: FeatureRecord;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const auth = useAuth();
  const mutation = useFeatureMutation();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState("");
  const [physical, setPhysical] = useState("");
  const [match, setMatch] = useState<z.infer<
    typeof accountLotMatchSchema
  > | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    onBusyChange(checking || mutation.isPending);
  }, [checking, mutation.isPending, onBusyChange]);
  const people = useQuery({
    queryKey: ["household-account-picker", auth.userId, search, page],
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      z
        .object({
          total: z.number(),
          rows: z.array(
            z.object({
              user_id: z.uuid().nullable(),
              name: z.string().nullable(),
              unit: z.string().nullable(),
            }),
          ),
        })
        .parse(
          await featureRpc("bfe_staff_directory", {
            p_kind: "members",
            p_search: search,
            p_field: "name",
            p_status: "Active",
            p_page: page,
          }),
        ),
  });
  return (
    <div className={styles.form}>
      <p>
        Select the verified account and lot. This adds an approved relationship
        effective now. Registered ownership, existing occupants and receipt
        access are unchanged.
      </p>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(0);
          setTarget("");
          setMatch(null);
        }}
      >
        <label>
          Find account by name
          <input
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <Button secondary type="submit">
          Find account
        </Button>
      </form>
      <Feedback error={people.error} />
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setChecking(true);
          setError(null);
          setMatch(null);
          try {
            setMatch(
              accountLotMatchSchema.parse(
                await featureRpc("bfe_account_lot_match", {
                  p_target: target,
                  p_physical: physical.trim(),
                }),
              ),
            );
          } catch (e) {
            setError(
              e instanceof Error ? e : new Error("Match could not be checked."),
            );
          } finally {
            setChecking(false);
          }
        }}
      >
        <label>
          Account
          <select
            required
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setMatch(null);
            }}
          >
            <option value="">Choose the verified account</option>
            {people.data?.rows
              .filter((r) => r.user_id)
              .map((r) => (
                <option key={r.user_id!} value={r.user_id!}>
                  {r.name || "Account holder"} ·{" "}
                  {r.unit || "No recorded address"}
                </option>
              ))}
          </select>
        </label>
        {people.data && people.data.total > 20 && (
          <div className={styles.actions}>
            <Button
              secondary
              disabled={page === 0}
              onClick={() => {
                setPage(page - 1);
                setTarget("");
                setMatch(null);
              }}
            >
              Previous accounts
            </Button>
            <Button
              secondary
              disabled={(page + 1) * 20 >= people.data.total}
              onClick={() => {
                setPage(page + 1);
                setTarget("");
                setMatch(null);
              }}
            >
              Next accounts
            </Button>
          </div>
        )}
        <label>
          Physical lot ID
          <input
            required
            placeholder="1-01-001"
            maxLength={40}
            value={physical}
            onChange={(e) => {
              setPhysical(e.target.value);
              setMatch(null);
            }}
          />
        </label>
        <Button secondary type="submit" pending={checking}>
          Check account & lot
        </Button>
      </form>
      <Feedback error={error ?? mutation.error} />
      {match && !match.candidate && (
        <p>No active imported lot matches this ID.</p>
      )}
      {match?.candidate && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutation.mutate(
              {
                name: "bfe_apply_household_request",
                args: {
                  p_id: record.id,
                  p_version: record.version,
                  p_target: match.expected.user_id,
                  p_lot: match.candidate!.id,
                  p_expected: match.expected,
                  p_lot_version: match.candidate!.version,
                  p_relationship: f.get("relationship"),
                  p_reference: f.get("reference"),
                },
              },
              { onSuccess: onSaved },
            );
          }}
        >
          <p>
            <strong>{match.expected.name}</strong> ·{" "}
            {match.candidate.physical_id}
            <br />
            Recorded homeowner: {match.candidate.recorded_homeowner}
          </p>
          {!match.can_link && (
            <p>
              Another authorized staff member must apply their own account's
              relationship.
            </p>
          )}
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
            <input name="reference" required minLength={3} maxLength={100} />
          </label>
          <label>
            <input type="checkbox" required />I verified the account, lot and
            relationship against supporting evidence.
          </label>
          <Button
            type="submit"
            disabled={!match.can_link}
            pending={mutation.isPending}
          >
            Apply relationship
          </Button>
        </form>
      )}
    </div>
  );
}
