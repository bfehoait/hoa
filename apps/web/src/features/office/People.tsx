import { useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Mail,
  RefreshCw,
  Search,
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
import CreateAccount from "./CreateAccount";
import RegistrationReview from "./RegistrationReview";
import MemberWorkspace from "./MemberWorkspace";
import { useRegistryRpc } from "../../data/registry";
import { usePermissions } from "../../data/permissions";
import { z } from "zod";

const linkedDirectorySchema = z.object({
  rows: z.array(z.object({ user_id: z.uuid(), physical_id: z.string() })),
});

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
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") ?? 0);
  const field = params.get("field");
  const status = params.get("status") ?? "";
  const filter: PeopleFilter = {
    page:
      Number.isInteger(requestedPage) &&
      requestedPage >= 0 &&
      requestedPage <= 10000
        ? requestedPage
        : 0,
    search: (params.get("q") ?? "").slice(0, 100),
    field: field === "email" || field === "unit" ? field : "name",
    status: (applications
      ? ["Pending", "Approved", "Rejected"]
      : ["Active", "Invited", "Suspended"]
    ).includes(status)
      ? status
      : "",
  };
  const [draft, setDraft] = useState(filter.search);
  const [draftSearch, setDraftSearch] = useState(filter.search);
  if (draftSearch !== filter.search) {
    setDraftSearch(filter.search);
    setDraft(filter.search);
  }
  const setFilter = (
    next: PeopleFilter | ((current: PeopleFilter) => PeopleFilter),
  ) => {
    const value = typeof next === "function" ? next(filter) : next;
    const nextParams = new URLSearchParams(params);
    for (const [key, entry] of Object.entries({
      q: value.search,
      field: value.field === "name" ? "" : value.field,
      status: value.status,
      page: value.page || "",
    })) {
      if (entry === "") nextParams.delete(key);
      else nextParams.set(key, String(entry));
    }
    setParams(nextParams, { preventScrollReset: true });
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(
    null,
  );
  const navigationKey = params.toString();
  const [selectionKey, setSelectionKey] = useState(navigationKey);
  if (selectionKey !== navigationKey) {
    setSelectionKey(navigationKey);
    setSelectedId(null);
    setSelectedMember(null);
  }
  const query = usePeople(applications ? "registrations" : "members", filter);
  const rows = query.isError ? [] : (query.data?.rows ?? []);
  const permissions = usePermissions();
  const userIds = rows.flatMap((row) =>
    "user_id" in row && row.user_id ? [row.user_id] : [],
  );
  const linked = useRegistryRpc(
    "bfe_staff_linked_properties",
    { p_users: userIds },
    linkedDirectorySchema,
    !applications &&
      userIds.length > 0 &&
      permissions.allowsPath("/office/lots"),
  );
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
          <div className="page-actions">
            {!applications && <CreateAccount />}
            <Button
              secondary
              pending={query.isFetching}
              onClick={() => {
                setSelectedId(null);
                void query.refetch();
                if (userIds.length && permissions.allowsPath("/office/lots"))
                  void linked.refetch();
              }}
            >
              <RefreshCw size={20} />
              Refresh
            </Button>
          </div>
        }
      />
      <NavigationGroup aria-label="People workspace">
        <NavLink to="/office/residents">Members</NavLink>
        <NavLink to="/office/registrations">Registrations</NavLink>
      </NavigationGroup>
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
            <div className={styles.resultsTitle}>
              <h2>{applications ? "Applications" : "Member directory"}</h2>
              {query.data && (
                <Badge>
                  {query.data.total === null
                    ? `${rows.length} loaded`
                    : `${query.data.total} matching`}
                </Badge>
              )}
            </div>
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
                <span>
                  {applications
                    ? "Recorded unit"
                    : "Property / recorded address"}
                </span>
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
                    <DirectoryProperty
                      row={row}
                      links={linked.data?.rows ?? []}
                      pending={linked.isFetching}
                      failed={linked.isError}
                    />
                    <span>
                      <Badge
                        tone={row.status === "Active" ? "green" : "neutral"}
                      >
                        {row.status}
                      </Badge>
                    </span>
                    <Button
                      secondary
                      onClick={() => {
                        if ("user_id" in row)
                          setSelectedMember(row as DirectoryMember);
                        setSelectedId(row.id);
                      }}
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
          Authorized staff can create accounts and review registration
          applications. Roles, status and deletion are managed through member
          access settings.
        </p>
        <p>
          Recorded unit text is not proof of ownership or occupancy. Household
          members, property verification and financial history still require
          their own connected records.
        </p>
      </details>
      {!applications && selectedId && selectedMember?.id === selectedId && (
        <MemberWorkspace
          initial={selectedMember}
          onClose={() => setSelectedId(null)}
        />
      )}
      {applications && selected && !query.isError && (
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
              ? "Verify proof and household details before approving. No email will be sent."
              : "All assigned roles are shown. Primary and extra roles can grant different workspaces; they do not establish property ownership."}
          </p>
          {applications && <RegistrationReview id={selected.id} />}
        </Modal>
      )}
    </>
  );
}

function DirectoryProperty({
  row,
  links,
  pending,
  failed,
}: {
  row: { user_id?: string | null; unit?: string | null };
  links: { user_id: string; physical_id: string }[];
  pending: boolean;
  failed: boolean;
}) {
  const matches = links.filter((link) => link.user_id === row.user_id);
  const unit = row.unit?.trim();
  return (
    <span className={styles.unit}>
      <Building2 size={18} aria-hidden="true" />
      <span>
        {matches.length
          ? matches.map((link) => link.physical_id).join("; ")
          : unit && !/^(n\/?a|none|-+)$/i.test(unit)
            ? unit
            : "Not recorded"}
        <small>
          {matches.length
            ? "Approved property link"
            : row.user_id && pending
              ? "Checking property links..."
              : failed
                ? "Linked addresses unavailable"
                : "Recorded address"}
        </small>
      </span>
    </span>
  );
}
