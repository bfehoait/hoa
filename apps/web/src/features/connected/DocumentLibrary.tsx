import PageIntro from "../office/OfficePage";
import { useLocation } from "react-router-dom";
import { ChevronRight, Folder } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { mandatoryDocuments } from "../../../../../packages/shared/src/request-topics";
import listStyles from "./DocumentLibrary.module.css";
import boardStyles from "../workspaces/Board.module.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Skeleton } from "../../components/UI";
import Sheet from "../../components/Sheet";
import DocumentAttachment from "./DocumentAttachment";
import styles from "./LiveFeature.module.css";
// Must match the board-records "Record category" options (migration 086).
const documentCategories = [
  "Mandatory Documents",
  "Member's Right to Inspect",
] as const;
// Records members may inspect (owner-supplied list, 19 November 2026).
const inspectionRecords = [
  {
    title: "Corporate & Governance Records",
    groups: [
      {
        heading: null,
        items: [
          "Articles of Incorporation and By-Laws (including all approved amendments)",
          "DHSUD Certificate of Registration and General Information Sheets (GIS)",
          "Minutes Book: Complete minutes of all General Assembly meetings and Board of Directors / Executive Officer meetings",
          "Compilation of Board Resolutions (including policies, authorizations, and administrative issuances)",
          "Deed of Restrictions, subdivision plans, and turnover documents from the developer",
        ],
      },
      {
        heading: "Membership & Election Records",
        items: [
          "Membership Book / Updated Master List of Members (indicating owners and authorized lessees/occupants)",
          "Election Reports: Attendance sheets, notarized minutes of elections, and certified election returns/tally sheets",
        ],
      },
    ],
  },
  {
    title: "Financial & Accounting Records",
    groups: [
      {
        heading: null,
        items: [
          "Audited Annual Financial Statements (AFS) and Annual Reports (which must also be provided upon request)",
          "Books of Accounts: Cash Receipts Book, Cash Disbursements Book, General Journal, and General Ledger",
          "Supporting Financial Vouchers: Official receipts, disbursement vouchers, supplier invoices, bank statements, check stubs, and approved contracts with service providers (e.g., security, maintenance, construction)",
        ],
      },
    ],
  },
] as const;
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
  return (
    <>
      <PageIntro
        eyebrow="YOUR COMMUNITY"
        title={board ? "Documents" : "Community documents"}
        description="Under Republic Act No. 9904 (Magna Carta for Homeowners and Homeowners’ Associations), the 2021 Revised Implementing Rules and Regulations (DHSUD Department Order No. 2021-007), and the Revised Corporation Code (R.A. No. 11232), HOA documents are divided into two categories: those that the Board must proactively post in common areas, and those that the Board must keep at the HOA office for members to inspect or copy upon request."
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
          <h2 id="mandatory-documents">Request a mandatory document</h2>
          <p>Choose a document to send a request to the office.</p>
          <ol className={listStyles.list} role="list">
            {mandatoryDocuments.map((name) => (
              <li key={name}>
                <Link
                  to={`/services/requests?new=document&topic=${encodeURIComponent(
                    `Mandatory Documents: ${name}`,
                  )}`}
                >
                  {name}
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!board && category === "Member's Right to Inspect" && (
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
          {inspectionRecords.map((table) => (
            <div key={table.title} className={listStyles.table}>
              <h2>{table.title}</h2>
              {table.groups.map((group) => (
                <div key={group.heading ?? "records"}>
                  {group.heading && <h3>{group.heading}</h3>}
                  <ul role="list">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
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
