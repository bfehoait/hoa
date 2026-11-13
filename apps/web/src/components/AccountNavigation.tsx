import {
  Building2,
  CalendarDays,
  House,
  LayoutDashboard,
  MoreHorizontal,
  Newspaper,
  Settings2,
  ShieldCheck,
  Wallet,
  Wrench,
  CarFront,
  KeyRound,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  memberRoles,
  memberWorkspaces,
} from "../../../../packages/shared/src/auth";
import { useAuth } from "../data/auth";
import { usePermissions } from "../data/permissions";

export type AccountNavLink = {
  to: string;
  label: string;
  mobile?: string;
  icon: LucideIcon;
};
export const areaNavigation: Record<
  string,
  { title: string; links: AccountNavLink[] }
> = {
  resident: {
    title: "My home",
    links: [
      { to: "/", label: "Home", icon: House },
      { to: "/account", label: "My account", mobile: "Account", icon: Wallet },
      {
        to: "/directory/market",
        label: "Livelihood",
        mobile: "Livelihood",
        icon: Store,
      },
      { to: "/services", label: "Services", icon: Wrench },
      {
        to: "/more",
        label: "More",
        mobile: "More",
        icon: MoreHorizontal,
      },
    ],
  },
  developer: {
    title: "Developer",
    links: [
      { to: "/developer", label: "Overview", mobile: "Home", icon: House },
      {
        to: "/developer/members",
        label: "Account support",
        mobile: "Support",
        icon: ShieldCheck,
      },
      {
        to: "/developer/connections",
        label: "Connections",
        mobile: "Connect",
        icon: ShieldCheck,
      },
      {
        to: "/developer/access",
        label: "Access configuration",
        mobile: "Access",
        icon: LayoutDashboard,
      },
      {
        to: "/developer/activity",
        label: "Diagnostics & audit",
        mobile: "Audit",
        icon: Newspaper,
      },
    ],
  },
  office: {
    title: "Office",
    links: [
      { to: "/office", label: "Overview", mobile: "Home", icon: House },
      { to: "/office/approvals", label: "Review inbox", icon: ShieldCheck },
      { to: "/office/residents", label: "People & accounts", icon: Building2 },
      { to: "/office/finance", label: "Finance", icon: Wallet },
      {
        to: "/office/operations",
        label: "Operations",
        mobile: "Tasks",
        icon: Wrench,
      },
      {
        to: "/office/calendar",
        label: "Facilities & calendar",
        mobile: "Calendar",
        icon: CalendarDays,
      },
      {
        to: "/office/community",
        label: "Community",
        mobile: "Publish",
        icon: Newspaper,
      },
      {
        to: "/office/requests",
        label: "Helpdesk",
        mobile: "Helpdesk",
        icon: Wrench,
      },
      { to: "/office/lots", label: "Lot register", icon: Building2 },
      { to: "/office/access", label: "Roles & permissions", icon: KeyRound },
    ],
  },
  board: {
    title: "Board of Directors",
    links: [
      { to: "/board", label: "Overview", icon: House },
      {
        to: "/board/documents",
        label: "Documents",
        mobile: "Files",
        icon: Newspaper,
      },
      {
        to: "/board/elections",
        label: "Elections",
        mobile: "Vote",
        icon: ShieldCheck,
      },
      { to: "/board/updates", label: "Updates", icon: Newspaper },
      { to: "/board/reports", label: "Reports", icon: Wallet },
      { to: "/board/shuttle", label: "Shuttle review", icon: CarFront },
    ],
  },
  security: {
    title: "Security",
    links: [
      { to: "/security", label: "Visitors", icon: House },
      { to: "/security/vehicles", label: "Vehicles", icon: CarFront },
      { to: "/security/incidents", label: "Incidents", icon: ShieldCheck },
      {
        to: "/security/gate",
        label: "Gate desk",
        mobile: "Gate",
        icon: KeyRound,
      },
    ],
  },
  driver: {
    title: "Transport",
    links: [
      { to: "/driver", label: "Shuttle", icon: House },
      { to: "/more/profile", label: "Profile", icon: Settings2 },
    ],
  },
};
export function useAccountNavigation() {
  const auth = useAuth();
  const permissions = usePermissions();
  const householdRole = auth.member
    ? memberRoles(auth.member).find(
        (role) => role === "homeowner" || role === "renter",
      )
    : undefined;
  return auth.member
    ? memberWorkspaces(auth.member)
        .map((area) => ({
          id: area.id,
          ...areaNavigation[area.id],
          title:
            area.id === "resident"
              ? householdRole === "renter"
                ? "Renter"
                : "Homeowner"
              : areaNavigation[area.id].title,
          links: areaNavigation[area.id].links.filter((link) =>
            permissions.allowsPath(link.to),
          ),
        }))
        .filter((area) => area.links.length)
    : [];
}
