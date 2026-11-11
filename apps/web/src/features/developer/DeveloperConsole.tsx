import { useParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  Activity,
  ArrowRight,
  Building2,
  CarFront,
  Database,
  Eye,
  HardDrive,
  House,
  MonitorCog,
  RefreshCw,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Empty,
  PageIntro,
} from "../../components/UI";
import { DetailDisclosure, NavigationGroup } from "../../components/Navigation";
import { useAuth } from "../../data/auth";
import {
  previewRoles,
  memberRoles,
} from "../../../../../packages/shared/src/auth";
import { roleLabels } from "./RolePreview";
import version from "../../../../../package.json";
import styles from "./DeveloperConsole.module.css";
import ModuleMonitor from "./ModuleMonitor";
import AccessPlanning from "./AccessPlanning";
import DeveloperHome from "./DeveloperHome";
import { RequestVisual } from "../../components/RequestVisual";
import MemberInspection from "./MemberAccountPicker";

const roleInfo = {
  homeowner: {
    icon: House,
    path: "/",
    sees: ["Household account and services", "Published community information"],
    boundary: "Other households and office administration stay hidden.",
  },
  renter: {
    icon: House,
    path: "/",
    sees: [
      "Resident navigation and service requests",
      "Published community information",
    ],
    boundary: "Owner/tenant financial differences still need approved policy.",
  },
  admin: {
    icon: Building2,
    path: "/office",
    sees: [
      "Office queues and sample reports",
      "Resident administration and publishing",
    ],
    boundary:
      "Developer tools stay hidden. Department permissions are still pending.",
  },
  board: {
    icon: Users,
    path: "/board",
    sees: [
      "Board workspace and governance information",
      "Document and election views",
    ],
    boundary:
      "Office administration and household views require their own roles.",
  },
  security: {
    icon: ShieldCheck,
    path: "/security",
    sees: ["Gate, vehicle and incident screens", "Sample security workflows"],
    boundary: "Finance, household records and developer tools stay hidden.",
  },
  driver: {
    icon: CarFront,
    path: "/driver",
    sees: ["Trips and transport views", "Profile and help"],
    boundary: "Office, board and unrelated household screens stay hidden.",
  },
};
export default function DeveloperConsole() {
  const auth = useAuth();
  const path = useParams()["*"] ?? "";
  if (path === "members") return <MemberInspection />;
  if (path === "access" || (path === "roles" && !auth.preview))
    return <AccessPlanning />;
  if (path === "modules" || path.startsWith("modules/"))
    return <ModuleMonitor />;
  if (!path) return <DeveloperHome />;
  const checked = auth.verifiedAt
    ? new Date(auth.verifiedAt).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
      })
    : "Not verified";
  return (
    <div className={`${styles.console} ${!path ? styles.hasDashboard : ""}`}>
      <PageIntro
        eyebrow="TECHNICAL OVERSIGHT"
        title={
          path === "roles"
            ? "Role previews"
            : path === "connections"
              ? "Connections"
              : path === "activity"
                ? "System activity"
                : "Developer console"
        }
        icon={<MonitorCog size={28} />}
        description="System maintenance and technical diagnostics. Daily operations belong in their assigned workspace."
      />
      {auth.preview && (
        <NavigationGroup aria-label="Developer console sections">
          <Link to="/developer">Overview</Link>
          <Link to="/developer/modules">Record diagnostics</Link>
          <Link to="/developer/connections">Connections</Link>
          <Link to="/developer/roles">Role previews</Link>
          <Link to="/developer/activity">Activity</Link>
        </NavigationGroup>
      )}
      {path === "connections" && (
        <>
          <div className="section-title">
            <h2>Connection status</h2>
            <Button secondary onClick={auth.retry}>
              <RefreshCw size={20} />
              Recheck access
            </Button>
          </div>
          <div className={styles.grid}>
            {[
              {
                title: "Supabase Auth",
                icon: ShieldCheck,
                status:
                  auth.userId && !auth.preview
                    ? "Identity verified"
                    : "Not verified",
                detail:
                  "Current signed-in identity only. Passwords and tokens are never displayed.",
                live: !!auth.userId && !auth.preview,
              },
              {
                title: "Member lookup",
                icon: Database,
                status:
                  auth.member && !auth.preview
                    ? "Member loaded"
                    : "Not verified",
                detail:
                  "Your own linked record. This does not verify all table policies.",
                live: !!auth.member && !auth.preview,
              },
              {
                title: "Operational monitoring",
                icon: Activity,
                status: "Check a module",
                detail:
                  "System modules use a developer-only read API. Availability is checked per source; this is not a global health probe.",
                live: false,
              },
              {
                title: "Files & delivery",
                icon: HardDrive,
                status: "Not checked",
                detail:
                  "Private storage, mail delivery and job health are not monitored yet.",
                live: false,
              },
            ].map(({ title, icon: Icon, status, detail, live }) => (
              <section key={title} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.icon}>
                    <Icon size={26} />
                  </span>
                  <Badge tone={live ? "green" : "neutral"}>{status}</Badge>
                </div>
                <h2>{title}</h2>
                <p>{detail}</p>
              </section>
            ))}
          </div>
        </>
      )}
      {path === "roles" && (
        <>
          <Link className="text-link" to="/developer/members">
            View a real member — read-only
            <ArrowRight size={20} />
          </Link>
          <div className="notice-note">
            <Eye size={22} />
            <p>
              Previews enforce current frontend route rules using invented
              records. They do not test live RLS or give you another person's
              account.
            </p>
          </div>
          <div className={styles.grid}>
            {previewRoles.map((role) => {
              const info = roleInfo[role];
              const Icon = info.icon;
              return (
                <a
                  key={role}
                  className={`${styles.card} ${styles.roleCard}`}
                  href={`/developer/preview/${role}${info.path === "/" ? "/" : info.path}`}
                >
                  <span className={styles.icon}>
                    <Icon size={28} />
                  </span>
                  <strong>
                    {roleLabels[role]}
                    <ArrowRight size={20} />
                  </strong>
                  <ul>
                    {info.sees.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>{info.boundary}</p>
                  <Badge>Synthetic preview</Badge>
                </a>
              );
            })}
          </div>
          <DetailDisclosure title="How previews stay separate">
            <p>
              Each role has its own sample-storage keys and query cache. Links
              stay inside the selected role's route prefix. Exit preview returns
              to your developer console. Account-changing Auth calls are
              disabled in preview.
            </p>
          </DetailDisclosure>
        </>
      )}
      {path === "activity" && (
        <>
          <Empty
            icon={<Activity size={32} />}
            title="Unified activity stream is not connected"
            action={
              <ButtonLink tone="primary" to="/developer/modules/audit">
                Open audit monitoring
                <ArrowRight size={20} />
              </ButtonLink>
            }
          >
            Use the audit module to inspect available server history. Delivery
            jobs and a unified event stream are not monitored here yet.
          </Empty>
          <section className={styles.card}>
            <h2>Available now</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Current identity verification</dt>
                <dd>{checked}</dd>
              </div>
              <div>
                <dt>Membership</dt>
                <dd>{auth.member?.status ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Unified event stream</dt>
                <dd>Unavailable</dd>
              </div>
            </dl>
          </section>
        </>
      )}
      {path && !["roles", "connections", "activity"].includes(path) && (
        <Empty
          title="This developer tool is not available yet"
          icon={<Wrench size={32} />}
        >
          Return to the console to review connections or role previews.
        </Empty>
      )}
      <div className={styles.actions}>
        <ButtonLink tone="secondary" to="/workspaces">
          Back to home
          <ArrowRight size={20} />
        </ButtonLink>
        <ButtonLink tone="danger" to="/sign-out">
          Sign out
        </ButtonLink>
      </div>
    </div>
  );
}
