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
import HomeownerSummary from "./HomeownerSummary";

const services: Destination[] = [
  {
    to: "/services/requests",
    title: "Helpdesk",
    detail: "Report an issue, file a complaint, raise a concern",
    icon: MessageSquare,
  },
  {
    to: "/services/bookings",
    title: "Facility bookings",
    detail: "Check facilities, availability and your requests",
    icon: CalendarDays,
  },
  {
    to: "/services/visitors",
    title: "Visitor passes",
    detail: "Request a pass and follow its status",
    icon: UserRound,
  },
  {
    to: "/community",
    title: "Community updates",
    detail: "Read published announcements",
    icon: FileText,
  },
  {
    to: "/directory/market",
    title: "Marketplace",
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
  const items = (area === "board" ? board : services).filter(
    (item) =>
      auth.member &&
      canOpenPath(auth.member, item.to) &&
      permissions.allowsPath(item.to) &&
      `${item.title} ${item.detail}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const name = auth.member?.name?.trim().split(/\s+/)[0];
  return (
    <>
      <PageIntro
        eyebrow={area === "board" ? "BOARD WORKSPACE" : "YOUR COMMUNITY"}
        title={
          area === "services"
            ? "Services"
            : area === "help"
              ? "Help & support"
              : area === "board"
                ? "Board workspace"
                : name
                  ? `Welcome, ${name}`
                  : "Welcome home"
        }
        description={
          area === "help"
            ? "Use Helpdesk to contact the office. You can follow the conversation in your requests."
            : "Open a service to view its current records and available actions."
        }
      />
      {area === "home" && <HomeownerSummary />}
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
