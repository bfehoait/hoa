import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { FeatureRecord } from "../../../../../packages/shared/src/feature-records";
import { useAuth } from "../../data/auth";
import { featureRpc, useFeatureMutation } from "../../data/feature-records";
import { Button, Feedback, Modal, Skeleton } from "../../components/UI";
import styles from "./LiveFeature.module.css";

const schema = z.object({
  can_issue: z.boolean(),
  issuance: z
    .object({
      outcome: z.enum(["sticker", "permit", "vehicle_removed"]),
      reference: z.string(),
      valid_from: z.string(),
      valid_until: z.string().nullable(),
      issued_at: z.string(),
    })
    .nullable(),
});
export default function RequestIssuance({
  record,
  office,
}: {
  record: FeatureRecord;
  office: boolean;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const mutation = useFeatureMutation();
  const query = useQuery({
    queryKey: ["feature-issuance", auth.userId, record.id, record.version],
    enabled: !!auth.userId && !auth.memberPreview && !auth.checking,
    queryFn: async () =>
      schema.parse(
        await featureRpc("bfe_request_issuance", { p_id: record.id }),
      ),
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
  });
  const removal =
    record.module === "vehicles" &&
    record.fields?.request === "Remove a vehicle";
  const issued = query.data?.issuance;
  const date = (value: string) =>
    new Date(value + "T12:00:00+08:00").toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
    });
  if (auth.memberPreview)
    return <p>Sign in directly to view issuance details.</p>;
  return (
    <>
      {query.isPending && <Skeleton />}
      <Feedback error={query.error} />
      {issued ? (
        <section aria-label="Issuance record">
          <strong>
            {issued.outcome === "vehicle_removed"
              ? "Vehicle removal recorded"
              : "Issued"}
          </strong>
          <dl className={styles.fields}>
            <div>
              <dt>Official reference</dt>
              <dd>{issued.reference}</dd>
            </div>
            <div>
              <dt>Effective from</dt>
              <dd>{date(issued.valid_from)}</dd>
            </div>
            {issued.valid_until && (
              <div>
                <dt>Valid until</dt>
                <dd>{date(issued.valid_until)}</dd>
              </div>
            )}
          </dl>
        </section>
      ) : (
        query.data &&
        record.status === "Reviewed" && (
          <p>
            {removal
              ? "Approved; removal has not been recorded yet."
              : "Approved; issuance has not been recorded yet."}
          </p>
        )
      )}
      {!issued && office && query.data?.can_issue && (
        <Button
          secondary
          onClick={() => {
            mutation.reset();
            setOpen(true);
          }}
        >
          {removal ? "Record vehicle removal" : "Record issuance"}
        </Button>
      )}
      {open && (
        <Modal
          title={removal ? "Record vehicle removal" : "Record issuance"}
          busy={mutation.isPending}
          onClose={() => setOpen(false)}
        >
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              mutation.mutate(
                {
                  name: "bfe_issue_request",
                  args: {
                    p_id: record.id,
                    p_version: record.version,
                    p_reference: form.get("reference"),
                    p_valid_from: form.get("from"),
                    p_valid_until: removal ? null : form.get("until"),
                    p_note: form.get("note"),
                  },
                },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            <p>
              Record the actual office action. Use the official reference and
              approved dates.
            </p>
            <label>
              Official reference
              <input name="reference" required minLength={3} maxLength={120} />
            </label>
            <label>
              Effective from
              <input name="from" type="date" required />
            </label>
            {!removal && (
              <label>
                Valid until
                <input name="until" type="date" required />
              </label>
            )}
            <label>
              Issuance note
              <textarea name="note" required minLength={5} maxLength={1000} />
            </label>
            <Feedback error={mutation.error} />
            <Button type="submit" pending={mutation.isPending}>
              {removal ? "Confirm removal record" : "Confirm issuance record"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
