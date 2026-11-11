import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Database,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Clock3,
  Rows3,
} from "lucide-react";
import { Link } from "../../components/AccessLink";
import {
  Badge,
  Button,
  ButtonLink,
  Feedback,
  Modal,
  Skeleton,
} from "../../components/UI";
import { NavigationGroup } from "../../components/Navigation";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { useModuleMonitor } from "../../data/monitoring";
import {
  findMonitorModule,
  monitorModules,
} from "../../../../../packages/shared/src/monitoring";
import styles from "./ModuleMonitor.module.css";
import { monitorModuleIcons } from "./monitor-icons";

export default function ModuleMonitor() {
  const path = useParams()["*"] ?? "";
  const [params] = useSearchParams();
  const id = path.split("/")[1];
  const module = findMonitorModule(id);
  return (
    <>
      <MonitorPage
        key={`${path}:${module ? "" : (params.get("query") ?? "")}`}
        module={module}
      />
    </>
  );
}
function MonitorPage({
  module,
}: {
  module: ReturnType<typeof findMonitorModule>;
}) {
  const auth = useAuth();
  const access = usePermissions();
  const workspaceAction = module
    ? (
        {
          people: { path: "/office/residents", label: "Manage people" },
          property: { path: "/office/lots", label: "Open lot register" },
          operations: { path: "/office/requests", label: "Manage requests" },
          messages: {
            path: "/office/inbox",
            label: "Open request conversations",
          },
          finance: { path: "/office/finance", label: "Open finance" },
          calendar: { path: "/office/bookings", label: "Manage bookings" },
          security: {
            path: "/office/visitors",
            label: "Manage visitor passes",
          },
          community: {
            path: "/office/announcements",
            label: "Manage announcements",
          },
          hotlines: {
            path: "/office/announcements",
            label: "Create a contact notice",
          },
          livelihood: {
            path: "/directory/market",
            label: "Open livelihood",
          },
          transport: {
            path: "/driver/dispatch",
            label: "Open shuttle service",
          },
          documents: { path: "/office/documents", label: "Manage documents" },
          elections: {
            path: "/explore/election-setup",
            label: "Election setup proposals",
          },
          access: {
            path: "/office/access",
            label: "Manage account access",
          },
          audit: {
            path: "/developer/modules/audit",
            label: "View recorded history",
          },
        } as Record<string, { path: string; label: string }>
      )[module.id]
    : undefined;
  const [params] = useSearchParams();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState(params.get("query") ?? "");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const section =
    module?.sections.find(([key]) => key === params.get("section")) ??
    module?.sections[0];
  const query = useModuleMonitor(section?.[0] ?? null, page);
  const result = query.isError ? undefined : query.data;
  const visibleRows = (result?.rows ?? []).filter(
    (row) =>
      (!recordStatus || row.status === recordStatus) &&
      (!recordSearch.trim() ||
        [row.label, row.reference, row.unit, ...Object.values(row.fields)]
          .join(" ")
          .toLowerCase()
          .includes(recordSearch.trim().toLowerCase())),
  );
  const statusOptions = [
    ...new Set(
      (result?.rows ?? [])
        .map((row) => row.status)
        .filter((value): value is string => !!value),
    ),
  ].sort();
  const refresh = () => {
    setSelected(null);
    void query.refetch();
  };
  const detail =
    selected === null
      ? null
      : result?.rows.find((row) => row.reference === selected);
  return (
    <div className={styles.monitor}>
      <header className={styles.desktopHeading}>
        <div>
          <div className={styles.crumb}>
            <Link to="/developer">Developer</Link>
            <span>/</span>
            <Link to="/developer/modules">Record diagnostics</Link>
            {module && (
              <>
                <span>/</span>
                <span>{module.title}</span>
              </>
            )}
          </div>
          <h1>
            <span className={styles.headingIcon}>
              {module ? <ModuleIcon id={module.id} /> : <Layers3 size={24} />}
            </span>
            {module?.title ?? "Record diagnostics"}
          </h1>
          <p>
            {module
              ? "View existing records or open the working service to make changes."
              : "One place for every part of the community system."}
          </p>
        </div>
        <div className={styles.headingActions}>
          <Badge>
            {access.data?.developer_control
              ? "Developer control"
              : "Developer workspace"}
          </Badge>
          {module && (
            <Button
              secondary
              pending={query.isFetching}
              disabled={auth.preview}
              onClick={refresh}
            >
              <RefreshCw size={18} />
              Refresh
            </Button>
          )}
        </div>
      </header>
      <div className={styles.mobileIntro}>
        <section className={styles.boundary}>
          <ShieldCheck size={24} />
          <p>Workspace actions use your verified developer account.</p>
          <Badge>
            {access.data?.developer_control
              ? "Control active"
              : "Developer workspace"}
          </Badge>
        </section>
      </div>
      {!module ? (
        <>
          <label className={styles.search}>
            Find a module
            <span>
              <Search size={20} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="People, security, finance…"
              />
            </span>
          </label>
          <div className={styles.catalogue}>
            {monitorModules
              .filter((item) =>
                item.title.toLowerCase().includes(search.trim().toLowerCase()),
              )
              .map((item) => (
                <Link
                  className={styles.module}
                  key={item.id}
                  to={`/developer/modules/${item.id}`}
                >
                  <span className={styles.icon}>
                    <ModuleIcon id={item.id} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.sections.length}{" "}
                      {item.sections.length === 1 ? "section" : "sections"}
                    </small>
                  </span>
                  <ChevronRight size={20} />
                </Link>
              ))}
          </div>
          {search &&
            !monitorModules.some((item) =>
              item.title.toLowerCase().includes(search.trim().toLowerCase()),
            ) && (
              <section className={styles.empty}>
                <h2>No matching modules</h2>
                <Button secondary onClick={() => setSearch("")}>
                  Clear search
                </Button>
              </section>
            )}
        </>
      ) : (
        <>
          <section
            className={styles.workspaceActions}
            aria-label="Available feature actions"
          >
            <p>
              {module.id === "audit"
                ? "History is recorded when you use a service. Audit records cannot be added or edited manually."
                : module.id === "hotlines"
                  ? "Editing the contact directory is not connected yet. You can submit a contact notice through announcements."
                  : module.id === "security" &&
                      !["passes", "gatePasses"].includes(section?.[0] ?? "")
                    ? "Editing these security records is not available yet. The visitor-pass service is available separately."
                    : "Use the working service for supported actions, subject to your permissions. Saved source records shown here are for reference; they are not automatically editable in that service."}
            </p>
            {workspaceAction && module.id !== "audit" && (
              <ButtonLink
                tone="primary"
                to={
                  module.id === "livelihood"
                    ? "/directory/market?section=" +
                      (section?.[0] === "boothEvents"
                        ? "booth-events"
                        : "businesses")
                    : module.id === "calendar" && section?.[0] === "events"
                      ? "/explore/events"
                      : workspaceAction.path
                }
              >
                {module.id === "calendar" && section?.[0] === "events"
                  ? "Manage events"
                  : workspaceAction.label}
              </ButtonLink>
            )}
            {module.id === "community" && (
              <ButtonLink to="/office/announcements?new=1">
                Create announcement
              </ButtonLink>
            )}
            {module.id === "finance" && (
              <ButtonLink to="/explore/expense-evidence">
                Submit expense evidence
              </ButtonLink>
            )}
            {module.id === "livelihood" && (
              <ButtonLink to="/directory/market?view=review">
                Review livelihood listings
              </ButtonLink>
            )}
            {module.id === "transport" && (
              <ButtonLink to="/directory/transport">
                Open carpool offers
              </ButtonLink>
            )}
          </section>
          <Link
            className={`text-link back-link ${styles.mobileBack}`}
            to="/developer/modules"
          >
            <ArrowLeft size={20} />
            All modules
          </Link>
          <nav
            className={styles.desktopSections}
            aria-label={`${module.title} sections`}
          >
            {module.sections.map(([key, title]) => (
              <Link
                key={key}
                to={`?section=${key}`}
                aria-current={section?.[0] === key ? "page" : undefined}
                onClick={() => {
                  setPage(0);
                  setRecordSearch("");
                  setRecordStatus("");
                  setSelected(null);
                }}
              >
                {title}
              </Link>
            ))}
          </nav>
          <div className={styles.mobileSections}>
            <NavigationGroup aria-label={`${module.title} sections`}>
              {module.sections.map(([key, title]) => (
                <Link
                  key={key}
                  to={`?section=${key}`}
                  aria-current={section?.[0] === key ? "page" : undefined}
                  onClick={() => {
                    setPage(0);
                    setRecordSearch("");
                    setRecordStatus("");
                    setSelected(null);
                  }}
                >
                  {title}
                </Link>
              ))}
            </NavigationGroup>
          </div>
          {auth.preview ? (
            <section className={styles.empty}>
              <h2>Sign in with your developer account</h2>
              <p>Real monitoring is separate from synthetic role previews.</p>
            </section>
          ) : query.isPending ? (
            <Skeleton />
          ) : query.isError ? (
            <Feedback error={query.error} />
          ) : (
            result && (
              <>
                <div className={styles.resultSummary}>
                  <span>
                    {!result.present
                      ? "No saved source section"
                      : `${result.total ?? "Unknown"} recorded items`}
                  </span>
                  <span>
                    Checked{" "}
                    {new Date(query.dataUpdatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className={styles.sourceSummary}>
                  <div>
                    <span className={styles.summaryIcon}>
                      <Database size={20} />
                    </span>
                    <span>
                      <small>Saved records</small>
                      <strong>
                        {result.present
                          ? (result.total ?? "Unknown")
                          : "Unavailable"}
                      </strong>
                    </span>
                  </div>
                  <div>
                    <span className={styles.summaryIcon}>
                      <Rows3 size={20} />
                    </span>
                    <span>
                      <small>Source section</small>
                      <strong>{section?.[1]}</strong>
                    </span>
                  </div>
                  <div>
                    <span className={styles.summaryIcon}>
                      <Clock3 size={20} />
                    </span>
                    <span>
                      <small>Last checked</small>
                      <strong>
                        {new Date(query.dataUpdatedAt).toLocaleTimeString(
                          "en-PH",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
                {!result.rows.length ? (
                  <section className={styles.empty}>
                    <Database size={32} />
                    <h2>
                      {result.present
                        ? "No records on this page"
                        : "This section has not been saved"}
                    </h2>
                    <p>
                      {result.present
                        ? "The database returned no records here. Try an earlier page if available."
                        : "No saved section was returned. Seeded examples from the old HTML have not been inserted."}
                    </p>
                  </section>
                ) : (
                  <>
                    <div className={styles.recordTools}>
                      <div>
                        <h2>{section?.[1]}</h2>
                        <span>
                          {visibleRows.length} of {result.rows.length} records
                          on this page
                        </span>
                      </div>
                      <label>
                        <span className="sr-only">
                          Search records on this page
                        </span>
                        <Search size={18} aria-hidden="true" />
                        <input
                          value={recordSearch}
                          onChange={(event) => {
                            setRecordSearch(event.target.value);
                            setSelected(null);
                          }}
                          placeholder="Search this page…"
                        />
                      </label>
                      <label>
                        <span className="sr-only">
                          Filter record status on this page
                        </span>
                        <select
                          aria-label="Filter record status on this page"
                          value={recordStatus}
                          onChange={(event) => {
                            setRecordStatus(event.target.value);
                            setSelected(null);
                          }}
                        >
                          <option value="">All statuses</option>
                          {statusOptions.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <caption className="sr-only">
                          {section?.[1]} · recorded data
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Record</th>
                            <th scope="col">Unit</th>
                            <th scope="col">Status</th>
                            <th scope="col">
                              {section?.[0] === "members"
                                ? "Primary role"
                                : section?.[0] === "units"
                                  ? "Owner"
                                  : "Recorded"}
                            </th>
                            <th scope="col">
                              <span className="sr-only">Details</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row, index) => (
                            <tr
                              key={`${row.reference}-${index}`}
                              data-selected={
                                selected === row.reference || undefined
                              }
                            >
                              <th scope="row">
                                <div className={styles.recordIdentity}>
                                  <span
                                    className={styles.recordAvatar}
                                    aria-hidden="true"
                                  >
                                    {row.label
                                      .trim()
                                      .slice(0, 1)
                                      .toUpperCase() || "•"}
                                  </span>
                                  <span>
                                    <strong>{row.label}</strong>
                                    <small>
                                      {typeof row.fields.email === "string" &&
                                      row.fields.email
                                        ? row.fields.email
                                        : row.reference}
                                    </small>
                                  </span>
                                </div>
                              </th>
                              <td>{row.unit || "Not recorded"}</td>
                              <td>
                                <Badge tone={statusTone(row.status)}>
                                  {row.status || "Not recorded"}
                                </Badge>
                              </td>
                              <td>
                                {section?.[0] === "members"
                                  ? String(row.fields.role ?? "Not recorded")
                                  : section?.[0] === "units"
                                    ? String(row.fields.owner ?? "Not recorded")
                                    : recordDate(row.recorded_at)}
                              </td>
                              <td>
                                <div className={styles.rowActions}>
                                  <Button
                                    secondary
                                    size="sm"
                                    onClick={(event) => {
                                      event.currentTarget.focus();
                                      setSelected(row.reference);
                                    }}
                                    aria-label={`View details ${row.label}`}
                                  >
                                    View details
                                    <ChevronRight size={16} />
                                  </Button>
                                  {/* Resolve the account through the protected
                                    picker; do not expose its user id here. */}
                                  {module.id === "people" &&
                                    !!row.fields?.email && (
                                      <ButtonLink
                                        tone="secondary"
                                        size="sm"
                                        to={`/developer/modules/people?accountSearch=${encodeURIComponent(
                                          String(row.fields.email),
                                        )}#account-access`}
                                      >
                                        Manage access
                                      </ButtonLink>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!visibleRows.length && (
                            <tr>
                              <td colSpan={5}>
                                <div className={styles.noMatches}>
                                  <Search size={24} />
                                  <strong>
                                    No matching records on this page
                                  </strong>
                                  <Button
                                    secondary
                                    onClick={() => {
                                      setRecordSearch("");
                                      setRecordStatus("");
                                    }}
                                  >
                                    Clear filters
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <ul className={styles.records}>
                      {result.rows.map((row, index) => (
                        <li key={`${row.reference}-${index}`}>
                          <div>
                            <strong>{row.label}</strong>
                            <span>{row.unit || "No recorded unit"}</span>
                            <small>{row.reference}</small>
                          </div>
                          <Badge>{row.status || "No status recorded"}</Badge>
                          <Button
                            secondary
                            onClick={(event) => {
                              event.currentTarget.focus();
                              setSelected(row.reference);
                            }}
                            aria-label={`View details ${row.label}`}
                          >
                            View details
                            <ChevronRight size={18} />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <nav
                  className={styles.pagination}
                  aria-label="Monitoring pages"
                >
                  <Button
                    secondary
                    disabled={!page || query.isFetching}
                    onClick={() => {
                      setSelected(null);
                      setPage((value) => value - 1);
                    }}
                  >
                    Previous
                  </Button>
                  <span>Page {page + 1}</span>
                  <Button
                    secondary
                    disabled={
                      query.isFetching ||
                      result.total === null ||
                      (page + 1) * 20 >= result.total
                    }
                    onClick={() => {
                      setSelected(null);
                      setPage((value) => value + 1);
                    }}
                  >
                    Next
                  </Button>
                </nav>
              </>
            )
          )}
          {module.id === "elections" && (
            <p className="note">
              This monitor exposes election setup metadata only. Individual
              ballots, votes and eligibility lists are not returned.
            </p>
          )}
          {detail && (
            <Modal
              className={styles.inspector}
              title={detail.label}
              description="Record details"
              onClose={() => setSelected(null)}
            >
              <dl className={styles.fields}>
                {Object.entries(detail.fields).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>
                      {value === null
                        ? "Not supplied"
                        : typeof value === "boolean"
                          ? value
                            ? "Yes"
                            : "No"
                          : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="note">
                Nested attachments, proof files, credential fields and
                individual ballots are not downloaded by this monitor.
              </p>
            </Modal>
          )}
        </>
      )}
      <details className={styles.notes}>
        <summary>Data & access notes</summary>
        <p>
          Recorded source data may contain historical examples or unverified
          information. Operational actions use your separately assigned
          workspaces. Monitoring does not grant approval powers or certify the
          records.
        </p>
      </details>
    </div>
  );
}

function recordDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (
    value
  ) : (
    <time dateTime={value} title={date.toLocaleString("en-PH")}>
      {date.toLocaleDateString("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
    </time>
  );
}

function statusTone(
  value: string | null,
): "neutral" | "green" | "amber" | "red" {
  if (/^(active|approved|paid|resolved|completed)$/i.test(value ?? ""))
    return "green";
  if (/pending|progress|review/i.test(value ?? "")) return "amber";
  if (/^(suspended|rejected|overdue|denied)$/i.test(value ?? "")) return "red";
  return "neutral";
}

function ModuleIcon({ id }: { id: string }) {
  const Icon = monitorModuleIcons[id] ?? Database;
  return <Icon size={24} />;
}
