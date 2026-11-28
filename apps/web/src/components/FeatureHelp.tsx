import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleHelp } from "lucide-react";
import {
  featureGuideForPath,
  featureGuides,
  type FeatureGuide,
} from "../../../../packages/shared/src/feature-help";
import Sheet from "./Sheet";
import { Button } from "./UI";
import styles from "./FeatureHelp.module.css";

function Guide({ guide }: { guide: FeatureGuide }) {
  return (
    <div className={styles.guide}>
      <p>{guide.purpose}</p>
      <ol>
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/** A help button only: no requests, permission changes or navigation. */
export default function FeatureHelp() {
  const { pathname } = useLocation();
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const guide = featureGuideForPath(pathname);
  const close = () => setOpenedPath(null);
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={`Help: ${guide.title}`}
        title="How this works"
        onClick={() => setOpenedPath(pathname)}
      >
        <CircleHelp size={20} aria-hidden="true" />
      </button>
      {openedPath === pathname && (
        <Sheet
          title={`How this works: ${guide.title}`}
          onClose={close}
          size="md"
          footer={
            <Button secondary onClick={close}>
              Close
            </Button>
          }
        >
          <Guide guide={guide} />
        </Sheet>
      )}
    </>
  );
}

/** Same wording as contextual help, available from the existing Help page. */
export function FeatureHelpLibrary() {
  const [search, setSearch] = useState("");
  const visible = featureGuides.filter((guide) =>
    `${guide.title} ${guide.purpose} ${guide.steps.join(" ")}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <section className={styles.library} aria-label="Feature guides">
      <label className={styles.search}>
        Find help
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="For example: permissions or booking"
        />
      </label>
      <p className={styles.note}>
        Open a topic for the steps. Your role and permissions decide which
        actions you can use.
      </p>
      {visible.length ? (
        visible.map((guide) => (
          <details key={guide.id} className={styles.topic}>
            <summary>{guide.title}</summary>
            <Guide guide={guide} />
          </details>
        ))
      ) : (
        <p role="status">No matching guide. Try a different word.</p>
      )}
    </section>
  );
}
