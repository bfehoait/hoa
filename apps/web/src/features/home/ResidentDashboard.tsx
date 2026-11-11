import {
  CalendarDays,
  MessageSquare,
  UserRound,
  ChevronRight,
  Phone,
  Store,
  Bus,
  FileText,
} from "lucide-react";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import { Link } from "../../components/AccessLink";
import CommunityHighlights from "./CommunityHighlights";
import DailyScripture from "./DailyScripture";
import HomeownerSummary from "./HomeownerSummary";
import { HomeRequests, HomeBookings } from "./HomeActivity";
import styles from "./ResidentHome.module.css";
const shortcuts = [
  {
    to: "/services/visitors?type=visitor",
    label: "Visitor pass",
    icon: UserRound,
  },
  { to: "/services/bookings", label: "Amenities", icon: CalendarDays },
  { to: "/services/requests", label: "Helpdesk", icon: MessageSquare },
  { to: "/more/hotlines", label: "Hotlines", icon: Phone },
];
const community = [
  {
    to: "/directory/market",
    title: "Shop local",
    detail: "Discover neighbourhood businesses and listings",
    icon: Store,
  },
  {
    to: "/more/transport",
    title: "Community shuttle",
    detail: "Check service availability and request a ride",
    icon: Bus,
  },
  {
    to: "/more/documents",
    title: "Community documents",
    detail: "Find forms and association information",
    icon: FileText,
  },
];
export default function ResidentDashboard() {
  const { member } = useAuth();
  const permissions = usePermissions();
  const allowed = (to: string) =>
    !!member &&
    canOpenPath(member, to.split("?")[0]) &&
    permissions.allowsPath(to.split("?")[0]);
  const quick = shortcuts.filter((item) => allowed(item.to));
  const discover = community.filter((item) => allowed(item.to));
  return (
    <div className={styles.home} data-home-dashboard>
      <h1 className={styles.homeTitle}>Home</h1>
      <DailyScripture />
      <div className={styles.homeColumns}>
        {allowed("/account") && (
          <div className={styles.homeAccount}>
            <HomeownerSummary />
          </div>
        )}

        <section
          className={styles.serviceSection}
          aria-labelledby="home-services"
        >
          <div className={styles.heading}>
            <h2 id="home-services">Quick actions</h2>
            <Link className={styles.sectionLink} to="/services">
              All services <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.shortcuts}>
            {quick.map(({ to, label, icon: Icon }) => (
              <Link to={to} key={to} className={styles.shortcut}>
                <span className={styles.shortcutIcon}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
          {!quick.length && (
            <p className={styles.muted}>
              No household services are available for this account yet.
            </p>
          )}
        </section>
        {allowed("/community") && (
          <div className={styles.homeAnnouncements}>
            <CommunityHighlights />
          </div>
        )}
        {(allowed("/services/requests") || allowed("/services/bookings")) && (
          <div className={styles.activity}>
            {allowed("/services/requests") && <HomeRequests />}
            {allowed("/services/bookings") && <HomeBookings />}
          </div>
        )}
        {!!discover.length && (
          <section
            className={styles.discovery}
            aria-labelledby="home-community"
          >
            <div className={styles.heading}>
              <h2 id="home-community">Around the community</h2>
            </div>
            <div className={styles.discoveryCards}>
              {discover.map(({ to, title, detail, icon: Icon }) => (
                <Link to={to} key={to}>
                  <span className={styles.discoveryIcon}>
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
