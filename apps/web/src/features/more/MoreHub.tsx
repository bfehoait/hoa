import { useAuth } from "../../data/auth";
import { useState } from "react";
import { useLinkedPropertyAddress } from "../../data/linked-properties";
import { Link } from "../../components/AccessLink";
import { usePermissions } from "../../data/permissions";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import { useAccountNavigation } from "../../components/AccountNavigation";

import {
  CircleHelp,
  ClipboardCheck,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Settings2,
  UserRound,
  Bell,
  Moon,
  ChevronRight,
  Search,
  FileText,
} from "lucide-react";
import {
  DestinationGrid,
  DetailDisclosure,
  type Destination,
} from "../../components/Navigation";
import { ButtonLink, Empty, PageIntro } from "../../components/UI";
import styles from "./MoreHub.module.css";

const groups: { title: string; category: string; items: Destination[] }[] = [
  {
    title: "Your account & support",
    category: "Account",
    items: [
      {
        to: "/more/profile",
        title: "My profile",
        detail: "Your account & contact details",
        icon: UserRound,
      },
      {
        to: "/more/notifications",
        title: "Notifications",
        detail: "New and earlier activity",
        icon: Bell,
      },
      {
        to: "/more/help",
        title: "Help & support",
        detail: "Get help using the app",
        icon: CircleHelp,
      },
      {
        to: "/more/settings",
        title: "Settings",
        detail: "Account and appearance",
        icon: Settings2,
      },
    ],
  },
];
const tools: Destination[] = [
  {
    to: "/office",
    title: "Office & reports",
    detail: "Office queues and reports",
    icon: LayoutDashboard,
  },
  {
    to: "/explore",
    title: "Service directory",
    detail: "Forms, submissions and community services",
    icon: LayoutGrid,
  },
  {
    to: "/coverage",
    title: "Source coverage",
    detail: "All 16 source areas & gates",
    icon: ClipboardCheck,
  },
  {
    to: "/developer",
    title: "Developer maintenance",
    detail: "Diagnostics & local reset",
    icon: Settings2,
  },
  {
    to: "/sign-in",
    title: "Switch preview workspace",
    detail: "Resident, office, security & more",
    icon: UserRound,
  },
];
export default function MoreHub() {
  const auth = useAuth();
  const links = useLinkedPropertyAddress();
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  const permissions = usePermissions();
  const accessGroups = useAccountNavigation().filter(
    (area) => area.id !== "resident",
  );
  const allowed = (item: Destination) =>
    auth.preview ||
    (!!auth.member &&
      canOpenPath(auth.member, item.to) &&
      permissions.allowsPath(item.to));
  const availableGroups = groups
    .map((group) => ({ ...group, items: group.items.filter(allowed) }))
    .filter((group) => group.items.length);
  const visible = availableGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !["/directory/market", "/directory/learning"].includes(item.to),
      ),
    }))
    .filter((group) => group.items.length);
  const matches = tools.filter(
    (item) => (auth.preview || !!auth.rolePreview) && allowed(item),
  );
  const serviceGroups = visible.map((group) => (
    <section
      key={group.category}
      className={`${styles.group} ${group.category === "Account" ? styles.accountExtras : ""}`}
    >
      <h2>{group.title}</h2>
      <DestinationGrid items={group.items} variant="rows" />
    </section>
  ));
  return (
    <>
      <PageIntro title="More" />
      {auth.member && (
        <Link to="/more/profile" className={styles.memberCard}>
          <span className={styles.memberAvatar} aria-hidden="true">
            {Array.from(auth.member.name?.trim() || "")[0]?.toUpperCase() ||
              "A"}
          </span>
          <span>
            <strong>{auth.member.name || "Member"}</strong>
            <span>{links.address}</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}
      <section
        className={styles.mobileAccount}
        aria-label="Account preferences"
      >
        <h2>Account</h2>
        <div className={styles.preferenceRows}>
          <Link to="/more/profile">
            <UserRound size={20} aria-hidden="true" />
            <span>Profile details</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/more/notifications">
            <Bell size={20} aria-hidden="true" />
            <span>Notifications</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <label>
            <Moon size={20} aria-hidden="true" />
            <span>
              Dark appearance<small>Easier on the eyes at night</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Dark appearance"
              checked={dark}
              onChange={(event) => {
                const next = event.target.checked;
                setDark(next);
                document.documentElement.dataset.theme = next
                  ? "dark"
                  : "light";
                window.dispatchEvent(new Event("bellefort-theme-change"));
                try {
                  localStorage.setItem(
                    "bellefort-theme",
                    next ? "dark" : "light",
                  );
                } catch {
                  /* Per-device preference can work without storage. */
                }
              }}
            />
          </label>
          <Link to="/more/settings">
            <Settings2 size={20} aria-hidden="true" />
            <span>Settings</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/search">
            <Search size={20} aria-hidden="true" />
            <span>Search features</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section
        className={styles.mobileAccount}
        aria-label="Community information"
      >
        <h2>Community</h2>
        <div className={styles.preferenceRows}>
          <Link to="/more/documents">
            <FileText size={20} aria-hidden="true" />
            <span>Community documents</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/more/help">
            <CircleHelp size={20} aria-hidden="true" />
            <span>Help &amp; support</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
      {accessGroups.map((area) => {
        const items = area.links.map((link) => ({
          to: link.to,
          title: `${area.title}: ${link.label}`,
          icon: link.icon,
        }));
        return items.length ? (
          <DetailDisclosure key={area.id} title={area.title}>
            <DestinationGrid items={items} variant="rows" />
          </DetailDisclosure>
        ) : null;
      })}
      <div className={styles.desktopServices}>{serviceGroups}</div>
      {!visible.length &&
        !matches.length &&
        !accessGroups.some((area) => area.links.length) && (
          <Empty title="No matching feature">
            No additional features are available for this account.
          </Empty>
        )}
      {matches.length > 0 && (
        <DetailDisclosure
          title={
            auth.preview || auth.rolePreview
              ? "Preview & maintenance tools"
              : "Tools & administration"
          }
        >
          <p>
            {auth.preview || auth.rolePreview
              ? "These tools demonstrate workflows and local maintenance. Opening a workspace does not grant permissions or authenticate anyone."
              : "Open the tools available to your account. Services that are not connected are marked as unavailable."}
          </p>
          <div className={styles.tools}>
            <DestinationGrid items={matches} compact />
          </div>
        </DetailDisclosure>
      )}
      {!auth.rolePreview && (
        <div className={styles.exit}>
          <ButtonLink tone="danger" to="/sign-out">
            <LogOut size={20} aria-hidden="true" />
            {auth.preview ? "Leave preview" : "Sign out"}
          </ButtonLink>
          <p>
            {auth.preview
              ? "Returns to the preview entry screen."
              : "Securely end your account session."}
          </p>
        </div>
      )}
    </>
  );
}
