import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { Feedback, Skeleton } from "../../components/UI";
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
    <section>
      <h3>Record history</h3>
      <p>
        Latest 100 events. Review reasons are shared with the submitting member.
      </p>
      <Feedback error={history.error} />
      {history.isPending ? (
        <Skeleton />
      ) : (
        <ol>
          {history.data?.map((event, index) => (
            <li key={index}>
              <strong>{event.action}</strong>
              <p>{event.note}</p>
              <time dateTime={event.at}>
                {new Date(event.at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
