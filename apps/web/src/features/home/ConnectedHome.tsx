import {
  Building2,
  CalendarDays,
  FileText,
  MessageSquare,
  Search,
  Store,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import { DestinationGrid, type Destination } from "../../components/Navigation";
import { PageIntro } from "../../components/UI";
import ResidentDashboard from "./ResidentDashboard";
import styles from "./ServiceDirectory.module.css";
import { serviceGroups as residentServiceGroups } from "../services/service-destinations";

const services: Destination[] = [
  {
    to: "/services/visitors",
    title: "Security & passes",
    detail: "Visitors, gate movements and small deliveries",
    icon: UserRound,
  },
  {
    to: "/services/requests",
    title: "Helpdesk",
    detail: "Report an issue, file a complaint, raise a concern",
    icon: MessageSquare,
  },
  {
    to: "/services/bookings",
    title: "Amenities & calendar",
    detail: "Choose an amenity and an available time",
    icon: CalendarDays,
  },
  {
    to: "/community",
    title: "Community updates",
    detail: "Read published announcements",
    icon: FileText,
  },
  {
    to: "/directory/market",
    title: "Livelihood",
    detail: "Browse listings or send your own for review",
    icon: Store,
  },
  {
    to: "/account",
    title: "Your account",
    detail: "View linked properties and recorded payments",
    icon: Building2,
  },
  {
    to: "/more/documents",
    title: "Community documents",
    detail: "Policies, resolutions and approved HOA records",
    icon: FileText,
  },
  {
    to: "/more/profile",
    title: "Your profile",
    detail: "Manage your contact details",
    icon: UserRound,
  },
  {
    to: "/more/vehicles",
    title: "Vehicles & stickers",
    detail: "Register a vehicle or ask for a sticker",
    icon: Building2,
  },
  {
    to: "/more/permits",
    title: "Permits & clearances",
    detail: "Request clearance for work or a move",
    icon: FileText,
  },
];

export default function ConnectedHome({
  area = "home",
}: {
  area?: "home" | "services" | "help" | "board";
}) {
  const auth = useAuth();
  const permissions = usePermissions();
  const [search, setSearch] = useState("");
  const board: Destination[] = [
    {
      to: "/board/documents",
      title: "Board documents",
      detail: "Read published board records",
      icon: FileText,
    },
    {
      to: "/board/updates",
      title: "Community updates",
      detail: "Read published announcements",
      icon: MessageSquare,
    },
    {
      to: "/board/elections",
      title: "Election information",
      detail: "Read published candidate information",
      icon: UserRound,
    },
    {
      to: "/board/reports",
      title: "Board reports",
      detail: "Not available yet",
      icon: Building2,
    },
  ];
  const liveServiceGroups = [
    ...residentServiceGroups,
    {
      title: "Track & plan",
      items: [
        {
          to: "/services/calendar",
          title: "Community calendar",
          detail: "Bookings and community dates",
          icon: CalendarDays,
        },
      ],
    },
  ];
  const items = (
    area === "board"
      ? board
      : area === "services"
        ? liveServiceGroups.flatMap((group) => group.items)
        : services
  ).filter(
    (item) =>
      !(area === "home" && item.to === "/account") &&
      auth.member &&
      canOpenPath(auth.member, item.to) &&
      permissions.allowsPath(item.to) &&
      `${item.title} ${item.detail}`
        .toLowerCase()
        .includes(area === "board" ? search.toLowerCase() : ""),
  );
  if (area === "home") return <ResidentDashboard />;
  if (area === "services" || area === "help") {
    const serviceGroups =
      area === "help"
        ? [
            { title: "Contact the office", paths: ["/services/requests"] },
            { title: "Useful resources", paths: ["/more/documents"] },
          ]
        : liveServiceGroups.map((group) => ({
            title: group.title,
            paths: group.items.map((item) => item.to),
          }));
    return (
      <div className={styles.page}>
        <PageIntro
          title={area === "help" ? "Help & support" : "Services"}
          description={
            area === "help"
              ? "Contact the office through Helpdesk and follow your request."
              : "What can we help you with?"
          }
        />
        <div className={styles.groups}>
          {serviceGroups.map((group) => {
            const destinations = items.filter((item) =>
              group.paths.includes(item.to),
            );
            return destinations.length ? (
              <section key={group.title}>
                <h2>{group.title}</h2>
                <DestinationGrid items={destinations} variant="rows" />
              </section>
            ) : null;
          })}
        </div>
        {!items.some((item) =>
          serviceGroups.some((group) => group.paths.includes(item.to)),
        ) && <p role="status">No matching services. Try another search.</p>}
      </div>
    );
  }
  return (
    <>
      <PageIntro
        eyebrow={area === "board" ? "BOARD WORKSPACE" : "YOUR COMMUNITY"}
        title="Board workspace"
        description="Community notices and services for your household."
      />
      <div className="search">
        <Search size={20} aria-hidden="true" />
        <input
          aria-label="Find a service"
          placeholder="Search services…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <DestinationGrid items={items} />
      {!items.length && (
        <p role="status">
          No matching services. Try another search or open your profile from the
          account menu.
        </p>
      )}
    </>
  );
}
