import { useState } from "react";
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
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./MemberAccountPicker.module.css";
export default function MemberAccountPicker() {
  const auth = useAuth();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const members = useAccessMembers(search, page);
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
    <>
      <PageIntro
        eyebrow="DEVELOPER"
        title="Preview a member’s account"
        description="Open the portal layout, navigation and connected data available to this account. Changes are disabled; the member is not notified."
      />
      {auth.preview || auth.rolePreview ? (
        <p>Sign in with your developer account to preview a real member.</p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <label>
              Find a member
              <input
                type="search"
                placeholder="Search by name or unit"
                maxLength={100}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
          <Feedback error={open.error ?? members.error} />
          {members.isPending ? (
            <Skeleton />
          ) : (
            !members.isError &&
            members.data && (
              <>
                <div className={styles.stack}>
                  <p className={styles.result} role="status">
                    {members.data.total} members found
                  </p>
                  {!members.data.rows.length && (
                    <p className={styles.empty}>
                      No matching members. Try another name or unit.
                    </p>
                  )}
                  {members.data.rows.map((member) => (
                    <article className={styles.card} key={member.user_id}>
                      <div className={styles.identity}>
                        <h2>{member.name || "Member"}</h2>
                        <p>
                          {!member.unit || /^(n\/?a)$/i.test(member.unit.trim())
                            ? "No unit recorded"
                            : member.unit}{" "}
                          ·{" "}
                          {[member.role, ...(member.extra_roles ?? [])].join(
                            ", ",
                          )}
                        </p>
                      </div>
                      <Badge>{member.status}</Badge>
                      <Button
                        secondary
                        pending={open.isPending}
                        disabled={member.status !== "Active"}
                        onClick={() => open.mutate(member)}
                      >
                        Preview account
                      </Button>
                    </article>
                  ))}
                </div>
                <div className={styles.actions}>
                  <Button
                    secondary
                    disabled={!page}
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
                    disabled={(page + 1) * 20 >= members.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next members
                  </Button>
                </div>
              </>
            )
          )}
        </>
      )}
    </>
  );
}
