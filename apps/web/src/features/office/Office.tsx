import financeStyles from "./FinanceReports.module.css";
import { DetailDisclosure, NavigationGroup } from "../../components/Navigation";
import { lazy, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Search,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { capabilityRows } from "../../../../../packages/shared/src/workspace";
import { money } from "../../../../../packages/shared/src";
import { householdLedger } from "../../data/fixtures";
import { usePortal } from "../../data/usePortal";
import { useWorkspace } from "../../data/workspace";
import {
  Badge,
  Feedback,
  Modal,
  PageIntro,
  Row,
  Skeleton,
} from "../../components/UI";
import {
  LinkedCard,
  MetricStrip,
  ProgressTimeline,
  Queue,
  Requirements,
  WorkspaceNote,
} from "../../components/WorkspaceUI";
import Admin from "../admin/Admin";
import { useAuth } from "../../data/auth";
import People from "./People";
import StaffHome from "./StaffHome";
import OfficeReviewInbox from "./OfficeReviewInbox";
import FacilityCalendar from "./FacilityCalendar";
import ParticipationDesk from "../connected/ParticipationDesk";
import Shuttle from "../transport/Shuttle";
import { featureReviewCapabilities } from "../../../../../packages/shared/src/office-review";
import { ExpenseVisual } from "../../components/RecordVisuals";
import { RequestVisual } from "../../components/RequestVisual";
import RequestDesk from "../services/RequestDesk";
import OperationsDesk from "../connected/OperationsDesk";
import LiveFeature from "../connected/LiveFeature";
import AnnouncementManager from "../connected/AnnouncementManager";
import LiveFeatureDirectory from "../connected/LiveFeatureDirectory";
import AccessPlanning from "../developer/AccessPlanning";
const FinanceReports = lazy(() => import("./FinanceReports"));
const RecordedFinance = lazy(() => import("./RecordedFinance"));
const AccountingWorkbench = lazy(() => import("./AccountingWorkbench"));
const OfficeConfiguration = lazy(() => import("./OfficeConfiguration"));
const GarageSaleItems = lazy(() => import("../connected/GarageSaleItems"));
const OfficeCalendar = lazy(() => import("../community/CommunityModules"));

export default function Office() {
  const auth = useAuth();
  const cache = useQueryClient();
  useEffect(() => {
    if (auth.preview || auth.rolePreview || auth.memberPreview) return;
    return cache.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        void cache.invalidateQueries({ queryKey: ["office-review-inbox"] });
        void cache.invalidateQueries({ queryKey: ["office-pending-lots"] });
      }
    });
  }, [cache, auth.preview, auth.rolePreview, auth.memberPreview]);
  const path = useParams()["*"] ?? "";
  const [params] = useSearchParams();
  if (!auth.preview && !auth.rolePreview) {
    if (path === "garage-items") return <GarageSaleItems office />;
    if (path === "finance/accounting") return <AccountingWorkbench />;
    if (path === "settings" || path === "hotlines")
      return <OfficeConfiguration contacts={path === "hotlines"} />;
    if (path === "calendar") return <FacilityCalendar />;
    if (path === "approvals") return <OfficeReviewInbox />;
    if (path === "shuttle") return <Shuttle />;
    const [desk, module] = path.split("/");
    if (desk === "review" && Object.hasOwn(featureReviewCapabilities, module))
      return (
        <>
          <Link
            className="text-link"
            to={
              params.get("history") === "1"
                ? `/office/review/${module}`
                : `/office/review/${module}?history=1`
            }
          >
            {params.get("history") === "1"
              ? "Pending review only"
              : "All submissions & history"}
          </Link>
          <LiveFeature
            key={`${module}:${params.get("history")}`}
            module={module}
            initialView="review"
            pendingOnly={params.get("history") !== "1"}
          />
        </>
      );
    if (
      desk === "participation" &&
      (module === "workshops" ||
        module === "booth-events" ||
        module === "carpools")
    )
      return (
        <ParticipationDesk
          key={`${module}:${params.get("history")}`}
          module={module}
          office
          pendingOnly={params.get("history") !== "1"}
        />
      );
  }
  // Signed-in staff get the connected request desk. The Admin fallback is
  // fixture-backed and would show synthetic records to a real office account.
  if (!auth.preview && !auth.rolePreview && path === "requests")
    return <RequestDesk office />;
  // Vehicle and permit requests are feature records; review them with the same
  // connected desk the rest of the modules use, rather than a separate screen.
  if (
    !auth.preview &&
    !auth.rolePreview &&
    ["vehicles", "permits"].includes(path)
  )
    return <LiveFeature key={path} module={path} initialView="review" />;
  if (path === "access") return <AccessPlanning />;
  if (
    !auth.preview &&
    !auth.rolePreview &&
    ["bookings", "visitors", "calendar"].includes(path)
  )
    return (
      <OperationsDesk
        key={`${path}:${params.get("queue")}`}
        office
        kind={path === "visitors" ? "visitor" : "booking"}
      />
    );
  if (
    !auth.preview &&
    !auth.rolePreview &&
    ["announcements", "community", "documents"].includes(path)
  )
    return path === "documents" ? (
      <LiveFeature key={path} module="board-records" initialView="review" />
    ) : (
      <AnnouncementManager key={path} />
    );
  if (!auth.preview && !auth.rolePreview && path === "operations")
    return <LiveFeatureDirectory initialView="review" />;
  if (
    !auth.preview &&
    !auth.rolePreview &&
    [
      "finance",
      "finance/collections",
      "finance/reports",
      "finance/expenses",
      "finance/reconciliation",
    ].includes(path)
  )
    return <RecordedFinance section={path} />;
  if (path === "calendar") return <OfficeCalendar area="calendar" />;
  if (["requests", "inbox"].includes(path)) return <RequestDesk office />;
  if (!auth.preview && path === "") return <StaffHome />;
  if (
    !auth.preview &&
    !auth.rolePreview &&
    ["residents", "registrations"].includes(path)
  )
    return <People key={path} applications={path === "registrations"} />;
  return <SampleOffice />;
}

function SampleOffice() {
  const rawPath = useParams()["*"] ?? "";
  const path = rawPath.startsWith("finance/")
    ? rawPath.slice("finance/".length)
    : rawPath;
  const workspace = useWorkspace();
  const portal = usePortal();
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState<string | null>(null);
  if (workspace.isPending || portal.isPending) return <Skeleton />;
  if (workspace.error || portal.error)
    return (
      <>
        <PageIntro
          eyebrow="OFFICE PREVIEW"
          title="Workspace data is unavailable"
        />
        <Feedback error={workspace.error ?? portal.error} />
        <Link className="text-link" to="/developer">
          Open local recovery tools
          <ArrowRight size={20} />
        </Link>
      </>
    );
  const items = workspace.data?.items ?? [];
  const applications = items.filter(
    (item) =>
      item.kind === "registration" &&
      ["Submitted locally", "In review"].includes(item.status),
  );
  const requests =
    portal.data?.records.filter(
      (item) => item.kind === "request" && item.status !== "Resolved",
    ) ?? [];
  const financeNav = (
    <>
      <nav
        className={financeStyles.tabs}
        aria-label="Finance workspace navigation"
      >
        <NavLink end to="/office/finance">
          Collections & AR
        </NavLink>
        <NavLink to="/office/finance/reports">Reports</NavLink>
      </nav>
      {rawPath !== "finance/reports" && (
        <DetailDisclosure title="Finance tools">
          <NavigationGroup aria-label="Finance tools">
            <NavLink to="/explore/billing-proposals">Billing proposals</NavLink>
            <NavLink to="/explore/imports">Import staging</NavLink>
            <NavLink to="/account/statement">
              Printable sample statement
            </NavLink>
          </NavigationGroup>
        </DetailDisclosure>
      )}
    </>
  );
  if (rawPath === "finance/reports")
    return (
      <>
        {financeNav}
        <FinanceReports />
      </>
    );
  if (path === "finance")
    return (
      <>
        {financeNav}
        <Admin section="" embedded />
      </>
    );
  if (path === "requests") return <Admin section="operations" embedded />;
  if (path === "history") return <Admin section="audit" embedded />;
  if (path === "registrations")
    return (
      <>
        <PageIntro
          eyebrow="OFFICE · LOCAL REVIEW"
          title="Registration review"
          description="Compare the sample application with its supporting information. Actual approval and invitations are unavailable."
        />
        <MetricStrip
          items={[
            {
              label: "Awaiting review",
              value: applications.length,
              detail: "Synthetic applications",
            },
            {
              label: "Verified identities",
              value: "Unavailable",
              detail: "No identity provider",
            },
            {
              label: "Invitation delivery",
              value: "Not connected",
              detail: "No messages are sent",
            },
          ]}
        />
        <Queue kind="registration" title="Applications" allowReview />
        <WorkspaceNote>
          Reviewing a local item cannot create an identity, grant membership or
          send mail. Real approval needs one transactional server operation and
          a retryable invitation outbox.
        </WorkspaceNote>
      </>
    );
  if (path === "residents")
    return (
      <>
        <PageIntro
          eyebrow="PROPERTY DIRECTORY · SAMPLE LEDGER UNITS"
          title="Properties & households"
          description="These units come from the synthetic financial ledger. They are not a verified property registry."
        />
        <div className="search">
          <Search size={20} />
          <input
            aria-label="Search sample properties"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a unit…"
          />
        </div>
        <div className="list">
          {householdLedger
            .filter((row) =>
              row.unit.toLowerCase().includes(search.toLowerCase()),
            )
            .map((row) => (
              <button
                className="workspace-row-button"
                key={row.unit}
                onClick={() => setUnit(row.unit)}
              >
                <Users size={20} />
                <span>
                  <strong>{row.unit}</strong>
                  <small>Owner and occupancy not verified</small>
                </span>
                <Badge>Sample</Badge>
                <ArrowRight size={20} />
              </button>
            ))}
        </div>
        {unit && (
          <Modal
            title={unit}
            description="Synthetic household dossier"
            onClose={() => setUnit(null)}
          >
            <Requirements
              items={[
                { label: "Owner of record", state: "Not supplied" },
                { label: "Current members", state: "Not verified" },
                { label: "Occupancy dates", state: "Not confirmed" },
              ]}
            />
            <ProgressTimeline
              items={[
                {
                  label: "Sample ledger reference",
                  detail: "Available in the local report",
                  done: true,
                },
                {
                  label: "Verify registry and membership",
                  detail: "Requires trusted HOA source records",
                },
                {
                  label: "Approve a property change",
                  detail: "Requires authorized server workflow",
                },
              ]}
            />
            <Link className="text-link" to="/office/finance">
              View sample ledger
              <ArrowRight size={20} />
            </Link>
          </Modal>
        )}
      </>
    );
  if (path === "access")
    return (
      <>
        <PageIntro
          eyebrow="PROPOSED POLICY · NO REAL GRANTS"
          title="Roles & effective access"
          description="A visual discussion matrix. These proposals are not enforced permissions."
        />
        <WorkspaceNote>
          No control here can grant a role. Main roles, extra roles, view-only
          precedence, overrides and super-admin authority need approval before
          server implementation.
        </WorkspaceNote>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Proposed capability matrix"
        >
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Resident</th>
                <th>Office</th>
                <th>Security</th>
                <th>Driver</th>
                <th>Board</th>
              </tr>
            </thead>
            <tbody>
              {capabilityRows.map((row) => (
                <tr key={row.task}>
                  <td>{row.task}</td>
                  <td>{row.resident}</td>
                  <td>{row.office}</td>
                  <td>{row.security}</td>
                  <td>{row.driver}</td>
                  <td>{row.board}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Queue
          kind="access-change"
          title="Sample policy review notes"
          createLabel="Add policy review note"
          description="Notes do not change account permissions."
        />
      </>
    );
  if (
    ["expenses", "announcements", "documents", "permits", "vehicles"].includes(
      path,
    )
  ) {
    const config = {
      expenses: {
        kind: "expense" as const,
        title: "Expense review",
        create: "Add sample expense",
      },
      announcements: {
        kind: "announcement" as const,
        title: "Announcement studio",
        create: "New sample announcement",
      },
      documents: {
        kind: "document" as const,
        title: "Document library",
        create: "Add sample document metadata",
      },
      permits: {
        kind: "permit" as const,
        title: "Permit review",
        create: "New sample permit enquiry",
      },
      vehicles: {
        kind: "vehicle" as const,
        title: "Vehicle review",
        create: "New sample vehicle request",
      },
    }[
      path as
        "expenses" | "announcements" | "documents" | "permits" | "vehicles"
    ];
    return (
      <>
        {path === "expenses" && financeNav}
        <PageIntro
          eyebrow="OFFICE WORKSPACE · SYNTHETIC"
          title={config.title}
        />
        {path === "expenses" && !workspace.isError && (
          <ExpenseVisual records={items} />
        )}
        <Queue
          key={config.kind}
          kind={config.kind}
          title={path === "expenses" ? "Expense submissions" : config.title}
          createLabel={config.create}
          allowReview
          description="All changes stay in this tab. Review states are illustrative; no real approval, payment, document or authorization is issued."
        />
        <Link className="text-link" to="/office/review">
          Open connected structured review desk <ArrowRight size={20} />
        </Link>
      </>
    );
  }
  if (path === "reconciliation")
    return (
      <>
        {financeNav}
        <PageIntro
          eyebrow="FINANCE CONTROL · NOT CONNECTED"
          title="Reconciliation"
        />
        <MetricStrip
          items={[
            {
              label: "Ledger source",
              value: "Sample",
              detail: "Six synthetic billed units",
            },
            {
              label: "Bank statement",
              value: "Unavailable",
              detail: "No bank data supplied",
            },
            {
              label: "Reconciled balance",
              value: "Unavailable",
              detail: "No comparison can be made",
            },
          ]}
        />
        <ProgressTimeline
          items={[
            {
              label: "Define approved ledger scope",
              detail: "Period, source, receipts and adjustments",
            },
            {
              label: "Load authorized bank evidence",
              detail: "No bank connection exists",
            },
            {
              label: "Review exceptions",
              detail: "Exact matching rules need approval",
            },
            {
              label: "Confirm reconciliation",
              detail: "Requires verified records and audit",
            },
          ]}
        />
      </>
    );
  if (path === "operations" || path === "community" || path === "settings")
    return (
      <>
        <PageIntro
          eyebrow="OFFICE WORKSPACE · LOCAL PREVIEW"
          title={
            path === "operations"
              ? "Operations desk"
              : path === "community"
                ? "Community publishing"
                : "Office administration"
          }
        />
        <div className="grid-2">
          {(path === "operations"
            ? [
                {
                  title: "Requests & concerns",
                  to: "/office/requests",
                  icon: Wrench,
                  detail: "Review local resident requests.",
                },
                {
                  title: "Bookings & calendar",
                  to: "/office/calendar",
                  icon: CalendarDays,
                  detail: "Explore sample reservation requests.",
                },
                {
                  title: "Permits",
                  to: "/office/permits",
                  icon: ClipboardCheck,
                  detail: "Review sample requirements and enquiries.",
                },
                {
                  title: "Security workspace",
                  to: "/security",
                  icon: ShieldCheck,
                  detail: "Visitor requests and incident review.",
                },
              ]
            : path === "community"
              ? [
                  {
                    title: "Announcement studio",
                    to: "/office/announcements",
                    icon: FileText,
                    detail: "Draft and publish only into the local preview.",
                  },
                  {
                    title: "Document library",
                    to: "/office/documents",
                    icon: FileText,
                    detail: "Metadata and review states; no file hosting.",
                  },
                ]
              : [
                  {
                    title: "Roles & access",
                    to: "/office/access",
                    icon: ShieldCheck,
                    detail: "Proposed matrix and review notes.",
                  },
                  {
                    title: "Local activity",
                    to: "/office/history",
                    icon: FileText,
                    detail: "Preview history; not secure audit.",
                  },
                  {
                    title: "Developer maintenance",
                    to: "/developer",
                    icon: Wrench,
                    detail: "Local diagnostics, scenarios and reset tools.",
                  },
                  {
                    title: "Preview access & sign out",
                    to: "/sign-in",
                    icon: Users,
                    detail: "Workspace chooser; no real authentication.",
                  },
                ]
          ).map(({ title, to, icon: Icon, detail }) => (
            <LinkedCard
              key={to}
              title={title}
              to={to}
              detail={detail}
              icon={<Icon size={24} />}
            />
          ))}
          <LinkedCard
            title="Full feature baseline"
            to="/explore"
            detail="Detailed marketplace, transport, support, governance and administrative workflows."
            icon={<ClipboardCheck size={24} />}
          />
        </div>
      </>
    );
  if (path)
    return (
      <>
        <PageIntro eyebrow="OFFICE" title="This workspace is unavailable." />
        <Link className="text-link" to="/office">
          Return to office
          <ArrowRight size={20} />
        </Link>
      </>
    );
  return (
    <>
      <PageIntro
        eyebrow="OFFICE CONTROL CENTER · SAMPLE DATA"
        title="What needs your attention"
        description="Review queues and matching resident workflows, together in one workspace."
      />
      <RequestVisual />
      <MetricStrip
        items={[
          {
            label: "Registration reviews",
            value: applications.length,
            detail: "Synthetic applications",
          },
          {
            label: "Open concerns",
            value: requests.length,
            detail: "Local resident requests",
          },
          {
            label: "Sample collected",
            value: money(
              householdLedger.reduce((sum, row) => sum + row.received, 0),
            ),
            detail: "Fixed sample ledger snapshot",
          },
          {
            label: "Draft notices",
            value: items.filter(
              (item) => item.kind === "announcement" && item.status === "Draft",
            ).length,
            detail: "Not sent to residents",
          },
        ]}
      />
      <div className="two-column">
        <section className="panel">
          <h2>Next in the queue</h2>
          {applications.map((item) => (
            <Row
              key={item.id}
              title={item.title}
              detail={`${item.id} · ${item.status}`}
              to="/office/registrations"
              icon={<Users size={20} />}
            />
          ))}
          <Row
            title="Resident concerns"
            detail={`${requests.length} open local requests`}
            to="/office/requests"
            icon={<Wrench size={20} />}
          />
          <Row
            title="Office administration"
            detail="Access proposals, local history and maintenance"
            to="/office/settings"
            icon={<ShieldCheck size={20} />}
          />
        </section>
        <section className="panel">
          <h2>Financial picture</h2>
          <p className="note">
            Amounts reconcile to the six-household sample ledger. Bank balances,
            expenses paid and unbilled households remain unavailable.
          </p>
          <Requirements
            items={[
              { label: "Sample invoice ledger", state: "Supplied" },
              { label: "Bank reconciliation", state: "Not connected" },
              { label: "Payment provider", state: "Not connected" },
            ]}
          />
          <Link className="text-link" to="/office/finance">
            Open collections & aging
            <ArrowRight size={20} />
          </Link>
        </section>
      </div>
      <div className="grid-2" style={{ marginTop: 24 }}>
        <LinkedCard
          title="Connected review desk"
          to="/office/review"
          detail="Review structured local drafts and publish supported sample content."
          icon={<ClipboardCheck size={24} />}
        />
        <LinkedCard
          title="Office conversations"
          to="/office/inbox"
          detail="The same local support threads residents can inspect."
          icon={<FileText size={24} />}
        />
        <LinkedCard
          title="Property proposals"
          to="/office/registry"
          detail="Imported registry drafts and proposed household changes."
          icon={<Users size={24} />}
        />
        <LinkedCard
          title="Full feature baseline"
          to="/explore"
          detail="Structured local workflows, import staging and policy proposals."
          icon={<ClipboardCheck size={24} />}
        />
        <LinkedCard
          title="Properties & households"
          to="/office/residents"
          detail="Unit lookup and verification checklist."
          icon={<Users size={24} />}
        />
        <LinkedCard
          title="Operations desk"
          to="/office/operations"
          detail="Requests, amenities, permits and security."
          icon={<ClipboardCheck size={24} />}
        />
      </div>
    </>
  );
}
