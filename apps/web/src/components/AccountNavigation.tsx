import {
  Building2,
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
  type LucideIcon,
} from "lucide-react";
import { memberWorkspaces } from "../../../../packages/shared/src/auth";
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
        to: "/community",
        label: "Community",
        mobile: "Updates",
        icon: Newspaper,
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
        to: "/developer/modules",
        label: "System modules",
        mobile: "Modules",
        icon: LayoutDashboard,
      },
      {
        to: "/developer/connections",
        label: "Connections",
        mobile: "Connect",
        icon: ShieldCheck,
      },
      {
        to: "/developer/roles",
        label: "Access & roles",
        mobile: "Roles",
        icon: LayoutDashboard,
      },
      { to: "/more/lots", label: "Lot register", icon: Building2 },
      { to: "/driver/dispatch", label: "Shuttle service", icon: CarFront },
      { to: "/developer/activity", label: "Activity", icon: Newspaper },
      {
        to: "/developer/access",
        label: "Roles & committee access",
        mobile: "Access",
        icon: KeyRound,
      },
    ],
  },
  office: {
    title: "Office",
    links: [
      { to: "/office", label: "Overview", mobile: "Home", icon: House },
      { to: "/office/residents", label: "People", icon: Building2 },
      { to: "/office/finance", label: "Finance", icon: Wallet },
      {
        to: "/office/operations",
        label: "Operations",
        mobile: "Tasks",
        icon: Wrench,
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
    title: "Board",
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
  return auth.member
    ? memberWorkspaces(auth.member)
        .map((area) => ({
          id: area.id,
          ...areaNavigation[area.id],
          links: areaNavigation[area.id].links.filter((link) =>
            permissions.allowsPath(link.to),
          ),
        }))
        .filter((area) => area.links.length)
    : [];
}
