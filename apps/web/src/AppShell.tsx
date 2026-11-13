import { lazy, Suspense, useEffect, useRef, useState } from "react";
import CustomerBack from "./components/CustomerBack";
import ResidentMobileHeader from "./components/ResidentMobileHeader";
import mobileStyles from "./components/ResidentMobile.module.css";
import CustomerSearch from "./components/CustomerSearch";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
  useNavigationType,
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
const Home = lazy(() =>
  import("./features/home/Home").then((module) => ({ default: module.Home })),
);
import styles from "./App.module.css";
import { useAuth } from "./data/auth";

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

const LotRegister = lazy(() => import("./features/registry/LotRegister"));
const Shuttle = lazy(() => import("./features/transport/Shuttle"));
const Account = lazy(() => import("./features/account/Account"));

const Community = lazy(() => import("./features/community/Community"));
const Services = lazy(() => import("./features/services/Services"));
const More = lazy(() => import("./features/more/More"));
const Hotlines = lazy(() => import("./features/more/Hotlines"));
const CustomerSearchPage = lazy(
  () => import("./features/more/CustomerSearchPage"),
);
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
import ProductionBoundary from "./components/ProductionBoundary";
const ConnectedHome = lazy(() => import("./features/home/ConnectedHome"));
const LiveFeatureDirectory = lazy(
  () => import("./features/connected/LiveFeatureDirectory"),
);
const ResidentFeature = lazy(
  () => import("./features/connected/ResidentFeature"),
);

export default function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const ownProfile = useOwnProfile();
  const accountGroups = useAccountNavigation();

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
    memberRoles(auth.member).includes("developer") &&
    location.pathname.startsWith("/developer");
  const workspaceName = office
    ? "Office preview"
    : security
      ? "Security preview"
      : driver
        ? "Driver preview"
        : board
          ? "Board preview"
          : "Resident preview";
  const routeArea = office
    ? "office"
    : security
      ? "security"
      : driver
        ? "driver"
        : board
          ? "board"
          : developer
            ? "developer"
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
  const workspaceOptions = accountGroups.map((group) => ({
    id: group.id,
    title: group.title,
    to:
      group.links.find(
        (link) =>
          link.to ===
          (
            {
              developer: "/developer",
              office: "/office",
              board: "/board",
              security: "/security",
              driver: "/driver",
              resident: "/",
            } as Record<string, string>
          )[group.id],
      )?.to ?? group.links[0].to,
  }));
  const residentShell = areaId === "resident";
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (
      !residentShell ||
      location.pathname === "/" ||
      isAccountTabSwitch(previousPath.current, location.pathname) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const content = document.getElementById("content");
    const transition = content?.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    return () => transition?.cancel();
  }, [location.pathname, residentShell]);
  const navigationType = useNavigationType();
  const scrollPositions = useRef(new Map<string, number>());
  const customerDetail =
    residentShell &&
    ![
      "/",
      "/account",
      "/account/lots",
      "/account/payments",
      "/directory/market",
      "/services",
      "/more",
    ].includes(location.pathname);
  const allLinks = currentArea.links;
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.dataset.theme === "dark");
    window.addEventListener("bellefort-theme-change", update);
    return () => window.removeEventListener("bellefort-theme-change", update);
  }, []);
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
    const path = location.pathname;
    const switchingAccountTab =
      residentShell && isAccountTabSwitch(previousPath.current, path);
    previousPath.current = path;
    const savedPosition =
      residentShell && navigationType === "POP"
        ? (scrollPositions.current.get(path) ?? 0)
        : 0;
    const frame = switchingAccountTab
      ? null
      : requestAnimationFrame(() => window.scrollTo(0, savedPosition));
    const remember = () => {
      if (scrollPositions.current.size > 50) scrollPositions.current.clear();
      scrollPositions.current.set(path, window.scrollY);
    };
    window.addEventListener("scroll", remember, { passive: true });
    document.title = `${location.pathname === "/" ? "Overview" : location.pathname.split("/")[1].replace(/^./, (c) => c.toUpperCase())} · Bellefort`;
    if (!switchingAccountTab)
      document.getElementById("content")?.focus({ preventScroll: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remember);
    };
  }, [location.pathname, navigationType, residentShell]);
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

  const name = auth.preview
    ? (portal.data?.profile.name ?? "Demo resident")
    : (ownProfile.isError ? null : ownProfile.data?.display_name) ||
      auth.member?.name ||
      "Member";
  const sectionActive = (to: string) => {
    if (
      residentShell &&
      [
        "/more/transport",
        "/directory/transport",
        "/more/vehicles",
        "/more/permits",
        "/more/elections",
      ].some(
        (path) =>
          location.pathname === path ||
          location.pathname.startsWith(path + "/"),
      )
    )
      return to === "/services";
    if (residentShell && location.pathname.startsWith("/community"))
      return to === "/";
    const livelihoodPaths = [
      "/directory/market",
      "/more/marketplace",
      "/explore/businesses",
      "/explore/buy-sell",
      "/explore/jobs",
      "/explore/garage-sales",
    ];
    if (
      residentShell &&
      to === "/more" &&
      livelihoodPaths.some(
        (path) =>
          location.pathname === path ||
          location.pathname.startsWith(path + "/"),
      )
    )
      return false;
    const aliases: Record<string, string[]> = {
      "/more": [
        "/directory",
        "/explore",
        "/coverage",
        "/developer",
        "/community",
      ],
      "/directory/market": livelihoodPaths.slice(1),
      "/office/residents": ["/office/registry", "/office/registrations"],
      "/office/operations": [
        "/office/visitors",
        "/office/review",
        "/office/permits",
        "/office/vehicles",
      ],
      "/office/requests": ["/office/inbox"],
      "/office/calendar": ["/office/bookings"],
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
  // More is a fallback destination, never a second selected workspace tab.
  const mobileActive =
    mobileLinks.find(
      (item) => item.to !== "/more" && activeWithin(item.to, mobileLinks),
    )?.to ?? "/more";
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
    <div
      className={`${styles.app} ${developer ? styles.developer : ""} ${residentShell ? `${styles.residentShell} ${mobileStyles.resident}` : ""}`}
      data-customer-ui={residentShell ? "true" : undefined}
      data-resident-path={residentShell ? location.pathname : undefined}
      data-staff-ui={!residentShell ? "true" : undefined}
    >
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
        <div className={styles.navigationBody}>
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
          {workspaceOptions.length > 1 && (
            <label className={styles.workspaceSwitch}>
              Workspace
              <select
                aria-label="Switch workspace"
                value={areaId}
                onChange={(event) => {
                  const target = workspaceOptions.find(
                    (item) => item.id === event.target.value,
                  );
                  if (target) navigate(target.to);
                }}
              >
                {workspaceOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          )}
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
        <header
          className={styles.topbar}
          data-resident-header={residentShell || undefined}
          data-resident-detail={(residentShell && customerDetail) || undefined}
        >
          {residentShell && <ResidentMobileHeader name={name} />}
          {!residentShell && workspaceOptions.length > 1 && (
            <label className={styles.mobileWorkspaceSwitch}>
              <span className="sr-only">Switch workspace</span>
              <select
                aria-label="Switch workspace on mobile"
                value={areaId}
                onChange={(event) => {
                  const target = workspaceOptions.find(
                    (item) => item.id === event.target.value,
                  );
                  if (target) navigate(target.to);
                }}
              >
                {workspaceOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {customerDetail && <CustomerBack />}
          {residentShell && !customerDetail && (
            <Link
              to="/"
              className={styles.residentBrand}
              aria-label="Bellefort Estates home"
            >
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
          )}
          {!residentShell && (
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
          )}
          {residentShell && <CustomerSearch />}
          <div className={styles.topActions} data-header-actions>
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
            {!residentShell && (
              <button
                className="icon-button"
                onClick={() => setDark(!dark)}
                aria-label={dark ? "Use light theme" : "Use dark theme"}
              >
                {dark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            )}
            <NotificationBell />
          </div>
        </header>
        {residentShell && workspaceOptions.length > 1 && (
          <label className={styles.residentWorkspaceSwitch}>
            Workspace
            <select
              aria-label="Switch account workspace"
              value={areaId}
              onChange={(event) => {
                const target = workspaceOptions.find(
                  (item) => item.id === event.target.value,
                );
                if (target) navigate(target.to);
              }}
            >
              {workspaceOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {(!residentShell || auth.preview || auth.rolePreview) && (
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
                  : `Signed in · ${areaId[0].toUpperCase() + areaId.slice(1)} workspace`}
            </span>
            <Link to={auth.preview ? "/more/settings" : "/workspaces"}>
              {auth.preview ? "Data & settings" : "My account"}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
        {!online && (
          <div className="offline-banner" role="status">
            You’re offline. Information may be out of date. Reconnect before
            checking a status or sending a request.
          </div>
        )}
        <main id="content" tabIndex={-1} className={styles.main}>
          {permissions.readOnlyPath(location.pathname) && (
            <div className="offline-banner" role="note">
              {residentShell
                ? "Browsing only. Contact the office if you need help making a change."
                : "View only. You can browse this module; changes require edit permission."}
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
                <Route path="/more/hotlines" element={<Hotlines />} />
                <Route path="/search" element={<CustomerSearchPage />} />
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
            aria-current={mobileActive === to ? "page" : undefined}
            className={mobileActive === to ? styles.mobileSelected : ""}
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

function isAccountTabSwitch(from: string, to: string) {
  const paths = ["/account", "/account/lots", "/account/payments"];
  return from !== to && paths.includes(from) && paths.includes(to);
}
