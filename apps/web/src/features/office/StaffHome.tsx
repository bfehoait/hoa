import {
  ArrowRight,
  Building2,
  FileText,
  Landmark,
  MessageSquare,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { Link } from "../../components/AccessLink";
import { PageIntro } from "../../components/UI";
import styles from "./StaffHome.module.css";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { areaNavigation } from "../../components/AccountNavigation";
import { unavailableService } from "../../../../../packages/shared/src/service-availability";
import OfficeReviewInbox from "./OfficeReviewInbox";

const areas = [
  {
    title: "People & property",
    icon: Users,
    detail: "Accounts, applications and property records.",
    links: [
      { title: "Lot register", to: "/office/lots", connected: true },
      { title: "Member directory", to: "/office/residents", connected: true },
      {
        title: "Registration inbox",
        to: "/office/registrations",
        connected: true,
      },
      { title: "Property & household changes", to: "/office/registry" },
      { title: "Access planning", to: "/office/access" },
    ],
  },
  {
    title: "Requests & messages",
    icon: MessageSquare,
    detail: "Follow up on what residents need.",
    links: [
      { title: "Resident requests", to: "/office/requests", connected: true },
      { title: "Request conversations", to: "/office/inbox", connected: true },
      { title: "Operations desk", to: "/office/operations" },
      { title: "Support tickets", to: "/explore/tickets" },
    ],
  },
  {
    title: "Finance",
    icon: Landmark,
    detail: "Collections, evidence and reconciliation.",
    links: [
      {
        title: "Recorded collections",
        to: "/office/finance/collections",
        connected: true,
      },
      { title: "Collections & aging", to: "/office/finance" },
      { title: "Expense review", to: "/office/finance/expenses" },
      { title: "Reconciliation", to: "/office/finance/reconciliation" },
      { title: "Billing proposals", to: "/explore/billing-proposals" },
    ],
  },
  {
    title: "Community & publishing",
    icon: FileText,
    detail: "Review content and keep residents informed.",
    links: [
      { title: "Announcements", to: "/office/announcements" },
      { title: "Documents", to: "/office/documents" },
      {
        title: "Garage sale items",
        to: "/office/garage-items",
        connected: true,
      },
      { title: "Hotline management", to: "/office/hotlines", connected: true },
      {
        title: "Association settings",
        to: "/office/settings",
        connected: true,
      },
      { title: "Election setup proposals", to: "/explore/election-setup" },
      { title: "Content review", to: "/office/review" },
      { title: "Community events", to: "/explore/events" },
    ],
  },
  {
    title: "Facilities & security",
    icon: ShieldCheck,
    detail: "Bookings, visitors and household services.",
    links: [
      { title: "Amenity calendar", to: "/office/calendar" },
      { title: "Visitor & gate passes", to: "/office/visitors" },
      { title: "Vehicle requests", to: "/office/vehicles" },
      { title: "Permit enquiries", to: "/office/permits" },
    ],
  },
  {
    title: "More community services",
    icon: Store,
    detail: "Livelihood, learning and transport workflows.",
    links: [
      { title: "Feature catalogue", to: "/explore" },
      { title: "Community directory", to: "/directory" },
      { title: "Livelihood review", to: "/office/review" },
      { title: "Training & workshops", to: "/directory/learning" },
      { title: "Import staging", to: "/explore/imports" },
    ],
  },
];

export default function StaffHome() {
  const auth = useAuth();
  const permissions = usePermissions();
  const sample = auth.preview || !!auth.rolePreview;
  const destinations = new Set(
    areaNavigation.office.links.map((link) => link.to),
  );
  // These destinations are already exposed inside their primary workspaces.
  for (const path of [
    "/office/registrations",
    "/office/inbox",
    "/office/finance/collections",
    "/office/finance/expenses",
    "/office/finance/reconciliation",
    "/office/announcements",
    "/explore/tickets",
  ])
    destinations.add(path);
  const tools = areas
    .map((area) => ({
      ...area,
      links: area.links.filter((link) => {
        if (
          destinations.has(link.to) ||
          unavailableService(link.to) ||
          !permissions.allowsPath(link.to)
        )
          return false;
        destinations.add(link.to);
        return true;
      }),
    }))
    .filter((area) => area.links.length);
  return (
    <>
      <PageIntro
        eyebrow="OFFICE & ADMINISTRATION"
        title="Your office, organized."
        description="Submissions awaiting decisions and work that needs follow-up."
        icon={<Building2 size={28} />}
      />
      <OfficeReviewInbox compact />
      {sample && <p>These previews do not change real association records.</p>}
      {!!tools.length && (
        <details className={styles.tools}>
          <summary>More Office tools</summary>
          <div className={styles.areas}>
            {tools.map((area) => (
              <section key={area.title} className={styles.area}>
                <div className={styles.areaHeading}>
                  <area.icon size={24} />
                  <h2>{area.title}</h2>
                </div>
                <ul>
                  {area.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to}>
                        <span>{link.title}</span>
                        <ArrowRight size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
