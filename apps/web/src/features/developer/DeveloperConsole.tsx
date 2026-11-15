import { useParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowRight,
  Building2,
  CarFront,
  Eye,
  House,
  MonitorCog,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { Badge, ButtonLink, Empty, PageIntro } from "../../components/UI";
import { DetailDisclosure, NavigationGroup } from "../../components/Navigation";
import { useAuth } from "../../data/auth";
import { previewRoles } from "../../../../../packages/shared/src/auth";
import { roleLabels } from "./RolePreview";
import styles from "./DeveloperConsole.module.css";
import ModuleMonitor from "./ModuleMonitor";
import AccessPlanning from "./AccessPlanning";
import DeveloperHome from "./DeveloperHome";
import MemberInspection from "./MemberAccountPicker";
import DeveloperConnections from "./DeveloperConnections";
import DeveloperAudit from "./DeveloperAudit";

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
  if (path === "connections") return <DeveloperConnections />;
  if (path === "activity") return <DeveloperAudit />;
  return (
    <div className={`${styles.console} ${!path ? styles.hasDashboard : ""}`}>
      <PageIntro
        eyebrow="TECHNICAL OVERSIGHT"
        title={
          path === "roles" || path === "previews"
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
      {(path === "roles" || path === "previews") && (
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
      {path &&
        !["roles", "previews", "connections", "activity"].includes(path) && (
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
