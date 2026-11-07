import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import {
  assignedRoleLabels,
  peoplePageSize,
  type DirectoryMember,
} from "../../../../../packages/shared/src/people";
import { NavigationGroup } from "../../components/Navigation";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import { usePeople, type PeopleFilter } from "../../data/people";
import styles from "./People.module.css";

const initialFilter: PeopleFilter = {
  page: 0,
  search: "",
  field: "name",
  status: "",
};
export default function People({
  applications = false,
}: {
  applications?: boolean;
}) {
  // Route key supplied by Office resets filters and selected private records on tab changes.
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = usePeople(applications ? "registrations" : "members", filter);
  const rows = query.isError ? [] : (query.data?.rows ?? []);
  const selected = rows.find((row) => row.id === selectedId);
  const updateFilter = (patch: Partial<PeopleFilter>) => {
    setSelectedId(null);
    setFilter((current) => ({ ...current, ...patch, page: 0 }));
  };
  return (
    <>
      <PageIntro
        eyebrow="OFFICE · PEOPLE"
        title={applications ? "Registration inbox" : "People & accounts"}
        description={
          applications
            ? "Applications received by the association."
            : "Find a member, check their details and understand their assigned access."
        }
        icon={applications ? <ClipboardCheck size={28} /> : <Users size={28} />}
        action={
          <Button
            secondary
            pending={query.isFetching}
            onClick={() => {
              setSelectedId(null);
              void query.refetch();
            }}
          >
            <RefreshCw size={20} />
            Refresh
          </Button>
        }
      />
      <NavigationGroup aria-label="People workspace">
        <NavLink to="/office/residents">Members</NavLink>
        <NavLink to="/office/registrations">Registrations</NavLink>
        <NavLink to="/office/lots">Lot register</NavLink>
        <NavLink to="/office/registry">Property change drafts</NavLink>
        <NavLink to="/office/access">Access planning</NavLink>
      </NavigationGroup>
      <section className={styles.summary} aria-label="Directory connection">
        <span className={styles.summaryIcon}>
          <ShieldCheck size={28} />
        </span>
        <div>
          <strong>
            {query.isError
              ? "Connection needs attention"
              : query.isPending
                ? "Connecting to records"
                : "Database records"}
          </strong>
          <p>
            {query.isError
              ? "No sample fallback is shown."
              : "Only records returned by your database permissions appear here."}
          </p>
        </div>
        {query.data && !query.isError && (
          <Badge>
            {query.data.total === null
              ? `${rows.length} loaded`
              : `${query.data.total} matching`}
          </Badge>
        )}
      </section>
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          updateFilter({ search: draft });
        }}
      >
        <label>
          Search by
          <select
            value={filter.field}
            onChange={(event) =>
              updateFilter({
                field: event.target.value as PeopleFilter["field"],
              })
            }
          >
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="unit">Unit</option>
          </select>
        </label>
        <label className={styles.search}>
          Find {applications ? "an application" : "a member"}
          <span>
            <Search size={20} aria-hidden="true" />
            <input
              value={draft}
              maxLength={100}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type to search…"
            />
          </span>
        </label>
        <label>
          Status
          <select
            value={filter.status}
            onChange={(event) => updateFilter({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {(applications
              ? ["Pending", "Approved", "Rejected"]
              : ["Active", "Invited", "Suspended"]
            ).map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <Button type="submit">
          <Search size={20} />
          Search
        </Button>
        {(filter.search || filter.status || draft) && (
          <Button
            secondary
            type="button"
            onClick={() => {
              setDraft("");
              setFilter(initialFilter);
              setSelectedId(null);
            }}
          >
            Clear
          </Button>
        )}
      </form>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <Feedback error={query.error} />
      ) : (
        <>
          <div className={styles.resultsHeading}>
            <h2>{applications ? "Applications" : "Member directory"}</h2>
            <span>
              {query.dataUpdatedAt
                ? `Checked ${new Date(query.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </span>
          </div>
          {!rows.length ? (
            <section className={styles.empty}>
              <Users size={36} />
              <h3>No records returned</h3>
              <p>
                Try another search or status. An empty result can also mean your
                database permissions do not expose these records.
              </p>
            </section>
          ) : (
            <>
              <div className={styles.columnLabels} aria-hidden="true">
                <span>Member</span>
                <span>
                  {applications ? "Requested role" : "Assigned roles"}
                </span>
                <span>Recorded unit</span>
                <span>Status</span>
                <span>Details</span>
              </div>
              <ul
                className={styles.records}
                aria-label={
                  applications ? "Registration results" : "Member results"
                }
              >
                {rows.map((row) => (
                  <li key={row.id}>
                    <div className={styles.identity}>
                      <span className={styles.avatar} aria-hidden="true">
                        <UserRound size={22} />
                      </span>
                      <div>
                        <strong>{row.name || "Name not supplied"}</strong>
                        <span>{row.email || "Email not supplied"}</span>
                      </div>
                    </div>
                    <div className={styles.roles}>
                      {("extra_roles" in row
                        ? assignedRoleLabels(row as DirectoryMember)
                        : [row.role || "Not supplied"]
                      ).map((role) => (
                        <Badge key={role}>{role}</Badge>
                      ))}
                    </div>
                    <span className={styles.unit}>
                      <Building2 size={18} aria-hidden="true" />
                      {row.unit || "Not assigned"}
                    </span>
                    <span>
                      <Badge
                        tone={row.status === "Active" ? "green" : "neutral"}
                      >
                        {row.status}
                      </Badge>
                    </span>
                    <Button
                      secondary
                      onClick={() => setSelectedId(row.id)}
                      aria-label={`View ${row.name || "record"}`}
                    >
                      View
                      <ChevronRight size={18} />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <nav className={styles.pagination} aria-label="Results pages">
            <Button
              secondary
              disabled={filter.page === 0 || query.isFetching}
              onClick={() => {
                setSelectedId(null);
                setFilter((current) => ({
                  ...current,
                  page: current.page - 1,
                }));
              }}
            >
              <ChevronLeft size={20} />
              Previous
            </Button>
            <span>Page {filter.page + 1}</span>
            <Button
              secondary
              disabled={
                query.isFetching ||
                (query.data?.total === null
                  ? rows.length < peoplePageSize
                  : (filter.page + 1) * peoplePageSize >=
                    (query.data?.total ?? 0))
              }
              onClick={() => {
                setSelectedId(null);
                setFilter((current) => ({
                  ...current,
                  page: current.page + 1,
                }));
              }}
            >
              Next
              <ChevronRight size={20} />
            </Button>
          </nav>
        </>
      )}
      <details className={styles.boundaries}>
        <summary>Account actions & household verification</summary>
        <p>
          This directory is read-only. Invitations, role changes, suspension,
          deletion and application approval require protected server operations
          before they can be enabled.
        </p>
        <p>
          Recorded unit text is not proof of ownership or occupancy. Household
          members, property verification and financial history still require
          their own connected records.
        </p>
      </details>
      {selected && !query.isError && (
        <Modal
          title={selected.name || "Member details"}
          description={
            applications
              ? "Submitted registration details"
              : "Recorded account details"
          }
          onClose={() => setSelectedId(null)}
        >
          <dl className={styles.details}>
            <div>
              <dt>
                <Mail size={18} />
                Email
              </dt>
              <dd>{selected.email || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Mobile number</dt>
              <dd>{selected.phone || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Recorded unit</dt>
              <dd>{selected.unit || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
            {"user_id" in selected && (
              <>
                <div>
                  <dt>Auth account link</dt>
                  <dd>
                    {selected.user_id
                      ? "Auth ID recorded; account existence not checked"
                      : "No Auth ID recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Position</dt>
                  <dd>{selected.title || "Not supplied"}</dd>
                </div>
              </>
            )}
            {"review_note" in selected && (
              <div>
                <dt>Review note</dt>
                <dd>{selected.review_note || "No note supplied"}</dd>
              </div>
            )}
          </dl>
          <p className="note">
            {applications
              ? "Registration proofs are not downloaded by this screen. Approval and invitation delivery are not connected."
              : "All assigned roles are shown. Primary and extra roles can grant different workspaces; they do not establish property ownership."}
          </p>
        </Modal>
      )}
    </>
  );
}
