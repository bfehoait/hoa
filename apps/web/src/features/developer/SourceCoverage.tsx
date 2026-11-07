import { useState } from "react";
import { Link } from "../../components/AccessLink";
import { ArrowRight, Search } from "lucide-react";
import inventory from "../../../../../packages/shared/src/reference-inventory.json";
import { Badge, Button } from "../../components/UI";
import { MetricStrip, WorkspaceNote } from "../../components/WorkspaceUI";

export default function SourceCoverage() {
  const [modulePage, setModulePage] = useState(0);
  const [tab, setTab] = useState("Modules");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const query = search.toLowerCase();
  const functions = inventory.functions.filter((item) =>
    item.name.toLowerCase().includes(query),
  );
  const structures = inventory.datasets.filter((item) =>
    `${item.name} ${item.fields.join(" ")}`.toLowerCase().includes(query),
  );
  const areas = inventory.areas.filter((area) =>
    `${area.name} ${area.features.join(" ")} ${area.keys.join(" ")}`
      .toLowerCase()
      .includes(query),
  );
  const page = Math.min(
    modulePage,
    Math.max(0, Math.ceil(areas.length / 4) - 1),
  );
  return (
    <>
      <p className="note">
        Sanitized metadata from the separately downloaded reference. This is an
        inventory, not completed feature parity.
      </p>
      <Link className="text-link" to="/explore">
        Open structured feature workflows <ArrowRight size={20} />
      </Link>
      <WorkspaceNote>
        The source is read-only and blocked from the dev server. No legacy code,
        data values, credentials, photos or ballots are imported into the app. A
        field or source default does not establish an approved HOA rule.
      </WorkspaceNote>
      <MetricStrip
        items={[
          {
            label: "Source lines",
            value: inventory.lines,
            detail: "Two identical application copies",
          },
          {
            label: "Named functions",
            value: inventory.functionCount,
            detail: "Static source index only",
          },
          {
            label: "Store properties",
            value: inventory.rootStoreFieldCount,
            detail: "Includes UI state, not 50 tables",
          },
          {
            label: "Feature families",
            value: inventory.areas.length,
            detail: "Preview coverage is partial",
          },
        ]}
      />
      <p className="note">
        Snapshot: {inventory.snapshotDate} · Commit{" "}
        {inventory.commit.slice(0, 12)} · {inventory.parseDiagnostics} parser
        diagnostics. No backend was contacted.
      </p>
      <div className="filters" aria-label="Source information category">
        {["Modules", "Structures", "Functions", "Backend references"].map(
          (value) => (
            <button
              key={value}
              className="filter"
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                setLimit(50);
              }}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <div className="search">
        <Search size={20} />
        <input
          aria-label="Search source information"
          placeholder="Find a feature, field or function…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setModulePage(0);
            setLimit(50);
          }}
        />
      </div>
      {tab === "Modules" && (
        <div className="grid-2">
          {areas.slice(page * 4, page * 4 + 4).map((area) => (
            <section key={area.name} className="panel">
              <div className="split-heading">
                <h2>{area.name}</h2>
                <Badge tone="amber">Partial preview</Badge>
              </div>
              <p className="note">
                Source evidence lines: {area.evidence.join(", ")}.
              </p>
              <details className="source-details">
                <summary>Source features and original inventory gaps</summary>
                <h3>Observed feature information</h3>
                <ul>
                  {area.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <h3>Gaps recorded at initial inventory</h3>
                <p className="note">
                  Some local forms now exist in the feature baseline. These
                  snapshot notes remain evidence of the initial comparison; they
                  are not current completion claims.
                </p>
                <ul>
                  {area.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
                <p className="note">
                  Source store keys: {area.keys.join(", ")}. Source values were
                  not copied.
                </p>
              </details>
              <Link className="text-link" to={area.route}>
                Open related preview
                <ArrowRight size={18} />
              </Link>
            </section>
          ))}
        </div>
      )}
      {tab === "Modules" && areas.length > 4 && (
        <nav className="form-actions" aria-label="Source family pages">
          <Button
            secondary
            disabled={!page}
            onClick={() => setModulePage(page - 1)}
          >
            Previous families
          </Button>
          <span>
            Page {page + 1} of {Math.ceil(areas.length / 4)}
          </span>
          <Button
            secondary
            disabled={(page + 1) * 4 >= areas.length}
            onClick={() => setModulePage(page + 1)}
          >
            Next families
          </Button>
        </nav>
      )}
      {tab === "Structures" && (
        <>
          <WorkspaceNote>
            Entry counts below describe literal arrays in this source snapshot.
            Empty arrays do not prove the live database is empty, and seeded
            counts do not prove real resident counts. Credential-related field
            names are metadata only; their values are excluded.
          </WorkspaceNote>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Static data structure inventory"
          >
            <table>
              <thead>
                <tr>
                  <th>Source property</th>
                  <th>Shape / line</th>
                  <th>Observed field names</th>
                </tr>
              </thead>
              <tbody>
                {structures.map((item) => (
                  <tr key={`${item.name}-${item.line}`}>
                    <td>{item.name}</td>
                    <td>
                      {item.shape} · L{item.line}
                    </td>
                    <td>
                      {item.fields.join(", ") ||
                        "Fields not determined statically"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "Functions" && (
        <>
          <p className="note">
            Showing {Math.min(limit, functions.length)} of {functions.length}{" "}
            matching function names. Bodies are not included or executed.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Function identifier</th>
                  <th>Source line</th>
                </tr>
              </thead>
              <tbody>
                {functions.slice(0, limit).map((item) => (
                  <tr key={`${item.name}-${item.line}`}>
                    <td>{item.name}</td>
                    <td>{item.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {functions.length > limit && (
            <button
              className="filter"
              style={{ marginTop: 16 }}
              onClick={() => setLimit(limit + 50)}
            >
              Show 50 more identifiers
            </button>
          )}
        </>
      )}
      {tab === "Backend references" && (
        <div className="two-column">
          <section className="panel">
            <h2>Referenced tables and RPCs</h2>
            <p className="note">
              Call sites are not schema definitions or verified access controls.
            </p>
            <ul>
              {[
                ...new Set(inventory.tableReferences.map((item) => item.name)),
              ].map((name) => (
                <li key={name}>Table reference: {name}</li>
              ))}
              {[
                ...new Set(inventory.rpcReferences.map((item) => item.name)),
              ].map((name) => (
                <li key={name}>RPC reference: {name}</li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Incomplete database evidence</h2>
            <p className="note">
              Only the registrations SQL file is present. Missing referenced
              files: {inventory.sqlEvidence.missingReferencedFiles.join(", ")}.
              Required function definitions not established here:{" "}
              {inventory.sqlEvidence.requiredFunctions.join(", ")}. No policy
              was executed or tested, and no connection was made to the source
              project.
            </p>
            <Badge tone="amber">RLS not verified</Badge>
          </section>
        </div>
      )}
    </>
  );
}
