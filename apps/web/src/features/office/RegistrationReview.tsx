import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Feedback, Field, Modal, Skeleton } from "../../components/UI";
import { featureRpc } from "../../data/feature-records";
import CreateAccount from "./CreateAccount";
const schema = z.object({
  application: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    unit: z.string(),
    role: z.enum(["homeowner", "renter"]),
    status: z.string(),
    proof: z.string().nullable(),
    proof_ref: z.string().nullable(),
    owner_name: z.string().nullable(),
    note: z.string().nullable(),
    details: z.record(z.string(), z.unknown()),
    version: z.number(),
  }),
  can_approve: z.boolean(),
});
export default function RegistrationReview({ id }: { id: string }) {
  const cache = useQueryClient(),
    [reject, setReject] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ["registration-detail", id],
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      schema.parse(await featureRpc("bfe_registration_detail", { p_id: id })),
  });
  if (query.isPending) return <Skeleton />;
  if (query.isError)
    return (
      <>
        <Feedback error={query.error} />
        <Button secondary onClick={() => void query.refetch()}>
          Try again
        </Button>
      </>
    );
  const { application: a, can_approve } = query.data;
  const answer = (value: unknown) =>
    value === "yes" ? "Yes" : value === "no" ? "No" : "Not provided";
  const household = Array.isArray(a.details.household)
    ? (a.details.household as Record<string, unknown>[])
    : [];
  return (
    <section>
      <h3>Membership review</h3>
      <dl className="detail-list">
        <div>
          <dt>Registered homeowner</dt>
          <dd>{a.owner_name || "Not supplied"}</dd>
        </div>
        {(a.proof || a.proof_ref) && (
          <div>
            <dt>Proof</dt>
            <dd>
              {a.proof || "Not supplied"} / {a.proof_ref || "No reference"}
            </dd>
          </div>
        )}
        <div>
          <dt>Senior citizen</dt>
          <dd>{answer(a.details.senior)}</dd>
        </div>
        <div>
          <dt>Person with disability</dt>
          <dd>{answer(a.details.pwd)}</dd>
        </div>
        <div>
          <dt>Applicant note</dt>
          <dd>{a.note || "None"}</dd>
        </div>
        {typeof a.details.healthNote === "string" && a.details.healthNote && (
          <div>
            <dt>Private health conditions</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{a.details.healthNote}</dd>
          </div>
        )}
      </dl>
      {household.length > 0 && (
        <details>
          <summary>Household members ({household.length})</summary>
          {household.map((p, i) => (
            <dl className="detail-list" key={i}>
              <div>
                <dt>Name / relationship</dt>
                <dd>
                  {String(p.name ?? "")} / {String(p.relationship ?? "")}
                </dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{String(p.phone || "Not provided")}</dd>
              </div>
              <div>
                <dt>Senior / PWD</dt>
                <dd>
                  {answer(p.senior)} / {answer(p.pwd)}
                </dd>
              </div>
            </dl>
          ))}
        </details>
      )}
      {a.status === "Pending" && can_approve && (
        <>
          <p className="note">
            Verify identity, residence and proof before approving. Creating the
            account does not approve a lot link.
          </p>
          <div className="btn-row">
            <CreateAccount application={a} />
            <Button secondary onClick={() => setReject(true)}>
              Reject application
            </Button>
          </div>
        </>
      )}
      {a.status === "Pending" && !can_approve && (
        <p className="note">
          An authorized account manager with registration approval permission
          must review this application.
        </p>
      )}
      {reject && (
        <Modal
          title="Reject this application?"
          busy={busy}
          onClose={() => {
            if (!busy) setReject(false);
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await featureRpc("bfe_reject_registration", {
                  p_id: id,
                  p_version: a.version,
                  p_reason: reason,
                });
                setReject(false);
                void cache.invalidateQueries({
                  queryKey: ["registration-detail"],
                });
                void cache.invalidateQueries({ queryKey: ["office-people"] });
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e
                    : new Error("Review could not be confirmed."),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Reason" htmlFor="registration-rejection">
              <textarea
                id="registration-rejection"
                value={reason}
                minLength={5}
                maxLength={200}
                required
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Feedback error={error} />
            <Button type="submit" tone="danger" pending={busy}>
              Reject application
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
