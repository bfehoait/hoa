import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CircleHelp,
  LayoutDashboard,
  Moon,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { usePortal } from "./data/usePortal";
import { Skeleton } from "./components/UI";
import {
  areaNavigation,
  useAccountNavigation,
  type AccountNavLink,
} from "./components/AccountNavigation";
import { PwaPrompt } from "./components/PwaPrompt";
import { Home } from "./features/home/Home";
import styles from "./App.module.css";
import { useAuth } from "./data/auth";
import DeveloperSearch from "./features/developer/DeveloperSearch";
import { NotificationBell } from "./components/NotificationBell";
import Notifications from "./features/more/Notifications";
import { useOwnProfile } from "./data/accounts";
import { usePermissions } from "./data/permissions";
import {
  canOpenPath,
  memberRoles,
  type AuthMember,
  memberHomePath,
  isBoardWorkspacePath,
} from "../../../packages/shared/src/auth";
import { AuthGate, WorkspacePicker } from "./features/auth/AuthGate";
import { previewScope } from "./data/preview-scope";
import { RolePreview } from "./features/developer/RolePreview";
import { monitorModules } from "../../../packages/shared/src/monitoring";
import { monitorModuleIcons } from "./features/developer/monitor-icons";

const LotRegister = lazy(() => import("./features/registry/LotRegister"));
const Shuttle = lazy(() => import("./features/transport/Shuttle"));
const Account = lazy(() => import("./features/account/Account"));

const Community = lazy(() => import("./features/community/Community"));
const Services = lazy(() => import("./features/services/Services"));
const More = lazy(() => import("./features/more/More"));
const Admin = lazy(() => import("./features/admin/Admin"));
const Office = lazy(() => import("./features/office/Office"));
const RequestDesk = lazy(() => import("./features/services/RequestDesk"));
const Developer = lazy(() => import("./features/developer/Developer"));
const Access = lazy(() => import("./features/auth/Access"));
const Exit = lazy(() => import("./features/auth/Exit"));
const FieldWorkspace = lazy(
  () => import("./features/workspaces/FieldWorkspace"),
);
const CommunityModules = lazy(
  () => import("./features/community/CommunityModules"),
);
const FeatureBaseline = lazy(
  () => import("./features/baseline/FeatureBaseline"),
);
const Directory = lazy(() => import("./features/connected/Directory"));
const ReviewDesk = lazy(() => import("./features/connected/ReviewDesk"));
const Inbox = lazy(() => import("./features/connected/Inbox"));
const FlowDesk = lazy(() => import("./features/connected/FlowDesk"));
const Statement = lazy(() => import("./features/connected/Statement"));
const Coverage = lazy(() => import("./features/connected/Coverage"));
import { accountPreview } from "./data/account-preview-client";
import AccountInterfacePreview from "./features/developer/AccountInterfacePreview";
import ProductionBoundary from "./components/ProductionBoundary";
import UnavailableService from "./components/UnavailableService";
import ConnectedHome from "./features/home/ConnectedHome";
const LiveFeatureDirectory = lazy(
  () => import("./features/connected/LiveFeatureDirectory"),
);
const ResidentFeature = lazy(
  () => import("./features/connected/ResidentFeature"),
);

export function App() {
  const auth = useAuth();
  const location = useLocation();
  useEffect(() => {
    try {
      document.documentElement.dataset.theme =
        localStorage.getItem("bellefort-theme") === "dark" ? "dark" : "light";
    } catch {
      /* Default light theme. */
    }
  }, []);
  if (accountPreview)
    return (
      <AuthGate developerOnly>
        <AccountInterfacePreview>
          <AuthGate>
            <PreviewShell />
          </AuthGate>
        </AccountInterfacePreview>
      </AuthGate>
    );
  if (previewScope)
    return (
      <AuthGate developerOnly>
        {!auth.preview ? (
          <UnavailableService title="Role simulation" backHref="/developer" />
        ) : (
          <RolePreview role={previewScope.role}>
            <PreviewShell />
          </RolePreview>
        )}
      </AuthGate>
    );
  if (auth.preview) return <AppShell />;
  if (
    [
      "/sign-in",
      "/register",
      "/recover",
      "/reset-password",
      "/sign-out",
    ].includes(location.pathname)
  )
    return <AppShell />;
  return (
    <AuthGate>
      {location.pathname === "/workspaces" ? <WorkspacePicker /> : <AppShell />}
    </AuthGate>
  );
}
function PreviewShell() {
  const location = useLocation();
  return location.pathname === "/workspaces" ? (
    <WorkspacePicker />
  ) : (
    <AppShell />
  );
}
function AppShell() {
  const auth = useAuth();
  const ownProfile = useOwnProfile();
  const accountGroups = useAccountNavigation();
  const moduleNavigation = useRef<HTMLDivElement>(null);
  const permissions = usePermissions();
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("bellefort-theme") === "dark";
    } catch {
      return false;
    }
  });
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();
  const publicScreen = [
    "/sign-in",
    "/register",
    "/recover",
    "/sign-out",
    "/reset-password",
  ].includes(location.pathname);
  const portal = usePortal(!publicScreen);
  const office = location.pathname.startsWith("/office");
  const security = location.pathname.startsWith("/security");
  const driver = location.pathname.startsWith("/driver");
  const board = isBoardWorkspacePath(auth.member, location.pathname);
  const developer =
    !auth.preview &&
    !auth.rolePreview &&
    !!auth.member &&
    memberRoles(auth.member).includes("developer");
  const workspaceName = office
    ? "Office preview"
    : security
      ? "Security preview"
      : driver
        ? "Driver preview"
        : board
          ? "Board preview"
          : "Resident preview";
  useEffect(() => {
    const nav = moduleNavigation.current;
    const active = nav?.querySelector<HTMLElement>(
      'nav[aria-label="Developer module monitoring"] [aria-current="page"]',
    );
    if (!nav || !active || window.innerWidth < 1024) return;
    const bounds = nav.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < bounds.top) nav.scrollTop += item.top - bounds.top;
    else if (item.bottom > bounds.bottom)
      nav.scrollTop += item.bottom - bounds.bottom;
  }, [developer, location.pathname]);
  const routeArea = developer
    ? "developer"
    : office
      ? "office"
      : security
        ? "security"
        : driver
          ? "driver"
          : board
            ? "board"
            : "resident";
  const areaId =
    routeArea === "resident" &&
    !auth.preview &&
    !accountGroups.some((group) => group.id === "resident")
      ? (accountGroups.find((group) =>
          group.links.some(
            (link) =>
              link.to === (auth.member ? memberHomePath(auth.member) : "/"),
          ),
        )?.id ??
        accountGroups[0]?.id ??
        "resident")
      : routeArea;
  const currentArea = areaNavigation[areaId];
  const allLinks = currentArea.links;
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("bellefort-theme", dark ? "dark" : "light");
    } catch {
      /* Theme remains usable without storage. */
    }
  }, [dark]);
  useEffect(() => {
    const yes = () => setOnline(true);
    const no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${location.pathname === "/" ? "Overview" : location.pathname.split("/")[1].replace(/^./, (c) => c.toUpperCase())} · Bellefort`;
    document.getElementById("content")?.focus({ preventScroll: true });
  }, [location.pathname]);
  const links = auth.preview
    ? allLinks
    : allLinks
        .map((link) => ({
          ...link,
          to: link.to === "/sign-in" ? "/workspaces" : link.to,
        }))
        .filter(
          (link) =>
            auth.member &&
            canOpenPath(auth.member, link.to) &&
            permissions.allowsPath(link.to),
        );
  const mobileLinks =
    areaId === "resident"
      ? links
      : [
          ...links.filter((link) => link.to !== "/more").slice(0, 4),
          { to: "/more", label: "More", icon: MoreHorizontal },
        ];
  const otherGroups = accountGroups.filter((group) => group.id !== areaId);
  const name = auth.preview
    ? (portal.data?.profile.name ?? "Demo resident")
    : (ownProfile.isError ? null : ownProfile.data?.display_name) ||
      auth.member?.name ||
      "Member";
  const sectionActive = (to: string) => {
    const aliases: Record<string, string[]> = {
      "/more": ["/directory", "/explore", "/coverage", "/developer"],
      "/office/residents": ["/office/registry", "/office/registrations"],
      "/office/operations": [
        "/office/review",
        "/office/requests",
        "/office/inbox",
        "/office/permits",
        "/office/vehicles",
      ],
      "/office/community": ["/office/announcements", "/office/documents"],
      "/security": ["/security/gate"],
      "/driver": ["/driver/dispatch"],
      "/board/documents": ["/more/documents", "/directory/governance"],
      "/board/elections": ["/more/elections"],
    };
    return (
      location.pathname === to ||
      (![
        "/",
        "/office",
        "/security",
        "/driver",
        "/board",
        "/developer",
      ].includes(to) &&
        location.pathname.startsWith(to + "/")) ||
      aliases[to]?.some(
        (path) =>
          location.pathname === path ||
          location.pathname.startsWith(path + "/"),
      )
    );
  };
  const activeWithin = (to: string, items: AccountNavLink[]) =>
    sectionActive(to) &&
    !items.some(
      (item) =>
        item.to !== to &&
        item.to.startsWith(to + "/") &&
        sectionActive(item.to),
    );
  if (publicScreen)
    return (
      <>
        <PwaPrompt />
        <Suspense fallback={<Skeleton />}>
          {location.pathname === "/sign-out" ? (
            <Exit />
          ) : (
            <Access key={location.pathname} />
          )}
        </Suspense>
      </>
    );
  return (
    <div className={`${styles.app} ${developer ? styles.developer : ""}`}>
      <PwaPrompt />
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Main navigation">
        <Link to={auth.preview ? "/" : "/workspaces"} className={styles.brand}>
          <img
            className={styles.wordmarkLight}
            src="/brand/bellefort-logo.png"
            alt="Bellefort Estates"
            width="479"
            height="212"
          />
          <img
            className={styles.wordmarkDark}
            src="/brand/bellefort-logo-white.png"
            alt="Bellefort Estates"
            width="479"
            height="212"
          />
        </Link>
        <div className={styles.navigationBody} ref={moduleNavigation}>
          <div className={styles.property}>
            <Building2 size={20} />
            <span>
              {!auth.preview
                ? developer
                  ? "Developer workspace"
                  : "Account workspace"
                : office || security || driver || board
                  ? workspaceName
                  : "Block 08 · Lot 12"}
              <small>
                {!auth.preview && !auth.rolePreview
                  ? "Access follows your account permissions"
                  : office || security || driver || board
                    ? "Inspectable sample workspace"
                    : "Phase 2 · Preview"}
              </small>
            </span>
          </div>
          <p className={`${styles.navLabel} eyebrow`}>
            {workspaceHeading(auth.member, location.pathname, developer, board)}
          </p>
          <nav>
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                aria-current={activeWithin(to, links) ? "page" : undefined}
                className={`${styles.navLink} ${activeWithin(to, links) ? styles.selected : ""}`}
              >
                <Icon size={20} />
                <span>{label}</span>
                {to === "/community" && (auth.preview || auth.rolePreview) && (
                  <span className={styles.count}>3</span>
                )}
              </Link>
            ))}
          </nav>
          {developer && (
            <>
              <p className={`${styles.navLabel} eyebrow`}>SYSTEM MODULES</p>
              <nav aria-label="Developer module monitoring">
                {monitorModules.map((module) => {
                  const Icon = monitorModuleIcons[module.id];
                  const path = `/developer/modules/${module.id}`;
                  return (
                    <Link
                      key={module.id}
                      to={path}
                      aria-current={
                        location.pathname === path ? "page" : undefined
                      }
                      className={`${styles.navLink} ${location.pathname === path ? styles.selected : ""}`}
                    >
                      <Icon size={20} />
                      <span>{module.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </>
          )}
          {otherGroups.map((group) => (
            <section key={group.id}>
              <p className={`${styles.navLabel} eyebrow`}>{group.title}</p>
              <nav aria-label={`${group.title} navigation`}>
                {group.links.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`${styles.navLink} ${activeWithin(to, group.links) ? styles.selected : ""}`}
                    aria-current={
                      activeWithin(to, group.links) ? "page" : undefined
                    }
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            </section>
          ))}
          {auth.preview && (
            <div className={styles.adminLink}>
              <NavLink
                to={
                  office || security || driver || board ? "/sign-in" : "/office"
                }
                className={styles.navLink}
              >
                <LayoutDashboard size={20} />
                <span>
                  {office || security || driver || board
                    ? "Preview roles"
                    : "Office & reports"}
                </span>
                <ArrowUpRight size={16} />
              </NavLink>
            </div>
          )}
        </div>
        <div className={styles.sidebarBottom}>
          <Link to="/more/help" className={styles.help}>
            <CircleHelp size={20} />
            Need a hand?
            <ArrowUpRight size={16} />
          </Link>
          <div className={styles.member}>
            <span className="avatar">
              {name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{name}</strong>
              <small>
                {!auth.preview
                  ? "Signed-in member"
                  : office || security || driver || board
                    ? workspaceName
                    : "Demo resident"}
              </small>
            </span>
            <Link
              className="icon-button"
              to="/more/profile"
              aria-label="Open profile settings"
            >
              <Settings2 size={20} />
            </Link>
          </div>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          {developer && <DeveloperSearch />}
          <div className={styles.breadcrumb}>
            <Link
              className={`icon-button ${styles.menuOpen}`}
              to={auth.preview ? "/" : "/workspaces"}
              aria-label="Bellefort overview"
            >
              <img src="/icon.svg" width="32" height="32" alt="" />
            </Link>
            <span className={styles.desktopCrumb}>
              Your community<span className={styles.slash}>/</span>
            </span>
            <span>
              {location.pathname === "/more/notifications"
                ? "Notifications"
                : location.pathname === "/more/profile"
                  ? "My profile"
                  : location.pathname.startsWith("/admin")
                    ? "Office & reports"
                    : (links.find((l) => l.to !== "/" && sectionActive(l.to))
                        ?.label ?? "Bellefort")}
            </span>
          </div>
          <div className={styles.topActions}>
            {developer && (
              <Link to="/more/profile" className={styles.developerProfile}>
                <span className="avatar">
                  {name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>Developer workspace</small>
                </span>
              </Link>
            )}
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Use light theme" : "Use dark theme"}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <NotificationBell />
          </div>
        </header>
        <div
          className={styles.previewBar}
          role="region"
          aria-label="Data status"
        >
          <ShieldCheck size={16} />
          <span>
            {auth.preview || auth.rolePreview
              ? "Local preview · Sample data — not an HOA confirmation"
              : developer
                ? "Signed in · Developer workspace"
                : "Signed in · Account services"}
          </span>
          <Link to={auth.preview ? "/more/settings" : "/workspaces"}>
            {auth.preview ? "Data & settings" : "My account"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {!online && (
          <div className="offline-banner" role="status">
            You’re offline. Database records may be out of date. Reconnect
            before relying on an account status or submitting an action.
          </div>
        )}
        <main id="content" tabIndex={-1} className={styles.main}>
          {permissions.readOnlyPath(location.pathname) && (
            <div className="offline-banner" role="note">
              View only. You can browse this module; changes require edit
              permission.
            </div>
          )}
          <Suspense fallback={<Skeleton />}>
            <ProductionBoundary>
              <Routes>
                <Route
                  path="/"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <Home />
                    ) : (
                      <ConnectedHome />
                    )
                  }
                />
                <Route
                  path="/services"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <Services />
                    ) : (
                      <ConnectedHome area="services" />
                    )
                  }
                />
                <Route
                  path="/more/help"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <More />
                    ) : (
                      <ConnectedHome area="help" />
                    )
                  }
                />
                <Route
                  path="/board"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <FieldWorkspace />
                    ) : (
                      <ConnectedHome area="board" />
                    )
                  }
                />
                <Route path="/account/*" element={<Account />} />
                <Route path="/community/*" element={<Community />} />
                <Route path="/services/*" element={<Services />} />
                <Route path="/more/*" element={<More />} />
                <Route
                  path="/admin"
                  element={<Navigate replace to="/office/finance" />}
                />
                <Route path="/admin/*" element={<Admin />} />
                <Route path="/office/lots/*" element={<LotRegister office />} />
                <Route path="/more/lots/*" element={<LotRegister />} />
                <Route
                  path="/more/vehicles"
                  element={<ResidentFeature module="vehicles" />}
                />
                <Route
                  path="/more/permits"
                  element={<ResidentFeature module="permits" />}
                />
                <Route path="/more/transport" element={<Shuttle />} />
                <Route path="/board/shuttle" element={<Shuttle />} />
                <Route path="/office/*" element={<Office />} />
                <Route path="/developer/*" element={<Developer />} />
                <Route path="/explore" element={<FeatureBaseline />} />
                <Route path="/explore/:module" element={<FeatureBaseline />} />
                <Route path="/directory" element={<Directory />} />
                <Route
                  path="/directory/learning"
                  element={<Directory section="Learning" />}
                />
                <Route
                  path="/directory/market"
                  element={<Directory section="Market" />}
                />
                <Route
                  path="/directory/transport"
                  element={<Directory section="Transport" />}
                />
                <Route
                  path="/directory/governance"
                  element={<Directory section="Governance" />}
                />
                <Route
                  path="/office/review"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <ReviewDesk />
                    ) : (
                      <LiveFeatureDirectory initialView="review" />
                    )
                  }
                />
                <Route
                  path="/office/inbox"
                  element={
                    auth.preview ? (
                      <Inbox actor="Office" />
                    ) : (
                      <RequestDesk office />
                    )
                  }
                />
                <Route
                  path="/services/inbox"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <Inbox actor="Resident" />
                    ) : (
                      <RequestDesk />
                    )
                  }
                />
                <Route
                  path="/office/registry"
                  element={<FlowDesk area="registry" />}
                />
                <Route path="/driver/dispatch" element={<Shuttle />} />
                <Route
                  path="/security/gate"
                  element={<FlowDesk area="gate" />}
                />
                <Route
                  path="/account/statement"
                  element={
                    auth.preview || auth.rolePreview ? (
                      <Statement />
                    ) : (
                      <LotRegister account />
                    )
                  }
                />
                <Route path="/coverage" element={<Coverage />} />
                <Route path="/security/*" element={<FieldWorkspace />} />
                <Route path="/driver/*" element={<Shuttle />} />
                <Route path="/board/*" element={<FieldWorkspace />} />
                {[
                  "vehicles",
                  "permits",
                  "documents",
                  "elections",
                  "marketplace",
                  "training",
                ].map((area) => (
                  <Route
                    key={area}
                    path={`/more/${area}`}
                    element={<CommunityModules area={area} />}
                  />
                ))}
                <Route path="/more/notifications" element={<Notifications />} />
                <Route
                  path="/services/calendar"
                  element={<CommunityModules area="calendar" />}
                />
                <Route
                  path="*"
                  element={
                    <div className="not-found">
                      <p className="eyebrow">404 · A wrong turn</p>
                      <h1>Let’s get you back home.</h1>
                      <p>This page doesn’t exist in the preview.</p>
                      <Link className="text-link" to="/">
                        Go to overview <ArrowUpRight size={20} />
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </ProductionBoundary>
          </Suspense>
        </main>
        <footer className={styles.footer}>
          <span>
            Bellefort Estates<span className={styles.footerDot}>·</span>Bacoor,
            Cavite
          </span>
          <span>A little closer to home.</span>
        </footer>
      </div>
      <nav
        className={styles.mobileNav}
        aria-label="Mobile navigation"
        style={{
          gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))`,
        }}
      >
        {mobileLinks.map(({ to, label, mobile, icon: Icon }) => (
          <Link
            to={to}
            key={to}
            aria-current={activeWithin(to, mobileLinks) ? "page" : undefined}
            className={
              activeWithin(to, mobileLinks) ? styles.mobileSelected : ""
            }
          >
            <Icon size={24} />
            <span>{mobile ?? label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** The heading over the sidebar links.
 *
 *  It was three-way, so a guard, a driver and a renter were all told they were
 *  looking at "your neighborhood". The heading follows the section being used
 *  first, then the account's own role, because an admin on the gate desk is
 *  doing gate work whatever their member record says.
 */
function workspaceHeading(
  member: AuthMember | null,
  pathname: string,
  developer: boolean,
  board: boolean,
) {
  if (developer) return "DEVELOPER CONSOLE";
  if (board) return "BOARD WORKSPACE";
  if (pathname.startsWith("/security")) return "GATE & SECURITY";
  if (pathname.startsWith("/driver")) return "TRANSPORT";
  if (pathname.startsWith("/office") || pathname.startsWith("/admin"))
    return "ADMINISTRATION";
  const roles = member ? memberRoles(member) : [];
  if (roles.includes("security")) return "GATE & SECURITY";
  if (roles.includes("driver")) return "TRANSPORT";
  if (roles.includes("admin")) return "ADMINISTRATION";
  // A renter is a resident of one home, not of the neighborhood's records.
  if (roles.includes("renter") && !roles.includes("homeowner"))
    return "MY RESIDENCE";
  if (roles.includes("homeowner")) return "MY HOUSEHOLD";
  return "YOUR NEIGHBORHOOD";
}
