import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { Empty, Feedback, Skeleton } from "../../components/UI";
import styles from "./WorkflowHistory.module.css";
export default function WorkflowHistory({
  kind,
  id,
}: {
  kind: "feature" | "booking" | "visitor";
  id: string;
}) {
  const auth = useAuth();
  const history = useQuery({
    queryKey: ["workflow-history", auth.userId, kind, id],
    gcTime: 0,
    retry: false,
    queryFn: async () =>
      z
        .array(
          z.object({ action: z.string(), note: z.string(), at: z.string() }),
        )
        .parse(
          await featureRpc("bfe_workflow_history", { p_kind: kind, p_id: id }),
        ),
  });
  return (
    <section aria-label="History" className={styles.history}>
      <p className={styles.note}>
        Latest 100 updates. Review reasons can be read by the person who sent
        the request.
      </p>
      <Feedback error={history.error} />
      {history.isPending ? (
        <Skeleton />
      ) : history.isSuccess && !history.data.length ? (
        <Empty title="No updates yet">
          Updates will appear here when an action is recorded.
        </Empty>
      ) : history.isSuccess ? (
        <ol>
          {history.data?.map((event, index) => (
            <li key={index}>
              <strong>{event.action.replaceAll("_", " ")}</strong>
              {event.note && <p>{event.note}</p>}
              <time dateTime={event.at}>
                {new Date(event.at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </time>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
