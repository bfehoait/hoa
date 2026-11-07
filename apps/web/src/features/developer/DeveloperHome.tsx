import {
  ArrowRight,
  Database,
  Eye,
  ShieldCheck,
  Users,
  Wrench,
  Building2,
  Activity,
  Plus,
} from "lucide-react";
import { Link } from "../../components/AccessLink";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { monitorModules } from "../../../../../packages/shared/src/monitoring";
import { monitorModuleIcons } from "./monitor-icons";
import styles from "./DeveloperHome.module.css";
import { RequestVisual } from "../../components/RequestVisual";

const groups = [
  {
    title: "People & property",
    detail: "The community behind every record.",
    icon: Users,
    ids: ["people", "property"],
  },
  {
    title: "Daily operations",
    detail: "Requests, movement and shared spaces.",
    icon: Wrench,
    ids: ["operations", "messages", "security", "calendar", "transport"],
  },
  {
    title: "Community life",
    detail: "News, local services and governance.",
    icon: Building2,
    ids: ["community", "hotlines", "livelihood", "documents", "elections"],
  },
  {
    title: "Administration",
    detail: "Financial records, access and history.",
    icon: ShieldCheck,
    ids: ["finance", "access", "audit"],
  },
];
export default function DeveloperHome() {
  const auth = useAuth();
  const access = usePermissions();
  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>
            BELLEFORT ESTATES · DEVELOPER WORKSPACE
          </p>
          <h1>
            A clear view of
            <br />
            your community.
          </h1>
          <p>
            Explore system records, review access and see every role’s
            experience.
          </p>
          <div className={styles.heroActions}>
            {!auth.preview &&
              !auth.memberPreview &&
              access.data?.developer_control && (
                <>
                  <Link to="/office/announcements?new=1">
                    Create announcement <Plus size={18} />
                  </Link>
                  <Link to="/office/review">
                    Create & review submissions <ArrowRight size={18} />
                  </Link>
                </>
              )}
            <Link to="/developer/members">
              View member — read-only
              <Eye size={18} />
            </Link>
            <Link to="/developer/modules">
              Explore modules
              <ArrowRight size={18} />
            </Link>
            <Link to="/developer/access">
              Review access
              <ShieldCheck size={18} />
            </Link>
          </div>
        </div>
        <svg className={styles.map} viewBox="0 0 360 240" aria-hidden="true">
          <path
            d="M-20 130 360 20M-20 190 380 76M40 270 370 175M55-20 150 270M190-20 290 270"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <g
              key={i}
              transform={`translate(${38 + (i % 4) * 78} ${30 + Math.floor(i / 4) * 76}) rotate(-16)`}
            >
              <rect
                width="42"
                height="44"
                rx="5"
                fill="currentColor"
                opacity={i % 3 === 0 ? 0.8 : 0.35}
              />
              <path
                d="m9 20 12-9 12 9v16H9Z"
                fill="none"
                stroke="var(--on-brand)"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>
      </section>
      <div className={styles.metrics}>
        <Link to="/developer/modules">
          <span>
            <small>System areas</small>
            <strong>{monitorModules.length}</strong>
            <em>Modules available to explore</em>
          </span>
          <Database size={23} />
        </Link>
        <Link to="/developer/members">
          <span>
            <small>Account support</small>
            <strong>View</strong>
            <em>Read-only member access</em>
          </span>
          <Eye size={23} />
        </Link>
        <Link to="/developer/access">
          <span>
            <small>Your active permissions</small>
            <strong>
              {access.isError || !access.data
                ? "—"
                : access.data.developer_control
                  ? "Full"
                  : access.data.capabilities.length}
            </strong>
            <em>
              {access.isError
                ? "Setup or verification required"
                : "Exact actions and scopes"}
            </em>
          </span>
          <ShieldCheck size={23} />
        </Link>
      </div>
      <RequestVisual />
      <div className={styles.sectionHeading}>
        <div>
          <h2>Your system, at a glance</h2>
          <p>Choose a work area to inspect its recorded information.</p>
        </div>
        <Link to="/developer/modules">
          All modules
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className={styles.groups}>
        {groups.map((group) => (
          <section key={group.title} className={styles.group}>
            <header>
              <span className={styles.groupIcon}>
                <group.icon size={22} />
              </span>
              <div>
                <h3>{group.title}</h3>
                <p>{group.detail}</p>
              </div>
            </header>
            <div>
              {group.ids.map((id) => {
                const module = monitorModules.find((item) => item.id === id)!;
                const Icon = monitorModuleIcons[id];
                return (
                  <Link key={id} to={`/developer/modules/${id}`}>
                    <Icon size={18} />
                    <span>{module.title}</span>
                    <small>{module.sections.length}</small>
                    <ArrowRight size={16} />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section className={styles.connection}>
        <span className={styles.groupIcon}>
          <Activity size={22} />
        </span>
        <div>
          <h2>Account connection</h2>
          <p>
            {auth.userId && auth.member
              ? "Your signed-in identity and member record are loaded."
              : "Your identity has not been verified."}{" "}
            Source availability is checked when you open a module.
          </p>
        </div>
        <Link to="/developer/connections">
          Connection details
          <ArrowRight size={18} />
        </Link>
      </section>
      <p className={styles.footnote}>
        Developer controls act through protected server operations. Member
        account support is read-only. Unavailable services are marked before you
        can make a change.
      </p>
    </>
  );
}
