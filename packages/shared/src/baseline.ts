import { z } from "zod";

export type BaselineField = {
  key: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "email" | "url" | "textarea";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  /** Show this field only while the field named by `key` holds one of `in`.
   *  The server applies the same rule in bfe_validate_feature_fields, so a
   *  hidden field is never required and never accepts a value. */
  showWhen?: { key: string; in: string[] };
};
export type BaselineModule = {
  id: string;
  title: string;
  group: string;
  summary: string;
  fields: BaselineField[];
  steps: string[];
  server: string[];
  evidence: number[];
};
const field = (
  key: string,
  label: string,
  type: BaselineField["type"] = "text",
  required = true,
): BaselineField => ({ key, label, type, required });
const select = (
  key: string,
  label: string,
  options: string[],
): BaselineField => ({ key, label, options, required: true });
const number = (
  key: string,
  label: string,
  min = 0,
  max = 1000000,
): BaselineField => ({ key, label, type: "number", min, max, required: true });
/** A field that only appears for certain answers to an earlier select. */
const when = (
  spec: BaselineField,
  key: string,
  values: string[],
): BaselineField => ({ ...spec, showWhen: { key, in: values } });
const module = (
  id: string,
  title: string,
  group: string,
  summary: string,
  fields: BaselineField[],
  steps: string[],
  server: string[],
  evidence: number[],
): BaselineModule => ({
  id,
  title,
  group,
  summary,
  fields,
  steps,
  server,
  evidence,
});

// Project-owned workflow descriptions. Source line numbers are evidence, never imported code or policy.
export const baselineModules: BaselineModule[] = [
  module(
    "unit-register",
    "Property register drafts",
    "Property",
    "Stage synthetic lot, owner, occupancy and area metadata for review.",
    [
      field("unit", "Sample unit"),
      field("owner", "Synthetic owner label"),
      number("area", "Sample lot area (square metres)", 1, 100000),
      select("occupancy", "Proposed occupancy", [
        "Owner occupied",
        "Tenanted",
        "Vacant",
        "Unknown",
      ]),
    ],
    [
      "Prepare unit metadata",
      "Review identity and evidence",
      "Await registry verification",
    ],
    [
      "Verified ownership registry",
      "Versioned imports and transfers",
      "Protected member identities",
    ],
    [2581, 7412, 7585, 7590],
  ),
  module(
    "expense-evidence",
    "Expense evidence drafts",
    "Finance",
    "Stage expense categories, amounts and document references before finance review.",
    [
      field("date", "Sample expense date", "date"),
      field("category", "Sample expense category"),
      number("amount", "Sample amount (PHP)"),
      field("reference", "Synthetic evidence reference"),
    ],
    [
      "Prepare evidence",
      "Review source and category",
      "Await authorized finance decision",
    ],
    [
      "Approved categories and expense authority",
      "Secure evidence uploads",
      "Server-owned ledger and reversals",
    ],
    [7614, 7630, 7700, 7760],
  ),
  module(
    "businesses",
    "Neighbourhood businesses",
    "Livelihood",
    "A directory for local services, opening hours and owner-managed profiles.",
    [
      select("category", "Business category", [
        "Food",
        "Home services",
        "Retail",
        "Other",
      ]),
      when(
        select("fulfilment", "How customers get it", [
          "Pickup",
          "Delivery",
          "Pickup or delivery",
        ]),
        "category",
        ["Food", "Retail"],
      ),
      when(field("serviceArea", "Areas served"), "category", [
        "Home services",
      ]),
      when(
        select("storefront", "Where it operates from", [
          "Home-based",
          "Physical store",
          "Online only",
        ]),
        "category",
        ["Retail"],
      ),
      when(
        field("businessKind", "Describe the business", "text", false),
        "category",
        ["Other"],
      ),
      field("hours", "Sample opening hours"),
      field("owner", "Sample owner label"),
      field("contact", "Sample contact email", "email"),
      field("website", "Sample website", "url", false),
    ],
    [
      "Prepare a business profile",
      "Submit for local review",
      "Review visibility and changes",
    ],
    [
      "Provider verification",
      "Contact consent and visibility",
      "Moderation and media storage",
    ],
    [1223, 6046],
  ),
  module(
    "buy-sell",
    "Buy & sell",
    "Livelihood",
    "Create a classified listing with condition, category and asking price.",
    [
      select("category", "Item category", [
        "Home",
        "Garden",
        "Electronics",
        "Other",
      ]),
      select("condition", "Condition", ["New", "Used", "For parts"]),
      number("price", "Sample asking price (PHP)"),
      field("contact", "Sample contact email", "email"),
      field("photoNote", "Photo description (no upload)", "text", false),
    ],
    ["Draft an item", "Submit for moderation", "Archive a local listing"],
    [
      "Listing publication rules",
      "Secure photos",
      "No checkout or buyer protection configured",
    ],
    [1248, 5992],
  ),
  module(
    "jobs",
    "Jobs & services",
    "Livelihood",
    "Separate hiring from seeking work, with setup, pay information and deadlines.",
    [
      select("kind", "Listing purpose", ["Hiring", "Seeking work"]),
      field("company", "Sample company or worker"),
      select("jobType", "Job type", [
        "Full-time",
        "Part-time",
        "Contract",
        "One-off",
      ]),
      select("setup", "Work setup", ["On-site", "Remote", "Hybrid"]),
      field("location", "Sample work location"),
      field("pay", "Sample pay description"),
      field("deadline", "Application deadline", "date"),
      field("applyLink", "Sample application link", "url", false),
    ],
    ["Prepare opportunity", "Review listing", "Archive after deadline"],
    [
      "Employer verification",
      "Safe external applications",
      "Publication authority",
    ],
    [1195, 6116, 6170],
  ),
  module(
    "garage-sales",
    "Garage sales",
    "Livelihood",
    "Plan a sale window and an item list before moderation.",
    [
      field("date", "Sale date", "date"),
      field("start", "Start time", "time"),
      field("end", "End time", "time"),
      field("location", "Sample sale location"),
      field("items", "Items", "textarea"),
      select("visibility", "Proposed audience", [
        "Households",
        "Community members",
      ]),
      field("contact", "Sample contact email", "email"),
    ],
    [
      "List sale items",
      "Review items and schedule",
      "Request changes or archive",
    ],
    [
      "Item approval / rejection",
      "Sale and contact policies",
      "Protected listing photos",
    ],
    [1280, 6182, 6223, 6234, 6240],
  ),
  module(
    "booth-events",
    "Booth events",
    "Livelihood",
    "Describe venue, setup window and a proposed booth capacity.",
    [
      field("venue", "Sample venue"),
      field("date", "Event date", "date"),
      field("setup", "Setup time", "time"),
      field("start", "Start time", "time"),
      field("end", "End time", "time"),
      number("capacity", "Sample booth capacity", 1, 200),
    ],
    [
      "Draft an event",
      "Collect sample applications",
      "Inspect capacity and assignment proposals",
    ],
    [
      "Approved venue and fees",
      "Atomic booth allocation",
      "Event publication and cancellation",
    ],
    [1293, 6361, 6419],
  ),
  module(
    "booth-applications",
    "Vendor applications",
    "Livelihood",
    "Link a vendor proposal to a locally created booth event.",
    [
      field("eventId", "Local booth event reference"),
      field("business", "Sample business name"),
      field("products", "Products or services"),
      field("contact", "Sample contact email", "email"),
    ],
    [
      "Choose a sample event",
      "Submit vendor details",
      "Record a proposed booth number",
    ],
    [
      "Vendor approval",
      "Server-owned capacity and booth allocation",
      "Verified vendor directory",
    ],
    [3310, 6337, 6390, 6402, 6407],
  ),
  module(
    "workshops",
    "Training sessions",
    "Learning",
    "Build a sample session with facilitator, venue, capacity and fee details.",
    [
      field("date", "Session date", "date"),
      field("start", "Start time", "time"),
      field("end", "End time", "time"),
      field("venue", "Sample venue"),
      field("facilitator", "Sample facilitator"),
      number("capacity", "Sample participant capacity", 1, 500),
      number("fee", "Sample fee (PHP)"),
    ],
    [
      "Prepare session",
      "Collect local participation interests",
      "Review or cancel requests",
    ],
    [
      "Trainer verification",
      "Enrollment and fee rules",
      "Server-owned capacity",
    ],
    [5781, 5823],
  ),
  module(
    "participation",
    "Learning interests",
    "Learning",
    "Join or withdraw a local interest list without claiming enrollment.",
    [
      field("sessionId", "Local training session reference"),
      field("participant", "Sample participant label"),
      number("places", "Requested places", 1, 10),
    ],
    [
      "Choose a sample session",
      "Save participation interest",
      "Withdraw locally if needed",
    ],
    ["Actual enrollment", "Capacity and payment confirmation"],
    [5781, 5823],
  ),
  module(
    "ride-requests",
    "Community ride requests",
    "Transport",
    "Specify pickup, destination, time and passenger count for the dispatch preview.",
    [
      field("pickup", "Sample pickup"),
      field("destination", "Sample destination"),
      field("date", "Trip date", "date"),
      field("time", "Pickup time", "time"),
      number("passengers", "Passengers", 1, 20),
    ],
    [
      "Request locally",
      "Simulate driver assignment",
      "Simulate pickup and completion",
    ],
    [
      "Driver and vehicle verification",
      "Fare, dispatch and safety rules",
      "Live trip confirmation",
    ],
    [4969, 5660, 5683, 5703, 5713, 5723],
  ),
  module(
    "carpools",
    "Neighbour carpools",
    "Transport",
    "Describe an offered route, departure and available sample seats.",
    [
      field("pickup", "Sample pickup"),
      field("destination", "Sample destination"),
      field("date", "Departure date", "date"),
      field("time", "Departure time", "time"),
      number("seats", "Sample seats", 1, 10),
      field("contact", "Sample contact email", "email"),
    ],
    [
      "Offer a sample route",
      "Collect local seat interests",
      "Withdraw or archive locally",
    ],
    [
      "Verified driver and insurance",
      "Seat allocation and consent",
      "Carpool cancellation rules",
    ],
    [5547, 5650],
  ),
  module(
    "carpool-interests",
    "Carpool seat interests",
    "Transport",
    "Link a sample passenger request to an offered local carpool.",
    [
      field("carpoolId", "Local carpool reference"),
      field("participant", "Sample passenger label"),
      number("places", "Requested seats", 1, 10),
    ],
    ["Find a sample route", "Save seat interest", "Withdraw interest"],
    ["Real seat confirmation", "Protected passenger contacts"],
    [5547, 5650],
  ),
  module(
    "stations",
    "Transport stations",
    "Transport",
    "Keep a sample station and dispatcher roster for reviewing the transport flow.",
    [
      field("location", "Sample station location"),
      field("dispatcher", "Sample dispatcher label"),
      field("drivers", "Drivers", "textarea"),
      field("hours", "Sample operating hours"),
    ],
    [
      "Describe a station",
      "Review sample driver coverage",
      "Inspect ride queue",
    ],
    ["Approved stations and staffing", "Real dispatch authority"],
    [5008, 5012, 5021, 5037, 5071],
  ),
  module(
    "complaints",
    "Complaints",
    "Support",
    "Separate named-party complaints from maintenance and general support.",
    [
      select("category", "Complaint category", [
        "Noise",
        "Shared spaces",
        "Conduct",
        "Other",
      ]),
      field("party", "Synthetic party label"),
      field("location", "Sample location"),
      field("resolution", "Requested resolution", "textarea"),
    ],
    ["Save complaint locally", "Review confidentiality", "Add follow-up notes"],
    [
      "Confidential party access",
      "Escalation and resolution policy",
      "Protected evidence",
    ],
    [7944, 7946, 7958],
  ),
  module(
    "concerns",
    "Resident concerns",
    "Support",
    "A conversation about neighbourhood issues with a clear follow-up trail.",
    [
      select("category", "Concern category", [
        "Maintenance",
        "Safety",
        "Environment",
        "Other",
      ]),
      field("location", "Sample location"),
      select("priority", "Proposed priority", ["Routine", "Time-sensitive"]),
    ],
    ["Describe a concern", "Review locally", "Record follow-up notes"],
    ["Assignment and escalation rules", "Resident-office delivery"],
    [7976, 7990],
  ),
  module(
    "tickets",
    "Support tickets",
    "Support",
    "Track support by channel, priority and a sample staff assignment.",
    [
      select("channel", "Requested channel", ["Portal", "Email", "Office"]),
      select("priority", "Proposed priority", ["Low", "Normal", "High"]),
      select("assignedTo", "Sample assignee", [
        "Unassigned",
        "Demo staff A",
        "Demo staff B",
      ]),
    ],
    [
      "Open local ticket",
      "Review priority and assignment",
      "Record response history",
    ],
    [
      "Support response commitments",
      "Real email and ticket delivery",
      "Confidential attachments",
    ],
    [8171, 8184],
  ),
  module(
    "messages",
    "Resident–office inbox",
    "Support",
    "Prepare a conversation and append local messages without sending them.",
    [
      select("recipient", "Proposed recipient", [
        "Office",
        "Finance",
        "Security",
        "Board",
      ]),
      select("topic", "Conversation topic", [
        "General enquiry",
        "Billing enquiry",
        "Request follow-up",
        "Other",
      ]),
    ],
    [
      "Create a conversation",
      "Add local messages",
      "Review conversation history",
    ],
    [
      "Verified participants",
      "Unread / delivery receipts",
      "Private message access",
    ],
    [3427, 3500, 3562, 3579],
  ),
  module(
    "gate-passes",
    "Gate-pass requests",
    "Security",
    "Record a proposed purpose and item list separately from visitor invitations.",
    [
      select("purpose", "Pass purpose", [
        "Delivery",
        "Move-in",
        "Move-out",
        "Service work",
        "Other",
      ]),
      when(field("crew", "Company or crew doing the work"), "purpose", [
        "Service work",
      ]),
      when(field("movingUnit", "Unit moving in or out"), "purpose", [
        "Move-in",
        "Move-out",
      ]),
      when(field("purposeDetail", "What is the pass for"), "purpose", [
        "Other",
      ]),
      field("date", "Requested date", "date"),
      field("items", "Items", "textarea"),
      field("vehicle", "Synthetic vehicle label"),
      field("party", "Synthetic visitor label"),
    ],
    ["Prepare request", "Review purpose and items", "Await real authorization"],
    [
      "Pass approval and expiry",
      "Gate verification / QR",
      "Entry and exit authority",
    ],
    [4133, 5118, 5741],
  ),
  module(
    "walk-ins",
    "Visitor lookup & walk-ins",
    "Security",
    "Capture a synthetic walk-in enquiry for local security review.",
    [
      field("visitor", "Synthetic visitor label"),
      field("unit", "Sample destination unit"),
      select("purpose", "Visit purpose", [
        "Social visit",
        "Delivery",
        "Service work",
        "Other",
      ]),
      field("date", "Visit date", "date"),
    ],
    [
      "Search sample records",
      "Record walk-in enquiry",
      "Await verified host response",
    ],
    [
      "Host verification",
      "Real entry / exit logs",
      "Visitor identity retention",
    ],
    [2258, 2268, 2289, 2322],
  ),
  module(
    "vehicles",
    "Vehicle & sticker requests",
    "Property",
    "Register a household vehicle and ask for the sticker that goes with it.",
    [
      select("request", "What do you need", [
        "New sticker",
        "Renew sticker",
        "Replace a lost sticker",
        "Remove a vehicle",
      ]),
      field("plate", "Plate or conduction number"),
      select("vehicleType", "Vehicle type", [
        "Car",
        "Motorcycle",
        "Van or SUV",
        "Truck",
        "Other",
      ]),
      field("makeModel", "Make and model"),
      field("colour", "Colour"),
      field("unit", "Unit the vehicle belongs to"),
      select("owner", "Who owns the vehicle", [
        "Homeowner",
        "Household member",
        "Tenant",
        "Company",
      ]),
      when(field("driver", "Who usually drives it"), "owner", [
        "Household member",
        "Tenant",
      ]),
      when(field("company", "Registered company"), "owner", ["Company"]),
      when(
        field("lostReport", "What happened to the sticker", "textarea"),
        "request",
        ["Replace a lost sticker"],
      ),
      field("orCr", "OR / CR reference", "text", false),
    ],
    [
      "Household sends the vehicle details",
      "Office checks the unit and documents",
      "Office records the decision",
    ],
    [
      "Only the office may approve a sticker or record a decision.",
      "Sticker numbers and fees stay unavailable until the association supplies them.",
    ],
    [2782, 2808, 5178, 7913, 8114],
  ),
  module(
    "permits",
    "Permit & clearance requests",
    "Property",
    "Ask for the clearance needed before construction, renovation or a move.",
    [
      select("permit", "Permit or clearance needed", [
        "Construction",
        "Renovation",
        "Move-in clearance",
        "Move-out clearance",
        "Other",
      ]),
      field("unit", "Unit the work is for"),
      field("start", "Proposed start date", "date"),
      field("finish", "Proposed finish date", "date"),
      when(
        field("scope", "Describe the work", "textarea"),
        "permit",
        ["Construction", "Renovation", "Other"],
      ),
      when(field("contractor", "Contractor or crew"), "permit", [
        "Construction",
        "Renovation",
      ]),
      when(field("workers", "How many workers", "number"), "permit", [
        "Construction",
        "Renovation",
      ]),
      when(field("mover", "Moving company or crew"), "permit", [
        "Move-in clearance",
        "Move-out clearance",
      ]),
      field("documents", "Supporting document reference", "text", false),
    ],
    [
      "Household describes the work and dates",
      "Office reviews the request",
      "Office records the decision",
    ],
    [
      "Only the office may issue or refuse a clearance.",
      "Permit fees and required documents stay unavailable until the association supplies them.",
    ],
    [1040, 1079, 3170, 6054],
  ),
  module(
    "incidents",
    "Incident records",
    "Security",
    "Log what happened at the gate or in the community, and what was done about it.",
    [
      select("kind", "Incident type", [
        "Gate or entry",
        "Property damage",
        "Disturbance",
        "Vehicle",
        "Injury or medical",
        "Other",
      ]),
      field("occurred", "Date it happened", "date"),
      field("time", "Time it happened", "time"),
      field("location", "Where it happened"),
      select("severity", "Severity", [
        "Information only",
        "Needs follow-up",
        "Urgent",
      ]),
      when(field("plate", "Vehicle plate involved"), "kind", ["Vehicle"]),
      when(
        field("injuries", "Who was hurt and how", "textarea"),
        "kind",
        ["Injury or medical"],
      ),
      when(field("damage", "What was damaged", "textarea"), "kind", [
        "Property damage",
      ]),
      field("action", "Action taken", "textarea"),
      field("reportedBy", "Reported by", "text", false),
    ],
    [
      "Security records what happened",
      "Office reviews the record",
      "Office records the outcome",
    ],
    [
      "Only the office may change an incident record once it is filed.",
      "Incident records are not published to residents and carry no penalty or finding.",
    ],
    [1022, 1831, 1947, 2318, 2790],
  ),
  module(
    "board-reports",
    "Board reports",
    "Documents",
    "Publish a board report to members once it has been reviewed.",
    [
      select("kind", "Report type", [
        "Monthly update",
        "Financial summary",
        "Annual report",
        "Committee report",
        "Other",
      ]),
      field("period", "Period covered"),
      select("audience", "Who it is for", [
        "All members",
        "Homeowners",
        "Board only",
      ]),
      when(field("committee", "Which committee"), "kind", [
        "Committee report",
      ]),
      field("summary", "Summary", "textarea"),
      field("reference", "Supporting document reference", "text", false),
    ],
    [
      "Board prepares the report",
      "Board or office reviews it",
      "Reviewed text is published to the chosen audience",
    ],
    [
      "Only a reviewer may publish a report to members.",
      "Figures stay unavailable until verified accounting records exist.",
    ],
    [743, 939, 940, 941, 944],
  ),
  module(
    "guard-roster",
    "Guard roster",
    "Security",
    "Plan sample posts and shifts without changing operational security assignments.",
    [
      field("post", "Sample guard post"),
      field("guard", "Synthetic guard label"),
      field("date", "Shift date", "date"),
      field("start", "Shift start", "time"),
      field("end", "Shift end", "time"),
    ],
    [
      "Draft shift coverage",
      "Review post assignments",
      "Archive obsolete draft",
    ],
    [
      "Security manager authority",
      "Verified staff contacts",
      "Operational handover",
    ],
    [4269, 4284, 5200],
  ),
  module(
    "household-changes",
    "Household changes",
    "Property",
    "Prepare occupancy, tenant or ownership change requests with evidence references.",
    [
      field("unit", "Sample unit"),
      select("change", "Change type", [
        "Owner change",
        "Tenant change",
        "Household member",
        "Occupancy update",
      ]),
      field("effective", "Proposed effective date", "date"),
      field("member", "Synthetic member label"),
      field("evidence", "Evidence description (no upload)"),
    ],
    [
      "Prepare change request",
      "Verify evidence outside preview",
      "Review effective membership",
    ],
    [
      "Ownership verification",
      "Protected identity evidence",
      "Transactional membership and access changes",
    ],
    [2538, 2581, 7262, 7313],
  ),
  module(
    "publishing",
    "Notice publishing details",
    "Community",
    "Prepare audience, pinning and attachment metadata for an announcement.",
    [
      select("audience", "Proposed audience", [
        "All members",
        "Homeowners",
        "Renters",
        "Board",
        "Security",
      ]),
      select("pinned", "Pin preference", ["Unpinned", "Pinned"]),
      field("date", "Proposed publication date", "date"),
      field(
        "attachments",
        "Attachment / image / QR description",
        "textarea",
        false,
      ),
    ],
    [
      "Draft a notice",
      "Review audience and assets",
      "Use office preview for sample publication",
    ],
    [
      "Audience enforcement",
      "Protected files and safe QR content",
      "Scheduled real delivery",
    ],
    [4736, 4750, 5402],
  ),
  module(
    "events",
    "Community events",
    "Community",
    "Plan community dates, times and venues without reserving an amenity.",
    [
      field("date", "Event date", "date"),
      field("start", "Start time", "time"),
      field("end", "End time", "time"),
      field("venue", "Sample venue"),
    ],
    ["Prepare event", "Review calendar", "Archive or cancel proposal"],
    ["Confirmed venue and booking", "Publishing and cancellation rules"],
    [2760, 5335],
  ),
  module(
    "board-records",
    "Board documents & disclosures",
    "Governance",
    "Prepare versioned document and financial disclosure metadata.",
    [
      select("category", "Record category", [
        "Minutes",
        "Policy",
        "Financial disclosure",
        "Resolution",
      ]),
      field("version", "Sample version"),
      field("owner", "Sample record owner"),
      select("audience", "Proposed audience", [
        "Board",
        "Members",
        "Homeowners",
      ]),
      field("source", "Source / attachment description"),
    ],
    [
      "Draft metadata",
      "Review version and audience",
      "Publish sample metadata through office",
    ],
    [
      "Board approval",
      "Protected original documents",
      "Disclosure accuracy and audience",
    ],
    [2906, 5296, 6837],
  ),
  module(
    "election-setup",
    "Election preparation",
    "Governance",
    "Capture schedule and position proposals while ballots and tallies remain unavailable.",
    [
      field("date", "Proposed election date", "date"),
      field("start", "Proposed opening time", "time"),
      field("end", "Proposed closing time", "time"),
      field("positions", "Proposed positions", "textarea"),
      field("eligibility", "Eligibility questions", "textarea"),
      field("proxy", "Proxy and tally publication questions", "textarea"),
    ],
    [
      "Prepare rules and schedule",
      "Verify eligible membership",
      "Implement secure ballot separately",
    ],
    [
      "Approved eligibility and proxy rules",
      "Secret ballot / duplicate prevention",
      "Server-owned tally and certification",
    ],
    [8031, 8032, 8037, 8047, 8083],
  ),
  module(
    "billing-proposals",
    "Billing run proposals",
    "Finance",
    "Prepare an assessment period and rate proposal without creating a real invoice.",
    [
      field("period", "Sample billing period"),
      select("mode", "Proposed billing mode", [
        "Flat amount",
        "Per square metre",
      ]),
      number("rate", "Sample rate (PHP)"),
      field("due", "Proposed due date", "date"),
      field("scope", "Sample unit scope"),
    ],
    [
      "Prepare assessment",
      "Inspect calculator",
      "Review before any real billing run",
    ],
    [
      "Approved dues and penalties",
      "Immutable server-owned invoices",
      "Idempotent billing run",
    ],
    [1570, 6575, 6590],
  ),
  module(
    "payment-evidence",
    "Payment evidence & receipts",
    "Finance",
    "Record synthetic evidence references without changing balances or issuing receipts.",
    [
      field("unit", "Sample unit"),
      field("date", "Sample payment date", "date"),
      number("amount", "Sample amount (PHP)"),
      field("reference", "Synthetic evidence reference"),
      select("method", "Proposed payment method", [
        "Bank transfer",
        "Cash",
        "Other",
      ]),
      field("allocation", "Proposed invoice allocation"),
    ],
    [
      "Prepare evidence",
      "Reconcile independently",
      "Await authorized verification",
    ],
    [
      "Real payment verification",
      "Receipt numbering / allocations / reversals",
      "Bank and gateway reconciliation",
    ],
    [7519, 7538, 7844, 7859],
  ),
  module(
    "budgets",
    "Budgets & collection history",
    "Finance",
    "Compare sample planned and actual amounts without implying verified accounts.",
    [
      field("period", "Sample reporting period"),
      field("category", "Sample expense category"),
      number("planned", "Sample planned amount (PHP)"),
      number("actual", "Sample actual amount (PHP)"),
      field("source", "Sample report source"),
    ],
    ["Prepare budget line", "Compare sample variance", "Export local evidence"],
    [
      "Approved accounts and categories",
      "Verified collection history",
      "Report sign-off",
    ],
    [3004, 7599, 7666, 7767],
  ),
  module(
    "access-proposals",
    "Account & access proposals",
    "Administration",
    "Document proposed roles, page visibility and view-only restrictions; no grants are applied.",
    [
      field("account", "Synthetic account label"),
      select("change", "Proposed action", [
        "Invitation",
        "Manual account setup",
        "Suspend account",
        "Main role",
        "Extra role",
        "Page visibility",
        "Individual override",
        "Access manager",
        "View-only restriction",
      ]),
      field("scope", "Proposed scope"),
      field("evidence", "Supporting reference"),
    ],
    [
      "Document request",
      "Review authority and evidence",
      "Apply only through future protected server",
    ],
    [
      "Identity provider and sessions",
      "Permission precedence / RLS",
      "Server-owned audit and privileged operations",
    ],
    [2029, 6970, 7146, 7170, 8203, 8244, 8290],
  ),
  module(
    "facility-rules",
    "Facility & association settings",
    "Administration",
    "Draft facility, category and operating-hour changes before policy approval.",
    [
      select("setting", "Setting area", [
        "Facility rules",
        "Renter access",
        "Office hours",
        "Quiet hours",
        "Request categories",
        "Booth venues",
        "Association details",
        "Notification preferences",
      ]),
      field("scope", "Sample setting scope"),
      field("proposed", "Proposed value", "textarea"),
    ],
    [
      "Prepare setting proposal",
      "Review impact and policy",
      "Await approved server configuration",
    ],
    [
      "Official values and approvals",
      "Versioned server settings",
      "Safe change rollout",
    ],
    [893, 899, 3029, 6728],
  ),
  module(
    "election-candidates",
    "Candidate proposals",
    "Governance",
    "Prepare synthetic candidate profiles linked to an election proposal. No nomination is certified and no vote is cast.",
    [
      field("electionId", "Local election proposal reference"),
      field("position", "Proposed position"),
      field("nominee", "Synthetic nominee label"),
      field("biography", "Sample candidate introduction", "textarea"),
      field("photoDescription", "Synthetic photo description (no upload)"),
    ],
    [
      "Choose a sample election",
      "Prepare candidate metadata",
      "Review for local information display",
    ],
    [
      "Nomination and eligibility verification",
      "Protected candidate media and consent",
      "Ballot and certified election service",
    ],
    [8031, 8032, 8037],
  ),
];

export function baselineModule(id: string) {
  const value = baselineModules.find((item) => item.id === id);
  if (!value) throw new Error("Unknown feature baseline module.");
  return value;
}
export function sampleBaselineFields(id: string, parentId = "") {
  const all = Object.fromEntries(
    baselineModule(id).fields.map((field) => {
      let value = field.options?.[0] ?? `Demo ${field.key}`;
      if (field.key === relatedField[id]) value = parentId;
      else if (field.type === "date") value = "2026-11-20";
      else if (field.type === "time")
        value =
          field.key === "end"
            ? "12:00"
            : field.key === "setup"
              ? "09:00"
              : "10:00";
      else if (field.type === "email") value = "sample@example.invalid";
      else if (field.type === "url") value = "https://example.invalid/sample";
      else if (field.type === "number")
        value = String(
          Math.max(
            field.min ?? 0,
            ["capacity", "seats"].includes(field.key) ? 4 : 1,
          ),
        );
      else if (field.key === "items") value = "Sample table\nSample chair";
      else if (field.key === "unit") value = "Demo A-09";
      return [field.key, value];
    }),
  );
  // A conditional field only carries a value when its condition holds, so the
  // sample matches what a resident filling the form would actually submit.
  return Object.fromEntries(
    baselineModule(id).fields.map((field) => [
      field.key,
      fieldVisible(field, all) ? all[field.key] : "",
    ]),
  );
}
/** True when a field should be shown and validated for the answers given. */
export function fieldVisible(
  spec: BaselineField,
  values: Record<string, string>,
) {
  if (!spec.showWhen) return true;
  return spec.showWhen.in.includes((values[spec.showWhen.key] ?? "").trim());
}
/** The fields a module shows for the answers given, in definition order. */
export function visibleFields(id: string, values: Record<string, string>) {
  return baselineModule(id).fields.filter((spec) => fieldVisible(spec, values));
}
export function baselineSchema(id: string) {
  const definition = baselineModule(id);
  const shape: Record<string, z.ZodType> = {};
  for (const spec of definition.fields) {
    let schema: z.ZodType = specSchema(spec);
    if (!spec.required || spec.showWhen)
      schema = z.union([z.literal(""), schema]).default("");
    shape[spec.key] = schema;
  }
  return z
    .object({
      title: z.string().trim().min(3).max(100),
      detail: z.string().trim().min(10).max(2000),
      fields: z.object(shape).strict(),
    })
    .superRefine((value, ctx) => {
      const fields = value.fields as Record<string, string>;
      for (const spec of definition.fields) {
        if (!spec.showWhen) continue;
        const given = (fields[spec.key] ?? "").trim();
        // A hidden field is never required and never carries a value, so the
        // answer the resident sees always matches the record that is stored.
        if (!fieldVisible(spec, fields)) {
          if (given)
            ctx.addIssue({
              code: "custom",
              path: ["fields", spec.key],
              message:
                "This answer does not apply to the category you chose. Clear it or change the category.",
            });
          continue;
        }
        if (spec.required !== false && !given) {
          ctx.addIssue({
            code: "custom",
            path: ["fields", spec.key],
            message: "This answer is needed for the category you chose.",
          });
          continue;
        }
        if (!given) continue;
        const check = specSchema(spec).safeParse(given);
        if (!check.success)
          ctx.addIssue({
            code: "custom",
            path: ["fields", spec.key],
            message: check.error.issues[0].message,
          });
      }
      if (
        id === "garage-sales" &&
        (fields.items ?? "").split(/\r?\n/).filter((item) => item.trim())
          .length > 20
      )
        ctx.addIssue({
          code: "custom",
          path: ["fields", "items"],
          message: "Use at most 20 items in this local sample preview.",
        });
      if (fields.start && fields.end && fields.end <= fields.start)
        ctx.addIssue({
          code: "custom",
          path: ["fields", "end"],
          message:
            "End time must follow start time. Use separate drafts for overnight shifts.",
        });
      if (fields.setup && fields.start && fields.setup > fields.start)
        ctx.addIssue({
          code: "custom",
          path: ["fields", "setup"],
          message: "Setup must be before the event starts.",
        });
    });
}
function specSchema(spec: BaselineField): z.ZodType {
  let schema: z.ZodType;
    if (spec.options) schema = z.enum(spec.options);
    else if (spec.type === "number")
      schema = z
        .string()
        .refine(
          (value) =>
            value.trim() !== "" &&
            Number.isFinite(Number(value)) &&
            Number(value) >= (spec.min ?? 0) &&
            Number(value) <= (spec.max ?? 1000000) &&
            (Number.isInteger(Number(value)) ||
              ["price", "rate", "fee", "amount", "planned", "actual"].includes(
                spec.key,
              )),
          "Enter a valid sample number within the displayed limits.",
        );
    else if (spec.type === "date") schema = z.iso.date();
    else if (spec.type === "time")
      schema = z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");
    else if (spec.type === "email")
      schema = z
        .email()
        .refine(
          (value) => value.endsWith("@example.invalid"),
          "Use a synthetic address ending in @example.invalid.",
        );
    else if (spec.type === "url")
      schema = z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          url.hostname === "example.invalid" &&
          !url.username &&
          !url.password
        );
      }, "Use https://example.invalid/ for sample links.");
    else
    schema = z.string().trim().min(2, "Add at least 2 characters.").max(300);
  return schema;
}

export const relatedModule: Record<string, string> = {
  "booth-applications": "booth-events",
  participation: "workshops",
  "carpool-interests": "carpools",
  "election-candidates": "election-setup",
};
export const relatedField: Record<string, string> = {
  "booth-applications": "eventId",
  participation: "sessionId",
  "carpool-interests": "carpoolId",
  "election-candidates": "electionId",
};
export const tripSteps = [
  "Sample queue",
  "Sample driver assigned",
  "Sample on the way",
  "Sample at pickup",
  "Sample completed",
] as const;

export function billingEstimate(
  rate: number,
  area: number,
  mode: "Flat amount" | "Per square metre",
) {
  if (
    ![rate, area].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1000000,
    )
  )
    throw new Error("Use non-negative finite sample amounts within the limit.");
  const amount = Math.round(rate * 100 * (mode === "Flat amount" ? 1 : area));
  if (!Number.isSafeInteger(amount))
    throw new Error("Sample result is outside the safe money range.");
  return amount;
}
