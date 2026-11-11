import { Navigate, useSearchParams } from "react-router-dom";
import LiveFeature from "./LiveFeature";
import Marketplace from "./Marketplace";
import CarpoolHub from "../transport/CarpoolHub";
import styles from "./LiveFeature.module.css";
import { baselineModules } from "../../../../../packages/shared/src/baseline";
import { featureReviewCapabilities } from "../../../../../packages/shared/src/office-review";
import {
  Store,
  ShoppingBag,
  Briefcase,
  CalendarDays,
  Flag,
  GraduationCap,
  Layers,
  type LucideIcon,
} from "lucide-react";
const sectionIcons: Record<string, LucideIcon> = {
  businesses: Store,
  "buy-sell": ShoppingBag,
  jobs: Briefcase,
  "garage-sales": CalendarDays,
  "booth-events": Flag,
  workshops: GraduationCap,
};
const reviewAreas: Record<string, string> = {
  property: "Property & permits",
  security: "Security & passes",
  livelihood: "Livelihood & activities",
  transport: "Transport",
  requests: "Helpdesk & requests",
  documents: "Documents & governance",
  community: "Community & publishing",
  finance: "Finance",
  operations: "Operations & access",
};
const groups: Record<string, Array<[string, string]>> = {
  Market: [
    ["businesses", "Business directory"],
    ["buy-sell", "Buy, sell & services"],
    ["jobs", "Jobs & referrals"],
    ["garage-sales", "Garage sales"],
    ["booth-events", "Booth events"],
    ["workshops", "Training & workshops"],
  ],
  Learning: [["workshops", "Training & workshops"]],
  Transport: [["carpools", "Private carpools"]],
  Community: [
    ["publishing", "Announcements"],
    ["events", "Events"],
  ],
  Governance: [
    ["board-records", "Board records"],
    ["election-candidates", "Candidate information"],
  ],
};
export default function LiveFeatureDirectory({
  section = "All",
  initialView = "published",
}: {
  section?: string;
  initialView?: string;
}) {
  const choices =
    initialView === "review" && section === "All"
      ? baselineModules.map((m) => [m.id, m.title])
      : (groups[section] ?? Object.values(groups).flat());
  const [params, setParams] = useSearchParams();
  const groupedReview = initialView === "review" && section === "All";
  const groupFor = (id: string) =>
    (groupedReview
      ? reviewAreas[
          featureReviewCapabilities[
            id as keyof typeof featureReviewCapabilities
          ]
        ]
      : undefined) ??
    baselineModules.find((m) => m.id === id)?.group ??
    "Other";
  const areaNames = [...new Set(choices.map(([id]) => groupFor(id)))].sort();
  const area =
    groupedReview && areaNames.includes(params.get("area") ?? "")
      ? params.get("area")!
      : "";
  const availableChoices = choices.filter(
    ([id]) => !area || groupFor(id) === area,
  );
  const selected =
    availableChoices.find(
      ([id]) =>
        id ===
        (params.get("section") ??
          (initialView === "review" ? params.get("module") : null)),
    )?.[0] ?? availableChoices[0][0];
  const setSelected = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("section", value);
    setParams(next);
  };
  if (section === "Learning" && initialView === "published") {
    const next = new URLSearchParams(params);
    if (!next.has("section")) next.set("section", "workshops");
    return <Navigate replace to={`/directory/market?${next}`} />;
  }
  if (section === "Market" && initialView === "published")
    return <Marketplace />;
  if (section === "Transport" && initialView === "published")
    return <CarpoolHub />;
  return (
    <>
      {choices.length <= 8 && (
        <div
          className={styles.sections}
          role="group"
          aria-label="Choose a section"
        >
          {choices.map(([id, label]) => {
            const Icon = sectionIcons[id] ?? Layers;
            return (
              <button
                type="button"
                key={id}
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
      {choices.length > 8 && (
        <div className={styles.toolbar}>
          {groupedReview && (
            <label>
              Area
              <select
                value={area}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set("area", e.target.value);
                  else next.delete("area");
                  const first = choices.find(
                    ([id]) =>
                      !e.target.value || groupFor(id) === e.target.value,
                  );
                  if (first) next.set("section", first[0]);
                  setParams(next);
                }}
              >
                <option value="">All areas</option>
                {areaNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            {groupedReview ? "Workflow" : "Section"}
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {groupedReview
                ? areaNames
                    .filter((name) => !area || name === area)
                    .map((name) => (
                      <optgroup key={name} label={name}>
                        {availableChoices
                          .filter(([id]) => groupFor(id) === name)
                          .map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                      </optgroup>
                    ))
                : choices.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
            </select>
          </label>
        </div>
      )}
      {groupedReview && (
        <p className={styles.formHelp}>
          Area narrows the workflow list. Choose a workflow to review its
          submissions; each decision records the outcome available for that
          service.
        </p>
      )}
      <LiveFeature
        key={selected}
        module={selected}
        initialView={initialView}
        resident={initialView !== "review"}
      />
    </>
  );
}
