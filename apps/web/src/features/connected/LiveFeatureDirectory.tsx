import { useSearchParams } from "react-router-dom";
import LiveFeature from "./LiveFeature";
import styles from "./LiveFeature.module.css";
import { baselineModules } from "../../../../../packages/shared/src/baseline";
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
  const selected =
    choices.find(([id]) => id === params.get("section"))?.[0] ?? choices[0][0];
  const setSelected = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("section", value);
    setParams(next);
  };
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
          <label>
            Section
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {choices.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <LiveFeature key={selected} module={selected} initialView={initialView} />
    </>
  );
}
