import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { memberRoles } from "../../../../../packages/shared/src/auth";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Skeleton } from "../../components/UI";
import listStyles from "./DocumentLibrary.module.css";

const queueSchema = z.object({
  rows: z.array(
    z.object({
      id: z.uuid(),
      document: z.string(),
      status: z.enum(["Pending", "Approved", "Declined"]),
      requested_at: z.string(),
      expires_at: z.string().nullable(),
      note: z.string(),
      name: z.string(),
      unit: z.string().nullable(),
    }),
  ),
  total: z.number(),
  pending: z.number(),
});
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Members' requests to download community documents (migration 093). Admins
 *  approve (download unlocked for 7 days) or decline. The server enforces the
 *  same admin/developer rule. */
export default function DocumentRequestQueue() {
  const auth = useAuth();
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const allowed =
    !!auth.member &&
    memberRoles(auth.member).some((r) => r === "admin" || r === "developer");
  const queue = useQuery({
    queryKey: ["document-requests", auth.userId, page],
    enabled: allowed,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      queueSchema.parse(
        await featureRpc("bfe_document_download_requests_queue", {
          p_page: page,
        }),
      ),
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      featureRpc("bfe_decide_document_download", {
        p_id: id,
        p_decision: decision,
        p_note: "",
      }),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["document-requests"] }),
  });
  if (!allowed) return null;
  return (
    <section className={listStyles.history} aria-labelledby="download-requests">
      <h2 id="download-requests">
        Download requests
        {queue.isSuccess && queue.data.pending > 0
          ? ` (${queue.data.pending} waiting)`
          : ""}
      </h2>
      <Feedback error={decide.error} />
      {queue.isPending ? (
        <Skeleton />
      ) : queue.isError ? (
        <Feedback error={queue.error} />
      ) : queue.data.rows.length ? (
        <div className={listStyles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Requested by</th>
                <th scope="col">When</th>
                <th scope="col">Decision</th>
              </tr>
            </thead>
            <tbody>
              {queue.data.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.document}</td>
                  <td>
                    {row.name}
                    {row.unit ? ` · ${row.unit}` : ""}
                  </td>
                  <td>{when(row.requested_at)}</td>
                  <td>
                    {row.status === "Pending" ? (
                      <div className={listStyles.decide}>
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ id: row.id, decision: "Approved" })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          secondary
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ id: row.id, decision: "Declined" })
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    ) : row.status === "Approved" && row.expires_at ? (
                      `Approved, until ${when(row.expires_at)}`
                    ) : (
                      row.status
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No download requests yet.</p>
      )}
      {queue.isSuccess && queue.data.total > 20 && (
        <nav className="btn-row" aria-label="Download request pages">
          <Button
            secondary
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>Page {page + 1}</span>
          <Button
            secondary
            disabled={(page + 1) * 20 >= queue.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  );
}
