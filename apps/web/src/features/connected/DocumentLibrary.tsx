import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import {
  Button,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import Sheet from "../../components/Sheet";
import DocumentAttachment from "./DocumentAttachment";
import styles from "./LiveFeature.module.css";
const schema = z.object({
  rows: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      summary: z.string(),
      created_at: z.string(),
      category: z.string().nullable(),
      version: z.string().nullable(),
    }),
  ),
  total: z.number(),
});
export default function DocumentLibrary() {
  const auth = useAuth(),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["document-library", auth.userId, search, category, page],
    refetchInterval: 30000,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      schema.parse(
        await featureRpc("bfe_document_library", {
          p_search: search,
          p_category: category,
          p_page: page,
        }),
      ),
  });
  const current = query.data?.rows.find((row) => row.id === selected);
  return (
    <>
      <PageIntro
        eyebrow="YOUR COMMUNITY"
        title="Community documents"
        description="Approved HOA policies, resolutions, minutes and disclosures."
      />
      <div className={styles.toolbar}>
        <label>
          Search documents
          <input
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          >
            <option value="">All categories</option>
            {["Minutes", "Policy", "Financial disclosure", "Resolution"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Try again
          </Button>
        </>
      ) : (
        <>
          <div className={styles.stack}>
            {query.data.rows.map((row) => (
              <article key={row.id} className={styles.card}>
                <p className="note">
                  {row.category ?? "Document"}
                  {row.version ? ` / Version ${row.version}` : ""} ·{" "}
                  {new Date(row.created_at).toLocaleDateString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </p>
                <h2>{row.title}</h2>
                <p>{row.summary}</p>
                <Button secondary onClick={() => setSelected(row.id)}>
                  View document
                </Button>
              </article>
            ))}
          </div>
          {!query.data.rows.length && (
            <p>
              No published documents match your search. Clear the filters or
              check again after the office publishes a document.
            </p>
          )}
          {query.data.total > 20 && (
            <nav className="btn-row" aria-label="Document pages">
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
                disabled={(page + 1) * 20 >= query.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      {current && (
        <Sheet
          title={current.title}
          onClose={() => setSelected(null)}
          presentation="task"
        >
          <p>{current.summary}</p>
          <DocumentAttachment record={current.id} />
        </Sheet>
      )}
    </>
  );
}
