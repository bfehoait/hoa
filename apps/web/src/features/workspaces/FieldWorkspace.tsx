import { lazy } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import { ArrowRight, ClipboardCheck, KeyRound } from "lucide-react";
import { usePortal } from "../../data/usePortal";
import { useWorkspace } from "../../data/workspace";
import { PageIntro, Row, Feedback, Skeleton } from "../../components/UI";
import { useAuth } from "../../data/auth";
import OperationsDesk from "../connected/OperationsDesk";
import LiveFeature from "../connected/LiveFeature";
import {
  MetricStrip,
  ProgressTimeline,
  Queue,
  Requirements,
  WorkspaceNote,
} from "../../components/WorkspaceUI";
const BoardContent = lazy(() => import("../community/CommunityModules"));
const BoardUpdates = lazy(() => import("../community/Community"));

export default function FieldWorkspace() {
  const auth = useAuth();
  const pathname = useLocation().pathname;
  if (
    !auth.preview &&
    !auth.rolePreview &&
    ["/security", "/security/visitors", "/security/gate"].includes(pathname)
  )
    return <OperationsDesk kind="visitor" office />;
  // Security reads vehicle registrations rather than deciding them; the review
  // desk already enforces who may change a status.
  if (
    !auth.preview &&
    !auth.rolePreview &&
    pathname === "/security/vehicles"
  )
    return <LiveFeature module="vehicles" initialView="review" />;
  // Security files incidents and the office reviews them. "mine" shows what
  // this account filed; the review view is gated by the server, not here.
  if (!auth.preview && !auth.rolePreview && pathname === "/security/incidents")
    return <LiveFeature module="incidents" initialView="mine" />;
  if (!auth.preview && !auth.rolePreview && pathname === "/board/reports")
    return <LiveFeature module="board-reports" initialView="published" />;
  if (!auth.preview && !auth.rolePreview && pathname.startsWith("/board/")) {
    if (["/board/documents", "/board/elections"].includes(pathname))
      return (
        <BoardContent
          area={pathname.endsWith("documents") ? "documents" : "elections"}
        />
      );
    if (pathname === "/board/updates" || pathname.startsWith("/board/updates/"))
      return <BoardUpdates basePath="/board/updates" />;
  }
  return <SampleFieldWorkspace />;
}
function SampleFieldWorkspace() {
  const location = useLocation();
  const path = useParams()["*"] ?? "";
  const role = location.pathname.startsWith("/security")
    ? "security"
    : location.pathname.startsWith("/driver")
      ? "driver"
      : "board";
  const portal = usePortal();
  const workspace = useWorkspace();
  if (portal.isPending || workspace.isPending) return <Skeleton />;
  if (portal.error || workspace.error)
    return (
      <>
        <PageIntro
          eyebrow="LOCAL WORKSPACE"
          title="Workspace records are unavailable"
        />
        <Feedback error={portal.error ?? workspace.error} />
        <Link className="text-link" to="/developer">
          Open local recovery tools
          <ArrowRight size={20} />
        </Link>
      </>
    );
  const visitors =
    portal.data?.records.filter(
      (record) => record.kind === "visitor" && record.status !== "Cancelled",
    ) ?? [];
  if (role === "board" && ["documents", "elections"].includes(path))
    return <BoardContent area={path} />;
  if (role === "board" && (path === "updates" || path.startsWith("updates/")))
    return <BoardUpdates basePath="/board/updates" />;
  if (role === "board" && path === "reports")
    return (
      <>
        <PageIntro
          eyebrow="BOARD · REPORTS"
          title="Published reports"
          icon={<ClipboardCheck size={28} />}
          description="Association reports approved for board review."
        />
        <section className="panel">
          <h2>No verified reports connected yet</h2>
          <p>
            Financial totals and private household drill-downs require an
            approved board reporting endpoint. No amounts are shown as zero.
          </p>
        </section>
        <Link className="text-link" to="/board">
          <ArrowRight size={20} />
          Board overview
        </Link>
      </>
    );
  if (role === "security")
    return (
      <>
        <PageIntro
          eyebrow="SECURITY WORKSPACE · SYNTHETIC"
          title={
            path === "incidents"
              ? "Incident desk"
              : path === "vehicles"
                ? "Vehicle review"
                : "Gate & visitor desk"
          }
          description="Preview operations only. No gate device, identity verification or emergency response service is connected."
        />
        {path === "incidents" ? (
          <Queue
            kind="incident"
            title="Sample incidents"
            createLabel="New sample incident"
            allowReview
            description="Non-emergency demonstration. Use verified emergency/security contacts for a real event."
          />
        ) : path === "vehicles" ? (
          <Queue kind="vehicle" title="Vehicle requests" allowReview />
        ) : (
          <>
            <MetricStrip
              items={[
                {
                  label: "Visitor requests",
                  value: portal.isPending
                    ? "Loading"
                    : portal.error
                      ? "Unavailable"
                      : visitors.length,
                  detail: "Local records only",
                },
                {
                  label: "Gate authorization",
                  value: "Unavailable",
                  detail: "No verification service",
                },
                {
                  label: "Entry / exit events",
                  value: "Unavailable",
                  detail: "No device integration",
                },
              ]}
            />
            <section className="panel">
              <h2>Visitor requests in this tab</h2>
              {visitors.length ? (
                visitors.map((item) => (
                  <Row
                    key={item.id}
                    title={item.title}
                    detail={`${item.date} · ${item.status}`}
                    icon={<KeyRound size={20} />}
                  />
                ))
              ) : (
                <p className="note">
                  No local visitors yet. Create a synthetic request from the
                  resident flow.
                </p>
              )}
              <Link className="text-link" to="/services/visitors">
                Open resident visitor requests
                <ArrowRight size={20} />
              </Link>
            </section>
            <WorkspaceNote>
              No request is a valid gate pass. QR generation, entry/exit
              confirmation, expiry validation and overrides stay unavailable
              until approved server and guard workflows exist.
            </WorkspaceNote>
          </>
        )}
      </>
    );
  if (role === "driver")
    return (
      <>
        <PageIntro
          eyebrow="DRIVER WORKSPACE · SYNTHETIC"
          title="Trips & route requests"
          description="A driver-oriented view without access to unrelated resident or financial records."
        />
        <MetricStrip
          items={[
            {
              label: "Sample route interests",
              value: workspace.isPending
                ? "Loading"
                : workspace.error
                  ? "Unavailable"
                  : (workspace.data?.items.filter(
                      (item) => item.kind === "ride",
                    ).length ?? 0),
              detail: "Not confirmed seats",
            },
            {
              label: "Verified driver",
              value: "Unavailable",
              detail: "No verified identity",
            },
            {
              label: "Assigned trips",
              value: "Unavailable",
              detail: "No dispatch system",
            },
          ]}
        />
        <div className="two-column">
          <section className="panel">
            <h2>Bellefort → Bacoor · sample route</h2>
            <ProgressTimeline
              items={[
                { label: "Pickup point", detail: "Not confirmed" },
                { label: "Departure", detail: "Not scheduled" },
                { label: "Destination", detail: "Sample route concept only" },
              ]}
            />
            <Requirements
              items={[
                { label: "Driver / vehicle", state: "Not verified" },
                { label: "Fare / seat policy", state: "Not confirmed" },
                { label: "Trip roster", state: "Unavailable" },
              ]}
            />
          </section>
          <section>
            <Queue
              kind="ride"
              title="Sample ride interests"
              createLabel="Add sample route interest"
            />
          </section>
        </div>
      </>
    );
  return (
    <>
      <PageIntro
        eyebrow="BOARD WORKSPACE · PREVIEW"
        title="Governance & oversight"
        description="Approved oversight powers are still to be defined. This preview does not grant board authority."
      />
      <section className="panel">
        <h2>Board information</h2>
        <Requirements
          items={[
            { label: "Verified financial reports", state: "Not connected" },
            { label: "Official document source", state: "Unavailable" },
            {
              label: "Election rules and eligibility",
              state: "Pending approval",
            },
          ]}
        />
      </section>
      <WorkspaceNote>
        The board role must not automatically reveal confidential complaints,
        individual ballots, personal information or access-administration
        powers. Real oversight needs an approved permission matrix.
      </WorkspaceNote>
    </>
  );
}
