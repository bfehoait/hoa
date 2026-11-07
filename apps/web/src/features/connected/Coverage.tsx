import { NavigationGroup } from "../../components/Navigation";
import { useState } from "react";
import { Link } from "../../components/AccessLink";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import inventory from "../../../../../packages/shared/src/reference-inventory.json";
import { Badge, PageIntro } from "../../components/UI";
import { MetricStrip, WorkspaceNote } from "../../components/WorkspaceUI";
import styles from "./Connected.module.css";

const delivery: Record<
  string,
  { routes: [string, string][]; local: string; gate: string }
> = {
  "Accounts and registration": {
    routes: [
      ["Entry and registration", "/sign-in"],
      ["Account proposals", "/explore/access-proposals"],
    ],
    local:
      "Preview entry/exit, recovery-unavailable state, synthetic registration review, profiles and account-change proposals.",
    gate: "Real identity, sessions, suspension, invitations, recovery and membership approval require an identity provider and protected server operations.",
  },
  "Access and audit": {
    routes: [
      ["Permission matrix", "/office/access"],
      ["Local history", "/office/history"],
    ],
    local:
      "Proposed role/page/view-only/access-manager changes and local event history.",
    gate: "Effective permission precedence, RLS, refusal tests and immutable audit remain unimplemented. Preview navigation grants no authority.",
  },
  "Announcements and inbox": {
    routes: [
      ["Content review", "/office/review?module=publishing"],
      ["Resident updates", "/community"],
      ["Conversations", "/services/inbox"],
    ],
    local:
      "Structured notice publication feeds resident updates; pinning and simulated audiences; synthetic media references; two-view local replies and unread markers.",
    gate: "Audience privacy, protected uploads/QR handling, authenticated participants, delivery and real read receipts require a server.",
  },
  "Properties and master data": {
    routes: [
      ["Property proposals", "/office/registry"],
      ["Import staging", "/explore/imports"],
    ],
    local:
      "Separate synthetic registry/household-change proposals, fixed ledger-unit lookup, validated mapped CSV staging and exports.",
    gate: "Verified property data, ownership transfers, membership/access changes and production import conflict resolution remain unavailable.",
  },
  "Operations and support": {
    routes: [
      ["Review desk", "/office/review"],
      ["Request assignment", "/office/requests"],
      ["Office inbox", "/office/inbox"],
    ],
    local:
      "Separate concerns/complaints/tickets, local priorities, assignment proposals, review histories and resident-office sample replies; existing request assignment/resolution and FAQs.",
    gate: "Confidential party boundaries, real assignments, service commitments, escalation and delivery require approved rules and server enforcement.",
  },
  "Amenities and calendar": {
    routes: [
      ["Booking requests", "/services/bookings"],
      ["Combined local calendar", "/services/calendar"],
      ["Facility proposals", "/explore/facility-rules"],
    ],
    local:
      "Booking requests/cancellation and calendar markers alongside local event, booth and training proposals; facility-rule proposals.",
    gate: "Actual booking approval, capacity/fee/renter rules, conflicting reservations and cancellation consequences are not confirmed.",
  },
  "Gate, visitors and vehicles": {
    routes: [
      ["Gate simulation", "/security/gate"],
      ["Visitor requests", "/services/visitors"],
      ["Vehicle review", "/security/vehicles"],
    ],
    local:
      "Visitor enquiries, walk-ins, purpose/item gate-pass proposals, guard rosters, vehicle/sticker requests and non-authoritative arrival/departure simulation.",
    gate: "No valid gate QR, host identity checks, actual entry/exit logs, sticker issuance, expiry enforcement or guard authority exists.",
  },
  Incidents: {
    routes: [["Incident desk", "/security/incidents"]],
    local:
      "Synthetic non-emergency incident capture, local review and archived history.",
    gate: "Operational closure, evidence protection, confidential access and emergency escalation require approved server workflows and verified contacts.",
  },
  "Billing and receipts": {
    routes: [
      ["Bills and histories", "/account"],
      ["Printable sample statement", "/account/statement"],
      ["Assessment proposals", "/explore/billing-proposals"],
    ],
    local:
      "Immutable synthetic invoices/recorded payments, balances/aging, CSV and printable sample statements, flat/area calculator, evidence/import and allocation proposals.",
    gate: "No invoice posting, real payment verification, official receipt, ledger correction, allocation, reversal or gateway is implemented.",
  },
  "Expenses and reporting": {
    routes: [
      ["Collections report", "/office/finance"],
      ["Expense review", "/office/finance/expenses"],
      ["Budgets", "/explore/budgets"],
      ["Import staging", "/explore/imports"],
    ],
    local:
      "Fixed sample collection reports, expense review and evidence drafts, import templates, local budgets/variance and labelled exports.",
    gate: "Verified expenses, accounting definitions, finance approvals, bank reconciliation and official reports are unavailable.",
  },
  "Business and buy/sell": {
    routes: [
      ["Resident market directory", "/directory/market"],
      ["Content review", "/office/review?module=businesses"],
    ],
    local:
      "Category-specific business and classified drafts, hours/contact/condition/prices, local review/publication, search, sample detail and archive withdrawal.",
    gate: "Provider verification, real contact consent, protected listing photos, moderation authority and transactions need approved backend workflows.",
  },
  "Jobs, garage sales and booths": {
    routes: [
      ["Local market", "/directory/market"],
      ["Vendor proposals", "/explore/booth-applications"],
    ],
    local:
      "Hiring/seeking and job setup/deadline/link fields; garage windows and per-item local review with stale-review invalidation; published sample events, linked vendor proposals, numbered booth simulation and local conflict checks.",
    gate: "Real external applications, item/vendor approvals, atomic booth allocation, capacity and fees remain server/policy gates.",
  },
  Training: {
    routes: [
      ["Learning directory", "/directory/learning"],
      ["Participation interests", "/explore/participation"],
    ],
    local:
      "Published synthetic sessions with facilitator/date/capacity/fee metadata; linked interest creation and local withdrawal/counts.",
    gate: "Actual enrollment, attendance, verified facilitators, fee collection and atomic capacity handling are unavailable.",
  },
  "Rides and carpools": {
    routes: [
      ["Dispatch simulation", "/driver/dispatch"],
      ["Carpool directory", "/directory/transport"],
    ],
    local:
      "Stations, ride requests, sample driver/vehicle pairings, sequential trip progression/history, carpool publication and linked seat-interest/withdrawal.",
    gate: "No real drivers, routes, fares, seats, dispatch messages, pickup tracking or safety verification is provided.",
  },
  "Board documents and disclosures": {
    routes: [
      ["Document metadata", "/more/documents"],
      ["Governance directory", "/directory/governance"],
      ["Board overview", "/board"],
    ],
    local:
      "Version/audience/source metadata, local document/disclosure publication, sample financial oversight and rule proposals.",
    gate: "Actual approved documents, protected downloads, governance authority, certified disclosures and official rules remain unavailable.",
  },
  Elections: {
    routes: [
      ["Election readiness", "/more/elections"],
      ["Election preparation", "/explore/election-setup"],
      ["Candidate proposals", "/explore/election-candidates"],
    ],
    local:
      "Schedule/position/rule questions and linked synthetic candidate profiles with image-reference metadata; voting stays disabled.",
    gate: "Verified nominations/photos, eligibility/proxies, opening/closing authority, secret ballots, duplicate prevention and certified tallies are not implemented.",
  },
};

export default function Coverage() {
  const [search, setSearch] = useState("");
  const rows = inventory.areas.filter((area) =>
    `${area.name} ${area.features.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageIntro
        eyebrow="SOURCE-TO-PREVIEW COVERAGE"
        title="Every source area, with its boundaries visible."
        description="The frozen source inventory is mapped to local entry points. A mapped feature statement does not mean production parity or a completed backend."
      />
      <MetricStrip
        items={[
          {
            label: "Mapped source families",
            value: inventory.areas.length,
            detail: "All families in the extracted inventory",
          },
          {
            label: "Observed feature statements",
            value: inventory.areas.reduce(
              (sum, area) => sum + area.features.length,
              0,
            ),
            detail: "Inventory descriptions, not a function-completion count",
          },
          {
            label: "Backend authority",
            value: "Unavailable",
            detail: "No auth/RLS, approval, payment or ballot service",
          },
        ]}
      />
      <NavigationGroup aria-label="Coverage navigation">
        <Link to="/directory">Synthetic walkthrough</Link>
        <Link to="/explore">Structured modules</Link>
        <Link to="/developer/source">Source evidence</Link>
      </NavigationGroup>
      <div className="search">
        <Search size={20} />
        <input
          aria-label="Search source coverage"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a source feature or area…"
        />
      </div>
      {rows.map((area) => {
        const value = delivery[area.name];
        return (
          <details
            className={styles.coverage}
            key={area.name}
            data-source-family={area.name}
          >
            <summary>
              {area.name}
              <span className="small muted">
                {area.features.length} observed statements
              </span>
              <ChevronDown size={20} />
            </summary>
            <label
              className="small"
              htmlFor={`coverage-${area.name.replace(/\W+/g, "-")}`}
            >
              Observed statements: {area.features.length}
            </label>
            <progress
              id={`coverage-${area.name.replace(/\W+/g, "-")}`}
              style={{ width: "100%", accentColor: "var(--accent)" }}
              value={area.features.length}
              max={Math.max(
                ...inventory.areas.map((item) => item.features.length),
              )}
            />
            <p className="note">
              Relative inventory size, not production completion.
            </p>
            <Badge>Local preview + server gates</Badge>
            <h2 style={{ marginTop: 20 }}>Observed source features</h2>
            <ul>
              {area.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <h2>Local coverage</h2>
            <p>{value?.local ?? "No local mapping supplied."}</p>
            <NavigationGroup aria-label={`${area.name} entry points`}>
              {value?.routes.map(([label, to]) => (
                <Link key={to} to={to}>
                  {label}
                  <ArrowRight size={18} />
                </Link>
              ))}
            </NavigationGroup>
            <h2>Remaining production gate</h2>
            <p>{value?.gate ?? "Coverage requires review."}</p>
            <p className="small muted">
              Evidence: snapshot {inventory.commit.slice(0, 12)} · source lines{" "}
              {area.evidence.join(", ")}. Source defaults are not approved HOA
              rules.
            </p>
          </details>
        );
      })}
      <WorkspaceNote>
        This map covers the extracted source feature statements. It does not
        prove equivalent behavior for every helper or every state in the
        8,891-line file. Actual records and missing backend dependencies cannot
        be recovered from static source metadata.
      </WorkspaceNote>
    </>
  );
}
