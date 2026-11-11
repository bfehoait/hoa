import { ClipboardCheck, ShieldCheck } from "lucide-react";
import {
  committeeNames,
  permissionQuestions,
} from "../../../../../packages/shared/src/permissions";
import { usePermissions } from "../../data/permissions";
import {
  Badge,
  Button,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./DeveloperConsole.module.css";
import AccessManager from "./AccessManager";
import TabAccess from "./TabAccess";
import { useLocation } from "react-router-dom";

export default function AccessPlanning({
  memberOnly = false,
}: {
  memberOnly?: boolean;
}) {
  const access = usePermissions();
  const office = useLocation().pathname.startsWith("/office");
  const manages = !!(
    access.data?.developer_control || access.data?.access_manager
  );
  if (memberOnly) return <AccessManager overlayOnly />;
  return (
    <>
      <PageIntro
        eyebrow={
          office ||
          (access.data?.access_manager && !access.data.developer_control)
            ? "OFFICE · ACCESS MANAGEMENT"
            : "DEVELOPER · ACCESS MANAGEMENT"
        }
        title="Roles & committee access"
        description="Choose what people and committees can view or change."
        icon={<ShieldCheck size={28} />}
        action={
          <Button secondary onClick={() => void access.refetch()}>
            Refresh access
          </Button>
        }
      />
      {!access.sample &&
        (access.data?.developer_control || access.data?.access_manager) && (
          <>
            <AccessManager />
            <details>
              <summary>Role & committee defaults</summary>
              <TabAccess />
            </details>
          </>
        )}
      <details open={!manages}>
        <summary>Access details and committee reference</summary>
        <h2>Your effective access</h2>
        {access.sample ? (
          <p className="note">
            Synthetic preview. Real account permissions are not loaded here.
          </p>
        ) : access.isPending ? (
          <Skeleton />
        ) : access.isError ? (
          <Feedback error={access.error} />
        ) : access.data?.developer_control ? (
          <section className={styles.card}>
            <ShieldCheck size={28} />
            <h3>Developer control</h3>
            <p>
              Account roles/status, staff permissions and the implemented
              request workflow. Other business workflows still need their
              protected backend operations.
            </p>
          </section>
        ) : (
          <div className={styles.grid}>
            {access.data?.capabilities.map((item) => (
              <section
                className={styles.card}
                key={`${item.module}:${item.action}:${item.scope}`}
              >
                <ShieldCheck size={24} />
                <h3>{item.module}</h3>
                <p>
                  {item.action} · {item.scope}
                </p>
              </section>
            ))}
          </div>
        )}
        <h2>Committee scopes</h2>
        <div className={styles.grid}>
          {committeeNames.map((name) => (
            <section className={styles.card} key={name}>
              <ClipboardCheck size={24} />
              <h3>{name}</h3>
              <Badge>Actions need approval</Badge>
            </section>
          ))}
        </div>
        <h2>Decisions still open</h2>
        <ul>
          {permissionQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </details>
    </>
  );
}
