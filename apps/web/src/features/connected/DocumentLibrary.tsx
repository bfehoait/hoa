import PageIntro from "../office/OfficePage";
import { useLocation } from "react-router-dom";
import { Eye, Folder, Send } from "lucide-react";
import {
  inspectionRecordFiles,
  mandatoryDocumentFiles,
} from "../../../../../packages/shared/src/mandatory-documents";
import CommunityDocumentViewer, {
  DocumentStatusTag,
  useDocumentAccess,
} from "./CommunityDocumentViewer";
import listStyles from "./DocumentLibrary.module.css";
import boardStyles from "../workspaces/Board.module.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Skeleton } from "../../components/UI";
import Sheet from "../../components/Sheet";
import { DetailDisclosure } from "../../components/Navigation";
import DocumentAttachment from "./DocumentAttachment";
import styles from "./LiveFeature.module.css";
// Must match the board-records "Record category" options (migration 093).
const documentCategories = ["Mandatory Documents", "Right to Inspect"] as const;
// Records members may inspect (owner list), grouped as on the page.
const inspectionTables = [
  ...new Set(inspectionRecordFiles.map((r) => r.table)),
].map((title) => {
  const rows = inspectionRecordFiles.filter((r) => r.table === title);
  return {
    title,
    groups: [...new Set(rows.map((r) => r.group))].map((heading) => ({
      heading,
      items: rows.filter((r) => r.group === heading),
    })),
  };
});
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
  const board = useLocation().pathname.startsWith("/board/");
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
  // Community documents are view-only; downloading needs an approved
  // request (migration 093). Admins decide requests on the office page.
  const access = useDocumentAccess();
  const [viewing, setViewing] = useState<{
    name: string;
    file: string;
    viewable: boolean;
  } | null>(null);
  // Mandatory Documents can be viewed; Right to Inspect records are request-only.
  const documentButton = (name: string, file: string, viewable = true) => (
    <button type="button" onClick={() => setViewing({ name, file, viewable })}>
      <span className={listStyles.docName}>{name}</span>
      <DocumentStatusTag
        access={access.data?.get(name)}
        idle={viewable ? "View" : "Request"}
      />
      {viewable ? (
        <Eye size={20} aria-hidden="true" />
      ) : (
        <Send size={20} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <>
      <PageIntro
        eyebrow="YOUR COMMUNITY"
        title={board ? "Documents" : "Community documents"}
      />
      <DetailDisclosure title="About document access">
        <p>
          Under Republic Act No. 9904 (Magna Carta for Homeowners and
          Homeowners’ Associations), the 2021 Revised Implementing Rules and
          Regulations (DHSUD Department Order No. 2021-007), and the Revised
          Corporation Code (R.A. No. 11232), HOA documents are divided into two
          categories: those that the Board must proactively post in common
          areas, and those that the Board must keep at the HOA office for
          members to inspect or copy upon request.
        </p>
      </DetailDisclosure>
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
            {documentCategories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {!board && category === "Mandatory Documents" && (
        <section
          className={listStyles.mandatory}
          aria-labelledby="mandatory-documents"
        >
          <h2 id="mandatory-documents">Mandatory documents</h2>
          <p>
            Choose a document to view it. To download a copy, request it from
            the HOA office.
          </p>
          <ol className={listStyles.list} role="list">
            {mandatoryDocumentFiles.map(({ name, file }) => (
              <li key={name}>{documentButton(name, file)}</li>
            ))}
          </ol>
        </section>
      )}
      {!board && category === "Right to Inspect" && (
        <section
          className={listStyles.inspect}
          aria-label="Records members may inspect"
        >
          <p>
            Under Section 7(b) and Section 17 of R.A. 9904, any member in good
            standing has the right to inspect the following official association
            books and records at the principal HOA office during reasonable
            office hours, and to request copies (at the requesting member's
            expense):
          </p>
          <p className={listStyles.hint}>
            Choose a record to request a downloadable copy from the HOA office.
          </p>
          {inspectionTables.map((table) => (
            <div key={table.title} className={listStyles.table}>
              <h2>{table.title}</h2>
              {table.groups.map((group) => (
                <div key={group.heading ?? "records"}>
                  {group.heading && <h3>{group.heading}</h3>}
                  <ul role="list">
                    {group.items.map(({ name, file }) => (
                      <li key={name}>{documentButton(name, file, false)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      {viewing && (
        <CommunityDocumentViewer
          name={viewing.name}
          file={viewing.file}
          access={access.data?.get(viewing.name)}
          viewable={viewing.viewable}
          onClose={() => setViewing(null)}
        />
      )}
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
          {board && (
            <p className="note">{query.data.total} published documents</p>
          )}
          <div className={board ? boardStyles.grid : styles.stack}>
            {query.data.rows.map((row) => (
              <article
                key={row.id}
                className={board ? boardStyles.card : styles.card}
              >
                <p className="note">
                  {row.category ?? "Document"}
                  {row.version ? ` / Version ${row.version}` : ""} ·{" "}
                  {new Date(row.created_at).toLocaleDateString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </p>
                <h2>
                  {board && <Folder size={22} aria-hidden="true" />} {row.title}
                </h2>
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
