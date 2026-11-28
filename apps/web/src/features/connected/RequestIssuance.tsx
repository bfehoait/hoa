import { useState } from "react";
import IssuedPermit from "./IssuedPermit";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { FeatureRecord } from "../../../../../packages/shared/src/feature-records";
import { useAuth } from "../../data/auth";
import { featureRpc, useFeatureMutation } from "../../data/feature-records";
import { Button, Feedback, Modal, Skeleton } from "../../components/UI";
import styles from "./LiveFeature.module.css";
import RecordFacts from "../../components/RecordFacts";

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
  const issueLabel = removal
    ? "Record vehicle removal"
    : record.module === "vehicles"
      ? "Confirm sticker issued"
      : "Confirm permit issued";
  const date = (value: string) =>
    new Date(value + "T12:00:00+08:00").toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
    });
  if (auth.memberPreview)
    return <p>This information is not available in account preview.</p>;
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
          <RecordFacts
            label="Issued document information"
            items={[
              { label: "Official reference number", value: issued.reference },
              { label: "Valid from", value: date(issued.valid_from) },
              ...(issued.valid_until
                ? [{ label: "Valid until", value: date(issued.valid_until) }]
                : []),
            ]}
          />
          {record.module === "permits" && <IssuedPermit id={record.id} />}
        </section>
      ) : (
        query.data &&
        record.status === "Reviewed" && (
          <p>
            {removal
              ? "Approved; removal has not been recorded yet."
              : record.module === "vehicles"
                ? "Approved. The Office has not recorded the sticker as issued yet."
                : "Approved. The Office has not recorded the permit as issued yet."}
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
          {issueLabel}
        </Button>
      )}
      {open && (
        <Modal
          title={issueLabel}
          protectChanges
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
              Official reference number
              <input name="reference" required minLength={3} maxLength={120} />
            </label>
            <label>
              Valid from
              <input name="from" type="date" required />
            </label>
            {!removal && (
              <label>
                Valid until
                <input name="until" type="date" required />
              </label>
            )}
            <label>
              Office note
              <textarea name="note" required minLength={5} maxLength={1000} />
            </label>
            <Feedback error={mutation.error} />
            <div className="form-actions">
              <Button type="submit" pending={mutation.isPending}>
                {issueLabel}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
