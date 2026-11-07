import { NavigationGroup } from "../../components/Navigation";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import { ArrowRight, ChevronRight, ClipboardCheck, Search } from "lucide-react";
import {
  baselineModule,
  baselineModules,
} from "../../../../../packages/shared/src/baseline";
import { useWorkspace } from "../../data/workspace";
import {
  Badge,
  Empty,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import { MetricStrip, WorkspaceNote } from "../../components/WorkspaceUI";
import { RecordDetail } from "../baseline/FeatureBaseline";
import styles from "./Connected.module.css";
import { useAuth } from "../../data/auth";
import LiveFeatureDirectory from "./LiveFeatureDirectory";

export default function ReviewDesk() {
  const auth = useAuth();
  if (!auth.preview && !auth.rolePreview)
    return <LiveFeatureDirectory initialView="review" />;
  return <SampleReviewDesk />;
}
function SampleReviewDesk() {
  const data = useWorkspace();
  const [query] = useSearchParams();
  const [module, setModule] = useState(() =>
    baselineModules.some((item) => item.id === query.get("module"))
      ? query.get("module")!
      : "All modules",
  );
  const [state, setState] = useState("All states"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  if (data.isPending) return <Skeleton />;
  if (data.error)
    return (
      <>
        <PageIntro eyebrow="OFFICE REVIEW" title="Review records unavailable" />
        <Feedback error={data.error} />
        <Link className="text-link" to="/developer">
          Open recovery tools <ArrowRight size={20} />
        </Link>
      </>
    );
  const all = data.data.items.filter((item) => item.kind === "baseline");
  const rows = all.filter(
    (item) =>
      (module === "All modules" || item.metadata.module === module) &&
      (state === "All states" || item.status === state) &&
      `${item.title} ${item.id} ${Object.values(item.metadata).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = all.find((item) => item.id === selected);
  return (
    <>
      <PageIntro
        eyebrow="OFFICE REVIEW DESK · LOCAL SAMPLES"
        title="Review desk"
        description="Review the same structured records residents prepare. Only supported content can be published into sample directories; financial and access records cannot."
      />
      <NavigationGroup aria-label="Office integration navigation">
        <Link to="/directory">Sample directory</Link>
        <Link to="/office/inbox">Office conversations</Link>
        <Link to="/office/registry">Property proposals</Link>
        <Link to="/coverage">Source coverage</Link>
      </NavigationGroup>
      <MetricStrip
        items={[
          {
            label: "Awaiting local review",
            value: all.filter((item) =>
              ["Submitted locally", "In review"].includes(item.status),
            ).length,
            detail: "Not real approval requests",
          },
          {
            label: "Preview published",
            value: all.filter((item) => item.status === "Preview published")
              .length,
            detail: "Synthetic content only",
          },
          {
            label: "Changes requested",
            value: all.filter((item) => item.status === "Changes requested")
              .length,
            detail: "Editable local drafts",
          },
        ]}
      />
      <div className={styles.toolbar}>
        <div className="search">
          <Search size={20} />
          <input
            aria-label="Search office review records"
            placeholder="Search all structured records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Review module"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        >
          <option>All modules</option>
          {baselineModules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Review state"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          {[
            "All states",
            "Draft",
            "Submitted locally",
            "In review",
            "Changes requested",
            "Preview published",
            "Archived",
            "Cancelled",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <div className={styles.list}>
        {rows.map((item) => (
          <button
            className={styles.row}
            key={item.id}
            onClick={() => setSelected(item.id)}
          >
            <span className={styles.icon}>
              <ClipboardCheck size={24} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>
                {baselineModule(item.metadata.module).title} · {item.id}
              </small>
            </div>
            <Badge>{item.status}</Badge>
            <ChevronRight size={20} />
          </button>
        ))}
      </div>
      {!rows.length && (
        <Empty title="No matching local review items.">
          Prepare a sample draft or change the filters.
        </Empty>
      )}
      <WorkspaceNote>
        This is an inspectable office preview, not a protected staff session.
        Local review and publication cannot approve payments, roles, admissions,
        permits, elections or actual bookings.
      </WorkspaceNote>
      {current && (
        <RecordDetail
          item={current}
          definition={baselineModule(current.metadata.module)}
          allowPublication
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
