import { Activity, ShieldCheck, Eye, Plug, ArrowRight } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { PageIntro } from "../../components/UI";
import { DetailDisclosure } from "../../components/Navigation";
import styles from "./DeveloperHome.module.css";

const tools = [
  {
    to: "/developer/connections",
    title: "Connections",
    detail: "Check sign-in, membership and service setup.",
    icon: Plug,
  },
  {
    to: "/developer/access",
    title: "Access configuration",
    detail: "Review system access configuration and permission planning.",
    icon: ShieldCheck,
  },
  {
    to: "/developer/members",
    title: "Account support",
    detail: "Inspect a member’s customer experience in read-only mode.",
    icon: Eye,
  },
  {
    to: "/developer/activity",
    title: "Diagnostics & audit",
    detail: "Review available history and technical diagnostics.",
    icon: Activity,
  },
];
export default function DeveloperHome() {
  return (
    <>
      <PageIntro
        eyebrow="DEVELOPER CONSOLE"
        title="System maintenance"
        description="Connections, access configuration and account diagnostics. Use the workspace switcher for daily Office, Board, Security or Driver work."
      />
      <div className={styles.groups}>
        {tools.map(({ to, title, detail, icon: Icon }) => (
          <section className={styles.group} key={to}>
            <header>
              <span className={styles.groupIcon}>
                <Icon size={24} aria-hidden="true" />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{detail}</p>
              </div>
            </header>
            <div>
              <Link to={to}>
                Open {title.toLowerCase()}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ))}
      </div>
      <DetailDisclosure title="Advanced record diagnostics">
        <p>
          Inspect legacy source availability and recorded history. These
          diagnostic views remain separate from operational workspaces; opening
          them does not grant access.
        </p>
        <Link className="text-link" to="/developer/modules">
          Open record diagnostics <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </DetailDisclosure>
    </>
  );
}
