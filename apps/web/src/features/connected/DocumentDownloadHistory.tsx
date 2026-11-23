import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { memberRoles } from "../../../../../packages/shared/src/auth";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Skeleton } from "../../components/UI";
import listStyles from "./DocumentLibrary.module.css";

const historySchema = z.object({
  rows: z.array(
    z.object({
      id: z.uuid(),
      document: z.string(),
      downloaded_at: z.string(),
      name: z.string(),
      unit: z.string().nullable(),
    }),
  ),
  total: z.number(),
});

/** Who downloaded which Mandatory Document, newest first (migration 092).
 *  Shown on the office documents page to admins and developers only; the
 *  server enforces the same rule. */
export default function DocumentDownloadHistory() {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const allowed =
    !!auth.member &&
    memberRoles(auth.member).some((r) => r === "admin" || r === "developer");
  const history = useQuery({
    queryKey: ["document-downloads", auth.userId, page],
    enabled: allowed,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      historySchema.parse(
        await featureRpc("bfe_document_download_history", { p_page: page }),
      ),
  });
  if (!allowed) return null;
  return (
    <section className={listStyles.history} aria-labelledby="download-history">
      <h2 id="download-history">Mandatory document downloads</h2>
      {history.isPending ? (
        <Skeleton />
      ) : history.isError ? (
        <Feedback error={history.error} />
      ) : history.data.rows.length ? (
        <div className={listStyles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Downloaded by</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {history.data.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.document}</td>
                  <td>
                    {row.name}
                    {row.unit ? ` · ${row.unit}` : ""}
                  </td>
                  <td>
                    {new Date(row.downloaded_at).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No downloads yet.</p>
      )}
      {history.isSuccess && history.data.total > 20 && (
        <nav className="btn-row" aria-label="Download history pages">
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
            disabled={(page + 1) * 20 >= history.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  );
}
