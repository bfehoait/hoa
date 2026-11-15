import { useState } from "react";
import { Search } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAccessMembers, type AccessMember } from "../../data/access-control";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { inspectionSessionSchema } from "../../../../../packages/shared/src/member-inspection";
import {
  memberHomePath,
  type AuthMember,
} from "../../../../../packages/shared/src/auth";
import {
  Badge,
  Button,
  Feedback,
  ButtonLink,
  Skeleton,
} from "../../components/UI";
import styles from "./DeveloperScreens.module.css";
import DeveloperPage from "./DeveloperPage";
import { usePermissions } from "../../data/permissions";
import { hasCapability } from "../../../../../packages/shared/src/permissions";
import WorkbookAccountLinks from "../registry/WorkbookAccountLinks";
export default function MemberAccountPicker() {
  const auth = useAuth();
  const permissions = usePermissions();
  const [linkAccounts, setLinkAccounts] = useState(false);
  const canLink =
    !auth.memberPreview &&
    [
      { module: "people", action: "view", scope: "association" },
      { module: "property", action: "view", scope: "association" },
      { module: "property", action: "manage", scope: "association" },
    ].every((requirement) =>
      hasCapability(
        permissions.data,
        requirement as Parameters<typeof hasCapability>[1],
      ),
    );
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const members = useAccessMembers(search, page);
  const [status, setStatus] = useState("");
  const visible = (members.data?.rows ?? []).filter(
    (member) => !status || member.status === status,
  );
  const open = useMutation({
    mutationFn: async (member: AccessMember) => {
      const session = inspectionSessionSchema.parse(
        await featureRpc("bfe_start_member_inspection", {
          p_client: crypto.randomUUID(),
          p_target: member.user_id,
          p_reason: "Account interface preview (read-only)",
        }),
      );
      await featureRpc("bfe_account_preview_read", {
        p_session: session.id,
        p_name: "bfe_get_member",
        p_args: {},
      });
      const home = memberHomePath({
        id: member.user_id,
        ...member,
        name: member.name ?? "Member",
        unit: member.unit ?? "",
      } as AuthMember);
      window.location.assign(`/developer/account-preview/${session.id}${home}`);
    },
  });
  return (
    <DeveloperPage
      title="Account support"
      description="Look up a member and open their account in read-only preview."
      actions={<ButtonLink to="/developer/previews">Role previews</ButtonLink>}
    >
      {auth.preview || auth.rolePreview ? (
        <p>Sign in with your developer account to preview a real member.</p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <Search size={20} aria-hidden="true" />
              <span className="sr-only">Find a member by name or unit</span>
              <input
                type="search"
                placeholder="Search members by name or unit"
                maxLength={100}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <div
              className={styles.chips}
              role="group"
              aria-label="Filter status on the current page"
            >
              {["", "Active", "Invited", "Suspended"].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                >
                  {value || "All"}
                </button>
              ))}
            </div>
          </div>
          <Feedback error={open.error ?? members.error} />
          {members.isError && (
            <Button
              secondary
              pending={members.isFetching}
              onClick={() => void members.refetch()}
            >
              Retry members
            </Button>
          )}
          {members.isPending ? (
            <Skeleton />
          ) : !members.isError && members.data ? (
            <>
              <div className={styles.result}>
                <span role="status">
                  {members.data.total} matching members · {visible.length} shown
                  on this page
                </span>
                {canLink && members.data.rows.length > 0 && (
                  <Button secondary onClick={() => setLinkAccounts(true)}>
                    Match this page to workbook lots
                  </Button>
                )}
              </div>
              <p className={styles.note}>
                Search applies across available members. Status chips filter the
                current page; use pagination to inspect more results.
              </p>
              <div
                className={styles.tableWrap}
                role="region"
                aria-label="Member account support results"
                tabIndex={0}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Roles</th>
                      <th scope="col">Status</th>
                      <th scope="col">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((member) => (
                      <tr key={member.user_id}>
                        <td>
                          <span className={styles.person}>
                            <span className={styles.avatar} aria-hidden="true">
                              {(member.name?.trim() || "M")
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                            <strong>{member.name || "Member"}</strong>
                          </span>
                        </td>
                        <td>
                          {!member.unit || /^(n\/?a)$/i.test(member.unit.trim())
                            ? "Not recorded"
                            : member.unit}
                        </td>
                        <td>
                          {[member.role, ...(member.extra_roles ?? [])].join(
                            ", ",
                          )}
                        </td>
                        <td>
                          <Badge
                            tone={
                              member.status === "Active"
                                ? "green"
                                : member.status === "Suspended"
                                  ? "red"
                                  : member.status === "Invited"
                                    ? "amber"
                                    : "neutral"
                            }
                          >
                            {member.status}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            secondary
                            size="sm"
                            pending={open.isPending}
                            disabled={member.status !== "Active"}
                            onClick={() => open.mutate(member)}
                            aria-label={`Preview ${member.name || "member"} account`}
                          >
                            Preview account
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <p className={styles.empty}>
                    No matching members on this page. Try another search, status
                    or page.
                  </p>
                )}
              </div>
              <nav
                className={styles.pagination}
                aria-label="Member support pages"
              >
                <Button
                  secondary
                  disabled={!page || members.isFetching || open.isPending}
                  onClick={() => setPage(page - 1)}
                >
                  Previous members
                </Button>
                <span>
                  Page {page + 1} of{" "}
                  {Math.max(1, Math.ceil(members.data.total / 20))}
                </span>
                <Button
                  secondary
                  disabled={
                    (page + 1) * 20 >= members.data.total ||
                    members.isFetching ||
                    open.isPending
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Next members
                </Button>
              </nav>
            </>
          ) : null}
        </>
      )}
      {linkAccounts && members.data && (
        <WorkbookAccountLinks
          targets={members.data.rows.map((member) => member.user_id)}
          onClose={() => setLinkAccounts(false)}
        />
      )}
    </DeveloperPage>
  );
}
