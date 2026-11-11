import { useState } from "react";
import {
  CalendarDays,
  CarFront,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  DestinationGrid,
  DetailDisclosure,
  type Destination,
} from "../../components/Navigation";
import {
  Badge,
  Empty,
  Feedback,
  PageIntro,
  Row,
  SectionTitle,
  Skeleton,
  Button,
} from "../../components/UI";
import { usePortal } from "../../data/usePortal";
import styles from "./ServiceHub.module.css";

const actions: Destination[] = [
  {
    to: "/services/requests",
    title: "Helpdesk",
    detail: "Issues, complaints, concerns & ideas",
    icon: Wrench,
  },
  {
    to: "/services/bookings",
    title: "Book an amenity",
    detail: "Swimming pool, court & function hall",
    icon: CalendarDays,
  },
  {
    to: "/services/visitors?new=visitor",
    title: "Invite a visitor",
    detail: "Prepare a visitor request",
    icon: ShieldCheck,
  },
  {
    to: "/more/vehicles",
    title: "Vehicles & stickers",
    detail: "Registration requests",
    icon: CarFront,
  },
  {
    to: "/more/permits",
    title: "Request a permit",
    detail: "Work & clearances",
    icon: ClipboardCheck,
  },
  {
    to: "/services/inbox",
    title: "Message the office",
    detail: "Local conversations",
    icon: MessageSquare,
  },
];
export default function ServiceHub() {
  const [search, setSearch] = useState("");
  const portal = usePortal();
  const matches = actions.filter((item) =>
    `${item.title} ${item.detail} ${item.to.includes("visitors") ? "gate pass guest delivery" : ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const active = portal.data?.records.filter(
    (item) =>
      item.kind === "request" &&
      !["Cancelled", "Resolved"].includes(item.status),
  ).length;
  const recent = portal.data?.records.slice(0, 2) ?? [];
  return (
    <div className={styles.hub}>
      <PageIntro title="Services" description="What would you like to do?" />
      <div className="search">
        <Search size={20} aria-hidden="true" />
        <input
          aria-label="Find a service"
          placeholder="Search services…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <section
        className={`${styles.section} ${styles.primary}`}
        aria-labelledby="service-action-heading"
      >
        <h2 id="service-action-heading">Choose a service</h2>
        <DestinationGrid items={matches} />
        {!matches.length && (
          <Empty
            title="No matching service"
            action={
              search ? (
                <Button secondary onClick={() => setSearch("")}>
                  Show all services
                </Button>
              ) : undefined
            }
          >
            Try “visitor”, “permit”, “vehicle” or “concern”.
          </Empty>
        )}
      </section>
      <section
        className={`${styles.section} ${styles.planning}`}
        aria-labelledby="service-tracking-heading"
      >
        <h2 id="service-tracking-heading">Track & plan</h2>
        <DestinationGrid
          compact
          items={[
            {
              to: "/services/requests",
              title: "My requests",
              detail: "Follow your local updates",
              icon: FileText,
              badge:
                active === undefined ? undefined : `${active} sample active`,
            },
            {
              to: "/services/calendar",
              title: "Community calendar",
              detail: "Dates & sample requests",
              icon: CalendarDays,
            },
          ]}
        />
      </section>
      <section className={`${styles.section} ${styles.latest}`}>
        <SectionTitle
          title="Your latest activity"
          to="/services/requests"
          label="See requests"
        />
        {portal.isPending ? (
          <Skeleton />
        ) : portal.error ? (
          <Feedback error={portal.error} />
        ) : recent.length ? (
          <div className={styles.activity}>
            {recent.map((item) => (
              <Row
                key={item.id}
                title={item.title}
                detail={item.date ?? item.id}
                icon={
                  item.kind === "booking" ? (
                    <CalendarDays size={22} />
                  ) : (
                    <Wrench size={22} />
                  )
                }
                to={`/services/${item.kind === "booking" ? "bookings" : item.kind === "visitor" ? "visitors" : "requests"}`}
                end={<Badge tone="amber">{item.status}</Badge>}
              />
            ))}
          </div>
        ) : (
          <p className="note">Your local sample activity will appear here.</p>
        )}
      </section>
      <DetailDisclosure>
        <p>
          All requests in this preview are synthetic and stay in this browser
          tab. Statuses do not mean an HOA approval, confirmed reservation or
          valid gate pass.
        </p>
        <p>
          Fees, availability, real notifications and official requirements need
          a connected backend and approved rules.
        </p>
      </DetailDisclosure>
    </div>
  );
}
