import { NavigationGroup } from "../../components/Navigation";
import { useState } from "react";
import { Link } from "../../components/AccessLink";
import {
  ArrowRight,
  Building2,
  CarFront,
  ChevronRight,
  KeyRound,
  Search,
  Users,
} from "lucide-react";
import {
  baselineModule,
  tripSteps,
} from "../../../../../packages/shared/src/baseline";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../../data/workspace";
import { householdLedger } from "../../data/fixtures";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Field,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import {
  MetricStrip,
  ProgressTimeline,
  WorkspaceNote,
} from "../../components/WorkspaceUI";
import { RecordDetail } from "../baseline/FeatureBaseline";
import styles from "./Connected.module.css";
import { useAuth } from "../../data/auth";
import OperationsDesk from "./OperationsDesk";

export default function FlowDesk({
  area,
}: {
  area: "registry" | "dispatch" | "gate";
}) {
  const auth = useAuth();
  if (!auth.preview && !auth.rolePreview && area === "gate")
    return <OperationsDesk kind="visitor" office />;
  return <SampleFlowDesk area={area} />;
}
function SampleFlowDesk({ area }: { area: "registry" | "dispatch" | "gate" }) {
  const data = useWorkspace();
  const simulate = useWorkspaceAction(workspaceRepository.simulate),
    gate = useWorkspaceAction(workspaceRepository.gateSimulation),
    pair = useWorkspaceAction(workspaceRepository.assignSampleTrip);
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [driver, setDriver] = useState("Demo driver A"),
    [vehicle, setVehicle] = useState("Demo vehicle 1");
  if (data.isPending) return <Skeleton />;
  if (data.error)
    return (
      <>
        <PageIntro eyebrow="LOCAL OPERATIONS" title="Records unavailable" />
        <Feedback error={data.error} />
        <Link className="text-link" to="/developer">
          Open recovery tools <ArrowRight size={20} />
        </Link>
      </>
    );
  const modules =
    area === "registry"
      ? ["unit-register", "household-changes"]
      : area === "dispatch"
        ? ["ride-requests", "stations", "carpools", "carpool-interests"]
        : ["walk-ins", "gate-passes", "guard-roster"];
  const rows = data.data.items.filter(
    (item) =>
      item.kind === "baseline" &&
      modules.includes(item.metadata.module) &&
      `${item.title} ${Object.values(item.metadata).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = rows.find((item) => item.id === selected);
  const title =
    area === "registry"
      ? "Properties, people and proposed changes"
      : area === "dispatch"
        ? "The sample dispatch desk"
        : "Visitor enquiries & gate-event simulation";
  const Icon =
    area === "registry" ? Building2 : area === "dispatch" ? CarFront : KeyRound;
  return (
    <>
      <PageIntro
        eyebrow={`${area.toUpperCase()} · SYNTHETIC OPERATIONS`}
        title={title}
        description="Inspect connected local records and their history. Real identity, operational authority and confirmations remain unavailable."
      />
      <NavigationGroup aria-label="Operational workflow navigation">
        {modules.map((id) => (
          <Link key={id} to={`/explore/${id}`}>
            {baselineModule(id).title}
          </Link>
        ))}
        <Link to="/office/review">Review desk</Link>
        <Link to="/coverage">Coverage & gates</Link>
      </NavigationGroup>
      <MetricStrip
        items={[
          {
            label: "Matching sample records",
            value: rows.length,
            detail: "Local proposals, not verified records",
          },
          {
            label: "Active local records",
            value: rows.filter(
              (row) => !["Cancelled", "Archived"].includes(row.status),
            ).length,
            detail: "Status does not grant authority",
          },
          {
            label: "Real confirmation",
            value: "Unavailable",
            detail: "No backend or operational device",
          },
        ]}
      />
      {area === "registry" && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h2>Existing synthetic ledger units</h2>
          <p className="note">
            These fixed sample units remain separate from imported registry
            drafts. No ownership or membership is changed by a proposal.
          </p>
          <div className={styles.grid}>
            {householdLedger.map((row) => (
              <div key={row.unit} className={styles.card}>
                <Building2 size={24} />
                <strong>{row.unit}</strong>
                <Badge>Unverified sample unit</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="search">
        <Search size={20} />
        <input
          aria-label="Search connected operations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find unit, route, visitor, post or reference…"
        />
      </div>
      <div className={styles.list}>
        {rows.map((row) => (
          <button
            className={styles.row}
            key={row.id}
            onClick={() => {
              setSelected(row.id);
              simulate.reset();
              gate.reset();
              pair.reset();
            }}
          >
            <span className={styles.icon}>
              <Icon size={24} />
            </span>
            <div>
              <strong>{row.title}</strong>
              <small>
                {baselineModule(row.metadata.module).title} ·{" "}
                {row.metadata.tripStep ??
                  row.metadata.gateSimulation ??
                  row.status}
              </small>
              <small>
                {row.metadata.unit ??
                  row.metadata.pickup ??
                  row.metadata.post ??
                  row.metadata.party ??
                  row.id}
              </small>
            </div>
            <Badge>{row.status}</Badge>
            <ChevronRight size={20} />
          </button>
        ))}
      </div>
      {!rows.length && (
        <Empty title="No matching local operations yet.">
          Prepare a structured sample or load the synthetic walkthrough from the
          directory.
        </Empty>
      )}
      <WorkspaceNote>
        {area === "gate"
          ? "The simulation never opens a gate, creates a valid pass/QR or records an authoritative entry/exit. Host verification, expiry, guard permissions and emergency handling require an approved server workflow."
          : area === "dispatch"
            ? "Pairings and trip steps are synthetic. No driver or vehicle is verified, no seat is reserved and no dispatcher receives a real request."
            : "Property and household changes remain proposals. Ownership evidence, membership transfers and resulting access changes require protected server transactions."}
      </WorkspaceNote>
      {current &&
        (area === "registry" ||
          !["ride-requests", "walk-ins", "gate-passes"].includes(
            current.metadata.module,
          )) && (
          <RecordDetail
            item={current}
            definition={baselineModule(current.metadata.module)}
            onClose={() => setSelected(null)}
          />
        )}{" "}
      {current &&
        area !== "registry" &&
        ["ride-requests", "walk-ins", "gate-passes"].includes(
          current.metadata.module,
        ) && (
          <Modal
            title={current.title}
            description="Synthetic operations simulation · no real authority"
            onClose={() => setSelected(null)}
          >
            <Badge>{current.status}</Badge>
            <dl className={styles.facts}>
              {baselineModule(current.metadata.module).fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{current.metadata[field.key] || "Not supplied"}</dd>
                </div>
              ))}
            </dl>
            {area === "dispatch" ? (
              <>
                <div className="notice-note">
                  <Users size={20} />
                  <p>
                    Sample pairing: {current.metadata.sampleDriver ?? "None"} /{" "}
                    {current.metadata.sampleVehicle ?? "None"}. No real driver
                    assignment.
                  </p>
                </div>
                <Field label="Synthetic driver">
                  <select
                    id="sample-driver"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                  >
                    <option>Demo driver A</option>
                    <option>Demo driver B</option>
                  </select>
                </Field>
                <Field label="Synthetic vehicle">
                  <select
                    id="sample-vehicle"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  >
                    <option>Demo vehicle 1</option>
                    <option>Demo vehicle 2</option>
                  </select>
                </Field>
                <Button
                  secondary
                  disabled={
                    ["Archived", "Cancelled"].includes(current.status) ||
                    current.metadata.tripStep === tripSteps.at(-1)
                  }
                  pending={pair.isPending}
                  onClick={() =>
                    pair.mutate({ id: current.id, driver, vehicle })
                  }
                >
                  Record sample dispatch pairing
                </Button>
                <ProgressTimeline
                  items={tripSteps.map((step, index) => ({
                    label: step,
                    done:
                      index <=
                      tripSteps.findIndex(
                        (value) =>
                          value === (current.metadata.tripStep ?? tripSteps[0]),
                      ),
                  }))}
                />
                <Button
                  secondary
                  disabled={
                    ["Archived", "Cancelled"].includes(current.status) ||
                    current.metadata.tripStep === tripSteps.at(-1)
                  }
                  pending={simulate.isPending}
                  onClick={() =>
                    simulate.mutate({ id: current.id, action: "trip" })
                  }
                >
                  Simulate next trip step
                </Button>
              </>
            ) : (
              <>
                <ProgressTimeline
                  items={[
                    {
                      label: "Sample arrival",
                      done: !!current.metadata.gateSimulation,
                    },
                    {
                      label: "Sample departure",
                      done:
                        current.metadata.gateSimulation === "Sample departure",
                    },
                  ]}
                />
                <Button
                  secondary
                  disabled={
                    ["Archived", "Cancelled"].includes(current.status) ||
                    current.metadata.gateSimulation === "Sample departure"
                  }
                  pending={gate.isPending}
                  onClick={() => gate.mutate({ id: current.id })}
                >
                  Simulate next gate event
                </Button>
              </>
            )}
            <h2 style={{ marginTop: 24 }}>Local history</h2>
            <ProgressTimeline
              items={current.events.map((event) => ({
                label: event.label,
                done: true,
              }))}
            />
            <Feedback
              error={simulate.error ?? gate.error ?? pair.error}
              message={
                simulate.isSuccess || gate.isSuccess || pair.isSuccess
                  ? "Local simulation updated. No real authorization or notification occurred."
                  : undefined
              }
            />
            <Button secondary onClick={() => setSelected(null)}>
              Close simulation
            </Button>
          </Modal>
        )}
    </>
  );
}
