import type { Invoice } from "../../../../packages/shared/src";

// Every record in this file is synthetic. No production data or reference data is used.
export const AS_OF = "2026-11-04";
export const DEMO_HOME = {
  name: "Alex Santos",
  phone: "09170000000",
  unit: "Block 08 · Lot 12",
  phase: "Phase 2",
  email: "alex@example.invalid",
};
export const invoices: Invoice[] = [
  {
    id: "INV-2611",
    period: "November 2026",
    due: "2026-11-30",
    amount: 185000,
    received: 0,
  },
  {
    id: "INV-2610",
    period: "October 2026",
    due: "2026-10-31",
    amount: 185000,
    received: 185000,
  },
  {
    id: "INV-2609",
    period: "September 2026",
    due: "2026-09-30",
    amount: 185000,
    received: 185000,
  },
];
export const notices = [
  {
    id: "water",
    category: "Maintenance",
    date: "2026-11-04",
    title: "Water line maintenance on Friday",
    summary:
      "A short interruption is planned for Phase 2. Here’s how to prepare.",
    body: "In this sample notice, water line maintenance is scheduled for Friday, 6 November, from 9 AM to 12 PM in Phase 2. Store enough water before the scheduled work. The actual schedule must be confirmed by the HOA before publishing.",
    urgent: true,
    author: "Sample admin office",
  },
  {
    id: "weekend",
    category: "Community",
    date: "2026-11-03",
    title: "A little time for a cleaner neighborhood",
    summary: "Join the weekend clean-up at the community grounds.",
    body: "This demonstration event brings neighbours together at the community grounds on Saturday, 14 November, at 7 AM. Bring a water bottle and comfortable shoes. No real event is scheduled by this preview.",
    urgent: false,
    author: "Sample community team",
  },
  {
    id: "office",
    category: "Office update",
    date: "2026-11-02",
    title: "A reminder about your account statements",
    summary:
      "Review recorded payments and tell the office if something looks wrong.",
    body: "Your account statement separates bills from recorded payments. If an entry looks incorrect, send a concern with the bill reference. Payments cannot be made or marked paid from this preview.",
    urgent: false,
    author: "Sample admin office",
  },
];
export type LocalRecord = {
  id: string;
  kind: "request" | "booking" | "visitor" | "interest";
  title: string;
  detail: string;
  status: string;
  assignedTo?: string;
  createdAt: string;
  date?: string;
  category?: string;
};
export const initialRecords: LocalRecord[] = [
  {
    id: "REQ-1042",
    kind: "request",
    title: "Streetlight near Block 08",
    detail:
      "The streetlight near the corner has been flickering in the evenings.",
    category: "Maintenance",
    status: "In progress",
    createdAt: "2026-11-02T02:30:00Z",
  },
  {
    id: "BOOK-0218",
    kind: "booking",
    title: "Swimming pool",
    detail: "14:00–16:00 · 8 guests",
    status: "Pending review",
    date: "2026-11-14",
    createdAt: "2026-11-01T06:00:00Z",
  },
];
export const householdLedger = [
  { unit: "Demo A-01", amount: 185000, received: 185000, due: "2026-11-30" },
  { unit: "Demo A-02", amount: 185000, received: 185000, due: "2026-11-30" },
  { unit: "Demo A-03", amount: 185000, received: 90000, due: "2026-11-30" },
  { unit: "Demo A-04", amount: 185000, received: 0, due: "2026-10-15" },
  { unit: "Demo A-05", amount: 185000, received: 0, due: "2026-09-15" },
  { unit: "Demo A-06", amount: 185000, received: 0, due: "2026-08-15" },
];
