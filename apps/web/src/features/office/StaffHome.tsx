import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileText,
  Landmark,
  LifeBuoy,
  MessageSquare,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { Link } from "../../components/AccessLink";
import { Badge, PageIntro } from "../../components/UI";
import styles from "./StaffHome.module.css";
import { useAuth } from "../../data/auth";
import { useRequestSummary } from "../../data/requests";
import { RequestVisual } from "../../components/RequestVisual";
import { unavailableService } from "../../../../../packages/shared/src/service-availability";

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
      { title: "Vehicle requests", to: "/office/vehicles" },
      { title: "Permit enquiries", to: "/office/permits" },
      { title: "Gate pass proposals", to: "/explore/gate-passes" },
    ],
  },
  {
    title: "More community services",
    icon: Store,
    detail: "Livelihood, learning and transport workflows.",
    links: [
      { title: "Feature catalogue", to: "/explore" },
      { title: "Community directory", to: "/directory" },
      { title: "Import staging", to: "/explore/imports" },
      { title: "Office settings", to: "/office/settings" },
    ],
  },
];

export default function StaffHome() {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  const summary = useRequestSummary();
  return (
    <>
      <PageIntro
        eyebrow="OFFICE & ADMINISTRATION"
        title="Your office, organized."
        description="Find a person, review an application or open the right work queue."
        icon={<Building2 size={28} />}
      />
      <section
        className={styles.metrics}
        aria-label={sample ? "Sample request activity" : "Request activity"}
      >
        {summary.data && !summary.isError ? (
          summary.data.map((item) => (
            <Link key={item.status} to="/office/requests">
              <span>{item.status}</span>
              <strong
                aria-label={
                  item.count === null ? "Unavailable" : String(item.count)
                }
              >
                {item.count === null
                  ? "—"
                  : new Intl.NumberFormat("en-PH", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(item.count)}
              </strong>
              <small>
                {sample ? "Synthetic requests" : "Authorized request records"}
              </small>
            </Link>
          ))
        ) : (
          <div className={styles.metricUnavailable}>
            <MessageSquare size={24} />
            <div>
              <strong>
                {summary.isPending
                  ? "Checking request activity"
                  : "Request activity unavailable"}
              </strong>
              <p>
                {summary.isPending
                  ? "Waiting for database confirmation."
                  : "The request backend may need setup, or access could not be confirmed. Open the request desk for details."}
              </p>
            </div>
          </div>
        )}
      </section>
      <RequestVisual />
      <section className={styles.priority} aria-labelledby="staff-start-title">
        <div>
          <span className={styles.eyebrow}>START HERE</span>
          <h2 id="staff-start-title">People first.</h2>
          <p>
            {sample
              ? "Explore invented people and office workflows. Every change stays inside this role preview."
              : "Member details and registrations read from the existing database. Request services require the new protected backend setup."}
          </p>
        </div>
        <div className={styles.quickActions}>
          <Link to="/office/residents">
            <Users size={24} />
            <span>
              Find a member<small>Recorded details & roles</small>
            </span>
            <ArrowRight size={20} />
          </Link>
          <Link to="/office/registrations">
            <ClipboardCheck size={24} />
            <span>
              Review applications<small>Read submitted information</small>
            </span>
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
      <div className={styles.legend}>
        <ShieldCheck size={18} />
        <span>
          {sample
            ? "Sample means invented local records. No changes are sent to the HOA."
            : "Services use your recorded account and permissions. Unavailable services are marked; current records are checked when you open a service."}
        </span>
      </div>
      <div className={styles.areas}>
        {areas.map((area) => (
          <section key={area.title} className={styles.area}>
            <div className={styles.areaHeading}>
              <span>
                <area.icon size={24} />
              </span>
              <div>
                <h2>{area.title}</h2>
                <p>{area.detail}</p>
              </div>
            </div>
            <ul>
              {area.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>
                    <span>{link.title}</span>
                    <Badge tone="neutral">
                      {sample
                        ? "Sample"
                        : unavailableService(link.to)
                          ? "Not available yet"
                          : "Open service"}
                    </Badge>
                    <ArrowRight size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className={styles.help}>
        <LifeBuoy size={24} />
        <div>
          <h2>Connecting the full office workflow</h2>
          <p>
            Property verification, approvals, financial posting and dashboard
            totals will become available as their protected backend operations
            are implemented. No example counts are presented as live totals.
          </p>
        </div>
      </section>
    </>
  );
}
