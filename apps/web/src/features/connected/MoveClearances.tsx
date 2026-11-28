import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./BookingFeeApproval.module.css";

const schema = z.array(
  z.object({
    record_id: z.string(),
    version: z.number(),
    title: z.string(),
    permit: z.string().nullable(),
    date: z.string().nullable(),
    unit: z.string().nullable(),
  }),
);
export default function MoveClearances() {
  const auth = useAuth(),
    cache = useQueryClient();
  const query = useQuery({
    queryKey: ["move-clearances", auth.userId],
    enabled: !!auth.userId && !auth.preview && !auth.rolePreview,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      schema.parse(await featureRpc("bfe_move_clearance_queue", {})),
  });
  const decision = useMutation({
    mutationFn: async ({
      id,
      version,
      form,
    }: {
      id: string;
      version: number;
      form: FormData;
    }) =>
      featureRpc("bfe_decide_move_clearance", {
        p_id: id,
        p_version: version,
        p_status: form.get("decision"),
        p_note: form.get("note"),
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["move-clearances"] });
    },
  });
  return (
    <section className={styles.panel} aria-label="Move Clearances">
      <h2>Move Clearances</h2>
      <p>Office-approved moves waiting for Security to check.</p>
      {query.isPending && <Skeleton />}
      <Feedback error={query.error ?? decision.error} />
      {query.data?.length === 0 && <p>No moves waiting for a check.</p>}
      {query.data?.map((row) => (
        <form
          key={row.record_id}
          className={styles.panel}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            form.set(
              "decision",
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
                "",
            );
            decision.mutate({ id: row.record_id, version: row.version, form });
          }}
        >
          <h3>{row.title}</h3>
          <p>{[row.permit, row.unit, row.date].filter(Boolean).join(" · ")}</p>
          <label>
            Security Check Note
            <textarea name="note" required minLength={5} maxLength={500} />
          </label>
          <div className={styles.footer}>
            <Button
              type="submit"
              secondary
              name="decision"
              value="Rejected"
              pending={decision.isPending}
            >
              Reject
            </Button>
            <Button
              type="submit"
              name="decision"
              value="Approved"
              pending={decision.isPending}
            >
              Approve Move
            </Button>
          </div>
        </form>
      ))}
    </section>
  );
}
