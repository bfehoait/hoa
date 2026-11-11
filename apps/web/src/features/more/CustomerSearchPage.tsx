import { useSearchParams } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { PageIntro } from "../../components/UI";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import styles from "./CustomerSearchPage.module.css";

const destinations = [
  {
    title: "Visitor pass",
    detail: "Invite a visitor",
    to: "/services/visitors?type=visitor",
    terms: "guest entry access",
  },
  {
    title: "Gate pass",
    detail: "Request a gate pass",
    to: "/services/visitors?type=gate",
    terms: "entry access",
  },
  {
    title: "Small delivery",
    detail: "Arrange delivery access",
    to: "/services/visitors?type=small_delivery",
    terms: "package courier",
  },
  {
    title: "Amenities",
    detail: "Book a community facility",
    to: "/services/bookings",
    terms: "court swimming pool clubhouse hall booking reservation calendar",
  },
  {
    title: "Helpdesk",
    detail: "Requests, complaints and concerns",
    to: "/services/requests",
    terms: "maintenance issue report support",
  },
  {
    title: "Hotlines",
    detail: "Emergency, security and utility contacts",
    to: "/more/hotlines",
    terms: "phone call water police fire hospital",
  },
  {
    title: "My account",
    detail: "Your properties and recorded payments",
    to: "/account",
    terms: "balance bill dues receipts finance",
  },
  {
    title: "Payments",
    detail: "View your recorded payments",
    to: "/account/payments",
    terms: "receipt history",
  },
  {
    title: "Your lots",
    detail: "Verified property links",
    to: "/more/lots",
    terms: "house land block ownership",
  },
  {
    title: "Livelihood",
    detail: "Browse the community marketplace",
    to: "/directory/market",
    terms: "shop buy sell business jobs garage sale",
  },
  {
    title: "Announcements",
    detail: "Read community updates",
    to: "/community",
    terms: "news notices",
  },
  {
    title: "Vehicles & stickers",
    detail: "Vehicle registration requests",
    to: "/more/vehicles",
    terms: "car motorcycle",
  },
  {
    title: "Permits",
    detail: "Property work and clearances",
    to: "/more/permits",
    terms: "renovation construction",
  },
  {
    title: "Documents",
    detail: "Community documents",
    to: "/more/documents",
    terms: "forms rules policies",
  },
  {
    title: "Shuttle",
    detail: "Community shuttle service",
    to: "/more/transport",
    terms: "bus ride stops trip",
  },
  {
    title: "Carpooling",
    detail: "Explore the interactive carpool demo",
    to: "/directory/transport",
    terms: "ride share trip",
  },
  {
    title: "Training & workshops",
    detail: "Community learning",
    to: "/directory/learning",
    terms: "skills classes",
  },
  {
    title: "Calendar",
    detail: "Bookings and community events",
    to: "/services/calendar",
    terms: "schedule",
  },
  {
    title: "Profile",
    detail: "Your account details",
    to: "/more/profile",
    terms: "name address",
  },
  {
    title: "Settings",
    detail: "Appearance and account preferences",
    to: "/more/settings",
    terms: "dark light theme mode",
  },
];

export default function CustomerSearchPage() {
  const [params] = useSearchParams();
  const { member } = useAuth();
  const permissions = usePermissions();
  const query = (params.get("q") ?? "").slice(0, 100).trim();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = destinations.filter((item) => {
    const path = item.to.split("?")[0];
    return (
      member &&
      canOpenPath(member, path) &&
      permissions.allowsPath(path) &&
      terms.every((term) =>
        `${item.title} ${item.detail} ${item.terms}`
          .toLowerCase()
          .includes(term),
      )
    );
  });
  return (
    <div className={styles.page}>
      <PageIntro
        title="Search"
        description="Find features and services available to your account."
      />
      <p className={styles.summary} role="status">
        {query
          ? `${results.length} results for “${query}”`
          : "Browse available features or search above."}
      </p>
      <ul className={styles.results}>
        {results.map((item) => (
          <li key={item.to}>
            <Link to={item.to}>
              <Search size={20} aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {!results.length && (
        <p>Try a feature name such as Hotlines, Amenities or Payments.</p>
      )}
    </div>
  );
}
