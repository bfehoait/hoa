import { z } from "zod";

// Developer monitoring destinations stay in the developer route namespace.
// A destination does not grant operational permissions or impersonate a role.
export const monitorModules = [
  {
    id: "people",
    title: "People & accounts",
    sections: [
      ["members", "Members"],
      ["registrations", "Registrations"],
      ["household", "Household members"],
    ],
  },
  {
    id: "property",
    title: "Property",
    sections: [
      ["units", "Unit registry"],
      ["budget", "Budget"],
    ],
  },
  {
    id: "operations",
    title: "Requests & concerns",
    sections: [
      ["bfe_requests", "New request workflow"],
      ["requests", "Legacy issues"],
      ["complaints", "Complaints"],
      ["concerns", "Concerns"],
      ["tickets", "Support"],
    ],
  },
  {
    id: "messages",
    title: "Messages",
    sections: [["bfe_request_messages", "Request replies"]],
  },
  {
    id: "finance",
    title: "Finance",
    sections: [
      ["dues", "Dues"],
      ["lotPayments", "Recorded payments"],
      ["expenses", "Expenses"],
      ["ledger", "Balances"],
      ["collectionsHistory", "Collection history"],
      ["reportLog", "Reports"],
    ],
  },
  {
    id: "calendar",
    title: "Calendar & amenities",
    sections: [
      ["bookings", "Bookings"],
      ["events", "Events"],
    ],
  },
  {
    id: "security",
    title: "Security & access",
    sections: [
      ["gatePasses", "Gate passes"],
      ["passes", "Visitor passes"],
      ["stickers", "Vehicle stickers"],
      ["incidents", "Incidents"],
      ["guards", "Guard roster"],
      ["secAdmin", "Security assignments"],
    ],
  },
  {
    id: "community",
    title: "Announcements",
    sections: [
      ["announcements", "Announcements"],
      ["notifs", "Notifications"],
    ],
  },
  {
    id: "hotlines",
    title: "Emergency contacts",
    sections: [["hotlines", "Hotlines"]],
  },
  {
    id: "livelihood",
    title: "Livelihood & marketplace",
    sections: [
      ["marketplace", "Listings, jobs & training"],
      ["boothEvents", "Booth events"],
      ["boothApps", "Vendor applications"],
    ],
  },
  {
    id: "transport",
    title: "Transport",
    sections: [
      ["rides", "Shuttle & ride records"],
      ["carpools", "Carpools"],
    ],
  },
  {
    id: "documents",
    title: "Documents & governance",
    sections: [
      ["boardDocs", "Board documents"],
      ["disclosures", "Disclosures"],
      ["rules", "Community rules"],
    ],
  },
  {
    id: "elections",
    title: "Elections",
    sections: [["election", "Election setup"]],
  },
  {
    id: "access",
    title: "Role assignments",
    sections: [["members", "Assigned member roles"]],
  },
  {
    id: "audit",
    title: "Audit history",
    sections: [
      ["bfe_request_audit", "New request history"],
      ["audit_log", "Legacy audit"],
    ],
  },
] as const;
export const monitorValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const monitorRowSchema = z.object({
  reference: z.string(),
  label: z.string(),
  status: z.string().nullable(),
  unit: z.string().nullable(),
  recorded_at: z.string().nullable(),
  fields: z.record(z.string(), monitorValueSchema),
});
export const monitorResponseSchema = z.object({
  source: z.string(),
  present: z.boolean(),
  total: z.number().int().nonnegative().nullable(),
  rows: z.array(monitorRowSchema),
});
export function findMonitorModule(id: string) {
  return monitorModules.find((module) => module.id === id);
}
