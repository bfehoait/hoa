import { useState } from "react";
import { CalendarDays, FileText, Search, Wrench } from "lucide-react";
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
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import styles from "./ServiceHub.module.css";
import { serviceGroups } from "./service-destinations";

const allServices = serviceGroups.flatMap((group) => group.items);
export default function ServiceHub() {
  const [search, setSearch] = useState("");
  const auth = useAuth();
  const permissions = usePermissions();
  const allowed = (item: Destination) =>
    auth.preview ||
    (!!auth.member &&
      canOpenPath(auth.member, item.to) &&
      permissions.allowsPath(item.to));
  const visibleGroups = serviceGroups
    .map((group) => ({ ...group, items: group.items.filter(allowed) }))
    .filter((group) => group.items.length);
  const portal = usePortal();
  const matches = allServices
    .filter(allowed)
    .filter((item) =>
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
      {search ? (
        <section
          className={`${styles.section} ${styles.primary}`}
          aria-labelledby="service-action-heading"
        >
          <h2 id="service-action-heading">Matching services</h2>
          {matches.length ? (
            <DestinationGrid variant="rows" items={matches} />
          ) : (
            <Empty
              title="No matching service"
              action={
                <Button secondary onClick={() => setSearch("")}>
                  Show all services
                </Button>
              }
            >
              Try “visitor”, “permit”, “vehicle” or “concern”.
            </Empty>
          )}
        </section>
      ) : (
        visibleGroups.map((group) => (
          <section
            key={group.title}
            className={styles.section}
            aria-label={group.title}
          >
            <h2>{group.title}</h2>
            <DestinationGrid variant="rows" items={group.items} />
          </section>
        ))
      )}
      {!search && (
        <section
          className={`${styles.section} ${styles.planning}`}
          aria-label="Track & plan"
        >
          <h2>Track &amp; plan</h2>
          <DestinationGrid
            variant="rows"
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
      )}
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
