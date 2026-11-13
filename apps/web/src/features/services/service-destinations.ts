import {
  CalendarDays,
  CarFront,
  Bus,
  Building2,
  ClipboardCheck,
  FileText,
  MessageSquare,
  ShieldCheck,
  Wrench,
  Flag,
  Vote,
} from "lucide-react";
import type { Destination } from "../../components/Navigation";

// Grouped by purpose so the list reads as named sections, like the rest of the
// portal. Routes and labels are unchanged; only the presentation is grouped.
export const serviceGroups: { title: string; items: Destination[] }[] = [
  {
    title: "Access & amenities",
    items: [
      {
        to: "/services/visitors?new=visitor",
        title: "Invite a visitor",
        detail: "Prepare a visitor request",
        icon: ShieldCheck,
      },
      {
        to: "/services/bookings",
        title: "Book an amenity",
        detail: "Swimming pool, court & function hall",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Requests & property",
    items: [
      {
        to: "/services/requests",
        title: "Helpdesk",
        detail: "Issues, complaints, concerns & ideas",
        icon: Wrench,
      },
      {
        to: "/services/inbox",
        title: "Message the office",
        detail: "Local conversations",
        icon: MessageSquare,
      },
      {
        to: "/more/lots",
        title: "Your lots",
        detail: "Verified property links and receipts",
        icon: Building2,
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
    ],
  },
  {
    title: "Transport",
    items: [
      {
        to: "/more/transport",
        title: "Community shuttle",
        detail: "Check availability and request a ride",
        icon: Bus,
      },
      {
        to: "/directory/transport",
        title: "Carpool",
        detail: "Share a ride with neighbours",
        icon: CarFront,
      },
    ],
  },
  {
    title: "Raise it with the office",
    items: [
      {
        to: "/services/requests?new=Complaint",
        title: "File a complaint",
        detail: "A private matter involving a neighbour",
        icon: Flag,
      },
      {
        to: "/services/requests?new=Concern",
        title: "Raise a concern",
        detail: "For the office, board or officers to review",
        icon: MessageSquare,
      },
      {
        to: "/services/requests?new=Maintenance",
        title: "Report an issue",
        detail: "Damage or maintenance in the community",
        icon: Wrench,
      },
    ],
  },
  {
    title: "Community",
    items: [
      {
        to: "/more/documents",
        title: "Community documents",
        detail: "Policies, resolutions and approved HOA records",
        icon: FileText,
      },
      {
        to: "/more/elections",
        title: "Community elections",
        detail: "Readiness & information",
        icon: Vote,
      },
    ],
  },
];
