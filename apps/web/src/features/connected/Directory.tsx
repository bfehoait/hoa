import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowRight,
  ArrowLeft,
  LayoutGrid,
  BookOpen,
  CalendarDays,
  CarFront,
  FileText,
  Search,
  Store,
  Users,
} from "lucide-react";
import {
  baselineModule,
  relatedModule,
} from "../../../../../packages/shared/src/baseline";
import {
  audienceOptions,
  isPublishedContent,
  matchesAudience,
} from "../../../../../packages/shared/src/integration";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../../data/workspace";
import { downloadCsv } from "../../data/download";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import Sheet from "../../components/Sheet";
import { DetailDisclosure } from "../../components/Navigation";
import { WorkspaceNote } from "../../components/WorkspaceUI";
import styles from "./Connected.module.css";
import { useAuth } from "../../data/auth";
import LiveFeatureDirectory from "./LiveFeatureDirectory";

const sectionModules: Record<string, string[]> = {
  Market: ["businesses", "buy-sell", "jobs", "garage-sales", "booth-events"],
  Learning: ["workshops"],
  Transport: ["carpools"],
  Community: ["publishing", "events"],
  Governance: ["board-records", "election-candidates"],
};
export default function Directory({ section = "All" }: { section?: string }) {
  const location = useLocation();
  const auth = useAuth();
  if (!auth.preview && !auth.rolePreview)
    return (
      <LiveFeatureDirectory
        key={location.pathname}
        section={section}
        initialView={
          new URLSearchParams(location.search).get("view") === "review"
            ? "review"
            : "published"
        }
      />
    );
  return <DirectoryPage key={location.pathname} section={section} />;
}
function DirectoryPage({ section: initial }: { section: string }) {
  const data = useWorkspace();
  const scenario = useWorkspaceAction(
    workspaceRepository.loadIntegrationScenario,
  );
  const [search, setSearch] = useState("");
  const [section, setSection] = useState(initial);
  const [audience, setAudience] = useState("All members");
  const [selected, setSelected] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  if (data.isPending) return <Skeleton />;
  if (data.error)
    return (
      <>
        <PageIntro
          eyebrow="SAMPLE DIRECTORY"
          title="Local directory unavailable"
        />
        <Feedback error={data.error} />
        <Link className="text-link" to="/developer">
          Open recovery tools <ArrowRight size={20} />
        </Link>
      </>
    );
  const published = data.data.items
    .filter(isPublishedContent)
    .filter((item) => matchesAudience(item, audience));
  const rows = published.filter(
    (item) =>
      (section === "All" ||
        sectionModules[section]?.includes(item.metadata.module)) &&
      `${item.title} ${item.detail} ${Object.values(item.metadata).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const item = rows.find((row) => row.id === selected);
  const definition = item ? baselineModule(item.metadata.module) : null;
  const child = item
    ? Object.keys(relatedModule).find(
        (id) => relatedModule[id] === item.metadata.module,
      )
    : undefined;
  const hasScenario = data.data.items.some(
    (item) => item.metadata.scenario === "INTEGRATION-DEMO-V1",
  );
  return (
    <>
      <Link className="text-link back-link" to="/more">
        <ArrowLeft size={20} />
        All features
      </Link>
      <PageIntro
        eyebrow="DISCOVER BELLEFORT"
        title={
          initial === "Market"
            ? "Neighborhood market"
            : initial === "Learning"
              ? "Learning & workshops"
              : initial === "Transport"
                ? "Rides & carpools"
                : "Community directory"
        }
        icon={
          initial === "Transport" ? (
            <CarFront size={28} />
          ) : initial === "Learning" ? (
            <BookOpen size={28} />
          ) : (
            <Store size={28} />
          )
        }
        description="Local finds, shared interests and community activities."
      />
      <div className="search">
        <Search size={20} aria-hidden="true" />
        <input
          aria-label="Search published samples"
          placeholder="Search the directory..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div
        className={styles.directorySections}
        role="group"
        aria-label="Directory section"
      >
        {[
          { name: "All", icon: LayoutGrid },
          { name: "Market", icon: Store },
          { name: "Learning", icon: BookOpen },
          { name: "Transport", icon: CarFront },
          { name: "Community", icon: CalendarDays },
          { name: "Governance", icon: FileText },
        ].map(({ name, icon: Icon }) => (
          <button
            type="button"
            key={name}
            aria-pressed={section === name}
            onClick={() => setSection(name)}
          >
            <Icon size={24} aria-hidden="true" />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <div className="section-title">
        <h2>{section === "All" ? "Explore the directory" : section}</h2>
        <Badge>{rows.length} sample entries</Badge>
      </div>
      <div className={styles.grid}>
        {rows.map((row) => {
          const module = baselineModule(row.metadata.module);
          const Icon =
            module.group === "Learning"
              ? BookOpen
              : module.group === "Transport"
                ? CarFront
                : module.group === "Governance"
                  ? FileText
                  : module.group === "Community"
                    ? CalendarDays
                    : Store;
          return (
            <article className={styles.card} key={row.id}>
              <span className={styles.icon}>
                <Icon size={28} />
              </span>
              <Badge>Preview published · synthetic</Badge>
              <h2>{row.title}</h2>
              <p>{row.detail}</p>
              <dl className={styles.facts}>
                {module.fields.slice(0, 2).map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{row.metadata[field.key] || "Not supplied"}</dd>
                  </div>
                ))}
              </dl>
              <Button
                secondary
                onClick={() => {
                  setSelected(row.id);
                  setExported(false);
                }}
              >
                View sample details <ArrowRight size={20} />
              </Button>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <Empty
          title={
            published.length || search || section !== "All"
              ? "No matching entries"
              : "Your community directory starts here"
          }
          icon={<Store size={32} />}
          action={
            search || section !== "All" ? (
              <Button
                secondary
                onClick={() => {
                  setSearch("");
                  setSection("All");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        >
          {published.length
            ? "Try another category or search."
            : "No listings have been added. Sample entries are available below to explore the layout."}
        </Empty>
      )}
      <div className={styles.directorySamples}>
        <span className={styles.icon}>
          <Store size={24} />
        </span>
        <div>
          <h2>Try sample entries</h2>
          <p>Fictional listings. Existing edits stay intact.</p>
        </div>
        <Button
          secondary
          disabled={hasScenario}
          pending={scenario.isPending}
          onClick={() => scenario.mutate(undefined)}
        >
          {hasScenario
            ? "Synthetic walkthrough loaded"
            : "Load synthetic walkthrough"}
        </Button>
      </div>
      <Feedback error={scenario.error} />
      <DetailDisclosure title="Directory tools">
        <Link className="text-link" to="/explore">
          Manage sample drafts <ArrowRight size={20} />
        </Link>
        <label className={styles.controlLabel} htmlFor="directory-audience">
          Simulated audience
        </label>
        <select
          className="standalone-control"
          id="directory-audience"
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
        >
          {audienceOptions.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <p className="note">
          Changes the sample display only. This does not enforce access.
        </p>
      </DetailDisclosure>
      <WorkspaceNote>
        Listings, candidate profiles and document metadata are synthetic
        demonstrations. No seller, facilitator, driver, nominee, file, place or
        approval is verified. Contact, purchase, nomination and actual
        participation services are not connected.
      </WorkspaceNote>
      {item && definition && (
        <Sheet
          title={item.title}
          description="Synthetic directory entry · not an HOA endorsement"
          onClose={() => setSelected(null)}
        >
          <Badge>{definition.group}</Badge>
          <p className="note">{item.detail}</p>
          <dl className={styles.facts}>
            {definition.fields.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{item.metadata[field.key] || "Not supplied"}</dd>
              </div>
            ))}
          </dl>
          {item.attachments.map((file) => (
            <div className="notice-note" key={file.id}>
              <FileText size={20} />
              <p>
                {file.name} · {file.kind}. Metadata only; no hosted file.
              </p>
            </div>
          ))}
          {child && (
            <Link
              className="text-link"
              to={`/explore/${child}?new=1&parent=${encodeURIComponent(item.id)}`}
            >
              <Users size={20} />
              Prepare local{" "}
              {child === "participation"
                ? "learning interest"
                : child === "carpool-interests"
                  ? "seat interest"
                  : child === "election-candidates"
                    ? "candidate proposal"
                    : "vendor application"}
              <ArrowRight size={20} />
            </Link>
          )}
          <div className="form-actions">
            <Button
              secondary
              onClick={() => {
                downloadCsv("SAMPLE-directory-metadata.csv", [
                  ["SYNTHETIC METADATA — NOT AN OFFICIAL FILE"],
                  ["Title", item.title],
                  ["Reference", item.id],
                  ...definition.fields.map((field) => [
                    field.label,
                    item.metadata[field.key] ?? "",
                  ]),
                ]);
                setExported(true);
              }}
            >
              Export sample metadata
            </Button>
            <Button onClick={() => setSelected(null)}>Close sample</Button>
          </div>
          <Feedback
            message={
              exported
                ? "Synthetic metadata CSV prepared. No protected source file was downloaded."
                : undefined
            }
          />
        </Sheet>
      )}
    </>
  );
}
