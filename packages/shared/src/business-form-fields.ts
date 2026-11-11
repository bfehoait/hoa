import type { BaselineField } from "./baseline";

// Project-owned business questions. Optional additions preserve saved records;
// operational authority remains in each dedicated service.
const text = (
  key: string,
  label: string,
  type: BaselineField["type"] = "text",
): BaselineField => ({ key, label, type, required: false });
const choices = (
  key: string,
  label: string,
  options: string[],
): BaselineField => ({ key, label, options, required: false });
export const businessFormAdditions: Record<string, BaselineField[]> = {
  "buy-sell": [
    choices("listingKind", "What are you listing?", [
      "Item for sale",
      "Service",
      "For rent",
    ]),
    text("rate", "Service or rental rate (PHP)", "number"),
    text("rateUnit", "Rate basis (per hour, day or service)"),
    text("business", "Business or provider name"),
    text("facebook", "Social page", "url"),
  ],
  businesses: [
    text("listedBy", "Listed by"),
    text("facebook", "Business social page", "url"),
  ],
  jobs: [text("contact", "Contact details")],
  workshops: [
    text("category", "Training category"),
    text("contact", "Contact details"),
    text("signupLink", "Registration or information link", "url"),
  ],
  "booth-events": [
    text("theme", "Event theme"),
    text("vendorRules", "Vendor rules", "textarea"),
    text("contact", "Event contact details"),
  ],
  "booth-applications": [
    text("vendor", "Vendor name"),
    text("phone", "Vendor phone"),
  ],
  "guard-roster": [
    text("contact", "Guard contact number"),
    text("shift", "Shift name"),
  ],
  carpools: [
    choices("kind", "I am", ["Offering a ride", "Looking for a ride"]),
    text("contribution", "Proposed contribution per rider (PHP)", "number"),
    text("note", "Ride notes", "textarea"),
  ],
  "ride-requests": [
    text("station", "Station or stop number"),
    text("driverNote", "Note for the driver", "textarea"),
  ],
  "board-reports": [
    text("reportedIncome", "Reported income (PHP)", "number"),
    text("reportedExpenses", "Reported expenses (PHP)", "number"),
    text("reportLink", "Full report link", "url"),
    text("reportDate", "Report date", "date"),
  ],
  "election-candidates": [
    text("credentials", "Candidate credentials", "textarea"),
  ],
};
