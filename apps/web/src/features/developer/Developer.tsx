import { NavigationGroup } from "../../components/Navigation";
import { useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Braces,
  Download,
  RefreshCw,
} from "lucide-react";
import { usePortal } from "../../data/usePortal";
import { repository } from "../../data/repository";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../../data/workspace";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Row,
} from "../../components/UI";
import {
  MetricStrip,
  ProgressTimeline,
  Requirements,
  WorkspaceNote,
} from "../../components/WorkspaceUI";
import version from "../../../../../package.json";
import SourceCoverage from "./SourceCoverage";
import { useAuth } from "../../data/auth";
import DeveloperConsole from "./DeveloperConsole";
import { RequestVisual } from "../../components/RequestVisual";

export default function Developer() {
  const auth = useAuth();
  const path = useParams()["*"] ?? "";
  return !auth.preview ||
    path === "roles" ||
    path === "members" ||
    path.startsWith("modules") ? (
    <DeveloperConsole />
  ) : (
    <SyntheticDeveloper />
  );
}
function SyntheticDeveloper() {
  const path = useParams()["*"] ?? "";
  const portal = usePortal();
  const workspace = useWorkspace();
  const client = useQueryClient();
  const reset = useWorkspaceAction(workspaceRepository.reset);
  const [confirm, setConfirm] = useState(false);
  const [scope, setScope] = useState("Workspace only");
  const [health, setHealth] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState<Error | null>(null);
  function checkStorage() {
    setFailure(null);
    try {
      const key = `bellefort-health-${crypto.randomUUID()}`;
      sessionStorage.setItem(key, "probe");
      const ok = sessionStorage.getItem(key) === "probe";
      sessionStorage.removeItem(key);
      if (!ok) throw new Error("The storage probe could not be read back.");
      setHealth("Write, read and removal confirmed");
    } catch {
      setHealth("Unavailable");
      setFailure(
        new Error(
          "Session storage failed the local probe. Check browser permissions or storage capacity.",
        ),
      );
    }
  }
  async function resetPreview() {
    setFailure(null);
    try {
      if (scope !== "Resident records only") await reset.mutateAsync(undefined);
      if (scope !== "Workspace only") {
        await repository.reset();
        await client.invalidateQueries({ queryKey: ["preview"] });
      }
      setConfirm(false);
      setMessage(
        `${scope} reset locally. No remote database or production setting was changed.`,
      );
    } catch (error) {
      setFailure(
        error instanceof Error ? error : new Error("Reset was not confirmed."),
      );
    }
  }
  function report() {
    const data = {
      application: "Bellefort local preview",
      version: version.version,
      mode: import.meta.env.MODE,
      generatedAt: new Date().toISOString(),
      backend: "not connected",
      identity: "not connected",
      paymentProvider: "not connected",
      email: "not connected",
      databaseRefusalTests: "not run",
      residentStorage: portal.status,
      workspaceStorage: workspace.status,
      counts: {
        localResidentRecords: portal.data?.records.length ?? null,
        workspaceRecords: workspace.data?.items.length ?? null,
      },
      storageProbe: health ?? "not run",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bellefort-preview-diagnostics.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Diagnostic metadata prepared for download. Names, contacts, record content and environment secrets are excluded.",
    );
  }
  return (
    <>
      <PageIntro
        eyebrow="DEVELOPER WORKSPACE · LOCAL MAINTENANCE"
        title={
          path === "source" ? "Source coverage catalogue" : "Developer settings"
        }
        description="Diagnostics and maintenance for this preview. This route is inspectable, not protected administration."
        action={
          <Button secondary onClick={report}>
            <Download size={20} />
            Download safe diagnostics
          </Button>
        }
      />
      <WorkspaceNote>
        Production maintenance requires a separate server-enforced capability
        and audit. These tools cannot alter infrastructure, grant a role, verify
        a payment, run SQL or reveal credentials.
      </WorkspaceNote>
      <NavigationGroup aria-label="Developer navigation">
        {[
          { path: "", title: "Diagnostics" },
          { path: "scenarios", title: "State lab" },
          { path: "components", title: "Component gallery" },
          { path: "runbook", title: "Maintenance runbook" },
          { path: "source", title: "Source catalogue" },
        ].map((tab) => (
          <NavLink
            end
            key={tab.path}
            to={`/developer${tab.path ? "/" + tab.path : ""}`}
          >
            {tab.title}
          </NavLink>
        ))}
      </NavigationGroup>
      <Feedback error={failure} message={message} />
      {!path && (
        <>
          <RequestVisual />
          <MetricStrip
            items={[
              {
                label: "Version",
                value: version.version,
                detail: import.meta.env.MODE,
              },
              {
                label: "Resident data",
                value: portal.status,
                detail: "Synthetic tab storage",
              },
              {
                label: "Workspace data",
                value: workspace.status,
                detail: "Separate synthetic fixture set",
              },
              {
                label: "Real services",
                value: "Not connected",
                detail: "Auth, database, payment, mail",
              },
            ]}
          />
          <div className="two-column">
            <section className="panel">
              <h2>Local health probe</h2>
              <p className="note">
                This verifies a temporary session-storage write/read/removal. It
                is not an API, RLS or production health check.
              </p>
              <Button secondary onClick={checkStorage}>
                <Activity size={20} />
                Run local storage check
              </Button>
              {health && <Feedback message={`Storage probe: ${health}`} />}
              <Requirements
                items={[
                  { label: "Authentication", state: "Not connected" },
                  { label: "Supabase / RLS", state: "Not connected" },
                  { label: "Email / payment delivery", state: "Not connected" },
                  {
                    label: "Remote CI verification",
                    state: "Not available here",
                  },
                ]}
              />
            </section>
            <section className="panel">
              <h2>Reset synthetic fixtures</h2>
              <p className="note">
                Affects this browser tab only. Use this to recover from damaged
                local data or prepare a clean demonstration.
              </p>
              <label className="control-label" htmlFor="reset-scope">
                Reset scope
              </label>
              <select
                className="standalone-control"
                id="reset-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                {[
                  "Workspace only",
                  "Resident records only",
                  "Both fixture sets",
                ].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <div className="form-actions">
                <Button secondary onClick={() => setConfirm(true)}>
                  <RefreshCw size={20} />
                  Review reset
                </Button>
              </div>
              <p className="note">
                Theme preference and code remain unchanged. Reset is not a
                database backup/restore.
              </p>
            </section>
          </div>
        </>
      )}
      {path === "scenarios" && (
        <>
          <h2>Resident account states</h2>
          <div className="grid-2" style={{ marginTop: 16 }}>
            {[
              { state: "due", title: "Bill due" },
              { state: "overdue", title: "Overdue bill" },
              { state: "paid", title: "Recorded payment" },
              { state: "unbilled", title: "Not yet billed" },
              { state: "loading", title: "Loading skeleton" },
              { state: "error", title: "Load failure" },
            ].map((item) => (
              <Row
                key={item.state}
                title={item.title}
                detail="Synthetic presentation; no account mutation"
                to={`/?state=${item.state}`}
                icon={<Braces size={20} />}
              />
            ))}
          </div>
          <div className="panel" style={{ marginTop: 24 }}>
            <h2>Workflow test entry points</h2>
            <Row
              title="Registration → office review"
              detail="Submit sample details, inspect the same local record"
              to="/register"
            />
            <Row
              title="Resident → office concern"
              detail="Track a request, then review it in the office"
              to="/services/requests"
            />
            <Row
              title="Draft → preview publication"
              detail="Create local content; no external delivery"
              to="/office/announcements"
            />
            <Row
              title="Signed-out preview screen"
              detail="No real identity provider is connected"
              to="/sign-in"
            />
          </div>
        </>
      )}
      {path === "components" && (
        <>
          <div className="two-column">
            <section className="panel">
              <h2>States and feedback</h2>
              <div className="filters" style={{ marginTop: 16 }}>
                <Badge>Unknown</Badge>
                <Badge tone="amber">Needs review</Badge>
                <Badge tone="green">Confirmed locally</Badge>
                <Badge tone="red">Failed</Badge>
              </div>
              <div className="form-actions">
                <Button
                  onClick={() =>
                    setMessage("Button feedback confirmed locally.")
                  }
                >
                  Primary action
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    setMessage("Secondary action feedback confirmed locally.")
                  }
                >
                  Secondary action
                </Button>
                <Button disabled>Unavailable</Button>
              </div>
              <Feedback message="An explicit, named local result." />
            </section>
            <section className="panel">
              <h2>Workflow timeline</h2>
              <ProgressTimeline
                items={[
                  {
                    label: "Sample record saved",
                    detail: "Confirmed in tab storage",
                    done: true,
                  },
                  {
                    label: "Office review",
                    detail: "Backend workflow not connected",
                  },
                  {
                    label: "Real confirmation",
                    detail: "Requires approved server authority",
                  },
                ]}
              />
            </section>
          </div>
          <WorkspaceNote>
            The gallery uses the same owned components and tokens as the
            application. Check keyboard focus, both themes, text size and
            reduced-motion behavior when changing components.
          </WorkspaceNote>
        </>
      )}
      {path === "runbook" && (
        <>
          <div className="grid-2">
            {[
              {
                title: "Before a change",
                steps: [
                  "Read AGENTS.md and the affected vault notes.",
                  "Keep a recoverable source copy; commits need approval.",
                  "Use synthetic records and reproduce the issue.",
                ],
              },
              {
                title: "Verify the change",
                steps: [
                  "Run typecheck, lint and relevant tests.",
                  "Check mobile and compact/wide desktop in both themes.",
                  "Record failures and unverified areas honestly.",
                ],
              },
              {
                title: "Before real release",
                steps: [
                  "Confirm the selected project and permission rules.",
                  "Run actual database refusal and recovery tests.",
                  "Complete resident/device testing and obtain release authorization.",
                ],
              },
              {
                title: "If something breaks",
                steps: [
                  "Identify whether the failure is UI, storage, server or delivery.",
                  "Export metadata-only diagnostics; do not copy credentials.",
                  "Use the approved rollback/restore procedure for the affected environment.",
                ],
              },
            ].map((item) => (
              <section className="panel" key={item.title}>
                <h2>{item.title}</h2>
                <ProgressTimeline
                  items={item.steps.map((label) => ({ label }))}
                />
              </section>
            ))}
          </div>
          <p className="note">
            Detailed commands and future production-maintenance requirements are
            in docs/DEVELOPER-MAINTENANCE.md. The current full dependency audit
            has documented development-only findings; this page does not run an
            audit or claim those findings are fixed.
          </p>
        </>
      )}
      {path === "source" && <SourceCoverage />}
      {!["", "scenarios", "components", "runbook", "source"].includes(path) && (
        <p className="note">Choose a developer section above.</p>
      )}
      {confirm && (
        <Modal
          title="Reset local preview data?"
          description={`${scope}. Local edits in the selected fixture set will be removed.`}
          onClose={() => setConfirm(false)}
        >
          <WorkspaceNote>
            No external service is touched. The original synthetic fixtures are
            restored when the selected data is read again.
          </WorkspaceNote>
          <Feedback error={failure} />
          <div className="form-actions">
            <Button secondary onClick={() => setConfirm(false)}>
              Keep local data
            </Button>
            <Button pending={reset.isPending} onClick={resetPreview}>
              Reset selected preview data
            </Button>
          </div>
        </Modal>
      )}
      <p className="note">
        <Link className="text-link" to="/more/settings">
          Resident preview settings
          <ArrowRight size={18} />
        </Link>
      </p>
    </>
  );
}
