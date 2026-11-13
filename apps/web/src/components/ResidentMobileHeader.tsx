import { Link } from "./AccessLink";
import { useLocation } from "react-router-dom";
import styles from "./ResidentMobileHeader.module.css";

/** Presentation only; member identity and notification access remain in AppShell. */
export default function ResidentMobileHeader({ name }: { name: string }) {
  const { pathname } = useLocation();
  const greeting =
    pathname === "/" ||
    ["/account", "/account/lots", "/account/payments"].includes(pathname);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const label =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (!greeting) {
    const pages: Record<string, [string, string]> = {
      "/directory/market": ["Livelihood", "Your community marketplace."],
      "/services/bookings": [
        "Amenities",
        "Choose an amenity, date and time. Office approval required · Philippine time.",
      ],
      "/services/calendar": [
        "Community calendar",
        "Bookings and community events.",
      ],
      "/services/requests": [
        "Helpdesk",
        "Report an issue or concern and track the office’s reply.",
      ],
      "/services/inbox": [
        "Helpdesk",
        "Report an issue or concern and track the office’s reply.",
      ],
      "/services/visitors": [
        "Visitor passes",
        "Prepare a request for your household. Office approval required.",
      ],
      "/more": ["More", ""],
      "/more/transport": [
        "Community shuttle",
        "Request a ride and follow its status.",
      ],
      "/services": ["Services", "What would you like to do?"],
    };
    const page = pages[pathname];
    return page ? (
      <div
        data-mobile-page-title
        className={`${styles.title} ${pathname === "/directory/market" ? styles.marketTitle : ""}`}
      >
        <h1>{page[0]}</h1>
        {page[1] && <p>{page[1]}</p>}
      </div>
    ) : null;
  }
  return (
    <Link
      to="/more/profile"
      className={styles.identity}
      aria-label={`Open profile for ${name}`}
    >
      <span className={styles.avatar} aria-hidden="true">
        {Array.from(name.trim())[0]?.toUpperCase() || "A"}
      </span>
      <span>
        <span className={styles.greeting}>{label}</span>
        <strong>{name}</strong>
      </span>
    </Link>
  );
}
