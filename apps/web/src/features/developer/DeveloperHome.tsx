import { useModuleMonitor } from "../../data/monitoring";
import { ButtonLink, Skeleton } from "../../components/UI";
import DeveloperPage from "./DeveloperPage";
import DeveloperServices from "./DeveloperServices";
import { AuditFeed } from "./DeveloperAudit";
import { committees } from "./AccessManager";
import styles from "./DeveloperScreens.module.css";

export default function DeveloperHome() {
  const members = useModuleMonitor("members", 0);
  const audit = useModuleMonitor("bfe_request_audit", 0);
  const metrics = [
    {
      title: "Request audit events",
      value: audit.isError
        ? "Unavailable"
        : (audit.data?.total?.toLocaleString("en-PH") ??
          (audit.isPending ? (
            <Skeleton variant="metric" label="Loading audit count" />
          ) : (
            "Unavailable"
          ))),
      note: "All recorded request events; not a 24-hour total",
    },
    {
      title: "Members",
      value: members.isError
        ? "Unavailable"
        : (members.data?.total?.toLocaleString("en-PH") ??
          (members.isPending ? (
            <Skeleton variant="metric" label="Loading member count" />
          ) : (
            "Unavailable"
          ))),
      note: "Member records returned by monitoring",
    },
    {
      title: "Committees",
      value: committees.length.toLocaleString("en-PH"),
      note: "Defined permission groups; not member assignments",
    },
  ];
  return (
    <DeveloperPage
      title="Overview"
      description="Diagnostics, access configuration and system maintenance."
      actions={
        <>
          <ButtonLink to="/developer/members">Account preview</ButtonLink>
          <ButtonLink to="/developer/previews">Role previews</ButtonLink>
        </>
      }
    >
      <section className={styles.section}>
        <h2>System status</h2>
        <DeveloperServices />
      </section>
      <section className={styles.section}>
        <h2>Activity</h2>
        <div className={styles.grid}>
          {metrics.map((metric) => (
            <article className={styles.card} key={metric.title}>
              <h3>{metric.title}</h3>
              <strong className={styles.big}>{metric.value}</strong>
              <p>{metric.note}</p>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <h2>Recent audit</h2>
        <AuditFeed compact />
      </section>
      <details className={styles.disclosure}>
        <summary>Developer tools</summary>
        <div className={styles.toolLinks}>
          <ButtonLink to="/developer/modules">
            All record diagnostics
          </ButtonLink>
          <ButtonLink to="/developer/access">Access configuration</ButtonLink>
          <ButtonLink to="/developer/connections">Connections</ButtonLink>
          <ButtonLink to="/workspaces">Account workspaces</ButtonLink>
          <ButtonLink tone="danger" to="/sign-out">
            Sign out
          </ButtonLink>
        </div>
      </details>
    </DeveloperPage>
  );
}
